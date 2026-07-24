import "server-only";
import { db, signSheetUrl } from "./db";
import type { Annotation, Conti, ContiSummary, Reference, Sheet, Song } from "./types";

export async function listContis(): Promise<ContiSummary[]> {
  const { data, error } = await db
    .from("conti")
    .select("id, title, service_date, created_by, song(count)")
    .order("service_date", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) throw error;

  return (data ?? []).map((row: Record<string, unknown>) => ({
    id: row.id as string,
    title: row.title as string,
    service_date: row.service_date as string,
    created_by: row.created_by as string,
    song_count: (row.song as { count: number }[] | null)?.[0]?.count ?? 0,
  }));
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
    (sheetRows ?? []).map(async (s: Sheet) => ({ ...s, url: await signSheetUrl(s.storage_path) }))
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
