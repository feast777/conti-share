import type { MetadataRoute } from "next";

/** 홈 화면에 추가했을 때 쓰이는 이름·색 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Worship Conti Share",
    short_name: "Conti Share",
    description: "찬양팀 콘티 · 악보 · 레퍼런스 공유",
    start_url: "/",
    display: "standalone",
    background_color: "#fbfbfa",
    theme_color: "#fbfbfa",
  };
}
