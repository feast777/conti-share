"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { copySongTo, findSongs } from "@/app/actions";
import type { SongHit } from "@/lib/types";

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];
function formatDate(iso: string) {
  const d = new Date(`${iso}T00:00:00`);
  return `${d.getFullYear() % 100}.${d.getMonth() + 1}.${d.getDate()} (${WEEKDAYS[d.getDay()]})`;
}

/**
 * 지난 콘티에서 곡 찾기 — 제목으로 검색해 언제 불렀는지 보고,
 * 악보·레퍼런스·가사까지 통째로 이 콘티에 가져온다.
 */
export default function SongSearch({ contiId }: { contiId: string }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<SongHit[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 입력이 멈추면 검색 (타자마다 요청하지 않도록)
  useEffect(() => {
    if (!open) return;
    const q = query.trim();
    if (timer.current) clearTimeout(timer.current);
    if (!q) {
      setHits(null);
      return;
    }
    timer.current = setTimeout(async () => {
      try {
        setHits(await findSongs(q));
      } catch {
        setHits([]);
      }
    }, 300);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [query, open]);

  const bring = async (hit: SongHit) => {
    setBusy(hit.song_id);
    try {
      await copySongTo(hit.song_id, contiId);
      startTransition(() => router.refresh());
      setOpen(false);
      setQuery("");
      setHits(null);
    } catch (e) {
      alert("곡을 가져오지 못했습니다.\n" + (e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="rounded-lg border border-ink-700 px-3 py-2 text-sm text-ink-400 transition hover:text-ink-200"
        title="지난 콘티에서 곡을 찾아 악보·메모까지 그대로 가져옵니다"
      >
        지난 곡 찾기
      </button>
    );
  }

  return (
    <div className="card w-full p-3">
      <div className="flex gap-2">
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="곡 제목으로 검색 (예: 내 평생에)"
          className="min-w-0 flex-1 text-sm"
        />
        <button
          onClick={() => {
            setOpen(false);
            setQuery("");
            setHits(null);
          }}
          className="shrink-0 rounded-lg px-2 text-sm text-ink-400 hover:text-ink-200"
        >
          닫기
        </button>
      </div>

      {hits && (
        <div className="mt-3">
          {hits.length === 0 ? (
            <p className="py-3 text-center text-sm text-ink-600">찾는 곡이 없어요.</p>
          ) : (
            <ul className="max-h-72 space-y-1 overflow-y-auto">
              {hits.map((h) => (
                <li
                  key={`${h.song_id}`}
                  className="flex items-center gap-2 rounded-lg px-2 py-2 transition hover:bg-ink-800"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-ink-200">{h.title}</p>
                    <p className="mt-0.5 truncate text-xs text-ink-600">
                      {formatDate(h.service_date)} · {h.conti_title}
                      {h.song_key && ` · Key ${h.song_key}`}
                      {h.sheet_count > 0 && ` · 악보 ${h.sheet_count}`}
                    </p>
                  </div>
                  <button
                    onClick={() => bring(h)}
                    disabled={!!busy}
                    className="shrink-0 rounded-lg bg-accent px-2.5 py-1.5 text-xs font-medium text-on-accent transition hover:opacity-90 disabled:opacity-50"
                  >
                    {busy === h.song_id ? "가져오는 중…" : "가져오기"}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
