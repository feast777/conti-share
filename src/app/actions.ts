"use server";

import { revalidatePath, unstable_cache } from "next/cache";
import { redirect } from "next/navigation";
import { checkTeamPassword, createSession, destroySession, requireSession } from "@/lib/auth";
import { SHEET_BUCKET, db } from "@/lib/db";
import { getConti } from "@/lib/queries";
import type { SheetKind, SheetLayout, Stroke, YoutubeHit } from "@/lib/types";

// ─────────────────────────────────────────────
// 로그인
// ─────────────────────────────────────────────
export async function login(_prev: string | null, formData: FormData): Promise<string | null> {
  const name = String(formData.get("name") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!name) return "이름을 입력해 주세요.";
  if (!checkTeamPassword(password)) return "팀 비밀번호가 맞지 않습니다.";

  await createSession(name);
  redirect("/");
}

export async function logout() {
  await destroySession();
  redirect("/login");
}

// ─────────────────────────────────────────────
// 콘티
// ─────────────────────────────────────────────
export async function createConti(formData: FormData) {
  const session = await requireSession();
  const title = String(formData.get("title") ?? "").trim();
  const serviceDate = String(formData.get("service_date") ?? "");
  const folderId = (String(formData.get("folder_id") ?? "") || null) as string | null;

  const { data, error } = await db
    .from("conti")
    .insert({
      title: title || "새 콘티",
      service_date: serviceDate || new Date().toISOString().slice(0, 10),
      created_by: session.name,
      folder_id: folderId,
    })
    .select("id")
    .single();

  if (error) throw error;
  revalidatePath("/");
  if (folderId) revalidatePath(`/folder/${folderId}`);
  redirect(`/conti/${data.id}/edit`);
}

export async function updateConti(id: string, patch: { title?: string; service_date?: string; note?: string }) {
  await requireSession();
  const { error } = await db
    .from("conti")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
  revalidatePath(`/conti/${id}`);
  revalidatePath("/");
}

export async function deleteConti(id: string) {
  await requireSession();

  // 스토리지에 올라간 악보 파일까지 같이 지운다 (DB 는 cascade)
  const { data: songs } = await db.from("song").select("id").eq("conti_id", id);
  const songIds = (songs ?? []).map((s) => s.id as string);
  if (songIds.length) {
    const { data: sheets } = await db.from("sheet").select("storage_path").in("song_id", songIds);
    const paths = (sheets ?? []).map((s) => s.storage_path as string);
    if (paths.length) await db.storage.from(SHEET_BUCKET).remove(paths);
  }

  const { error } = await db.from("conti").delete().eq("id", id);
  if (error) throw error;
  revalidatePath("/");
  redirect("/");
}

/** 지난 콘티를 통째로 복사한다 (악보 파일은 그대로 재사용). */
export async function duplicateConti(id: string) {
  const session = await requireSession();

  const { data: src } = await db.from("conti").select("*").eq("id", id).single();
  if (!src) throw new Error("콘티를 찾을 수 없습니다.");

  const { data: newConti, error } = await db
    .from("conti")
    .insert({
      title: `${src.title} (복사)`,
      service_date: new Date().toISOString().slice(0, 10),
      note: src.note,
      created_by: session.name,
      folder_id: src.folder_id, // 같은 폴더 안에 복사본을 둔다
    })
    .select("id")
    .single();
  if (error) throw error;

  const { data: songs } = await db.from("song").select("*").eq("conti_id", id).order("order_index");

  for (const song of songs ?? []) {
    const { data: newSong } = await db
      .from("song")
      .insert({
        conti_id: newConti.id,
        order_index: song.order_index,
        title: song.title,
        song_key: song.song_key,
        bpm: song.bpm,
        memo: song.memo,
        lyrics: song.lyrics,
        sheet_layout: song.sheet_layout,
      })
      .select("id")
      .single();
    if (!newSong) continue;

    const [{ data: sheets }, { data: refs }] = await Promise.all([
      db.from("sheet").select("*").eq("song_id", song.id).order("order_index"),
      db.from("reference").select("*").eq("song_id", song.id).order("order_index"),
    ]);

    if (sheets?.length) {
      await db.from("sheet").insert(
        sheets.map((s) => ({
          song_id: newSong.id,
          order_index: s.order_index,
          storage_path: s.storage_path, // 파일은 공유해서 쓴다
          file_name: s.file_name,
          kind: s.kind,
          page_count: s.page_count,
        }))
      );
    }
    if (refs?.length) {
      await db.from("reference").insert(
        refs.map((r) => ({
          song_id: newSong.id,
          order_index: r.order_index,
          url: r.url,
          label: r.label,
        }))
      );
    }
  }

  revalidatePath("/");
  redirect(`/conti/${newConti.id}/edit`);
}

// ─────────────────────────────────────────────
// 폴더
// ─────────────────────────────────────────────
export async function createFolder(name: string, parentId: string | null = null) {
  const session = await requireSession();
  const clean = name.trim();
  if (!clean) return;
  // 같은 위치의 폴더 개수를 순서값으로 (맨 뒤에 추가)
  const q = db.from("folder").select("id", { count: "exact", head: true });
  const { count } = await (parentId ? q.eq("parent_id", parentId) : q.is("parent_id", null));
  const { error } = await db
    .from("folder")
    .insert({ name: clean, parent_id: parentId, order_index: count ?? 0, created_by: session.name });
  if (error) throw error;
  revalidatePath("/");
  if (parentId) revalidatePath(`/folder/${parentId}`);
}

/** 같은 위치의 폴더들 순서를 다시 매긴다. */
export async function reorderFolders(parentId: string | null, orderedIds: string[]) {
  await requireSession();
  await Promise.all(
    orderedIds.map((id, i) => db.from("folder").update({ order_index: i }).eq("id", id))
  );
  revalidatePath("/");
  if (parentId) revalidatePath(`/folder/${parentId}`);
}

/** 폴더를 다른 폴더(또는 최상위)로 옮긴다. 자기 자신·자기 하위로는 못 옮긴다(사이클 방지). */
export async function moveFolder(folderId: string, parentId: string | null) {
  await requireSession();
  if (folderId === parentId) return;

  // parentId 의 조상들을 거슬러 올라가며 folderId 가 나오면 사이클 → 거부
  let cur: string | null = parentId;
  const seen = new Set<string>();
  while (cur) {
    if (cur === folderId) return;
    if (seen.has(cur)) break;
    seen.add(cur);
    const { data } = await db.from("folder").select("parent_id").eq("id", cur).maybeSingle();
    cur = (data?.parent_id as string | null) ?? null;
  }

  const { error } = await db.from("folder").update({ parent_id: parentId }).eq("id", folderId);
  if (error) throw error;
  revalidatePath("/");
  revalidatePath(`/folder/${folderId}`);
  if (parentId) revalidatePath(`/folder/${parentId}`);
}

export async function renameFolder(id: string, name: string) {
  await requireSession();
  const clean = name.trim();
  if (!clean) return;
  const { error } = await db.from("folder").update({ name: clean }).eq("id", id);
  if (error) throw error;
  revalidatePath("/");
  revalidatePath(`/folder/${id}`);
}

export async function deleteFolder(id: string) {
  await requireSession();
  // 이 폴더의 상위를 알아내, 하위 폴더·콘티를 한 단계 위로 올린다 (콘티는 지워지지 않는다)
  const { data: f } = await db.from("folder").select("parent_id").eq("id", id).maybeSingle();
  const parent = (f?.parent_id as string | null) ?? null;

  await db.from("folder").update({ parent_id: parent }).eq("parent_id", id);
  await db.from("conti").update({ folder_id: parent }).eq("folder_id", id);

  const { error } = await db.from("folder").delete().eq("id", id);
  if (error) throw error;

  revalidatePath("/");
  if (parent) {
    revalidatePath(`/folder/${parent}`);
    redirect(`/folder/${parent}`);
  }
  redirect("/");
}

/** 콘티를 폴더로 옮긴다. folderId 가 null 이면 폴더 밖으로 뺀다. */
export async function moveConti(contiId: string, folderId: string | null) {
  await requireSession();
  const { error } = await db.from("conti").update({ folder_id: folderId }).eq("id", contiId);
  if (error) throw error;
  revalidatePath("/");
  if (folderId) revalidatePath(`/folder/${folderId}`);
}

// ─────────────────────────────────────────────
// 곡
// ─────────────────────────────────────────────
export async function addSong(contiId: string, title: string) {
  await requireSession();
  const { count } = await db
    .from("song")
    .select("id", { count: "exact", head: true })
    .eq("conti_id", contiId);

  const { error } = await db
    .from("song")
    .insert({ conti_id: contiId, title: title.trim() || "제목 없음", order_index: count ?? 0 });
  if (error) throw error;
  revalidatePath(`/conti/${contiId}/edit`);
  revalidatePath(`/conti/${contiId}`);
}

export async function updateSong(
  songId: string,
  contiId: string,
  patch: {
    title?: string;
    song_key?: string;
    bpm?: string;
    memo?: string;
    lyrics?: string;
    sheet_layout?: SheetLayout;
  }
) {
  await requireSession();
  const { error } = await db.from("song").update(patch).eq("id", songId);
  if (error) throw error;
  revalidatePath(`/conti/${contiId}/edit`);
  revalidatePath(`/conti/${contiId}`);
}

export async function deleteSong(songId: string, contiId: string) {
  await requireSession();
  const { data: sheets } = await db.from("sheet").select("storage_path").eq("song_id", songId);
  const paths = (sheets ?? []).map((s) => s.storage_path as string);
  if (paths.length) await db.storage.from(SHEET_BUCKET).remove(paths);

  const { error } = await db.from("song").delete().eq("id", songId);
  if (error) throw error;
  revalidatePath(`/conti/${contiId}/edit`);
  revalidatePath(`/conti/${contiId}`);
}

/** 곡 순서를 통째로 다시 매긴다. */
export async function reorderSongs(contiId: string, orderedIds: string[]) {
  await requireSession();
  await Promise.all(
    orderedIds.map((id, i) => db.from("song").update({ order_index: i }).eq("id", id))
  );
  revalidatePath(`/conti/${contiId}/edit`);
  revalidatePath(`/conti/${contiId}`);
}

// ─────────────────────────────────────────────
// 레퍼런스 (유튜브)
// ─────────────────────────────────────────────
export async function addReference(songId: string, contiId: string, url: string, label: string) {
  await requireSession();
  const clean = url.trim();
  if (!clean) return;

  const { count } = await db
    .from("reference")
    .select("id", { count: "exact", head: true })
    .eq("song_id", songId);

  const { error } = await db
    .from("reference")
    .insert({ song_id: songId, url: clean, label: label.trim(), order_index: count ?? 0 });
  if (error) throw error;
  revalidatePath(`/conti/${contiId}/edit`);
  revalidatePath(`/conti/${contiId}`);
}

export async function deleteReference(refId: string, contiId: string) {
  await requireSession();
  const { error } = await db.from("reference").delete().eq("id", refId);
  if (error) throw error;
  revalidatePath(`/conti/${contiId}/edit`);
  revalidatePath(`/conti/${contiId}`);
}

// ─────────────────────────────────────────────
// 악보 업로드
// ─────────────────────────────────────────────
/** 브라우저가 파일을 스토리지로 직접 올릴 수 있는 1회용 URL 을 발급한다. */
export async function createSheetUploadUrl(songId: string, fileName: string) {
  await requireSession();
  const ext = fileName.split(".").pop()?.toLowerCase() ?? "bin";
  const path = `${songId}/${crypto.randomUUID()}.${ext}`;

  const { data, error } = await db.storage.from(SHEET_BUCKET).createSignedUploadUrl(path);
  if (error) throw error;
  return { uploadUrl: data.signedUrl, path: data.path };
}

export async function registerSheet(args: {
  songId: string;
  contiId: string;
  path: string;
  fileName: string;
  kind: SheetKind;
  pageCount: number;
}) {
  await requireSession();
  const { count } = await db
    .from("sheet")
    .select("id", { count: "exact", head: true })
    .eq("song_id", args.songId);

  const { error } = await db.from("sheet").insert({
    song_id: args.songId,
    order_index: count ?? 0,
    storage_path: args.path,
    file_name: args.fileName,
    kind: args.kind,
    page_count: args.pageCount,
  });
  if (error) throw error;
  revalidatePath(`/conti/${args.contiId}/edit`);
  revalidatePath(`/conti/${args.contiId}`);
}

export async function deleteSheet(sheetId: string, contiId: string) {
  await requireSession();
  const { data: sheet } = await db
    .from("sheet")
    .select("storage_path")
    .eq("id", sheetId)
    .maybeSingle();

  const { error } = await db.from("sheet").delete().eq("id", sheetId);
  if (error) throw error;

  // 다른 콘티가 같은 파일을 참조 중이면 (콘티 복사) 파일은 남겨둔다
  if (sheet) {
    const { count } = await db
      .from("sheet")
      .select("id", { count: "exact", head: true })
      .eq("storage_path", sheet.storage_path);
    if (!count) await db.storage.from(SHEET_BUCKET).remove([sheet.storage_path]);
  }

  revalidatePath(`/conti/${contiId}/edit`);
  revalidatePath(`/conti/${contiId}`);
}

/** 곡 안의 악보 순서를 다시 매긴다. (상하·좌우·바둑판 배치 순서에 반영된다) */
export async function reorderSheets(songId: string, contiId: string, orderedIds: string[]) {
  await requireSession();
  await Promise.all(
    orderedIds.map((id, i) => db.from("sheet").update({ order_index: i }).eq("id", id))
  );
  revalidatePath(`/conti/${contiId}/edit`);
  revalidatePath(`/conti/${contiId}`);
}

// ─────────────────────────────────────────────
// 콘티 PDF 저장용 — 악보 목록(열람 URL 포함) 넘겨주기
// ─────────────────────────────────────────────
/** 콘티의 모든 악보를 곡·악보 순서대로, 브라우저에서 받을 수 있는 임시 URL 과 함께 준다. */
export async function listContiSheets(contiId: string): Promise<{
  title: string;
  sheets: { url: string; kind: SheetKind; fileName: string }[];
}> {
  await requireSession();
  const conti = await getConti(contiId);
  if (!conti) return { title: "콘티", sheets: [] };

  const sheets = conti.songs
    .flatMap((song) => song.sheets)
    .filter((s) => s.url)
    .map((s) => ({ url: s.url as string, kind: s.kind, fileName: s.file_name }));

  return { title: conti.title, sheets };
}

// ─────────────────────────────────────────────
// 유튜브 검색 (곡 제목 + 악기 로 앱 안에서 영상 찾기)
// ─────────────────────────────────────────────
/**
 * 유튜브 검색 결과 페이지를 서버에서 받아 맨 위 영상 ID 를 뽑는다.
 * API 키 없이 동작하고, 같은 검색어는 하루 동안 캐시한다.
 */
const searchYoutubeCached = unstable_cache(
  async (query: string): Promise<string | null> => {
    const url =
      "https://www.youtube.com/results?search_query=" +
      encodeURIComponent(query) +
      "&sp=EgIQAQ%253D%253D"; // 동영상만 필터
    try {
      const res = await fetch(url, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
          "Accept-Language": "ko-KR,ko;q=0.9,en;q=0.8",
          Cookie: "SOCS=CAI; CONSENT=YES+1",
        },
      });
      if (!res.ok) return null;
      const html = await res.text();
      const m = html.match(/"videoId":"([\w-]{11})"/);
      return m?.[1] ?? null;
    } catch {
      return null;
    }
  },
  ["yt-search"],
  { revalidate: 60 * 60 * 24 }
);

export async function searchYoutube(query: string): Promise<string | null> {
  await requireSession();
  const q = query.trim();
  if (!q) return null;
  return searchYoutubeCached(q);
}

/** 검색 결과 상위 5개(영상 ID + 제목)를 뽑는다 — 사용자가 골라서 재생할 수 있게. */
const searchYoutubeManyCached = unstable_cache(
  async (query: string): Promise<YoutubeHit[]> => {
    const url =
      "https://www.youtube.com/results?search_query=" +
      encodeURIComponent(query) +
      "&sp=EgIQAQ%253D%253D"; // 동영상만
    try {
      const res = await fetch(url, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
          "Accept-Language": "ko-KR,ko;q=0.9,en;q=0.8",
          Cookie: "SOCS=CAI; CONSENT=YES+1",
        },
      });
      if (!res.ok) return [];
      const html = await res.text();
      const hits: YoutubeHit[] = [];
      const seen = new Set<string>();
      // videoId 뒤에 나오는 첫 제목 텍스트를 함께 잡는다 (다음 videoId 전까지만)
      const re = /"videoId":"([\w-]{11})"(?:(?!"videoId")[\s\S]){0,600}?"text":"((?:\\.|[^"\\])*)"/g;
      let m: RegExpExecArray | null;
      while ((m = re.exec(html)) && hits.length < 5) {
        const id = m[1];
        if (seen.has(id)) continue;
        seen.add(id);
        let title = m[2];
        try {
          title = JSON.parse('"' + m[2] + '"');
        } catch {
          /* 디코드 실패하면 원문 유지 */
        }
        hits.push({ id, title });
      }
      return hits;
    } catch {
      return [];
    }
  },
  ["yt-search-many"],
  { revalidate: 60 * 60 * 24 }
);

export async function searchYoutubeMany(query: string): Promise<YoutubeHit[]> {
  await requireSession();
  const q = query.trim();
  if (!q) return [];
  return searchYoutubeManyCached(q);
}

// ─────────────────────────────────────────────
// 손글씨 메모
// ─────────────────────────────────────────────
export async function saveAnnotation(sheetId: string, page: number, strokes: Stroke[]) {
  const session = await requireSession();
  const { error } = await db.from("annotation").upsert(
    {
      sheet_id: sheetId,
      page,
      author: session.name,
      strokes,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "sheet_id,page,author" }
  );
  if (error) throw error;
  // 자동 저장이라 revalidate 하지 않는다 (화면이 깜빡이지 않도록)
}
