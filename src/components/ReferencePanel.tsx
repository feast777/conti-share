"use client";

import { useEffect, useState } from "react";
import type { Reference } from "@/lib/types";
import { embedUrl, parseYoutube, thumbnailUrl } from "@/lib/youtube";

/** 곡 제목 + 악기 로 유튜브를 검색하는 버튼 목록 (필요하면 여기서 추가/변경) */
const INSTRUMENTS = [
  { label: "피아노", icon: "🎹" },
  { label: "일렉기타", icon: "🎸" },
  { label: "베이스", icon: "🎸" },
  { label: "드럼", icon: "🥁" },
];

const searchUrl = (songTitle: string, instrument: string) =>
  `https://www.youtube.com/results?search_query=${encodeURIComponent(`${songTitle} ${instrument}`)}`;

export default function ReferencePanel({
  references,
  songTitle,
}: {
  references: Reference[];
  songTitle: string;
}) {
  const [playing, setPlaying] = useState<string | null>(null);

  // 곡이 바뀌면 재생을 멈춘다
  useEffect(() => setPlaying(null), [references]);

  return (
    <div className="flex h-full gap-3 overflow-x-auto p-3">
      {references.map((ref) => {
        const yt = parseYoutube(ref.url);

        if (!yt) {
          return (
            <a
              key={ref.id}
              href={ref.url}
              target="_blank"
              rel="noreferrer"
              className="flex h-full min-w-56 items-center justify-center rounded-lg border border-ink-700 px-4 text-center text-sm text-accent"
            >
              {ref.label || ref.url}
            </a>
          );
        }

        const isPlaying = playing === ref.id;

        return (
          <div key={ref.id} className="flex h-full shrink-0 flex-col">
            <div className="relative h-full aspect-video overflow-hidden rounded-lg bg-black">
              {isPlaying ? (
                <iframe
                  src={embedUrl(yt)}
                  title={ref.label || "레퍼런스"}
                  allow="accelerometer; autoplay; encrypted-media; picture-in-picture"
                  allowFullScreen
                  className="h-full w-full"
                />
              ) : (
                <button
                  onClick={() => setPlaying(ref.id)}
                  className="group relative h-full w-full"
                  aria-label={`${ref.label || "레퍼런스"} 재생`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={thumbnailUrl(yt.id)}
                    alt=""
                    className="h-full w-full object-cover opacity-80 transition group-hover:opacity-100"
                  />
                  <span className="absolute inset-0 grid place-items-center">
                    <span className="grid h-11 w-11 place-items-center rounded-full bg-black/70 text-lg text-white">
                      ▶
                    </span>
                  </span>
                </button>
              )}
            </div>
            {ref.label && (
              <p className="mt-1 truncate text-center text-xs text-ink-400">{ref.label}</p>
            )}
          </div>
        );
      })}

      {/* 곡 제목 + 악기 로 유튜브에서 바로 찾기 */}
      <div className="flex h-full shrink-0 flex-col justify-center gap-1.5 rounded-lg border border-dashed border-ink-700 px-3 py-2">
        <p className="mb-0.5 px-1 text-[11px] text-ink-600">유튜브에서 찾기</p>
        <div className="grid grid-cols-2 gap-1.5">
          {INSTRUMENTS.map((it) => (
            <a
              key={it.label}
              href={searchUrl(songTitle, it.label)}
              target="_blank"
              rel="noreferrer"
              className="flex items-center justify-center gap-1 rounded-md border border-ink-700 px-3 py-2 text-xs text-ink-400 transition hover:border-ink-500 hover:text-white"
            >
              <span>{it.icon}</span>
              <span>{it.label}</span>
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}
