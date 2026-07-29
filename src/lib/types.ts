export type SheetKind = "pdf" | "image";

export type Point = [number, number]; // 0~1 로 정규화된 좌표

export type Stroke = {
  id: string;
  tool: "pen" | "highlighter";
  color: string;
  /** 악보 폭 대비 비율. 화면 크기가 달라도 두께가 유지된다. */
  width: number;
  points: Point[];
};

export type Annotation = {
  sheet_id: string;
  page: number;
  author: string;
  strokes: Stroke[];
};

export type Reference = {
  id: string;
  song_id: string;
  order_index: number;
  url: string;
  label: string;
};

export type Sheet = {
  id: string;
  song_id: string;
  order_index: number;
  storage_path: string;
  file_name: string;
  kind: SheetKind;
  page_count: number;
  /** 서버에서 만들어 붙여주는 임시 열람 URL */
  url?: string;
};

/** 악보 배치 방식 — single: 한 장씩 넘김, 나머지는 곡의 모든 페이지를 한 화면에 */
export type SheetLayout = "single" | "vertical" | "horizontal" | "grid";

export type Song = {
  id: string;
  conti_id: string;
  order_index: number;
  title: string;
  song_key: string;
  bpm: string;
  memo: string;
  sheet_layout: SheetLayout;
  sheets: Sheet[];
  references: Reference[];
};

export type Conti = {
  id: string;
  title: string;
  service_date: string;
  note: string;
  created_by: string;
  created_at: string;
  songs: Song[];
};

export type ContiSummary = {
  id: string;
  title: string;
  service_date: string;
  created_by: string;
  folder_id: string | null;
  song_count: number;
};

export type Folder = {
  id: string;
  name: string;
  created_by: string;
  created_at: string;
};

export type FolderSummary = {
  id: string;
  name: string;
  conti_count: number;
};
