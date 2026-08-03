import Link from "next/link";
import type { ContiSummary, FolderSummary } from "@/lib/types";
import { ChevronRight, LogoMark } from "./icons";

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

/** 예배일까지 남은 날 */
function dday(iso: string) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(`${iso}T00:00:00`);
  const diff = Math.round((d.getTime() - today.getTime()) / 86400000);
  if (diff === 0) return { label: "오늘 예배", tone: "now" as const };
  if (diff === 1) return { label: "내일 예배", tone: "now" as const };
  if (diff > 1) return { label: `${diff}일 남음`, tone: diff <= 7 ? ("soon" as const) : ("far" as const) };
  return { label: "지난 예배", tone: "past" as const };
}

/** '주일 오전' 폴더(및 그 하위 폴더) 안의 콘티만 고른다 */
function sundayMorningContis(contis: ContiSummary[], folders: FolderSummary[]) {
  const roots = folders.filter((f) => {
    const n = f.name.replace(/\s/g, "");
    return n.includes("주일") && (n.includes("오전") || n.includes("1부") || n.includes("１부"));
  });
  if (roots.length === 0) return null;

  // 해당 폴더 + 모든 하위 폴더(예: 26년 7월)를 모은다
  const ids = new Set(roots.map((f) => f.id));
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
  return contis.filter((c) => c.folder_id && ids.has(c.folder_id));
}

/**
 * 홈 상단 — 이번 주 '주일 오전' 콘티를 크게 띄운다.
 * 매주 여기 들어와 바로 여는 게 목적이라 날짜와 진입 버튼을 가장 크게 둔다.
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
  const today = new Date().toISOString().slice(0, 10);
  const pool = sundayMorningContis(contis, folders) ?? contis; // 폴더가 없으면 전체에서
  const scoped = sundayMorningContis(contis, folders) !== null;

  const upcoming = [...pool]
    .filter((c) => c.service_date >= today)
    .sort((a, b) => a.service_date.localeCompare(b.service_date))[0];
  const featured =
    upcoming ?? [...pool].sort((a, b) => b.service_date.localeCompare(a.service_date))[0];

  if (!featured) {
    return (
      <section className="mb-10 rounded-2xl border border-dashed border-ink-700 p-8 text-center">
        <LogoMark className="mx-auto h-6 w-6 text-ink-600" />
        <p className="mt-3 font-medium text-ink-200">첫 콘티를 만들어 보세요</p>
        <p className="mt-1 text-sm text-ink-400">
          곡을 담고 악보를 올리면 팀원 모두가 같은 화면으로 함께 봅니다.
        </p>
      </section>
    );
  }

  const d = dday(featured.service_date);
  const date = new Date(`${featured.service_date}T00:00:00`);
  const badge =
    d.tone === "now"
      ? "bg-accent text-on-accent"
      : d.tone === "soon"
        ? "bg-accent-soft text-accent"
        : "bg-ink-800 text-ink-400";

  return (
    <section className="mb-10">
      <div className="mb-3 flex items-baseline justify-between gap-2">
        <h2 className="text-xs font-medium uppercase tracking-wider text-ink-600">
          {scoped ? "이번 주 주일 오전" : "다음 콘티"}
        </h2>
        <span className="text-xs text-ink-600">{name}님</span>
      </div>

      <Link
        href={`/conti/${featured.id}`}
        className="card card-hover group flex items-stretch overflow-hidden"
      >
        {/* 날짜 블록 */}
        <div className="flex shrink-0 flex-col items-center justify-center gap-0.5 border-r border-ink-700 bg-ink-800/60 px-5 py-6 sm:px-7">
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
        <div className="flex min-w-0 flex-1 items-center gap-3 px-4 py-5 sm:px-5">
          <div className="min-w-0 flex-1">
            <span
              className={`inline-block rounded-full px-2 py-0.5 text-[0.7rem] font-semibold ${badge}`}
            >
              {d.label}
            </span>
            <h3 className="mt-2 truncate text-[1.15rem] font-semibold leading-snug tracking-tight text-ink-200 sm:text-[1.3rem]">
              {featured.title}
            </h3>
            <p className="mt-1 truncate text-[0.8rem] text-ink-600">
              {featured.song_count}곡
              {featured.created_by && ` · ${featured.created_by}`}
            </p>
          </div>
          <ChevronRight className="h-5 w-5 shrink-0 text-ink-600 transition group-hover:translate-x-0.5 group-hover:text-ink-400" />
        </div>
      </Link>
    </section>
  );
}
