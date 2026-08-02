"use client";

import { useEffect, useState } from "react";
import { searchYoutubeMany } from "@/app/actions";
import type { Reference, YoutubeHit } from "@/lib/types";
import { embedUrl, parseYoutube, thumbnailUrl } from "@/lib/youtube";

/** 곡 제목 + 악기 로 유튜브를 찾는 버튼 목록 (필요하면 여기서 추가/변경) */
const INSTRUMENTS = [
  { label: "피아노", icon: "🎹" },
  { label: "일렉기타", icon: "🎸" },
  { label: "베이스", icon: "🎸" },
  { label: "드럼", icon: "🥁" },
];

const searchUrl = (songTitle: string, instrument: string) =>
  `https://www.youtube.com/results?search_query=${encodeURIComponent(`${songTitle} ${instrument}`)}`;

/** "loading" = 검색 중, 배열 = 찾은 영상들(최대 5개), null = 아직 안 찾음 */
type Found = "loading" | YoutubeHit[] | null;

export default function ReferencePanel({
  references,
  songTitle,
}: {
  references: Reference[];
  songTitle: string;
}) {
  const [playing, setPlaying] = useState<string | null>(null);
  const [openInst, setOpenInst] = useState<string | null>(null);
  const [found, setFound] = useState<Record<string, Found>>({});

  // 곡이 바뀌면 재생·검색 상태를 초기화한다
  useEffect(() => {
    setPlaying(null);
    setOpenInst(null);
    setFound({});
  }, [references, songTitle]);

  const pickInstrument = async (instrument: string) => {
    setOpenInst(instrument);
    setPlaying(null);
    if (found[instrument] === undefined) {
      setFound((f) => ({ ...f, [instrument]: "loading" }));
      const hits = await searchYoutubeMany(`${songTitle} ${instrument}`);
      setFound((f) => ({ ...f, [instrument]: hits }));
    }
  };

  const result = openInst ? found[openInst] : undefined;

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

      {/* 곡 제목 + 악기 로 유튜브에서 찾아 앱 안에서 재생 */}
      <div className="flex h-full shrink-0 flex-col justify-center gap-1.5 rounded-lg border border-dashed border-ink-700 px-3 py-2">
        <p className="mb-0.5 px-1 text-[11px] text-ink-600">유튜브에서 찾기</p>
        <div className="grid grid-cols-2 gap-1.5">
          {INSTRUMENTS.map((it) => (
            <button
              key={it.label}
              onClick={() => pickInstrument(it.label)}
              className={`flex items-center justify-center gap-1 rounded-md border px-3 py-2 text-xs transition ${
                openInst === it.label
                  ? "border-accent text-white"
                  : "border-ink-700 text-ink-400 hover:border-ink-500 hover:text-white"
              }`}
            >
              <span>{it.icon}</span>
              <span>{it.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* 선택한 악기의 검색 결과 — 최대 5개 중 골라 재생 */}
      {openInst && result === "loading" && (
        <div className="grid h-full aspect-video shrink-0 place-items-center rounded-lg border border-ink-700 text-xs text-ink-500">
          검색 중…
        </div>
      )}

      {openInst && Array.isArray(result) && result.length === 0 && (
        <div className="grid h-full aspect-video shrink-0 place-content-center gap-1 rounded-lg border border-ink-700 p-3 text-center">
          <p className="text-xs text-ink-500">결과를 못 찾았어요</p>
          <a
            href={searchUrl(songTitle, openInst)}
            target="_blank"
            rel="noreferrer"
            className="text-xs text-accent underline"
          >
            유튜브에서 보기
          </a>
        </div>
      )}

      {openInst &&
        Array.isArray(result) &&
        result.map((hit) => (
          <div key={hit.id} className="flex h-full shrink-0 flex-col">
            <div className="relative h-full aspect-video overflow-hidden rounded-lg bg-black">
              {playing === hit.id ? (
                <iframe
                  src={embedUrl({ id: hit.id, start: 0 })}
                  title={hit.title || openInst}
                  allow="accelerometer; autoplay; encrypted-media; picture-in-picture"
                  allowFullScreen
                  className="h-full w-full"
                />
              ) : (
                <button
                  onClick={() => setPlaying(hit.id)}
                  className="group relative h-full w-full"
                  aria-label={`${hit.title || openInst} 재생`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={thumbnailUrl(hit.id)}
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
            <p className="mt-1 max-w-40 truncate text-center text-xs text-ink-400">
              {hit.title || openInst}
            </p>
          </div>
        ))}
    </div>
  );
}
