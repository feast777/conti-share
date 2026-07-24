"use client";

import { useCallback, useEffect, useRef } from "react";
import type { Point, Stroke } from "@/lib/types";

export type Tool = "pen" | "highlighter" | "eraser";

type Props = {
  /** 악보가 화면에 그려진 크기 (CSS px) */
  width: number;
  height: number;
  /** 내가 쓴 필기 — 편집 가능 */
  strokes: Stroke[];
  /** 다른 팀원이 쓴 필기 — 보기 전용 */
  otherStrokes: Stroke[];
  active: boolean;
  tool: Tool;
  color: string;
  /** 악보 폭 대비 두께 비율 */
  size: number;
  onChange: (next: Stroke[]) => void;
};

const ERASER_RADIUS = 0.016; // 악보 폭 대비

function applyStyle(ctx: CanvasRenderingContext2D, stroke: Stroke, pageWidth: number) {
  ctx.strokeStyle = stroke.color;
  ctx.lineWidth = Math.max(1, stroke.width * pageWidth);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.globalAlpha = stroke.tool === "highlighter" ? 0.32 : 1;
}

function drawStroke(
  ctx: CanvasRenderingContext2D,
  stroke: Stroke,
  w: number,
  h: number,
  alpha = 1
) {
  if (stroke.points.length === 0) return;
  applyStyle(ctx, stroke, w);
  ctx.globalAlpha *= alpha;

  ctx.beginPath();
  const [x0, y0] = stroke.points[0];
  ctx.moveTo(x0 * w, y0 * h);

  if (stroke.points.length === 1) {
    // 점 하나만 찍은 경우
    ctx.lineTo(x0 * w + 0.01, y0 * h);
  } else {
    for (let i = 1; i < stroke.points.length; i++) {
      ctx.lineTo(stroke.points[i][0] * w, stroke.points[i][1] * h);
    }
  }
  ctx.stroke();
  ctx.globalAlpha = 1;
}

export default function AnnotationCanvas({
  width,
  height,
  strokes,
  otherStrokes,
  active,
  tool,
  color,
  size,
  onChange,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const draftRef = useRef<Stroke | null>(null);
  // 그리는 중에는 state 를 건드리지 않고 ref 로만 다룬다 (매 프레임 리렌더 방지)
  const strokesRef = useRef(strokes);
  strokesRef.current = strokes;

  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || width === 0 || height === 0) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    if (canvas.width !== Math.round(width * dpr) || canvas.height !== Math.round(height * dpr)) {
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
    }

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);

    for (const s of otherStrokes) drawStroke(ctx, s, width, height, 0.55);
    for (const s of strokesRef.current) drawStroke(ctx, s, width, height);
    if (draftRef.current) drawStroke(ctx, draftRef.current, width, height);
  }, [width, height, otherStrokes]);

  useEffect(redraw, [redraw, strokes]);

  const toLocal = (e: React.PointerEvent<HTMLCanvasElement>): Point => {
    const rect = e.currentTarget.getBoundingClientRect();
    return [(e.clientX - rect.left) / rect.width, (e.clientY - rect.top) / rect.height];
  };

  const eraseAt = (p: Point) => {
    const aspect = height / width || 1;
    const kept = strokesRef.current.filter(
      (s) =>
        !s.points.some(([x, y]) => {
          const dx = x - p[0];
          const dy = (y - p[1]) * aspect; // 화면 비율 보정
          return dx * dx + dy * dy < ERASER_RADIUS * ERASER_RADIUS;
        })
    );
    if (kept.length !== strokesRef.current.length) onChange(kept);
  };

  const handleDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!active) return;
    e.preventDefault();
    // 캔버스 밖으로 나가도 선이 끊기지 않도록. 잡을 수 없는 포인터면 그냥 넘어간다.
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* noop */
    }

    const p = toLocal(e);
    if (tool === "eraser") {
      eraseAt(p);
      draftRef.current = null;
      return;
    }

    draftRef.current = {
      id: crypto.randomUUID(),
      tool,
      color,
      width: size,
      points: [p],
    };
    redraw();
  };

  const handleMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!active || e.buttons === 0) return;

    if (tool === "eraser") {
      eraseAt(toLocal(e));
      return;
    }

    const draft = draftRef.current;
    if (!draft) return;

    // 고주사율 펜의 중간 좌표까지 모아서 선을 매끄럽게.
    // 빈 배열을 주는 환경이 있어 그때는 이벤트 자체를 쓴다.
    const coalesced =
      typeof e.nativeEvent.getCoalescedEvents === "function"
        ? e.nativeEvent.getCoalescedEvents()
        : [];
    const events = coalesced.length > 0 ? coalesced : [e.nativeEvent];

    const rect = e.currentTarget.getBoundingClientRect();
    const ctx = canvasRef.current?.getContext("2d");
    if (ctx) applyStyle(ctx, draft, width);

    for (const ev of events) {
      const next: Point = [(ev.clientX - rect.left) / rect.width, (ev.clientY - rect.top) / rect.height];
      const prev = draft.points[draft.points.length - 1];
      draft.points.push(next);

      if (ctx) {
        ctx.beginPath();
        ctx.moveTo(prev[0] * width, prev[1] * height);
        ctx.lineTo(next[0] * width, next[1] * height);
        ctx.stroke();
      }
    }
    if (ctx) ctx.globalAlpha = 1;
  };

  const handleUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    const draft = draftRef.current;
    draftRef.current = null;
    if (draft && draft.points.length > 0) onChange([...strokesRef.current, draft]);
  };

  return (
    <canvas
      ref={canvasRef}
      style={{ width, height }}
      className={`absolute inset-0 ${active ? "no-touch-scroll" : "pointer-events-none"}`}
      onPointerDown={handleDown}
      onPointerMove={handleMove}
      onPointerUp={handleUp}
      onPointerCancel={handleUp}
    />
  );
}
