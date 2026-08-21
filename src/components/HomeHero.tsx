import Link from "next/link";
import type { ContiSummary, FolderSummary } from "@/lib/types";
import PdfButton from "./PdfButton";
import { ChevronRight, FolderIcon, LogoMark } from "./icons";

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

/** 예배일까지 남은 날 */
function dday(iso: string) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(`${iso}T00:00:00`);
  const diff = Math.round((d.getTime() - today.getTime()) / 86400000);
  if (diff === 0) return { label: "오늘 예배", tone: "now" as const };
  if (diff === 1) return { label: "내일 예배", tone: "now" as const };
  if (diff > 1)
    return { label: `${diff}일 남음`, tone: diff <= 7 ? ("soon" as const) : ("far" as const) };
  return { label: "지난 예배", tone: "past" as const };
}

/** 이 폴더와 그 아래 모든 하위 폴더의 id 를 모은다 (26년 7월 같은 하위까지 포함) */
function withDescendants(rootId: string, folders: FolderSummary[]) {
  const ids = new Set([rootId]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const f of folders) {
      if (!ids.has(f.id) && f.parent_id && ids.has(f.parent_id)) {
        ids.add(f.id);
        grew = true;
      }
    }
  }
  return ids;
}

/** 그 폴더(하위 포함)에서 다가오는 콘티 하나 — 없으면 가장 최근 것 */
function pickConti(contis: ContiSummary[], ids: Set<string>) {
  const today = new Date().toISOString().slice(0, 10);
  const pool = contis.filter((c) => c.folder_id && ids.has(c.folder_id));
  const upcoming = pool
    .filter((c) => c.service_date >= today)
    .sort((a, b) => a.service_date.localeCompare(b.service_date))[0];
  return upcoming ?? pool.sort((a, b) => b.service_date.localeCompare(a.service_date))[0] ?? null;
}

/** 예전 방식(이름으로 '주일 오전' 추측) — 즐겨찾기를 아직 안 했을 때만 쓴다 */
function guessSundayFolder(folders: FolderSummary[]) {
  return folders.find((f) => {
    const n = f.name.replace(/\s/g, "");
    return n.includes("주일") && (n.includes("오전") || n.includes("1부") || n.includes("１부"));
  });
}

/**
 * 홈 상단 — 즐겨찾은 폴더마다 '다음 콘티' 하나씩 보여준다.
 * 매주 여기서 바로 열 수 있게 날짜와 제목을 크게 둔다.
 */
export default function HomeHero({
  name,
  contis,
  folders,
}: {
  name: string;
  contis: ContiSummary[];
  folders: FolderSummary[];
}) {
  const favorites = folders.filter((f) => f.is_favorite);
  // 즐겨찾기가 없으면 '주일 오전' 폴더를 추측해 하나만 보여준다
  const targets = favorites.length ? favorites : [guessSundayFolder(folders)].filter(Boolean as unknown as (f: FolderSummary | undefined) => f is FolderSummary);

  const items = targets
    .map((f) => ({ folder: f, conti: pickConti(contis, withDescendants(f.id, folders)) }))
    .filter((x): x is { folder: FolderSummary; conti: ContiSummary } => x.conti !== null);

  if (items.length === 0) {
    return (
      <section className="mb-10 rounded-2xl border border-dashed border-ink-700 p-8 text-center">
        <LogoMark className="mx-auto h-6 w-6 text-ink-600" />
        <p className="mt-3 font-medium text-ink-200">
          {folders.length ? "폴더에 ★ 를 눌러 즐겨찾기 해보세요" : "첫 콘티를 만들어 보세요"}
        </p>
        <p className="mt-1 text-sm text-ink-400">
          {folders.length
            ? "즐겨찾은 폴더의 다음 콘티가 여기에 바로 뜹니다."
            : "곡을 담고 악보를 올리면 팀원 모두가 같은 화면으로 함께 봅니다."}
        </p>
      </section>
    );
  }

  return (
    <section className="mb-10">
      <div className="mb-3 flex items-baseline justify-between gap-2">
        <h2 className="text-xs font-medium uppercase tracking-wider text-ink-600">
          즐겨찾는 다음 콘티
        </h2>
        <span className="text-xs text-ink-600">{name}님</span>
      </div>

      <div className="space-y-2.5">
        {items.map(({ folder, conti }) => {
          const d = dday(conti.service_date);
          const date = new Date(`${conti.service_date}T00:00:00`);
          const badge =
            d.tone === "now"
              ? "bg-accent text-on-accent"
              : d.tone === "soon"
                ? "bg-accent-soft text-accent-ink"
                : "bg-ink-800 text-ink-400";

          return (
            <div
              key={folder.id}
              className="card card-hover group relative flex items-stretch overflow-hidden"
            >
              {/* 카드 전체가 링크. z-10 으로 내용 위에 덮어야 아무 데나 눌러도 열린다.
                  (그냥 깔기만 하면 아래 텍스트 블록에 가려져서 빈 틈만 눌린다) */}
              <Link
                href={`/conti/${conti.id}`}
                aria-label={conti.title}
                className="absolute inset-0 z-10 rounded-[0.875rem]"
              />

              {/* 날짜 블록 */}
              <div className="relative flex shrink-0 flex-col items-center justify-center gap-0.5 border-r border-ink-700 bg-ink-800/60 px-5 py-6 sm:px-7">
                <span className="text-[0.7rem] font-medium text-ink-600">
                  {date.getMonth() + 1}월
                </span>
                <span className="text-[1.9rem] font-semibold leading-none tracking-tight text-ink-200">
                  {date.getDate()}
                </span>
                <span className="text-[0.7rem] font-medium text-ink-400">
                  {WEEKDAYS[date.getDay()]}요일
                </span>
              </div>

              {/* 내용 */}
              <div className="relative flex min-w-0 flex-1 items-center gap-2 px-4 py-5 sm:gap-3 sm:px-5">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`inline-block rounded-full px-2 py-0.5 text-[0.7rem] font-semibold ${badge}`}
                    >
                      {d.label}
                    </span>
                    <span className="flex min-w-0 items-center gap-1 text-[0.7rem] text-ink-600">
                      <FolderIcon className="h-3 w-3 shrink-0" />
                      <span className="truncate">{folder.name}</span>
                    </span>
                  </div>
                  <h3 className="mt-2 truncate text-[1.15rem] font-semibold leading-snug tracking-tight text-ink-200 sm:text-[1.3rem]">
                    {conti.title}
                  </h3>
                  <div className="mt-1 flex items-center justify-between gap-2">
                    <p className="truncate text-[0.8rem] text-ink-600">
                      {conti.song_count}곡
                      {conti.created_by && ` · ${conti.created_by}`}
                    </p>
                    {/* 악보 전체를 PDF 로 — 카드를 열지 않고 바로 저장 */}
                    <div className="relative z-20 -mb-1 -mr-1.5 shrink-0">
                      <PdfButton contiId={conti.id} title={conti.title} />
                    </div>
                  </div>
                </div>
                <ChevronRight className="h-5 w-5 shrink-0 text-ink-600 transition group-hover:translate-x-0.5 group-hover:text-ink-400" />
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
