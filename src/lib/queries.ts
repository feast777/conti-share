import "server-only";
import { unstable_cache } from "next/cache";
import { db, signSheetUrl } from "./db";
import type {
  Annotation,
  Conti,
  ContiSummary,
  FolderSummary,
  Reference,
  Sheet,
  Song,
} from "./types";

/**
 * 악보 열람용 서명 URL 을 캐시한다.
 * 원래는 요청마다 새 토큰(=새 URL)이 나와서 브라우저가 매번 파일을 다시 받았다.
 * 같은 경로는 한동안 같은 URL 을 돌려주면 브라우저·CDN 이 파일을 캐시할 수 있다.
 * 파일은 경로(uuid)마다 고유하고, 지우면 DB 에서도 빠지므로 오래 재사용해도 안전하다.
 */
const signSheetUrlCached = unstable_cache(
  (path: string) => signSheetUrl(path, 60 * 60 * 12), // 12시간 유효한 URL
  ["sheet-signed-url"],
  { revalidate: 60 * 60 * 6 } // 6시간 동안 같은 URL 재사용
);

/**
 * 콘티 목록.
 * - folderId === "all": 전체
 * - folderId === null: 폴더 밖(folder_id 가 null)인 콘티만
 * - folderId === "<id>": 그 폴더의 콘티만
 */
export async function listContis(
  church: string,
  folderId: string | null | "all" = "all"
): Promise<ContiSummary[]> {
  let q = db
    .from("conti")
    .select("id, title, service_date, created_by, folder_id, song(count)")
    .eq("church", church)
    .order("service_date", { ascending: false })
    .order("created_at", { ascending: false });

  if (folderId === null) q = q.is("folder_id", null);
  else if (folderId !== "all") q = q.eq("folder_id", folderId);

  const { data, error } = await q;
  if (error) throw error;

  return (data ?? []).map((row: Record<string, unknown>) => ({
    id: row.id as string,
    title: row.title as string,
    service_date: row.service_date as string,
    created_by: row.created_by as string,
    folder_id: (row.folder_id as string | null) ?? null,
    song_count: (row.song as { count: number }[] | null)?.[0]?.count ?? 0,
  }));
}

/** 모든 폴더 (각 폴더의 콘티 개수 · 하위 폴더 개수 · 상위 폴더 포함).
 *  화면에서는 이 목록을 부모별로 걸러서 쓴다. */
export async function listAllFolders(church: string): Promise<FolderSummary[]> {
  const [{ data: folders, error: fErr }, { data: contis, error: cErr }] = await Promise.all([
    db
      .from("folder")
      .select("id, name, parent_id, order_index, created_at")
      .eq("church", church)
      .order("name"),
    db.from("conti").select("folder_id").eq("church", church),
  ]);
  // 에러를 삼키면 폴더가 '사라진 것처럼' 빈 목록이 되므로, 오류는 그대로 던진다
  if (fErr) throw fErr;
  if (cErr) throw cErr;

  const contiCount = new Map<string, number>();
  for (const c of contis ?? []) {
    const fid = (c as { folder_id: string | null }).folder_id;
    if (fid) contiCount.set(fid, (contiCount.get(fid) ?? 0) + 1);
  }
  const subCount = new Map<string, number>();
  for (const f of folders ?? []) {
    const p = (f as { parent_id: string | null }).parent_id;
    if (p) subCount.set(p, (subCount.get(p) ?? 0) + 1);
  }

  return (folders ?? []).map((f: Record<string, unknown>) => ({
    id: f.id as string,
    name: f.name as string,
    parent_id: (f.parent_id as string | null) ?? null,
    order_index: (f.order_index as number) ?? 0,
    created_at: (f.created_at as string) ?? "",
    conti_count: contiCount.get(f.id as string) ?? 0,
    subfolder_count: subCount.get(f.id as string) ?? 0,
  }));
}

/** 폴더 하나 */
export async function getFolder(
  id: string,
  church: string
): Promise<{ id: string; name: string; parent_id: string | null } | null> {
  const { data, error } = await db
    .from("folder")
    .select("id, name, parent_id")
    .eq("id", id)
    .eq("church", church)
    .maybeSingle();
  if (error) throw error; // 장애 때 '없는 폴더'로 오인하지 않도록
  return data
    ? { id: data.id as string, name: data.name as string, parent_id: (data.parent_id as string | null) ?? null }
    : null;
}

/**
 * 콘티 하나를 곡 · 악보 · 레퍼런스까지 통째로 읽어온다.
 * 곡→악보→레퍼런스를 따로 조회하면 DB 왕복이 여러 번이라 느리다.
 * 한 번의 중첩 조회로 가져오고, 정렬은 받아온 뒤 여기서 한다.
 */
export async function getConti(id: string, church: string): Promise<Conti | null> {
  const { data, error } = await db
    .from("conti")
    .select("*, song(*, sheet(*), reference(*))")
    .eq("id", id)
    .eq("church", church)
    .maybeSingle();
  if (error) throw error; // 장애 때 '없는 콘티(404)'로 오인하지 않도록
  if (!data) return null;

  const { song: songRows, ...conti } = data as Record<string, unknown> & {
    song?: (Record<string, unknown> & { sheet?: Sheet[]; reference?: Reference[] })[];
  };

  const byOrder = (a: Record<string, unknown>, b: Record<string, unknown>) =>
    ((a.order_index as number) ?? 0) - ((b.order_index as number) ?? 0);

  const rows = [...(songRows ?? [])].sort(byOrder);

  // 악보 열람용 임시 URL (경로별로 캐시되어 있어 대부분 즉시 반환된다)
  const allSheets = rows.flatMap((s) => s.sheet ?? []);
  const urls = await Promise.all(allSheets.map((s) => signSheetUrlCached(s.storage_path)));
  const urlByPath = new Map(allSheets.map((s, i) => [s.storage_path, urls[i]]));

  return {
    ...(conti as Omit<Conti, "songs">),
    songs: rows.map((s): Song => {
      const { sheet, reference, ...song } = s;
      return {
        ...(song as Omit<Song, "sheets" | "references">),
        sheets: [...(sheet ?? [])]
          .sort(byOrder)
          .map((sh) => ({ ...sh, url: urlByPath.get(sh.storage_path) ?? "" })),
        references: [...(reference ?? [])].sort(byOrder),
      };
    }),
  };
}

/** 콘티에 속한 모든 악보의 손글씨 메모 — 한 번의 조회로 가져온다. */
export async function getAnnotations(contiId: string, church: string): Promise<Annotation[]> {
  const { data, error } = await db
    .from("annotation")
    .select("sheet_id, page, author, strokes, sheet!inner(song!inner(conti_id, conti!inner(church)))")
    .eq("sheet.song.conti_id", contiId)
    .eq("sheet.song.conti.church", church);
  if (error) throw error;

  return (data ?? []).map((a: Record<string, unknown>) => ({
    sheet_id: a.sheet_id as string,
    page: a.page as number,
    author: a.author as string,
    strokes: (a.strokes ?? []) as Annotation["strokes"],
  }));
}
