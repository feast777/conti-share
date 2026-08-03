"use client";

import { useEffect, useRef, useState } from "react";

/**
 * 연습용 메트로놈.
 * 브라우저 타이머는 들쭉날쭉해서 박자가 밀리므로, 오디오 시계로 미리 예약해 정확히 울린다.
 */
export default function Metronome({ bpm: initialBpm }: { bpm?: string }) {
  const parsed = Number(String(initialBpm ?? "").replace(/[^\d]/g, ""));
  const [bpm, setBpm] = useState(parsed >= 30 && parsed <= 300 ? parsed : 90);
  const [beats, setBeats] = useState(4); // 한 마디 박 수 (첫 박 강조)
  const [on, setOn] = useState(false);
  const [beat, setBeat] = useState(0);

  const ctxRef = useRef<AudioContext | null>(null);
  const nextTimeRef = useRef(0);
  const beatRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // 재생 중 값이 바뀌어도 즉시 반영되도록 ref 로도 들고 있는다
  const bpmRef = useRef(bpm);
  const beatsRef = useRef(beats);
  bpmRef.current = bpm;
  beatsRef.current = beats;

  // 곡이 바뀌면 그 곡의 BPM 으로 맞춘다
  useEffect(() => {
    const n = Number(String(initialBpm ?? "").replace(/[^\d]/g, ""));
    if (n >= 30 && n <= 300) setBpm(n);
  }, [initialBpm]);

  /** 딸깍 소리 하나를 예약한다 (첫 박은 높고 세게) */
  const click = (ctx: AudioContext, at: number, strong: boolean) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = strong ? 1600 : 1000;
    gain.gain.setValueAtTime(strong ? 0.5 : 0.28, at);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.05);
    osc.connect(gain).connect(ctx.destination);
    osc.start(at);
    osc.stop(at + 0.06);
  };

  const stop = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
    setOn(false);
    setBeat(0);
    beatRef.current = 0;
  };

  const start = async () => {
    const Ctor =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = ctxRef.current ?? new Ctor();
    ctxRef.current = ctx;
    // 아이폰은 사용자가 누른 직후에만 소리를 켤 수 있다
    if (ctx.state === "suspended") await ctx.resume();

    nextTimeRef.current = ctx.currentTime + 0.1;
    beatRef.current = 0;
    setOn(true);

    // 25ms 마다 앞으로 0.2초 구간을 미리 예약해 둔다
    timerRef.current = setInterval(() => {
      while (nextTimeRef.current < ctx.currentTime + 0.2) {
        const isFirst = beatRef.current % beatsRef.current === 0;
        click(ctx, nextTimeRef.current, isFirst);
        const shown = beatRef.current % beatsRef.current;
        const at = nextTimeRef.current;
        const delay = Math.max(0, (at - ctx.currentTime) * 1000);
        setTimeout(() => setBeat(shown), delay);

        nextTimeRef.current += 60 / bpmRef.current;
        beatRef.current += 1;
      }
    }, 25);
  };

  useEffect(() => () => stop(), []);

  // 탭으로 빠르기 재기
  const tapsRef = useRef<number[]>([]);
  const tap = () => {
    const now = Date.now();
    const taps = tapsRef.current.filter((t) => now - t < 3000);
    taps.push(now);
    tapsRef.current = taps;
    if (taps.length >= 2) {
      const gaps = taps.slice(1).map((t, i) => t - taps[i]);
      const avg = gaps.reduce((a, b) => a + b, 0) / gaps.length;
      const next = Math.round(60000 / avg);
      if (next >= 30 && next <= 300) setBpm(next);
    }
  };

  return (
    <div className="h-full space-y-4 overflow-y-auto p-4">
      {/* 박자 표시 */}
      <div className="flex justify-center gap-2">
        {Array.from({ length: beats }, (_, i) => (
          <span
            key={i}
            className={`h-3 w-3 rounded-full transition ${
              on && beat === i ? (i === 0 ? "bg-accent scale-125" : "bg-ink-400") : "bg-ink-700"
            }`}
          />
        ))}
      </div>

      {/* BPM */}
      <div className="flex items-center justify-center gap-3">
        <button
          onClick={() => setBpm((b) => Math.max(30, b - 1))}
          className="grid h-9 w-9 place-items-center rounded-lg border border-ink-700 text-ink-400 transition hover:text-ink-200"
          aria-label="느리게"
        >
          −
        </button>
        <div className="text-center">
          <p className="text-3xl font-semibold tabular-nums tracking-tight text-ink-200">{bpm}</p>
          <p className="text-[0.7rem] text-ink-600">BPM</p>
        </div>
        <button
          onClick={() => setBpm((b) => Math.min(300, b + 1))}
          className="grid h-9 w-9 place-items-center rounded-lg border border-ink-700 text-ink-400 transition hover:text-ink-200"
          aria-label="빠르게"
        >
          +
        </button>
      </div>

      <input
        type="range"
        min={30}
        max={240}
        value={bpm}
        onChange={(e) => setBpm(Number(e.target.value))}
        className="w-full"
        aria-label="빠르기"
      />

      {/* 재생 · 탭 */}
      <div className="flex justify-center gap-2">
        <button
          onClick={() => (on ? stop() : void start())}
          className={`rounded-[0.625rem] px-6 py-2.5 text-sm font-medium transition ${
            on ? "bg-ink-800 text-ink-200" : "bg-accent text-on-accent hover:opacity-90"
          }`}
        >
          {on ? "정지" : "시작"}
        </button>
        <button
          onClick={tap}
          className="rounded-[0.625rem] border border-ink-700 px-4 py-2.5 text-sm text-ink-400 transition hover:text-ink-200"
          title="박자에 맞춰 여러 번 누르면 빠르기가 맞춰집니다"
        >
          탭
        </button>
      </div>

      {/* 박자 수 */}
      <div className="flex items-center justify-center gap-1.5">
        <span className="mr-1 text-xs text-ink-600">박자</span>
        {[2, 3, 4, 6].map((n) => (
          <button
            key={n}
            onClick={() => setBeats(n)}
            className={`rounded-md border px-2.5 py-1 text-xs transition ${
              beats === n
                ? "border-accent text-accent"
                : "border-ink-700 text-ink-400 hover:text-ink-200"
            }`}
          >
            {n}/4
          </button>
        ))}
      </div>
    </div>
  );
}
