import type { MetadataRoute } from "next";

/** 홈 화면에 추가했을 때 쓰이는 이름·색 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Cadence · Worship Setlist",
    short_name: "Cadence",
    description: "찬양팀 콘티 · 악보 · 레퍼런스 공유",
    start_url: "/",
    display: "standalone",
    background_color: "#f4f6f9",
    theme_color: "#f4f6f9",
  };
}
