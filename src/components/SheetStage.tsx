"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { RenderTask } from "pdfjs-dist";
import { freshSheetUrl } from "@/app/actions";
import { getPdfDocument } from "@/lib/pdf";
import type { Sheet, Stroke } from "@/lib/types";
import AnnotationCanvas, { type Tool } from "./AnnotationCanvas";

type Props = {
  sheet: Sheet;
  page: number;
  fit: "contain" | "width";
  strokes: Stroke[];
  otherStrokes: Stroke[];
  annotating: boolean;
  tool: Tool;
  color: string;
  size: number;
  onStrokesChange: (next: Stroke[]) => void;
};

type Size = { w: number; h: number };

export default function SheetStage({
  sheet,
  page,
  fit,
  strokes,
  otherStrokes,
  annotating,
  tool,
  color,
  size,
  onStrokesChange,
}: Props) {
  const boxRef = useRef<HTMLDivElement>(null);
  const pdfCanvasRef = useRef<HTMLCanvasElement>(null);
  const renderTaskRef = useRef<RenderTask | null>(null);

  const [box, setBox] = useState<Size>({ w: 0, h: 0 });
  const [intrinsic, setIntrinsic] = useState<Size | null>(null);
  const [error, setError] = useState<string | null>(null);

  // 열람 주소가 만료됐을 수 있으니, 한 번 실패하면 새 주소를 받아 다시 시도한다
  const [url, setUrl] = useState(sheet.url);
  const retriedRef = useRef(false);
  useEffect(() => {
    setUrl(sheet.url);
    retriedRef.current = false;
  }, [sheet.url, sheet.id]);

  const retryWithFreshUrl = useCallback(
    async (fallbackMessage: string) => {
      if (retriedRef.current) {
        setError(fallbackMessage);
        return;
      }
      retriedRef.current = true;
      try {
        const next = await freshSheetUrl(sheet.id);
        if (next) {
          setError(null);
          setUrl(next);
          return;
        }
      } catch {
        /* 실패하면 아래에서 안내 */
      }
      setError(fallbackMessage);
    },
    [sheet.id]
  );

  // 컨테이너 크기 추적
  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setBox({ w: width, h: height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // 악보 원본 크기 파악
  useEffect(() => {
    let cancelled = false;
    setIntrinsic(null);
    setError(null);

    if (!url) {
      setError("악보 파일을 불러올 수 없습니다.");
      return;
    }

    if (sheet.kind === "image") {
      const img = new Image();
      img.onload = () => {
        if (!cancelled) setIntrinsic({ w: img.naturalWidth, h: img.naturalHeight });
      };
      img.onerror = () => !cancelled && void retryWithFreshUrl("이미지를 불러오지 못했습니다.");
      img.src = url;
    } else {
      getPdfDocument(url)
        .then((doc) => doc.getPage(page))
        .then((p) => {
          const vp = p.getViewport({ scale: 1 });
          if (!cancelled) setIntrinsic({ w: vp.width, h: vp.height });
        })
        .catch(() => !cancelled && void retryWithFreshUrl("PDF 를 불러오지 못했습니다."));
    }

    return () => {
      cancelled = true;
    };
  }, [url, sheet.kind, page, retryWithFreshUrl]);

  const display = useMemo<Size>(() => {
    if (!intrinsic || box.w === 0) return { w: 0, h: 0 };
    const ratio = intrinsic.h / intrinsic.w;

    if (fit === "width") {
      return { w: box.w, h: box.w * ratio };
    }
    const scale = Math.min(box.w / intrinsic.w, box.h / intrinsic.h);
    return { w: intrinsic.w * scale, h: intrinsic.h * scale };
  }, [intrinsic, box, fit]);

  // PDF 페이지를 실제 표시 크기에 맞춰 렌더
  useEffect(() => {
    if (sheet.kind !== "pdf" || !url || display.w === 0) return;

    let cancelled = false;
    const dpr = Math.min(window.devicePixelRatio || 1, 2); // 3x 기기에서 메모리 폭주 방지

    getPdfDocument(url)
      .then((doc) => doc.getPage(page))
      .then((p) => {
        if (cancelled) return;
        const canvas = pdfCanvasRef.current;
        if (!canvas) return;

        const base = p.getViewport({ scale: 1 });
        const viewport = p.getViewport({ scale: (display.w / base.width) * dpr });

        canvas.width = Math.round(viewport.width);
        canvas.height = Math.round(viewport.height);

        renderTaskRef.current?.cancel();
        const task = p.render({ canvas, viewport });
        renderTaskRef.current = task;
        return task.promise.catch(() => {}); // cancel 시 조용히 넘어간다
      })
      .catch(() => !cancelled && void retryWithFreshUrl("PDF 페이지를 그리지 못했습니다."));

    return () => {
      cancelled = true;
      renderTaskRef.current?.cancel();
      renderTaskRef.current = null;
    };
  }, [url, sheet.kind, page, display.w, retryWithFreshUrl]);

  return (
    <div
      ref={boxRef}
      className={
        fit === "width"
          ? "h-full w-full overflow-y-auto overflow-x-hidden"
          : "flex h-full w-full items-center justify-center overflow-hidden"
      }
    >
      {error ? (
        <p className="p-8 text-center text-sm text-red-400">{error}</p>
      ) : display.w === 0 ? (
        <p className="p-8 text-center text-sm text-ink-600">악보 불러오는 중…</p>
      ) : (
        <div
          className="relative mx-auto bg-white shadow-2xl"
          style={{ width: display.w, height: display.h }}
        >
          {sheet.kind === "image" ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={url}
              alt=""
              width={display.w}
              height={display.h}
              className="block h-full w-full select-none"
              draggable={false}
            />
          ) : (
            <canvas
              ref={pdfCanvasRef}
              style={{ width: display.w, height: display.h }}
              className="block"
            />
          )}

          <AnnotationCanvas
            width={display.w}
            height={display.h}
            strokes={strokes}
            otherStrokes={otherStrokes}
            active={annotating}
            tool={tool}
            color={color}
            size={size}
            onChange={onStrokesChange}
          />
        </div>
      )}
    </div>
  );
}
