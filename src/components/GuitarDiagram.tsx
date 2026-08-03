"use client";

import type { Voicing } from "@/lib/guitar";

const W = 84; // 다이어그램 너비
const ROWS = 4; // 보여줄 프렛 칸 수
const LEFT = 14;
const TOP = 16;
const CELL = 15;

/** 코드 다이어그램 한 개 (세로 = 줄, 가로 = 프렛) */
export default function GuitarDiagram({ v }: { v: Voicing }) {
  const fretted = v.frets.filter((f) => f > 0);
  const min = fretted.length ? Math.min(...fretted) : 1;
  // 개방현이 섞이면 0프렛(너트)부터, 아니면 그 포지션부터 보여준다
  const startFret = fretted.length && (min > 2 || !v.frets.includes(0)) ? min : 1;
  const nut = startFret === 1;

  const stringX = (i: number) => LEFT + i * ((W - LEFT - 8) / 5);
  const fretY = (row: number) => TOP + row * CELL;

  return (
    <svg
      viewBox={`0 0 ${W} ${TOP + ROWS * CELL + 6}`}
      className="w-[5.6rem] text-ink-400"
      role="img"
    >
      {/* 개방현 / 뮤트 표시 */}
      {v.frets.map((f, i) => (
        <text
          key={`m${i}`}
          x={stringX(i)}
          y={TOP - 5}
          textAnchor="middle"
          fontSize="8"
          fill="currentColor"
        >
          {f < 0 ? "×" : f === 0 ? "○" : ""}
        </text>
      ))}

      {/* 너트(0프렛) 또는 시작 프렛 번호 */}
      {nut ? (
        <rect x={LEFT - 1} y={TOP - 1} width={W - LEFT - 6} height="3" fill="currentColor" />
      ) : (
        <text x={2} y={TOP + 10} fontSize="8" fill="currentColor">
          {startFret}
        </text>
      )}

      {/* 프렛선 */}
      {Array.from({ length: ROWS + 1 }, (_, r) => (
        <line
          key={`f${r}`}
          x1={LEFT}
          y1={fretY(r)}
          x2={W - 8}
          y2={fretY(r)}
          stroke="currentColor"
          strokeWidth="0.7"
          opacity="0.45"
        />
      ))}

      {/* 줄 */}
      {v.frets.map((_, i) => (
        <line
          key={`s${i}`}
          x1={stringX(i)}
          y1={TOP}
          x2={stringX(i)}
          y2={fretY(ROWS)}
          stroke="currentColor"
          strokeWidth="0.7"
          opacity="0.45"
        />
      ))}

      {/* 바레 */}
      {v.barre > 0 && v.barre >= startFret && v.barre < startFret + ROWS && (
        <rect
          x={stringX(v.frets.findIndex((f) => f === v.barre)) - 3.5}
          y={fretY(v.barre - startFret) + CELL / 2 - 3.5}
          width={
            stringX(5 - [...v.frets].reverse().findIndex((f) => f === v.barre)) -
            stringX(v.frets.findIndex((f) => f === v.barre)) +
            7
          }
          height="7"
          rx="3.5"
          fill="var(--color-accent)"
        />
      )}

      {/* 누르는 점 */}
      {v.frets.map((f, i) =>
        f > 0 && f >= startFret && f < startFret + ROWS ? (
          <circle
            key={`d${i}`}
            cx={stringX(i)}
            cy={fretY(f - startFret) + CELL / 2}
            r="3.6"
            fill="var(--color-accent)"
          />
        ) : null
      )}
    </svg>
  );
}
