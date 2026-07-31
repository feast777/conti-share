"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { updateSong } from "@/app/actions";
import type { SheetLite } from "@/lib/lyrics";

type SongData = { id: string; title: string; lyrics: string; sheets: SheetLite[] };

const BG = "000000"; // 검은 배경
const FG = "FFFF00"; // 노란 글씨
const FONT = "맑은 고딕";

export default function PptxButton({
  contiId,
  title,
  songs,
}: {
  contiId: string;
  title: string;
  songs: SongData[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [perSlide, setPerSlide] = useState(2);

  // ── 악보에서 가사 추출 → 가사칸 채우기 ──────────────────
  const extract = async () => {
    const hasSheets = songs.some((s) => s.sheets.some((sh) => sh.url));
    if (!hasSheets) {
      alert("추출할 악보가 없어요. 곡에 악보(PDF·이미지)를 먼저 올려주세요.");
      return;
    }
    if (
      !confirm(
        "악보에서 가사를 추출할까요?\n\n· PDF 악보는 정확하게, 사진·스캔 악보는 대략 뽑혀요(오인식은 가사칸에서 수정).\n· 곡·장이 많으면 시간이 걸립니다."
      )
    )
      return;

    setBusy("가사 추출 중…");
    try {
      const { extractSheetText, cleanLyrics, terminateWorker } = await import("@/lib/lyrics");
      let done = 0;
      for (const song of songs) {
        setBusy(`가사 추출 중… (${++done}/${songs.length})`);
        let text = "";
        for (const sheet of song.sheets) {
          if (!sheet.url) continue;
          try {
            text += (await extractSheetText(sheet)) + "\n";
          } catch {
            /* 한 장 실패해도 계속 */
          }
        }
        const cleaned = cleanLyrics(text);
        if (cleaned) await updateSong(song.id, contiId, { lyrics: cleaned });
      }
      await terminateWorker();
      router.refresh();
      alert("가사를 추출했어요!\n가사칸을 확인·수정한 뒤 '가사 PPT'를 눌러 PPT를 만드세요.");
    } catch (e) {
      alert("가사 추출에 실패했습니다.\n" + (e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  // ── 가사로 PPT 만들기 ──────────────────────────────────
  const makePptx = async () => {
    const withLyrics = songs.filter((s) => s.lyrics.trim());
    if (withLyrics.length === 0) {
      if (confirm("아직 가사가 없어요. 악보에서 가사를 추출할까요?")) await extract();
      return;
    }

    setBusy("PPT 만드는 중…");
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
        const t = pptx.addSlide();
        t.background = { color: BG };
        t.addText(song.title || "제목 없음", centered(40));

        const stanzas = song.lyrics.split(/\r?\n\s*\r?\n/);
        for (const stanza of stanzas) {
          const lines = stanza
            .split(/\r?\n/)
            .map((l) => l.trim())
            .filter(Boolean);
          for (let i = 0; i < lines.length; i += perSlide) {
            const slide = pptx.addSlide();
            slide.background = { color: BG };
            slide.addText(lines.slice(i, i + perSlide).join("\n"), centered(40));
          }
        }
      }
      await pptx.writeFile({ fileName: `${title || "찬양 가사"}.pptx` });
    } catch (e) {
      alert("PPT 만들기에 실패했습니다.\n" + (e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="flex items-center gap-1">
      <button
        onClick={extract}
        disabled={!!busy}
        className="rounded-lg border border-ink-700 px-2.5 py-1.5 text-sm text-ink-400 hover:text-white disabled:opacity-50"
        title="악보(PDF·이미지)에서 가사를 자동으로 뽑아 가사칸을 채웁니다"
      >
        악보에서 추출
      </button>
      <select
        value={perSlide}
        onChange={(e) => setPerSlide(Number(e.target.value))}
        disabled={!!busy}
        className="rounded-md border border-ink-700 bg-ink-800 px-1.5 py-1 text-xs text-ink-200"
        title="슬라이드당 가사 줄 수"
        aria-label="슬라이드당 줄 수"
      >
        <option value={1}>1줄</option>
        <option value={2}>2줄</option>
        <option value={3}>3줄</option>
      </select>
      <button
        onClick={makePptx}
        disabled={!!busy}
        className="rounded-lg border border-ink-700 px-2.5 py-1.5 text-sm text-ink-400 hover:text-white disabled:opacity-50"
        title="가사칸의 가사로 찬양 PPT(.pptx) 만들기"
      >
        {busy ?? "가사 PPT"}
      </button>
    </div>
  );
}
