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
  toggleFolderFavorite,
} from "@/app/actions";
import PdfButton from "@/components/PdfButton";
import {
  ChevronRight,
  CopyIcon,
  FolderIcon,
  GripIcon,
  HomeIcon,
  PlusIcon,
  StarIcon,
} from "@/components/icons";
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
  // 하위 폴더를 '위로' 뺄 때의 목적지 = 지금 폴더의 상위 (없으면 홈)
  const upTargetId = path.length ? path[path.length - 1].id : null;
  const upTargetName = path.length ? path[path.length - 1].name : "홈";
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
      <section className="mb-10">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="text-xs font-medium uppercase tracking-wider text-ink-600">
            {isHome ? "폴더" : "하위 폴더"}
          </h2>
          {subfolders.length > 1 && (
            <select
              value={sort}
              onChange={(e) => changeSort(e.target.value as SortKey)}
              className="border-transparent bg-transparent py-1 pl-1 pr-0 text-xs text-ink-400 shadow-none focus:border-transparent focus:shadow-none"
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
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
          {sortedFolders.map((f, i) => (
            <FolderCard
              key={f.id}
              folder={f}
              draggingId={active?.kind === "f" ? active.id : null}
              onToggleFavorite={() =>
                void toggleFolderFavorite(f.id, !f.is_favorite).then(refresh)
              }
              up={
                currentFolderId
                  ? {
                      label: upTargetName,
                      onUp: () => void moveFolder(f.id, upTargetId).then(refresh),
                    }
                  : null
              }
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
      </section>

      {/* 콘티 */}
      <section>
        <h2 className="mb-3 text-xs font-medium uppercase tracking-wider text-ink-600">
          {isHome ? "콘티" : "이 폴더의 콘티"}
        </h2>
        {contis.length === 0 ? (
          <p className="rounded-xl border border-dashed border-ink-700 p-10 text-center text-sm text-ink-600">
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
          <div className="rounded-[0.875rem] border border-accent bg-ink-900 px-4 py-3 shadow-[var(--shadow-card-hover)]">
            <p className="truncate text-sm font-medium text-ink-200">{activeConti.title}</p>
            <p className="mt-0.5 text-xs text-ink-600">
              {formatDate(activeConti.service_date)} · {activeConti.song_count}곡
            </p>
          </div>
        ) : activeFolder ? (
          <div className="flex items-center gap-2 rounded-[0.875rem] border border-accent bg-ink-900 px-4 py-3 shadow-[var(--shadow-card-hover)]">
            <FolderIcon className="h-4 w-4 text-ink-400" />
            <span className="text-sm font-medium text-ink-200">{activeFolder.name}</span>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

// ─────────────────────────────────────────────

function Breadcrumb({ path }: { path: { id: string; name: string }[] }) {
  return (
    <nav className="mb-6 flex flex-wrap items-center gap-0.5 text-sm text-ink-400">
      <Crumb dropId={ROOT} href="/">
        <HomeIcon className="h-3.5 w-3.5" />홈
      </Crumb>
      {path.map((a) => (
        <Fragment key={a.id}>
          <ChevronRight className="h-3.5 w-3.5 text-ink-600" />
          <Crumb dropId={`f:${a.id}`} href={`/folder/${a.id}`}>
            {a.name}
          </Crumb>
        </Fragment>
      ))}
    </nav>
  );
}

function Crumb({
  dropId,
  href,
  children,
}: {
  dropId: string;
  href: string;
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: dropId });
  return (
    <Link
      ref={setNodeRef}
      href={href}
      className={`flex items-center gap-1 rounded-md px-1.5 py-1 transition ${
        isOver ? "bg-accent-soft text-accent-ink" : "hover:bg-ink-800 hover:text-ink-200"
      }`}
    >
      {children}
    </Link>
  );
}

type Reorder = { canLeft: boolean; canRight: boolean; onLeft: () => void; onRight: () => void };

function FolderCard({
  folder,
  draggingId,
  reorder,
  up,
  onToggleFavorite,
}: {
  folder: FolderSummary;
  draggingId: string | null;
  reorder: Reorder | null;
  /** 상위로 빼기 (홈에서는 없음) */
  up: { label: string; onUp: () => void } | null;
  onToggleFavorite: () => void;
}) {
  const drop = useDroppable({ id: `f:${folder.id}` });
  const drag = useDraggable({ id: `f:${folder.id}` });
  const setRef = (n: HTMLElement | null) => {
    drop.setNodeRef(n);
    drag.setNodeRef(n);
  };
  const dimmed = draggingId === folder.id;

  // 버튼은 카드를 열지 않고 자기 동작만 하도록 (드래그도 시작하지 않게)
  const stop = (fn: () => void) => (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    fn();
  };
  const noDrag = (e: React.PointerEvent) => e.stopPropagation();

  return (
    <div
      ref={setRef}
      {...drag.listeners}
      {...drag.attributes}
      className={`card card-hover group relative flex flex-col p-3.5 ${
        drop.isOver && !dimmed ? "border-accent bg-accent-soft" : ""
      } ${dimmed ? "opacity-40" : ""}`}
    >
      {/* 카드 전체가 링크. 버튼은 이 위에 올라간다 (겹치지 않게 자리로 나눠 배치) */}
      <Link
        href={`/folder/${folder.id}`}
        draggable={false}
        aria-label={folder.name}
        className="absolute inset-0 rounded-[0.875rem]"
      />

      {/* 윗줄: 폴더 아이콘 · (즐겨찾기 / 위로 빼기) */}
      <div className="relative flex items-start justify-between">
        <FolderIcon className="h-[1.15rem] w-[1.15rem] text-ink-400" />
        <div className="-mr-1 -mt-1 flex items-center gap-0.5">
          <button
            onPointerDown={noDrag}
            onClick={stop(onToggleFavorite)}
            className={`grid h-7 w-7 place-items-center rounded-md transition hover:bg-ink-800 ${
              folder.is_favorite ? "text-accent-ink" : "text-ink-600 hover:text-ink-200"
            }`}
            title={folder.is_favorite ? "즐겨찾기 해제" : "즐겨찾기 — 홈에 다음 콘티 표시"}
            aria-label="즐겨찾기"
          >
            <StarIcon className="h-4 w-4" filled={folder.is_favorite} />
          </button>
          {up && (
            <button
              onPointerDown={noDrag}
              onClick={stop(up.onUp)}
              className="grid h-7 w-7 place-items-center rounded-md text-sm text-ink-600 transition hover:bg-ink-800 hover:text-ink-200"
              title={`'${up.label}' 로 빼기`}
              aria-label="상위 폴더로 빼기"
            >
              ↑
            </button>
          )}
        </div>
      </div>

      {/* 이름 */}
      <span className="relative mt-2.5 truncate text-sm font-medium text-ink-200">
        {folder.name}
      </span>

      {/* 아랫줄: 개수 · 순서 바꾸기 (윗줄 버튼과 자리가 겹치지 않는다) */}
      <div className="relative mt-0.5 flex items-end justify-between gap-1">
        <span className="truncate text-xs text-ink-600">
          콘티 {folder.conti_count}
          {folder.subfolder_count > 0 && ` · 폴더 ${folder.subfolder_count}`}
        </span>
        {reorder && (
          <div className="-mb-1 -mr-1 flex shrink-0 items-center gap-0.5">
            <button
              onPointerDown={noDrag}
              onClick={stop(reorder.onLeft)}
              disabled={!reorder.canLeft}
              className="grid h-7 w-7 place-items-center rounded-md text-sm text-ink-600 transition hover:bg-ink-800 hover:text-ink-200 disabled:opacity-20"
              title="앞으로"
              aria-label="앞으로"
            >
              ‹
            </button>
            <button
              onPointerDown={noDrag}
              onClick={stop(reorder.onRight)}
              disabled={!reorder.canRight}
              className="grid h-7 w-7 place-items-center rounded-md text-sm text-ink-600 transition hover:bg-ink-800 hover:text-ink-200 disabled:opacity-20"
              title="뒤로"
              aria-label="뒤로"
            >
              ›
            </button>
          </div>
        )}
      </div>
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
    <div className="flex flex-col justify-center gap-2 rounded-[0.875rem] border border-dashed border-ink-700 p-3.5">
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && onAdd()}
        placeholder="새 폴더 이름"
        className="w-full bg-transparent text-sm"
      />
      <button
        onClick={onAdd}
        className="flex items-center justify-center gap-1 rounded-lg px-2 py-1.5 text-xs font-medium text-ink-400 transition hover:bg-ink-800 hover:text-ink-200"
      >
        <PlusIcon className="h-3.5 w-3.5" />
        폴더 만들기
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
      className={`card card-hover group flex items-center ${dimmed ? "opacity-40" : ""}`}
    >
      <button
        type="button"
        ref={setActivatorNodeRef}
        {...listeners}
        {...attributes}
        className="shrink-0 cursor-grab touch-none py-5 pl-2.5 pr-1 text-ink-600 opacity-0 transition hover:text-ink-400 active:cursor-grabbing group-hover:opacity-100 sm:opacity-0"
        title="끌어서 폴더로 이동"
        aria-label={`${conti.title} 폴더로 이동`}
      >
        <GripIcon />
      </button>
      <Link href={`/conti/${conti.id}`} className="flex min-w-0 flex-1 items-center py-4 pl-1">
        <div className="min-w-0 flex-1">
          <p className="truncate text-[0.95rem] font-medium leading-snug text-ink-200">
            {conti.title}
          </p>
          <p className="mt-1 truncate text-[0.8rem] text-ink-600">
            {formatDate(conti.service_date)} · {conti.song_count}곡
            {conti.created_by && ` · ${conti.created_by}`}
          </p>
        </div>
      </Link>
      <div className="flex shrink-0 items-center gap-0.5 pr-2.5">
        <button
          onClick={() => {
            if (confirm(`"${conti.title}" 콘티를 복사할까요?`)) void duplicateConti(conti.id);
          }}
          className="grid h-8 w-8 place-items-center rounded-lg text-ink-600 transition hover:bg-ink-800 hover:text-ink-200"
          title="이 콘티 복사"
          aria-label={`${conti.title} 복사`}
        >
          <CopyIcon />
        </button>
        <PdfButton contiId={conti.id} title={conti.title} />
        <ChevronRight className="h-4 w-4 text-ink-600" />
      </div>
    </li>
  );
}
