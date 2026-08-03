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
import { Fragment, useEffect, useState, useTransition } from "react";
import {
  createFolder,
  duplicateConti,
  moveConti,
  moveFolder,
  reorderFolders,
} from "@/app/actions";
import PdfButton from "@/components/PdfButton";
import type { ContiSummary, FolderSummary } from "@/lib/types";

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];
function formatDate(iso: string) {
  const d = new Date(`${iso}T00:00:00`);
  return `${d.getMonth() + 1}월 ${d.getDate()}일 (${WEEKDAYS[d.getDay()]})`;
}

const ROOT = "root";

type SortKey = "manual" | "name-asc" | "name-desc" | "newest" | "oldest";
const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: "manual", label: "직접 정렬" },
  { key: "name-asc", label: "이름 ↑" },
  { key: "name-desc", label: "이름 ↓" },
  { key: "newest", label: "최신순" },
  { key: "oldest", label: "오래된순" },
];
const SORT_STORAGE_KEY = "conti.folderSort";

function sortFolders(list: FolderSummary[], sort: SortKey): FolderSummary[] {
  const arr = [...list];
  const byName = (a: FolderSummary, b: FolderSummary) => a.name.localeCompare(b.name, "ko");
  switch (sort) {
    case "name-asc":
      return arr.sort(byName);
    case "name-desc":
      return arr.sort((a, b) => byName(b, a));
    case "newest":
      return arr.sort((a, b) => (b.created_at || "").localeCompare(a.created_at || ""));
    case "oldest":
      return arr.sort((a, b) => (a.created_at || "").localeCompare(b.created_at || ""));
    default: // manual — order_index, 같으면 이름
      return arr.sort((a, b) => a.order_index - b.order_index || byName(a, b));
  }
}

type Props = {
  currentFolderId: string | null; // null = 홈
  path: { id: string; name: string }[]; // 조상들(홈 제외, 현재 폴더 제외) — 최상위→부모 순
  subfolders: FolderSummary[]; // 현재 위치의 하위 폴더
  contis: ContiSummary[]; // 현재 위치의 콘티
};

export default function ContiBrowser({ currentFolderId, path, subfolders, contis }: Props) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const refresh = () => startTransition(() => router.refresh());

  const [active, setActive] = useState<{ kind: "c" | "f"; id: string } | null>(null);
  const [newFolder, setNewFolder] = useState("");

  // 정렬은 기기별 취향(로컬 저장). "직접 정렬"만 팀 공용 순서(order_index)를 쓴다.
  const [sort, setSort] = useState<SortKey>("manual");
  useEffect(() => {
    const saved = localStorage.getItem(SORT_STORAGE_KEY) as SortKey | null;
    if (saved) setSort(saved);
  }, []);
  const changeSort = (s: SortKey) => {
    setSort(s);
    localStorage.setItem(SORT_STORAGE_KEY, s);
  };

  const sortedFolders = sortFolders(subfolders, sort);
  const manual = sort === "manual";

  const moveFolderPos = (idx: number, dir: -1 | 1) => {
    const ids = sortedFolders.map((f) => f.id);
    const j = idx + dir;
    if (j < 0 || j >= ids.length) return;
    [ids[idx], ids[j]] = [ids[j], ids[idx]];
    void reorderFolders(currentFolderId, ids).then(refresh);
  };

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 6 } }),
    useSensor(KeyboardSensor)
  );

  const isHome = currentFolderId === null;

  const parseId = (raw: string): { kind: "c" | "f"; id: string } => {
    const [kind, ...rest] = raw.split(":");
    return { kind: kind as "c" | "f", id: rest.join(":") };
  };

  const onDragEnd = (e: DragEndEvent) => {
    setActive(null);
    const { active: a, over } = e;
    if (!over) return;
    const { kind, id } = parseId(String(a.id));
    const overId = String(over.id);
    const target = overId === ROOT ? null : overId.startsWith("f:") ? overId.slice(2) : undefined;
    if (target === undefined) return;

    if (kind === "c") {
      const conti = contis.find((c) => c.id === id);
      if (!conti || (conti.folder_id ?? null) === target) return;
      void moveConti(id, target).then(refresh);
    } else {
      if (id === target) return; // 자기 자신 위로는 무시
      const folder = subfolders.find((f) => f.id === id);
      if (!folder || (folder.parent_id ?? null) === target) return;
      void moveFolder(id, target).then(refresh); // 사이클은 서버에서 막는다
    }
  };

  const activeConti = active?.kind === "c" ? contis.find((c) => c.id === active.id) ?? null : null;
  const activeFolder = active?.kind === "f" ? subfolders.find((f) => f.id === active.id) ?? null : null;

  const handleAddFolder = async () => {
    const name = newFolder.trim();
    if (!name) return;
    setNewFolder("");
    await createFolder(name, currentFolderId);
    refresh();
  };

  return (
    <DndContext
      sensors={sensors}
      onDragStart={(e: DragStartEvent) => setActive(parseId(String(e.active.id)))}
      onDragEnd={onDragEnd}
      onDragCancel={() => setActive(null)}
    >
      {!isHome && <Breadcrumb path={path} />}

      {/* 폴더 */}
      <section className="mb-6 mt-3">
        <div className="mb-2 flex items-center justify-between gap-2">
          <p className="text-sm font-medium text-ink-400">{isHome ? "폴더" : "하위 폴더"}</p>
          {subfolders.length > 1 && (
            <select
              value={sort}
              onChange={(e) => changeSort(e.target.value as SortKey)}
              className="rounded-md border border-ink-700 bg-ink-800 px-2 py-1 text-xs text-ink-200"
              aria-label="폴더 정렬"
            >
              {SORT_OPTIONS.map((o) => (
                <option key={o.key} value={o.key}>
                  {o.label}
                </option>
              ))}
            </select>
          )}
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {sortedFolders.map((f, i) => (
            <FolderCard
              key={f.id}
              folder={f}
              draggingId={active?.kind === "f" ? active.id : null}
              reorder={
                manual
                  ? {
                      canLeft: i > 0,
                      canRight: i < sortedFolders.length - 1,
                      onLeft: () => moveFolderPos(i, -1),
                      onRight: () => moveFolderPos(i, 1),
                    }
                  : null
              }
            />
          ))}
          <NewFolder value={newFolder} onChange={setNewFolder} onAdd={handleAddFolder} />
        </div>
        {manual && subfolders.length > 1 && (
          <p className="mt-1 text-xs text-ink-600">◀ ▶ 로 순서를 바꿀 수 있어요.</p>
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
              : "이 폴더에 콘티가 없습니다. 콘티를 여기로 끌어다 놓으세요."}
          </p>
        ) : (
          <ul className="space-y-2">
            {contis.map((c) => (
              <ContiCard key={c.id} conti={c} dimmed={active?.kind === "c" && active.id === c.id} />
            ))}
          </ul>
        )}
      </section>

      <DragOverlay>
        {activeConti ? (
          <div className="rounded-xl border border-accent bg-ink-800 px-4 py-3 shadow-2xl">
            <p className="truncate font-medium text-ink-200">{activeConti.title}</p>
            <p className="mt-0.5 text-xs text-ink-400">
              {formatDate(activeConti.service_date)} · {activeConti.song_count}곡
            </p>
          </div>
        ) : activeFolder ? (
          <div className="rounded-xl border border-accent bg-ink-800 px-4 py-3 shadow-2xl">
            <span className="text-sm font-medium text-ink-200">📁 {activeFolder.name}</span>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

// ─────────────────────────────────────────────

function Breadcrumb({ path }: { path: { id: string; name: string }[] }) {
  return (
    <nav className="flex flex-wrap items-center gap-1 text-sm text-ink-400">
      <Crumb dropId={ROOT} href="/" label="🏠 홈" />
      {path.map((a) => (
        <Fragment key={a.id}>
          <span className="text-ink-600">›</span>
          <Crumb dropId={`f:${a.id}`} href={`/folder/${a.id}`} label={a.name} />
        </Fragment>
      ))}
    </nav>
  );
}

function Crumb({ dropId, href, label }: { dropId: string; href: string; label: string }) {
  const { setNodeRef, isOver } = useDroppable({ id: dropId });
  return (
    <Link
      ref={setNodeRef}
      href={href}
      className={`rounded px-1.5 py-0.5 transition ${
        isOver ? "bg-accent-soft text-accent" : "hover:text-ink-200"
      }`}
    >
      {label}
    </Link>
  );
}

type Reorder = { canLeft: boolean; canRight: boolean; onLeft: () => void; onRight: () => void };

function FolderCard({
  folder,
  draggingId,
  reorder,
}: {
  folder: FolderSummary;
  draggingId: string | null;
  reorder: Reorder | null;
}) {
  const drop = useDroppable({ id: `f:${folder.id}` });
  const drag = useDraggable({ id: `f:${folder.id}` });
  const setRef = (n: HTMLElement | null) => {
    drop.setNodeRef(n);
    drag.setNodeRef(n);
  };
  const dimmed = draggingId === folder.id;
  return (
    <div
      ref={setRef}
      {...drag.listeners}
      {...drag.attributes}
      className={`relative flex flex-col rounded-xl border p-3 transition ${
        drop.isOver && !dimmed
          ? "border-accent bg-accent-soft"
          : "border-ink-700 bg-ink-900 hover:border-ink-600"
      } ${dimmed ? "opacity-40" : ""}`}
    >
      {reorder && (
        <div className="absolute right-1 top-1 flex gap-0.5">
          <button
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              reorder.onLeft();
            }}
            disabled={!reorder.canLeft}
            className="rounded px-1 text-base text-ink-500 hover:text-ink-200 disabled:opacity-30"
            aria-label="앞으로"
          >
            ◀
          </button>
          <button
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              reorder.onRight();
            }}
            disabled={!reorder.canRight}
            className="rounded px-1 text-base text-ink-500 hover:text-ink-200 disabled:opacity-30"
            aria-label="뒤로"
          >
            ▶
          </button>
        </div>
      )}
      <Link href={`/folder/${folder.id}`} draggable={false} className="flex flex-col">
        <span className="text-lg">📁</span>
        <span className="mt-1 truncate pr-10 text-sm font-medium text-ink-200">{folder.name}</span>
        <span className="text-xs text-ink-600">
          {folder.conti_count}개{folder.subfolder_count > 0 && ` · 폴더 ${folder.subfolder_count}`}
        </span>
      </Link>
    </div>
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
        className="rounded-md bg-accent px-2 py-1 text-xs font-medium text-on-accent"
      >
        ＋ 폴더 만들기
      </button>
    </div>
  );
}

function ContiCard({ conti, dimmed }: { conti: ContiSummary; dimmed: boolean }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef } = useDraggable({
    id: `c:${conti.id}`,
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
        className="shrink-0 cursor-grab touch-none px-2 py-5 text-ink-500 hover:text-ink-200 active:cursor-grabbing"
        title="끌어서 폴더로 이동"
        aria-label={`${conti.title} 폴더로 이동`}
      >
        ⠿
      </button>
      <Link href={`/conti/${conti.id}`} className="flex min-w-0 flex-1 items-center py-4">
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium text-ink-200">{conti.title}</p>
          <p className="mt-0.5 text-sm text-ink-400">
            {formatDate(conti.service_date)} · {conti.song_count}곡
            {conti.created_by && ` · ${conti.created_by}`}
          </p>
        </div>
      </Link>
      <button
        onClick={() => {
          if (confirm(`"${conti.title}" 콘티를 복사할까요?`)) void duplicateConti(conti.id);
        }}
        className="shrink-0 px-1.5 text-ink-500 hover:text-ink-200"
        title="이 콘티 복사"
        aria-label={`${conti.title} 복사`}
      >
        ⧉
      </button>
      <PdfButton contiId={conti.id} title={conti.title} />
      <span className="shrink-0 pr-3 text-ink-600">›</span>
    </li>
  );
}
