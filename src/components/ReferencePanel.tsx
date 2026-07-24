"use client";

import { useEffect, useState } from "react";
import type { Reference } from "@/lib/types";
import { embedUrl, parseYoutube, thumbnailUrl } from "@/lib/youtube";

export default function ReferencePanel({ references }: { references: Reference[] }) {
  const [playing, setPlaying] = useState<string | null>(null);

  // 곡이 바뀌면 재생을 멈춘다
  useEffect(() => setPlaying(null), [references]);

  if (references.length === 0) {
    return (
      <p className="p-6 text-center text-sm text-ink-600">
        등록된 레퍼런스가 없습니다. 편집 화면에서 유튜브 링크를 추가하세요.
      </p>
    );
  }

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
    </div>
  );
}
