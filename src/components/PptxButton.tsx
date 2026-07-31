"use client";

import { useState } from "react";

type SongLyric = { title: string; lyrics: string };

const BG = "000000"; // 검은 배경
const FG = "FFFF00"; // 노란 글씨
const FONT = "맑은 고딕";

/** 콘티의 곡 가사로 찬양 PPT(.pptx)를 만든다. 한 줄 = 한 슬라이드, 곡마다 제목 슬라이드. */
export default function PptxButton({ title, songs }: { title: string; songs: SongLyric[] }) {
  const [busy, setBusy] = useState(false);

  const make = async () => {
    const withLyrics = songs.filter((s) => s.lyrics.trim());
    if (withLyrics.length === 0) {
      alert("가사가 없어요. 편집 화면에서 곡에 가사를 붙여넣어 주세요.");
      return;
    }

    setBusy(true);
    try {
      const PptxGenJS = (await import("pptxgenjs")).default;
      const pptx = new PptxGenJS();
      pptx.layout = "LAYOUT_16x9";

      const centered = (fontSize: number) =>
        ({
          x: 0.4,
          y: 0,
          w: 9.2,
          h: "100%",
          align: "center",
          valign: "middle",
          fontFace: FONT,
          fontSize,
          bold: true,
          color: FG,
        }) as const;

      for (const song of songs) {
        // 곡 제목 슬라이드
        const titleSlide = pptx.addSlide();
        titleSlide.background = { color: BG };
        titleSlide.addText(song.title || "제목 없음", centered(40));

        // 가사 — 한 줄(빈 줄 제외)마다 슬라이드
        const lines = song.lyrics.split(/\r?\n/).map((l) => l.trim());
        for (const line of lines) {
          if (!line) continue;
          const slide = pptx.addSlide();
          slide.background = { color: BG };
          slide.addText(line, centered(44));
        }
      }

      await pptx.writeFile({ fileName: `${title || "찬양 가사"}.pptx` });
    } catch (e) {
      alert("PPT 만들기에 실패했습니다.\n" + (e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      onClick={make}
      disabled={busy}
      className="rounded-lg border border-ink-700 px-3 py-1.5 text-sm text-ink-400 hover:text-white disabled:opacity-50"
      title="곡 가사로 찬양 PPT(.pptx) 만들기"
    >
      {busy ? "PPT 만드는 중…" : "가사 PPT"}
    </button>
  );
}
