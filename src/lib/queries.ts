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
  folderId: string | null | "all" = "all"
): Promise<ContiSummary[]> {
  let q = db
    .from("conti")
    .select("id, title, service_date, created_by, folder_id, song(count)")
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
export async function listAllFolders(): Promise<FolderSummary[]> {
  const [{ data: folders }, { data: contis }] = await Promise.all([
    db.from("folder").select("id, name, parent_id").order("name"),
    db.from("conti").select("folder_id"),
  ]);

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
    conti_count: contiCount.get(f.id as string) ?? 0,
    subfolder_count: subCount.get(f.id as string) ?? 0,
  }));
}

/** 폴더 하나 */
export async function getFolder(
  id: string
): Promise<{ id: string; name: string; parent_id: string | null } | null> {
  const { data } = await db.from("folder").select("id, name, parent_id").eq("id", id).maybeSingle();
  return data
    ? { id: data.id as string, name: data.name as string, parent_id: (data.parent_id as string | null) ?? null }
    : null;
}

/** 콘티 하나를 곡 · 악보 · 레퍼런스까지 통째로 읽어온다. */
export async function getConti(id: string): Promise<Conti | null> {
  const { data: conti } = await db.from("conti").select("*").eq("id", id).maybeSingle();
  if (!conti) return null;

  const { data: songRows } = await db
    .from("song")
    .select("*")
    .eq("conti_id", id)
    .order("order_index");

  const songs = songRows ?? [];
  const songIds = songs.map((s) => s.id as string);

  const [{ data: sheetRows }, { data: refRows }] = await Promise.all([
    songIds.length
      ? db.from("sheet").select("*").in("song_id", songIds).order("order_index")
      : Promise.resolve({ data: [] as Sheet[] }),
    songIds.length
      ? db.from("reference").select("*").in("song_id", songIds).order("order_index")
      : Promise.resolve({ data: [] as Reference[] }),
  ]);

  // 악보마다 열람용 임시 URL 을 붙인다
  const sheets: Sheet[] = await Promise.all(
    (sheetRows ?? []).map(async (s: Sheet) => ({ ...s, url: await signSheetUrlCached(s.storage_path) }))
  );

  return {
    ...(conti as Omit<Conti, "songs">),
    songs: songs.map(
      (s): Song => ({
        ...(s as Omit<Song, "sheets" | "references">),
        sheets: sheets.filter((sheet) => sheet.song_id === s.id),
        references: (refRows ?? []).filter((r: Reference) => r.song_id === s.id),
      })
    ),
  };
}

/** 콘티에 속한 모든 악보의 손글씨 메모 */
export async function getAnnotations(contiId: string): Promise<Annotation[]> {
  const { data: songs } = await db.from("song").select("id").eq("conti_id", contiId);
  const songIds = (songs ?? []).map((s) => s.id as string);
  if (!songIds.length) return [];

  const { data: sheets } = await db.from("sheet").select("id").in("song_id", songIds);
  const sheetIds = (sheets ?? []).map((s) => s.id as string);
  if (!sheetIds.length) return [];

  const { data } = await db
    .from("annotation")
    .select("sheet_id, page, author, strokes")
    .in("sheet_id", sheetIds);

  return (data ?? []) as Annotation[];
}
