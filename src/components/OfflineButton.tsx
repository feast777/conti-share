"use client";

import { useEffect, useState } from "react";

/**
 * 이 콘티의 악보를 기기에 미리 받아둔다.
 * 예배당 인터넷이 끊겨도 받아둔 악보는 그대로 보인다.
 */
export default function OfflineButton({ urls }: { urls: string[] }) {
  const [ready, setReady] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [saved, setSaved] = useState(false);
  const [online, setOnline] = useState(true);

  useEffect(() => {
    setOnline(navigator.onLine);
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js")
        .then(() => navigator.serviceWorker.ready)
        .then(() => setReady(true))
        .catch(() => setReady(false));

      const onMsg = (e: MessageEvent) => {
        if (e.data?.type === "cache-progress") {
          setProgress({ done: e.data.done, total: e.data.total });
          if (e.data.done >= e.data.total) {
            setSaved(true);
            setTimeout(() => setProgress(null), 1200);
          }
        }
      };
      navigator.serviceWorker.addEventListener("message", onMsg);
      return () => {
        navigator.serviceWorker.removeEventListener("message", onMsg);
        window.removeEventListener("online", on);
        window.removeEventListener("offline", off);
      };
    }
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  const download = () => {
    if (!urls.length) {
      alert("받을 악보가 없어요.");
      return;
    }
    const sw = navigator.serviceWorker?.controller;
    if (!sw) {
      alert("잠시 후 다시 눌러주세요. (오프라인 준비 중)");
      return;
    }
    setSaved(false);
    setProgress({ done: 0, total: urls.length });
    sw.postMessage({ type: "cache-sheets", urls });
  };

  if (!ready) return null;

  return (
    <div className="flex items-center gap-2">
      {!online && (
        <span className="rounded-md bg-ink-800 px-2 py-1 text-[0.7rem] text-ink-400">
          오프라인
        </span>
      )}
      <button
        onClick={download}
        disabled={!!progress && progress.done < progress.total}
        className="shrink-0 whitespace-nowrap rounded-md border border-ink-700 px-2 py-1 text-xs text-ink-400 transition hover:text-ink-200 disabled:opacity-60"
        title="악보를 기기에 받아두면 인터넷이 없어도 볼 수 있어요"
      >
        {progress
          ? progress.done >= progress.total
            ? "저장됨"
            : `${progress.done}/${progress.total}`
          : saved
            ? "저장됨"
            : "↓ 저장"}
      </button>
    </div>
  );
}
