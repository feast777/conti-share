"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import {
  addReference,
  addSong,
  createSheetUploadUrl,
  deleteConti,
  deleteReference,
  deleteSheet,
  deleteSong,
  duplicateConti,
  registerSheet,
  reorderSongs,
  updateConti,
  updateSong,
} from "@/app/actions";
import { readPdfPageCount } from "@/lib/pdf";
import type { Conti, Song } from "@/lib/types";
import DebouncedField from "./DebouncedField";

const ACCEPT = ".pdf,image/png,image/jpeg,image/webp";

export default function ContiEditor({ conti }: { conti: Conti }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [newSong, setNewSong] = useState("");

  const refresh = () => startTransition(() => router.refresh());

  const handleAddSong = async () => {
    const title = newSong.trim();
    if (!title) return;
    setNewSong("");
    await addSong(conti.id, title);
    refresh();
  };

  const move = async (index: number, delta: number) => {
    const ids = conti.songs.map((s) => s.id);
    const target = index + delta;
    if (target < 0 || target >= ids.length) return;
    [ids[index], ids[target]] = [ids[target], ids[index]];
    await reorderSongs(conti.id, ids);
    refresh();
  };

  return (
    <main className="mx-auto max-w-3xl px-4 py-6 pb-24">
      <header className="mb-6 flex items-center gap-2">
        <Link href={`/conti/${conti.id}`} className="text-lg text-ink-400 hover:text-white">
          ‹
        </Link>
        <h1 className="flex-1 text-lg font-semibold text-white">콘티 편집</h1>
        <button
          onClick={() => void duplicateConti(conti.id)}
          className="rounded-lg border border-ink-700 px-3 py-1.5 text-sm text-ink-400 hover:text-white"
          title="곡 · 악보 · 레퍼런스를 그대로 복사해 새 콘티를 만듭니다"
        >
          복사
        </button>
        <Link
          href={`/conti/${conti.id}`}
          className="rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-ink-950"
        >
          보기
        </Link>
      </header>

      {/* 콘티 정보 */}
      <section className="mb-6 space-y-3 rounded-xl border border-ink-700 bg-ink-900 p-4">
        <div className="flex flex-col gap-2 sm:flex-row">
          <DebouncedField
            value={conti.title}
            onSave={(v) => updateConti(conti.id, { title: v })}
            placeholder="콘티 이름"
            className="flex-1"
          />
          <input
            type="date"
            defaultValue={conti.service_date}
            onChange={(e) => updateConti(conti.id, { service_date: e.target.value })}
            className="sm:w-44"
          />
        </div>
        <DebouncedField
          value={conti.note}
          onSave={(v) => updateConti(conti.id, { note: v })}
          placeholder="콘티 전체 안내사항 (예: 리허설 2시, 인도자 ○○○)"
          multiline
          rows={2}
          className="w-full resize-none"
        />
      </section>

      {/* 곡 목록 */}
      <ol className="space-y-4">
        {conti.songs.map((song, i) => (
          <SongCard
            key={song.id}
            song={song}
            index={i}
            total={conti.songs.length}
            contiId={conti.id}
            onMove={move}
            onRefresh={refresh}
          />
        ))}
      </ol>

      {/* 곡 추가 */}
      <div className="mt-4 flex gap-2">
        <input
          value={newSong}
          onChange={(e) => setNewSong(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleAddSong()}
          placeholder="곡 제목을 입력하고 Enter"
          className="flex-1"
        />
        <button
          onClick={handleAddSong}
          className="rounded-lg bg-accent px-4 py-2 font-medium text-ink-950"
        >
          곡 추가
        </button>
      </div>

      <div className="mt-12 border-t border-ink-800 pt-4">
        <button
          onClick={() => {
            if (confirm(`"${conti.title}" 콘티를 삭제할까요? 악보와 메모도 함께 지워집니다.`)) {
              void deleteConti(conti.id);
            }
          }}
          className="text-sm text-red-400 hover:text-red-300"
        >
          이 콘티 삭제
        </button>
      </div>
    </main>
  );
}

// ─────────────────────────────────────────────

function SongCard({
  song,
  index,
  total,
  contiId,
  onMove,
  onRefresh,
}: {
  song: Song;
  index: number;
  total: number;
  contiId: string;
  onMove: (index: number, delta: number) => void;
  onRefresh: () => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState<string | null>(null);
  const [refUrl, setRefUrl] = useState("");
  const [refLabel, setRefLabel] = useState("");

  const upload = async (files: FileList | null) => {
    if (!files?.length) return;

    for (const file of Array.from(files)) {
      try {
        setUploading(file.name);
        const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
        const pageCount = isPdf ? await readPdfPageCount(file) : 1;

        const { uploadUrl, path } = await createSheetUploadUrl(song.id, file.name);
        const res = await fetch(uploadUrl, {
          method: "PUT",
          headers: { "content-type": file.type || "application/octet-stream" },
          body: file,
        });
        if (!res.ok) throw new Error(await res.text());

        await registerSheet({
          songId: song.id,
          contiId,
          path,
          fileName: file.name,
          kind: isPdf ? "pdf" : "image",
          pageCount,
        });
      } catch (err) {
        alert(`"${file.name}" 업로드에 실패했습니다.\n${(err as Error).message}`);
      } finally {
        setUploading(null);
      }
    }

    if (fileRef.current) fileRef.current.value = "";
    onRefresh();
  };

  const handleAddRef = async () => {
    if (!refUrl.trim()) return;
    await addReference(song.id, contiId, refUrl, refLabel);
    setRefUrl("");
    setRefLabel("");
    onRefresh();
  };

  return (
    <li className="rounded-xl border border-ink-700 bg-ink-900 p-4">
      <div className="mb-3 flex items-start gap-2">
        <span className="mt-2 w-5 shrink-0 text-center text-sm text-ink-600">{index + 1}</span>

        <div className="min-w-0 flex-1 space-y-2">
          <DebouncedField
            value={song.title}
            onSave={(v) => updateSong(song.id, contiId, { title: v })}
            placeholder="곡 제목"
            className="w-full font-medium"
          />
          <div className="flex gap-2">
            <DebouncedField
              value={song.song_key}
              onSave={(v) => updateSong(song.id, contiId, { song_key: v })}
              placeholder="Key (예: G)"
              className="w-28"
            />
            <DebouncedField
              value={song.bpm}
              onSave={(v) => updateSong(song.id, contiId, { bpm: v })}
              placeholder="BPM"
              className="w-24"
            />
          </div>
        </div>

        <div className="flex shrink-0 flex-col gap-1">
          <button
            onClick={() => onMove(index, -1)}
            disabled={index === 0}
            className="rounded px-2 text-ink-400 hover:text-white disabled:opacity-25"
          >
            ▲
          </button>
          <button
            onClick={() => onMove(index, 1)}
            disabled={index === total - 1}
            className="rounded px-2 text-ink-400 hover:text-white disabled:opacity-25"
          >
            ▼
          </button>
        </div>
      </div>

      <DebouncedField
        value={song.memo}
        onSave={(v) => updateSong(song.id, contiId, { memo: v })}
        placeholder="곡 메모 — 진행 순서, 간주, 전조 등"
        multiline
        rows={2}
        className="mb-3 w-full resize-none text-sm"
      />

      {/* 악보 */}
      <div className="mb-3">
        <p className="mb-1.5 text-xs font-medium text-ink-400">악보</p>
        <div className="flex flex-wrap gap-2">
          {song.sheets.map((sheet) => (
            <span
              key={sheet.id}
              className="flex items-center gap-2 rounded-lg border border-ink-700 px-2.5 py-1 text-xs"
            >
              <span className="max-w-40 truncate">{sheet.file_name || sheet.kind}</span>
              <span className="text-ink-600">
                {sheet.kind === "pdf" ? `${sheet.page_count}p` : "img"}
              </span>
              <button
                onClick={async () => {
                  if (!confirm("이 악보를 삭제할까요? 이 악보에 쓴 메모도 함께 지워집니다.")) return;
                  await deleteSheet(sheet.id, contiId);
                  onRefresh();
                }}
                className="text-ink-600 hover:text-red-400"
              >
                ✕
              </button>
            </span>
          ))}

          <button
            onClick={() => fileRef.current?.click()}
            disabled={!!uploading}
            className="rounded-lg border border-dashed border-ink-600 px-2.5 py-1 text-xs text-ink-400 hover:text-white disabled:opacity-50"
          >
            {uploading ? `${uploading} 올리는 중…` : "+ PDF · 이미지"}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept={ACCEPT}
            multiple
            hidden
            onChange={(e) => upload(e.target.files)}
          />
        </div>
      </div>

      {/* 레퍼런스 */}
      <div>
        <p className="mb-1.5 text-xs font-medium text-ink-400">레퍼런스 (유튜브)</p>
        <ul className="mb-2 space-y-1">
          {song.references.map((ref) => (
            <li key={ref.id} className="flex items-center gap-2 text-xs">
              <span className="shrink-0 text-ink-400">{ref.label || "링크"}</span>
              <a
                href={ref.url}
                target="_blank"
                rel="noreferrer"
                className="min-w-0 flex-1 truncate text-accent hover:underline"
              >
                {ref.url}
              </a>
              <button
                onClick={async () => {
                  await deleteReference(ref.id, contiId);
                  onRefresh();
                }}
                className="text-ink-600 hover:text-red-400"
              >
                ✕
              </button>
            </li>
          ))}
        </ul>

        <div className="flex gap-2">
          <input
            value={refLabel}
            onChange={(e) => setRefLabel(e.target.value)}
            placeholder="이름"
            className="w-24 text-sm"
          />
          <input
            value={refUrl}
            onChange={(e) => setRefUrl(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAddRef()}
            placeholder="https://youtu.be/..."
            className="min-w-0 flex-1 text-sm"
          />
          <button
            onClick={handleAddRef}
            className="shrink-0 rounded-lg border border-ink-700 px-3 text-sm text-ink-400 hover:text-white"
          >
            추가
          </button>
        </div>
      </div>

      <div className="mt-3 border-t border-ink-800 pt-2 text-right">
        <button
          onClick={async () => {
            if (!confirm(`"${song.title}" 곡을 삭제할까요?`)) return;
            await deleteSong(song.id, contiId);
            onRefresh();
          }}
          className="text-xs text-ink-600 hover:text-red-400"
        >
          곡 삭제
        </button>
      </div>
    </li>
  );
}
