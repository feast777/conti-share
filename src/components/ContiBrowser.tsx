"use client";

import {
  DndContext,
  DragOverlay,
  type DragEndEvent,
  type DragStartEvent,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { createFolder, moveConti } from "@/app/actions";
import PdfButton from "@/components/PdfButton";
import type { ContiSummary, FolderSummary } from "@/lib/types";

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];
function formatDate(iso: string) {
  const d = new Date(`${iso}T00:00:00`);
  return `${d.getMonth() + 1}월 ${d.getDate()}일 (${WEEKDAYS[d.getDay()]})`;
}

const ROOT = "__root__";

type Props = {
  folders: FolderSummary[];
  contis: ContiSummary[];
  currentFolderId: string | null; // null = 홈
};

export default function ContiBrowser({ folders, contis, currentFolderId }: Props) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const refresh = () => startTransition(() => router.refresh());

  const [activeId, setActiveId] = useState<string | null>(null);
  const [newFolder, setNewFolder] = useState("");

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 6 } }),
    useSensor(KeyboardSensor)
  );

  const isHome = currentFolderId === null;
  // 목적지: 홈이면 모든 폴더, 폴더 안이면 현재 폴더는 빼고 나머지 폴더
  const destinations = isHome ? folders : folders.filter((f) => f.id !== currentFolderId);
  const activeConti = contis.find((c) => c.id === activeId) ?? null;

  const onDragEnd = (e: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = e;
    if (!over) return;
    const conti = contis.find((c) => c.id === String(active.id));
    if (!conti) return;
    const target = String(over.id) === ROOT ? null : String(over.id);
    if ((conti.folder_id ?? null) === target) return; // 이미 그 위치면 무시
    void moveConti(conti.id, target).then(refresh);
  };

  const handleAddFolder = async () => {
    const name = newFolder.trim();
    if (!name) return;
    setNewFolder("");
    await createFolder(name);
    refresh();
  };

  return (
    <DndContext
      sensors={sensors}
      onDragStart={(e: DragStartEvent) => setActiveId(String(e.active.id))}
      onDragEnd={onDragEnd}
      onDragCancel={() => setActiveId(null)}
    >
      {/* 폴더 / 목적지 */}
      <section className="mb-6">
        <p className="mb-2 text-sm font-medium text-ink-400">폴더</p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {!isHome && <RootDrop />}
          {destinations.map((f) => (
            <FolderDrop key={f.id} folder={f} />
          ))}
          {isHome && (
            <NewFolder value={newFolder} onChange={setNewFolder} onAdd={handleAddFolder} />
          )}
        </div>
        {isHome && folders.length === 0 && (
          <p className="mt-1 text-xs text-ink-600">
            폴더를 만들고, 아래 콘티를 폴더 위로 끌어다 놓으면 정리됩니다.
          </p>
        )}
      </section>

      {/* 콘티 */}
      <section>
        <p className="mb-2 text-sm font-medium text-ink-400">
          {isHome ? "폴더에 없는 콘티" : "이 폴더의 콘티"}
        </p>
        {contis.length === 0 ? (
          <p className="rounded-xl border border-dashed border-ink-700 p-8 text-center text-sm text-ink-600">
            {isHome
              ? "폴더 밖 콘티가 없습니다."
              : "이 폴더에 콘티가 없습니다. 콘티 목록에서 여기로 끌어다 놓으세요."}
          </p>
        ) : (
          <ul className="space-y-2">
            {contis.map((c) => (
              <ContiCard key={c.id} conti={c} dimmed={activeId === c.id} />
            ))}
          </ul>
        )}
      </section>

      <DragOverlay>
        {activeConti ? (
          <div className="rounded-xl border border-accent bg-ink-800 px-4 py-3 shadow-2xl">
            <p className="truncate font-medium text-white">{activeConti.title}</p>
            <p className="mt-0.5 text-xs text-ink-400">
              {formatDate(activeConti.service_date)} · {activeConti.song_count}곡
            </p>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

// ─────────────────────────────────────────────

function FolderDrop({ folder }: { folder: FolderSummary }) {
  const { setNodeRef, isOver } = useDroppable({ id: folder.id });
  return (
    <Link
      ref={setNodeRef}
      href={`/folder/${folder.id}`}
      className={`flex flex-col rounded-xl border p-3 transition ${
        isOver
          ? "border-accent bg-accent-soft"
          : "border-ink-700 bg-ink-900 hover:border-ink-600"
      }`}
    >
      <span className="text-lg">📁</span>
      <span className="mt-1 truncate text-sm font-medium text-white">{folder.name}</span>
      <span className="text-xs text-ink-600">{folder.conti_count}개</span>
    </Link>
  );
}

function RootDrop() {
  const { setNodeRef, isOver } = useDroppable({ id: ROOT });
  return (
    <Link
      ref={setNodeRef}
      href="/"
      className={`flex flex-col rounded-xl border p-3 transition ${
        isOver
          ? "border-accent bg-accent-soft"
          : "border-ink-700 bg-ink-900 hover:border-ink-600"
      }`}
    >
      <span className="text-lg">🏠</span>
      <span className="mt-1 text-sm font-medium text-white">폴더 밖으로</span>
      <span className="text-xs text-ink-600">전체 홈</span>
    </Link>
  );
}

function NewFolder({
  value,
  onChange,
  onAdd,
}: {
  value: string;
  onChange: (v: string) => void;
  onAdd: () => void;
}) {
  return (
    <div className="flex flex-col justify-center gap-1.5 rounded-xl border border-dashed border-ink-700 p-3">
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && onAdd()}
        placeholder="새 폴더 이름"
        className="w-full text-sm"
      />
      <button
        onClick={onAdd}
        className="rounded-md bg-accent px-2 py-1 text-xs font-medium text-ink-950"
      >
        ＋ 폴더 만들기
      </button>
    </div>
  );
}

function ContiCard({ conti, dimmed }: { conti: ContiSummary; dimmed: boolean }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef } = useDraggable({
    id: conti.id,
  });
  return (
    <li
      ref={setNodeRef}
      className={`flex items-center gap-1 rounded-xl border border-ink-700 bg-ink-900 transition ${
        dimmed ? "opacity-40" : "hover:border-ink-600 hover:bg-ink-800"
      }`}
    >
      <button
        type="button"
        ref={setActivatorNodeRef}
        {...listeners}
        {...attributes}
        className="shrink-0 cursor-grab touch-none px-2 py-5 text-ink-500 hover:text-white active:cursor-grabbing"
        title="끌어서 폴더로 이동"
        aria-label={`${conti.title} 폴더로 이동`}
      >
        ⠿
      </button>
      <Link href={`/conti/${conti.id}`} className="flex min-w-0 flex-1 items-center py-4">
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium text-white">{conti.title}</p>
          <p className="mt-0.5 text-sm text-ink-400">
            {formatDate(conti.service_date)} · {conti.song_count}곡
            {conti.created_by && ` · ${conti.created_by}`}
          </p>
        </div>
      </Link>
      <PdfButton contiId={conti.id} title={conti.title} />
      <span className="shrink-0 pr-3 text-ink-600">›</span>
    </li>
  );
}
