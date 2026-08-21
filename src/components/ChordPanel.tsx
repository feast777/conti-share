"use client";

import { useState } from "react";
import ChordCard from "@/components/ChordCard";
import { extractChords, parseChord } from "@/lib/chords";
import type { SheetLite } from "@/lib/lyrics";

const COMMON = ["C", "Am", "F", "G", "Em", "Dm", "E", "A", "B", "F#m", "C#m", "G#m"];

/**
 * 코드 도감 — 코드 이름을 입력하면 구성음·건반·기타 지판을 보여준다.
 * '악보에서 찾기'를 누르면 지금 보는 곡의 악보에서 코드 기호를 뽑아 목록으로 만든다.
 */
export default function ChordPanel({ sheets }: { sheets: SheetLite[] }) {
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState<string | null>(null);
  const [found, setFound] = useState<string[] | null>(null);
  const [busy, setBusy] = useState(false);

  const typed = query.trim();
  const typedOk = typed ? !!parseChord(typed) : false;
  const showing = picked ?? (typedOk ? typed : null);

  const scan = async () => {
    const usable = sheets.filter((s) => s.url);
    if (!usable.length) {
      alert("이 곡에는 악보가 없어요.");
      return;
    }
    setBusy(true);
    try {
      const { extractSheetText, terminateWorker } = await import("@/lib/lyrics");
      let text = "";
      for (const s of usable) {
        try {
          text += (await extractSheetText(s)) + "\n";
        } catch {
          /* 한 장 실패해도 계속 */
        }
      }
      await terminateWorker();
      setFound(extractChords(text));
    } catch (e) {
      alert("악보에서 코드를 찾지 못했어요.\n" + (e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="h-full space-y-3 overflow-y-auto p-3">
      {/* 입력 */}
      <div className="flex gap-2">
        <input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setPicked(null);
          }}
          placeholder="코드 입력 (예: D#m7(b5), G#7(#11), C#m7/B)"
          className="w-full text-sm"
        />
      </div>

      {/* 악보에서 코드 가져오기 — 누르면 이 곡 악보의 코드를 목록으로 만든다 */}
      <button
        onClick={scan}
        disabled={busy}
        className="flex w-full items-center justify-center gap-1.5 rounded-[0.625rem] bg-accent px-4 py-2.5 text-sm font-medium text-on-accent transition hover:opacity-90 disabled:opacity-60"
      >
        {busy ? "악보 읽는 중…" : "악보에서 코드 가져오기"}
      </button>

      {/* 악보에서 찾은 코드 */}
      {found && (
        <div>
          <p className="mb-1.5 text-xs text-ink-600">
            {found.length ? `악보에서 찾은 코드 ${found.length}개` : "악보에서 코드를 못 찾았어요"}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {found.map((c) => (
              <button
                key={c}
                onClick={() => {
                  setPicked(c);
                  setQuery(c);
                }}
                className={`rounded-lg border px-2.5 py-1 text-xs transition ${
                  showing === c
                    ? "border-accent text-accent-ink"
                    : "border-ink-700 text-ink-400 hover:text-ink-200"
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 자주 쓰는 코드 — 악보에서 못 찾았을 때도 계속 쓸 수 있게 둔다 */}
      {(!found || found.length === 0) && (
        <div>
          <p className="mb-1.5 text-xs text-ink-600">자주 쓰는 코드</p>
          <div className="flex flex-wrap gap-1.5">
            {COMMON.map((c) => (
              <button
                key={c}
                onClick={() => {
                  setPicked(c);
                  setQuery(c);
                }}
                className="rounded-lg border border-ink-700 px-2.5 py-1 text-xs text-ink-400 transition hover:text-ink-200"
              >
                {c}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 결과 */}
      {showing ? (
        <ChordCard name={showing} />
      ) : typed ? (
        <p className="text-sm text-ink-600">
          <span className="text-ink-400">{typed}</span> — 아직 코드로 읽지 못했어요. 예: Am7, Bb, F#m7(b5)
        </p>
      ) : null}
    </div>
  );
}
