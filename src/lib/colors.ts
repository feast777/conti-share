/** 폴더마다 고르게 도는 색. id 로 정하니 이름을 바꿔도 색이 유지된다. */
const FOLDER_COLORS = [
  "#e5484d", // 빨강
  "#f76b15", // 주황
  "#eba300", // 금색
  "#46a758", // 초록
  "#12a594", // 청록
  "#3e63dd", // 파랑
  "#8e4ec6", // 보라
  "#e93d82", // 분홍
];

export function folderColor(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return FOLDER_COLORS[h % FOLDER_COLORS.length];
}

/** 아이콘을 옅게 깐 타일 배경 — 라이트/다크 어느 쪽에서도 같은 식으로 먹는다 */
export function tint(color: string, percent = 15): string {
  return `color-mix(in srgb, ${color} ${percent}%, transparent)`;
}
