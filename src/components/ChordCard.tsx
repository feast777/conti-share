"use client";

import { parseChord } from "@/lib/chords";

const PC: Record<string, number> = {
  C: 0, "C#": 1, Db: 1, D: 2, "D#": 3, Eb: 3, E: 4, F: 5, "F#": 6, Gb: 6,
  G: 7, "G#": 8, Ab: 8, A: 9, "A#": 10, Bb: 10, B: 11, "B#": 0, Cb: 11,
  "E#": 5, Fb: 4,
};
const pcOf = (n: string) => PC[n] ?? 0;

/** 기타 6줄 개방현 (6번줄 E 부터) */
const STRINGS = ["E", "A", "D", "G", "B", "E"];
const FRETS = 5;

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
        {/* 건반은 테마와 무관하게 흰/검 그대로 두고, 코드음만 색으로 칠한다 */}
        <div className="flex h-full gap-px">
          {WHITE.map((pc) => (
            <div
              key={pc}
              style={{
                background: chordPcs.has(pc)
                  ? pc === rootPc
                    ? "var(--color-accent)"
                    : "color-mix(in srgb, var(--color-accent) 30%, #ffffff)"
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
                  ? "var(--color-accent)"
                  : "color-mix(in srgb, var(--color-accent) 65%, #111111)"
                : "#1c1c1c",
            }}
            className="absolute top-0 h-[62%] rounded-b-md border border-neutral-700"
          />
        ))}
      </div>

      {/* 기타 지판 — 1~5프렛에서 코드음 위치 (루트는 진하게) */}
      <p className="mt-4 mb-1.5 text-xs font-medium uppercase tracking-wider text-ink-600">
        기타 (1~5프렛)
      </p>
      <div className="max-w-[16rem]">
        <div className="flex gap-1 text-[0.6rem] text-ink-600">
          <span className="w-6" />
          {Array.from({ length: FRETS }, (_, f) => (
            <span key={f} className="flex-1 text-center">
              {f + 1}
            </span>
          ))}
        </div>
        {[...STRINGS].reverse().map((open, idx) => {
          const stringIdx = STRINGS.length - 1 - idx; // 표시는 1번줄이 위
          const openPc = pcOf(open);
          return (
            <div key={`${open}-${stringIdx}`} className="flex items-center gap-1">
              <span
                className={`w-6 text-right text-[0.65rem] ${
                  chordPcs.has(openPc) ? "font-semibold text-accent" : "text-ink-600"
                }`}
                title={chordPcs.has(openPc) ? "개방현으로 사용 가능" : ""}
              >
                {open}
                {chordPcs.has(openPc) ? "○" : ""}
              </span>
              {Array.from({ length: FRETS }, (_, f) => {
                const pc = (openPc + f + 1) % 12;
                const on = chordPcs.has(pc);
                const isRoot = pc === rootPc;
                const isBass = bassPc !== null && pc === bassPc;
                return (
                  <span
                    key={f}
                    className="flex flex-1 items-center justify-center border-l border-ink-700 py-[3px]"
                  >
                    <span
                      className={`grid h-4 w-4 place-items-center rounded-full text-[0.55rem] font-semibold ${
                        on
                          ? isRoot
                            ? "bg-accent text-on-accent"
                            : isBass
                              ? "border border-accent text-accent"
                              : "bg-accent-soft text-accent"
                          : ""
                      }`}
                    >
                      {on ? (isRoot ? "R" : "") : ""}
                    </span>
                  </span>
                );
              })}
            </div>
          );
        })}
        <p className="mt-1.5 text-[0.65rem] leading-relaxed text-ink-600">
          동그라미가 코드에 속한 음이에요. <span className="text-accent">R</span> = 루트,
          현 이름 옆 ○ 는 개방현으로 쓸 수 있다는 뜻.
        </p>
      </div>
    </div>
  );
}
