"use client";

import { useState } from "react";
import { listContiExport } from "@/app/actions";
import type { Stroke } from "@/lib/types";

function hexRgb(hex: string) {
  const h = hex.replace("#", "");
  const n = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const v = parseInt(n || "111827", 16);
  return { r: ((v >> 16) & 255) / 255, g: ((v >> 8) & 255) / 255, b: (v & 255) / 255 };
}

type State =
  | { phase: "idle" }
  | { phase: "working"; pct: number }
  | { phase: "done"; url: string; blob: Blob; fileName: string }
  | { phase: "error"; msg: string };

/**
 * 콘티 목록의 카드에서 그 콘티의 모든 악보를 하나의 PDF 로 만든다.
 * 브라우저 안에서 만들기 때문에 진행률(0~100%)을 실시간으로 보여줄 수 있고,
 * 다 되면 바로 보기 / 공유하기 를 할 수 있다.
 */
export default function PdfButton({ contiId, title }: { contiId: string; title: string }) {
  const [state, setState] = useState<State>({ phase: "idle" });

  const build = async () => {
    setState({ phase: "working", pct: 0 });
    try {
      const { title: contiTitle, sheets, annotations } = await listContiExport(contiId);
      if (!sheets.length) {
        setState({ phase: "error", msg: "악보 없음" });
        return;
      }

      const { PDFDocument, rgb, LineCapStyle } = await import("pdf-lib");

      // 손글씨 메모(정규화 0~1 좌표)를 페이지에 그린다. 화면 좌표는 위가 0,
      // PDF 는 아래가 0 이라 y 를 뒤집는다.
      const drawStrokes = (
        page: import("pdf-lib").PDFPage,
        strokes: Stroke[] | undefined,
        W: number,
        H: number
      ) => {
        for (const s of strokes ?? []) {
          if (!s.points?.length) continue;
          const c = hexRgb(s.color);
          const color = rgb(c.r, c.g, c.b);
          const thickness = Math.max(0.5, s.width * W);
          const opacity = s.tool === "highlighter" ? 0.32 : 1;
          const pts = s.points.map(([x, y]) => ({ x: x * W, y: (1 - y) * H }));
          const line = (a: { x: number; y: number }, b: { x: number; y: number }) =>
            page.drawLine({ start: a, end: b, thickness, color, opacity, lineCap: LineCapStyle.Round });
          if (pts.length === 1) {
            line(pts[0], { x: pts[0].x + 0.5, y: pts[0].y });
            continue;
          }
          for (let i = 1; i < pts.length; i++) line(pts[i - 1], pts[i]);
        }
      };

      // 1) 악보 파일을 한꺼번에 내려받는다 (하나 끝날 때마다 진행률 ~70% 까지)
      let done = 0;
      const buffers = await Promise.all(
        sheets.map(async (s) => {
          try {
            const res = await fetch(s.url);
            const buf = res.ok ? await res.arrayBuffer() : null;
            done += 1;
            setState({ phase: "working", pct: Math.round((done / sheets.length) * 70) });
            return buf ? { sheet: s, buf } : null;
          } catch {
            done += 1;
            return null;
          }
        })
      );

      // 2) 순서대로 한 파일로 합친다 (남은 30%)
      const out = await PDFDocument.create();
      for (let i = 0; i < buffers.length; i++) {
        const item = buffers[i];
        if (item) {
          try {
            if (item.sheet.kind === "pdf") {
              const src = await PDFDocument.load(item.buf, { ignoreEncryption: true });
              const pages = await out.copyPages(src, src.getPageIndices());
              pages.forEach((p, idx) => {
                out.addPage(p);
                drawStrokes(p, annotations[`${item.sheet.sheetId}:${idx + 1}`], p.getWidth(), p.getHeight());
              });
            } else {
              const data = new Uint8Array(item.buf);
              const isPng = item.sheet.fileName.toLowerCase().endsWith(".png");
              const img = isPng ? await out.embedPng(data) : await out.embedJpg(data);
              const page = out.addPage([img.width, img.height]);
              page.drawImage(img, { x: 0, y: 0, width: img.width, height: img.height });
              drawStrokes(page, annotations[`${item.sheet.sheetId}:1`], img.width, img.height);
            }
          } catch {
            // 형식이 안 맞는 파일은 건너뛴다
          }
        }
        setState({ phase: "working", pct: 70 + Math.round(((i + 1) / buffers.length) * 30) });
      }

      if (out.getPageCount() === 0) {
        setState({ phase: "error", msg: "불러오기 실패" });
        return;
      }

      const bytes = await out.save();
      const blob = new Blob([bytes as BlobPart], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      setState({ phase: "done", url, blob, fileName: `${contiTitle || "콘티"}.pdf` });
    } catch {
      setState({ phase: "error", msg: "실패" });
    }
  };

  const share = async (blob: Blob, fileName: string, url: string) => {
    const file = new File([blob], fileName, { type: "application/pdf" });
    const nav = navigator as Navigator & { canShare?: (d?: unknown) => boolean };
    try {
      if (nav.canShare?.({ files: [file] })) {
        await nav.share({ files: [file], title: fileName });
        return;
      }
    } catch {
      // 공유 취소 등은 조용히 넘어간다
      return;
    }
    // 공유를 지원하지 않으면 그냥 내려받기로 대체
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    a.click();
  };

  // 링크(카드)로 이벤트가 새지 않도록 클릭을 여기서 멈춘다
  const stop = (e: React.MouseEvent) => e.stopPropagation();

  if (state.phase === "working") {
    return (
      <div className="flex shrink-0 items-center gap-2" onClick={stop}>
        <div className="h-1.5 w-16 overflow-hidden rounded-full bg-ink-700">
          <div
            className="h-full rounded-full bg-accent transition-all"
            style={{ width: `${state.pct}%` }}
          />
        </div>
        <span className="w-14 text-xs text-ink-400">저장 중 {state.pct}%</span>
      </div>
    );
  }

  if (state.phase === "done") {
    return (
      <div className="flex shrink-0 items-center gap-1.5" onClick={stop}>
        <a
          href={state.url}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-lg border border-ink-700 px-3 py-1.5 text-xs text-ink-200 transition hover:border-ink-500 hover:text-ink-200"
        >
          보기
        </a>
        <button
          onClick={() => share(state.blob, state.fileName, state.url)}
          className="rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-on-accent"
        >
          공유하기
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={(e) => {
        stop(e);
        void build();
      }}
      className="shrink-0 rounded-lg border border-ink-700 px-3 py-1.5 text-xs text-ink-400 transition hover:border-ink-500 hover:text-ink-200"
      title="이 콘티의 악보 전체를 PDF 로 저장"
    >
      {state.phase === "error" ? "다시" : "PDF"}
    </button>
  );
}
