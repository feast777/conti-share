"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { saveAnnotation, updateSong } from "@/app/actions";
import type { Annotation, Conti, Stroke } from "@/lib/types";
import type { Tool } from "./AnnotationCanvas";
import ReferencePanel from "./ReferencePanel";
import SheetStage from "./SheetStage";

const PEN_COLORS = ["#e11d48", "#2563eb", "#16a34a", "#111827", "#f97316"];
const HIGHLIGHTER_COLORS = ["#facc15", "#4ade80", "#f472b6", "#60a5fa"];
const PEN_SIZES = [0.0022, 0.0038, 0.0065];
const HIGHLIGHTER_SIZES = [0.018, 0.03];

const key = (sheetId: string, page: number) => `${sheetId}:${page}`;

type Props = {
  conti: Conti;
  annotations: Annotation[];
  me: string;
};

export default function ContiViewer({ conti, annotations, me }: Props) {
  const songs = conti.songs;

  const [songIndex, setSongIndex] = useState(0);
  const [pageIndex, setPageIndex] = useState(0);

  const [annotating, setAnnotating] = useState(false);
  const [tool, setTool] = useState<Tool>("pen");
  const [penColor, setPenColor] = useState(PEN_COLORS[0]);
  const [hlColor, setHlColor] = useState(HIGHLIGHTER_COLORS[0]);
  const [penSize, setPenSize] = useState(1);
  const [hlSize, setHlSize] = useState(0);
  const [showOthers, setShowOthers] = useState(true);
  const [fit, setFit] = useState<"contain" | "width">("contain");

  // 하단 패널 높이(px). 0 이면 접힌 상태. 손잡이를 끌어 악보 ↔ 유튜브 분할을 조절한다.
  const [panelH, setPanelH] = useState(300);
  const lastPanelH = useRef(300);
  const [panelTab, setPanelTab] = useState<"ref" | "memo">("ref");
  const [saving, setSaving] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);

  // 페이지터너 페달이 보내는 키 확인용
  const [pedalTest, setPedalTest] = useState(false);
  const [lastKey, setLastKey] = useState("");
  const pedalTestRef = useRef(pedalTest);
  pedalTestRef.current = pedalTest;

  // 상단 곡 탭 스크롤 컨테이너 (곡이 많을 때 활성 탭을 가운데로 보낸다)
  const navRef = useRef<HTMLElement>(null);

  // ── 내 필기 / 남의 필기 ──────────────────────────────
  const [mine, setMine] = useState<Record<string, Stroke[]>>(() => {
    const map: Record<string, Stroke[]> = {};
    for (const a of annotations) {
      if (a.author === me) map[key(a.sheet_id, a.page)] = a.strokes ?? [];
    }
    return map;
  });

  const others = useMemo(() => {
    const map: Record<string, Stroke[]> = {};
    const authors: Record<string, Set<string>> = {};
    for (const a of annotations) {
      if (a.author === me || !a.strokes?.length) continue;
      const k = key(a.sheet_id, a.page);
      (map[k] ??= []).push(...a.strokes);
      (authors[k] ??= new Set()).add(a.author);
    }
    return { map, authors };
  }, [annotations, me]);

  const historyRef = useRef<Record<string, Stroke[][]>>({});

  const song = songs[songIndex];

  /** 곡 안의 악보들을 페이지 단위로 펼친다 (PDF 는 여러 장이 될 수 있다) */
  const pages = useMemo(
    () =>
      (song?.sheets ?? []).flatMap((sheet) =>
        Array.from({ length: Math.max(1, sheet.page_count) }, (_, i) => ({
          sheet,
          page: i + 1,
        }))
      ),
    [song]
  );

  const current = pages[pageIndex];
  const currentKey = current ? key(current.sheet.id, current.page) : "";

  // ── 자동 저장 ───────────────────────────────────────
  const pendingRef = useRef(new Map<string, { sheetId: string; page: number; strokes: Stroke[] }>());
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flush = useCallback(async () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;

    const items = [...pendingRef.current.values()];
    pendingRef.current.clear();
    if (!items.length) return;

    setSaving(true);
    try {
      await Promise.all(items.map((i) => saveAnnotation(i.sheetId, i.page, i.strokes)));
      setSaveFailed(false);
    } catch {
      // 네트워크가 끊겨도 필기를 잃지 않도록 되돌려 넣고 다시 시도한다
      for (const i of items) {
        if (!pendingRef.current.has(key(i.sheetId, i.page))) {
          pendingRef.current.set(key(i.sheetId, i.page), i);
        }
      }
      setSaveFailed(true);
      timerRef.current = setTimeout(() => void flush(), 5000);
    } finally {
      setSaving(false);
    }
  }, []);

  const queueSave = useCallback(
    (sheetId: string, page: number, strokes: Stroke[]) => {
      pendingRef.current.set(key(sheetId, page), { sheetId, page, strokes });
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(flush, 700);
    },
    [flush]
  );

  useEffect(() => () => void flush(), [flush]);

  const handleStrokes = useCallback(
    (next: Stroke[]) => {
      if (!current) return;
      const k = key(current.sheet.id, current.page);
      (historyRef.current[k] ??= []).push(mine[k] ?? []);
      setMine((prev) => ({ ...prev, [k]: next }));
      queueSave(current.sheet.id, current.page, next);
    },
    [current, mine, queueSave]
  );

  const undo = useCallback(() => {
    if (!current) return;
    const k = key(current.sheet.id, current.page);
    const stack = historyRef.current[k];
    if (!stack?.length) return;
    const prev = stack.pop()!;
    setMine((m) => ({ ...m, [k]: prev }));
    queueSave(current.sheet.id, current.page, prev);
  }, [current, queueSave]);

  const clearPage = useCallback(() => {
    if (!current || !confirm("이 페이지의 내 메모를 모두 지울까요?")) return;
    const k = key(current.sheet.id, current.page);
    (historyRef.current[k] ??= []).push(mine[k] ?? []);
    setMine((m) => ({ ...m, [k]: [] }));
    queueSave(current.sheet.id, current.page, []);
  }, [current, mine, queueSave]);

  // ── 곡 · 페이지 넘기기 ──────────────────────────────
  const goTo = useCallback(
    (nextSong: number, nextPage: number) => {
      void flush();
      setSongIndex(nextSong);
      setPageIndex(nextPage);
    },
    [flush]
  );

  const next = useCallback(() => {
    if (pageIndex < pages.length - 1) setPageIndex((p) => p + 1);
    else if (songIndex < songs.length - 1) goTo(songIndex + 1, 0);
  }, [pageIndex, pages.length, songIndex, songs.length, goTo]);

  const prev = useCallback(() => {
    if (pageIndex > 0) setPageIndex((p) => p - 1);
    else if (songIndex > 0) {
      const prevSong = songs[songIndex - 1];
      const lastPage =
        prevSong.sheets.reduce((n, s) => n + Math.max(1, s.page_count), 0) - 1;
      goTo(songIndex - 1, Math.max(0, lastPage));
    }
  }, [pageIndex, songIndex, songs, goTo]);

  const selectSong = useCallback((i: number) => goTo(i, 0), [goTo]);

  // 곡이 바뀌면 상단 탭을 가운데로 스크롤 (곡이 많을 때 활성 탭이 화면 밖에 숨지 않게)
  useEffect(() => {
    const nav = navRef.current;
    const el = nav?.children[songIndex] as HTMLElement | undefined;
    if (!nav || !el) return;
    const navRect = nav.getBoundingClientRect();
    const elRect = el.getBoundingClientRect();
    const delta = elRect.left + elRect.width / 2 - (navRect.left + navRect.width / 2);
    nav.scrollBy({ left: delta, behavior: "smooth" });
  }, [songIndex]);

  // 하단 패널 손잡이 끌기 — 악보 ↔ 유튜브 분할 조절
  const startPanelDrag = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    const onMove = (ev: PointerEvent) => {
      const max = window.innerHeight * 0.85;
      // 손잡이·탭 줄(약 40px)이 내용 위에 있으므로 보정해서 내용 높이를 맞춘다
      const h = Math.max(0, Math.min(max, window.innerHeight - ev.clientY - 40));
      setPanelH(h);
      if (h > 0) lastPanelH.current = h;
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }, []);

  // 접기/펼치기 — 높이만 0 ↔ 이전 높이로. 내용은 계속 마운트되어 재생이 끊기지 않는다.
  const togglePanel = useCallback(() => {
    setPanelH((h) => {
      if (h > 0) {
        lastPanelH.current = h;
        return 0;
      }
      return lastPanelH.current || 300;
    });
  }, []);

  const openPanel = useCallback(() => {
    setPanelH((h) => (h > 0 ? h : lastPanelH.current || 300));
  }, []);

  // 키보드 · 블루투스 페이지터너
  // 페달마다 보내는 키가 달라서 (방향키 / PageUp·Down / 스페이스 / Enter / 미디어키 등)
  // 넘어갈 만한 키를 넓게 받는다. 정확한 키는 상단 "페달" 버튼으로 확인할 수 있다.
  useEffect(() => {
    // key 와 code 를 모두 본다. 아이폰(iOS Safari)에서는 e.key 가 비고 e.code 만 오는
    // 경우가 있어서, code 로도 넘길 수 있게 폭을 넓힌다.
    const NEXT = ["ArrowRight", "ArrowDown", "PageDown", "Right", "Down", "MediaTrackNext", "AudioVolumeDown"];
    const PREV = ["ArrowLeft", "ArrowUp", "PageUp", "Left", "Up", "MediaTrackPrevious", "AudioVolumeUp"];
    const has = (list: string[], e: KeyboardEvent) => list.includes(e.key) || list.includes(e.code);

    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      const tag = el?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || el?.isContentEditable) return;

      if (pedalTestRef.current) setLastKey(`${e.key || "?"}  ·  code: ${e.code || "?"}`);

      const onButton = tag === "BUTTON" || tag === "A";
      const k = e.key;

      // 스페이스·Enter 는 버튼에 포커스가 없을 때만 "다음" 으로 (버튼 클릭과 겹치지 않게)
      const goNext = has(NEXT, e) || ((k === " " || k === "Enter") && !onButton);
      const goPrev = has(PREV, e);

      if (goNext) {
        e.preventDefault();
        next();
      } else if (goPrev) {
        e.preventDefault();
        prev();
      } else if (k === "e") {
        setAnnotating((a) => !a);
      } else if ((e.ctrlKey || e.metaKey) && k === "z") {
        e.preventDefault();
        undo();
      }
    };

    // 페달 확인 모드일 때만: keyup 도 화면에 보여준다. (기기가 keydown 은 안 주고
    // keyup 만 주는지, 아니면 아무 이벤트도 안 오는지 아이폰에서 구분하기 위함)
    const onKeyUp = (e: KeyboardEvent) => {
      if (pedalTestRef.current) setLastKey(`${e.key || "?"}  ·  code: ${e.code || "?"}  (뗌)`);
    };

    window.addEventListener("keydown", onKey);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [next, prev, undo]);

  // 스와이프 (필기 중일 때는 캔버스가 가져간다)
  const touchRef = useRef<{ x: number; y: number } | null>(null);
  const onTouchStart = (e: React.TouchEvent) => {
    if (annotating || e.touches.length !== 1) return;
    touchRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    const start = touchRef.current;
    touchRef.current = null;
    if (!start) return;
    const dx = e.changedTouches[0].clientX - start.x;
    const dy = e.changedTouches[0].clientY - start.y;
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) (dx < 0 ? next : prev)();
  };

  const color = tool === "highlighter" ? hlColor : penColor;
  const size = tool === "highlighter" ? HIGHLIGHTER_SIZES[hlSize] : PEN_SIZES[penSize];
  const palette = tool === "highlighter" ? HIGHLIGHTER_COLORS : PEN_COLORS;
  const otherAuthors = [...(others.authors[currentKey] ?? [])];

  if (!song) {
    return (
      <main className="grid min-h-dvh place-items-center p-6 text-center">
        <div className="space-y-4">
          <p className="text-ink-400">아직 곡이 없습니다.</p>
          <Link
            href={`/conti/${conti.id}/edit`}
            className="inline-block rounded-lg bg-accent px-4 py-2 font-medium text-ink-950"
          >
            곡 추가하기
          </Link>
        </div>
      </main>
    );
  }

  return (
    <div className="flex h-dvh flex-col overflow-hidden">
      {/* 상단 바 */}
      <header className="flex shrink-0 items-center gap-2 border-b border-ink-800 px-2 py-1.5">
        <Link
          href="/"
          className="rounded-md px-2 py-1 text-lg text-ink-400 hover:bg-ink-800 hover:text-white"
          aria-label="콘티 목록"
        >
          ‹
        </Link>

        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-white">
            <span className="mr-1.5 text-ink-600">{songIndex + 1}.</span>
            {song.title}
          </p>
          <p className="truncate text-xs text-ink-600">
            {[song.song_key && `Key ${song.song_key}`, song.bpm && `${song.bpm} BPM`, conti.title]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>

        {saveFailed ? (
          <span className="rounded-md bg-red-500/15 px-2 py-1 text-xs text-red-400">
            저장 실패 · 재시도 중
          </span>
        ) : (
          saving && <span className="text-xs text-ink-600">저장 중…</span>
        )}

        <button
          onClick={() => setFit((f) => (f === "contain" ? "width" : "contain"))}
          className="rounded-md border border-ink-700 px-2 py-1 text-xs text-ink-400 hover:text-white"
          title="화면맞춤 / 폭맞춤"
        >
          {fit === "contain" ? "화면" : "폭"}
        </button>

        <button
          onClick={() => setPedalTest((v) => !v)}
          className={`rounded-md border px-2 py-1 text-xs transition ${
            pedalTest ? "border-accent text-accent" : "border-ink-700 text-ink-400 hover:text-white"
          }`}
          title="페이지터너 페달이 보내는 키 확인"
        >
          페달
        </button>

        <button
          onClick={() => setAnnotating((a) => !a)}
          className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
            annotating ? "bg-accent text-ink-950" : "border border-ink-700 text-ink-400"
          }`}
        >
          ✎ 메모
        </button>

        <Link
          href={`/conti/${conti.id}/edit`}
          className="rounded-md border border-ink-700 px-2 py-1.5 text-xs text-ink-400 hover:text-white"
        >
          편집
        </Link>
      </header>

      {/* 곡 목록 */}
      <nav
        ref={navRef}
        className="flex shrink-0 gap-1 overflow-x-auto border-b border-ink-800 px-2 py-1.5"
      >
        {songs.map((s, i) => (
          <button
            key={s.id}
            onClick={() => selectSong(i)}
            className={`shrink-0 rounded-md px-2.5 py-1 text-xs transition ${
              i === songIndex
                ? "bg-accent-soft text-white"
                : "text-ink-400 hover:bg-ink-800 hover:text-white"
            }`}
          >
            {i + 1}. {s.title}
          </button>
        ))}
      </nav>

      {/* 악보 */}
      <div
        className="relative min-h-0 flex-1 bg-ink-900"
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        {current ? (
          <SheetStage
            sheet={current.sheet}
            page={current.page}
            fit={fit}
            strokes={mine[currentKey] ?? []}
            otherStrokes={showOthers ? (others.map[currentKey] ?? []) : []}
            annotating={annotating}
            tool={tool}
            color={color}
            size={size}
            onStrokesChange={handleStrokes}
          />
        ) : (
          <div className="grid h-full place-items-center p-6 text-center">
            <div className="space-y-3">
              <p className="text-sm text-ink-600">이 곡에는 악보가 없습니다.</p>
              <Link
                href={`/conti/${conti.id}/edit`}
                className="inline-block rounded-lg border border-ink-700 px-3 py-1.5 text-sm text-ink-400"
              >
                악보 올리기
              </Link>
            </div>
          </div>
        )}

        {/* 페이지 넘김 영역 (필기 중에는 비활성) */}
        {!annotating && (
          <>
            <button
              onClick={prev}
              className="group absolute left-0 top-0 h-full w-[12%] cursor-pointer"
              aria-label="이전"
            >
              <span className="pl-1 text-2xl text-white/0 transition group-hover:text-white/40">‹</span>
            </button>
            <button
              onClick={next}
              className="group absolute right-0 top-0 h-full w-[12%] cursor-pointer"
              aria-label="다음"
            >
              <span className="pr-1 text-2xl text-white/0 transition group-hover:text-white/40">›</span>
            </button>
          </>
        )}

        {/* 페이지 표시 */}
        {pages.length > 0 && (
          <div className="pointer-events-none absolute bottom-2 left-1/2 -translate-x-1/2 rounded-full bg-black/60 px-3 py-1 text-xs text-ink-200">
            {pageIndex + 1} / {pages.length}
            {otherAuthors.length > 0 && showOthers && (
              <span className="ml-2 text-ink-400">· {otherAuthors.join(", ")} 메모</span>
            )}
          </div>
        )}

        {/* 페달 확인 — 켜면 마지막으로 눌린 키를 보여준다 */}
        {pedalTest && (
          <div className="pointer-events-none absolute inset-x-0 bottom-10 flex justify-center px-4">
            <div className="max-w-full rounded-lg bg-black/80 px-3 py-1.5 text-center text-xs text-ink-100">
              페달/키를 눌러보세요 → <span className="font-mono text-accent">{lastKey || "…"}</span>
            </div>
          </div>
        )}

        {/* 필기 도구 */}
        {annotating && (
          <div className="absolute right-2 top-2 flex w-14 flex-col items-center gap-1.5 rounded-xl border border-ink-700 bg-ink-950/95 p-1.5 backdrop-blur">
            {(
              [
                ["pen", "✏️"],
                ["highlighter", "🖍️"],
                ["eraser", "🧽"],
              ] as const
            ).map(([t, icon]) => (
              <button
                key={t}
                onClick={() => setTool(t)}
                className={`h-9 w-full rounded-lg text-base transition ${
                  tool === t ? "bg-accent-soft" : "hover:bg-ink-800"
                }`}
              >
                {icon}
              </button>
            ))}

            {tool !== "eraser" && (
              <>
                <div className="my-0.5 h-px w-full bg-ink-700" />
                <div className="grid grid-cols-2 gap-1">
                  {palette.map((c) => (
                    <button
                      key={c}
                      onClick={() => (tool === "highlighter" ? setHlColor(c) : setPenColor(c))}
                      style={{ background: c }}
                      className={`h-5 w-5 rounded-full border-2 transition ${
                        color === c ? "border-white" : "border-transparent"
                      }`}
                      aria-label={`색상 ${c}`}
                    />
                  ))}
                </div>

                <div className="flex w-full flex-col items-center gap-1">
                  {(tool === "highlighter" ? HIGHLIGHTER_SIZES : PEN_SIZES).map((s, i) => {
                    const selected = (tool === "highlighter" ? hlSize : penSize) === i;
                    return (
                      <button
                        key={s}
                        onClick={() => (tool === "highlighter" ? setHlSize(i) : setPenSize(i))}
                        className={`flex h-6 w-full items-center justify-center rounded-md ${
                          selected ? "bg-accent-soft" : "hover:bg-ink-800"
                        }`}
                        aria-label={`두께 ${i + 1}`}
                      >
                        <span
                          style={{ height: Math.max(2, s * 320), background: color }}
                          className="w-6 rounded-full"
                        />
                      </button>
                    );
                  })}
                </div>
              </>
            )}

            <div className="my-0.5 h-px w-full bg-ink-700" />
            <button
              onClick={undo}
              className="h-8 w-full rounded-lg text-sm text-ink-400 hover:bg-ink-800"
              title="되돌리기"
            >
              ↶
            </button>
            <button
              onClick={clearPage}
              className="h-8 w-full rounded-lg text-xs text-ink-400 hover:bg-ink-800"
              title="이 페이지 내 메모 전체 삭제"
            >
              전체
            </button>
            <button
              onClick={() => setShowOthers((v) => !v)}
              className={`h-8 w-full rounded-lg text-xs ${
                showOthers ? "text-accent" : "text-ink-600"
              } hover:bg-ink-800`}
              title="다른 사람 메모 보기"
            >
              👥
            </button>
          </div>
        )}
      </div>

      {/* 하단 패널 — 위 손잡이를 끌어 악보 ↔ 유튜브 크기를 조절한다.
          내용은 접어도 계속 마운트되어 유튜브 재생이 끊기지 않는다. */}
      <section className="flex shrink-0 flex-col border-t border-ink-800 bg-ink-950">
        {/* 드래그 손잡이 */}
        <div
          onPointerDown={startPanelDrag}
          className="no-touch-scroll flex h-4 shrink-0 cursor-row-resize items-center justify-center hover:bg-ink-800"
          title="끌어서 악보 / 유튜브 크기 조절"
        >
          <span className="h-1 w-10 rounded-full bg-ink-600" />
        </div>

        <div className="flex items-center gap-1 px-2 pb-1">
          <button
            onClick={() => {
              setPanelTab("ref");
              openPanel();
            }}
            className={`rounded-md px-3 py-1 text-xs ${
              panelH > 0 && panelTab === "ref" ? "bg-ink-800 text-white" : "text-ink-400"
            }`}
          >
            레퍼런스 {song.references.length > 0 && `(${song.references.length})`}
          </button>
          <button
            onClick={() => {
              setPanelTab("memo");
              openPanel();
            }}
            className={`rounded-md px-3 py-1 text-xs ${
              panelH > 0 && panelTab === "memo" ? "bg-ink-800 text-white" : "text-ink-400"
            }`}
          >
            곡 메모
          </button>
          <div className="flex-1" />
          <button
            onClick={togglePanel}
            className="rounded-md px-2 py-1 text-xs text-ink-400 hover:text-white"
          >
            {panelH > 0 ? "▾ 접기" : "▴ 펼치기"}
          </button>
        </div>

        {/* 레퍼런스는 항상 마운트 → 접거나 곡메모로 바꿔도 재생이 유지된다.
            곡 메모는 그 위에 덮어 씌운다. */}
        <div
          style={{ height: panelH }}
          className="relative shrink-0 overflow-hidden border-t border-ink-800"
        >
          <div className="h-full">
            <ReferencePanel references={song.references} songTitle={song.title} />
          </div>
          {panelTab === "memo" && (
            <div className="absolute inset-0 bg-ink-950">
              <SongMemo song={song} contiId={conti.id} />
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

/** 곡별 전체 메모 — 입력이 멈추면 자동 저장 */
function SongMemo({ song, contiId }: { song: Conti["songs"][number]; contiId: string }) {
  const [value, setValue] = useState(song.memo);
  const [status, setStatus] = useState<"idle" | "saving" | "saved">("idle");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => setValue(song.memo), [song.id, song.memo]);

  const onChange = (v: string) => {
    setValue(v);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      setStatus("saving");
      await updateSong(song.id, contiId, { memo: v });
      setStatus("saved");
    }, 800);
  };

  return (
    <div className="flex h-full flex-col p-3">
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="이 곡 전체에 대한 메모 — 진행 순서, 간주, 전조, 주의할 부분 등"
        className="h-full w-full resize-none leading-relaxed"
      />
      <p className="mt-1 h-4 text-right text-xs text-ink-600">
        {status === "saving" ? "저장 중…" : status === "saved" ? "저장됨" : ""}
      </p>
    </div>
  );
}
