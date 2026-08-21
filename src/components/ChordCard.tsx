"use client";

import { parseChord } from "@/lib/chords";
import { findVoicings } from "@/lib/guitar";
import GuitarDiagram from "./GuitarDiagram";

const PC: Record<string, number> = {
  C: 0, "C#": 1, Db: 1, D: 2, "D#": 3, Eb: 3, E: 4, F: 5, "F#": 6, Gb: 6,
  G: 7, "G#": 8, Ab: 8, A: 9, "A#": 10, Bb: 10, B: 11, "B#": 0, Cb: 11,
  "E#": 5, Fb: 4,
};
const pcOf = (n: string) => PC[n] ?? 0;


/** 코드 하나를 구성음·피아노·기타 지판으로 보여준다 */
export default function ChordCard({ name }: { name: string }) {
  const info = parseChord(name);
  if (!info) {
    return (
      <div className="card p-4 text-sm text-ink-600">
        <span className="font-medium text-ink-400">{name}</span> — 코드로 읽지 못했어요
      </div>
    );
  }

  const chordPcs = new Set(info.notes.map(pcOf));
  const rootPc = pcOf(info.notes[0]);
  const bassPc = info.bass ? pcOf(info.bass) : null;

  // 잡을 수 있는 기타 폼 (완전5도는 생략 가능한 음으로 알려준다)
  const fifthPc = info.intervals.includes(7) ? (rootPc + 7) % 12 : null;
  const voicings = findVoicings([...chordPcs], rootPc, fifthPc, bassPc, 4);

  // 피아노 한 옥타브 (C~B)
  const WHITE = [0, 2, 4, 5, 7, 9, 11];
  const BLACK: { pc: number; left: number }[] = [
    { pc: 1, left: 1 }, { pc: 3, left: 2 }, { pc: 6, left: 4 },
    { pc: 8, left: 5 }, { pc: 10, left: 6 },
  ];

  return (
    <div className="card p-4">
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <h3 className="text-xl font-semibold tracking-tight text-ink-200">{info.name}</h3>
        <span className="text-xs text-ink-600">{info.quality}</span>
      </div>

      {/* 구성음 */}
      <div className="mt-3 flex flex-wrap gap-1.5">
        {info.notes.map((n, i) => (
          <span
            key={`${n}-${i}`}
            className={`rounded-lg px-2.5 py-1 text-sm font-medium ${
              i === 0 ? "bg-accent text-on-accent" : "bg-ink-800 text-ink-200"
            }`}
          >
            {n}
          </span>
        ))}
        {info.bass && (
          <span className="rounded-lg border border-dashed border-ink-600 px-2.5 py-1 text-sm text-ink-400">
            베이스 {info.bass}
          </span>
        )}
      </div>

      {/* 피아노 */}
      <p className="mt-4 mb-1.5 text-xs font-medium uppercase tracking-wider text-ink-600">건반</p>
      <div className="relative h-20 w-full max-w-[15rem] select-none">
        {/* 건반은 테마와 무관하게 흰/검 그대로 두므로, 칠하는 금색도 테마와 무관하게 고정한다 */}
        <div className="flex h-full gap-px">
          {WHITE.map((pc) => (
            <div
              key={pc}
              style={{
                background: chordPcs.has(pc)
                  ? pc === rootPc
                    ? "#b07400"
                    : "color-mix(in srgb, #b07400 30%, #ffffff)"
                  : "#ffffff",
              }}
              className="flex-1 rounded-b-md border border-neutral-400"
            />
          ))}
        </div>
        {BLACK.map(({ pc, left }) => (
          <div
            key={pc}
            style={{
              left: `calc(${left} * (100% / 7) - 5%)`,
              width: "10%",
              background: chordPcs.has(pc)
                ? pc === rootPc
                  ? "#f0b429"
                  : "color-mix(in srgb, #f0b429 65%, #111111)"
                : "#1c1c1c",
            }}
            className="absolute top-0 h-[62%] rounded-b-md border border-neutral-700"
          />
        ))}
      </div>

      {/* 기타 운지 — 잡을 수 있는 폼 여러 개 */}
      <p className="mt-4 mb-1.5 text-xs font-medium uppercase tracking-wider text-ink-600">
        기타 운지
      </p>
      <div>
        {voicings.length === 0 ? (
          <p className="text-xs text-ink-600">이 코드는 6줄로 잡을 수 있는 폼을 찾지 못했어요.</p>
        ) : (
          <div className="flex flex-wrap gap-3">
            {voicings.map((v, i) => (
              <div key={i} className="text-center">
                <GuitarDiagram v={v} />
                <p className="mt-0.5 text-[0.6rem] text-ink-600">
                  {v.frets.map((f) => (f < 0 ? "x" : f)).join(" ")}
                </p>
              </div>
            ))}
          </div>
        )}
        <p className="mt-2 text-[0.65rem] leading-relaxed text-ink-600">
          위 ○ 는 개방현, × 는 치지 않는 줄. 굵은 가로선은 바레예요.
        </p>
      </div>
    </div>
  );
}
