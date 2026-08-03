import Link from "next/link";
import type { ContiSummary } from "@/lib/types";
import { ChevronRight, LogoMark } from "./icons";

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

function greeting(hour: number) {
  if (hour < 6) return "늦은 밤이네요";
  if (hour < 12) return "좋은 아침이에요";
  if (hour < 18) return "좋은 오후예요";
  return "좋은 저녁이에요";
}

/** 예배일까지 남은 날 — 오늘/내일/D-n, 지난 건 '지난 콘티' */
function dday(iso: string) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(`${iso}T00:00:00`);
  const diff = Math.round((d.getTime() - today.getTime()) / 86400000);
  if (diff === 0) return { label: "오늘", soon: true };
  if (diff === 1) return { label: "내일", soon: true };
  if (diff > 1) return { label: `D-${diff}`, soon: diff <= 7 };
  return { label: "지난 콘티", soon: false };
}

function formatDate(iso: string) {
  const d = new Date(`${iso}T00:00:00`);
  return `${d.getMonth() + 1}월 ${d.getDate()}일 (${WEEKDAYS[d.getDay()]})`;
}

/**
 * 홈 상단 히어로 — 인사말과 함께 '다음(또는 가장 최근) 콘티'를 크게 띄운다.
 * 매주 여기 들어와서 이번 주 콘티를 바로 열 수 있게 하는 게 목적.
 */
export default function HomeHero({
  name,
  contis,
  totalCount,
  folderCount,
}: {
  name: string;
  contis: ContiSummary[];
  totalCount: number;
  folderCount: number;
}) {
  const today = new Date().toISOString().slice(0, 10);
  // 다가오는 예배 중 가장 가까운 것, 없으면 가장 최근 것
  const upcoming = [...contis]
    .filter((c) => c.service_date >= today)
    .sort((a, b) => a.service_date.localeCompare(b.service_date))[0];
  const featured =
    upcoming ?? [...contis].sort((a, b) => b.service_date.localeCompare(a.service_date))[0];

  const d = featured ? dday(featured.service_date) : null;
  const hour = new Date().getHours();

  return (
    <section className="relative mb-10 overflow-hidden rounded-2xl border border-ink-700 bg-ink-900 shadow-[var(--shadow-card)]">
      {/* 은은한 배경 그라데이션 */}
      <div
        aria-hidden
        className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full opacity-[0.07]"
        style={{ background: "radial-gradient(circle, var(--color-accent) 0%, transparent 70%)" }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-24 -left-10 h-52 w-52 rounded-full opacity-[0.05]"
        style={{ background: "radial-gradient(circle, var(--color-accent) 0%, transparent 70%)" }}
      />

      <div className="relative p-6 sm:p-8">
        <p className="text-sm text-ink-400">
          {greeting(hour)}, <span className="font-medium text-ink-200">{name}</span>님
        </p>

        {featured ? (
          <>
            <div className="mt-4 flex items-center gap-2">
              {d?.soon && (
                <span className="rounded-full bg-accent px-2.5 py-0.5 text-[0.7rem] font-semibold text-on-accent">
                  {d.label}
                </span>
              )}
              <span className="text-xs text-ink-600">
                {!d?.soon && d ? `${d.label} · ` : ""}
                {formatDate(featured.service_date)}
              </span>
            </div>

            <h2 className="mt-2 text-[1.6rem] font-semibold leading-tight tracking-tight text-ink-200 sm:text-3xl">
              {featured.title}
            </h2>
            <p className="mt-1.5 text-sm text-ink-400">
              {featured.song_count}곡
              {featured.created_by && ` · ${featured.created_by}`}
            </p>

            <Link
              href={`/conti/${featured.id}`}
              className="mt-5 inline-flex items-center gap-1.5 rounded-[0.625rem] bg-accent px-4 py-2.5 text-sm font-medium text-on-accent transition hover:opacity-90"
            >
              콘티 열기
              <ChevronRight className="h-4 w-4" />
            </Link>
          </>
        ) : (
          <>
            <h2 className="mt-3 flex items-center gap-2 text-[1.4rem] font-semibold tracking-tight text-ink-200">
              <LogoMark className="h-5 w-5 text-accent" />
              첫 콘티를 만들어 보세요
            </h2>
            <p className="mt-1.5 text-sm text-ink-400">
              곡을 담고 악보를 올리면 팀원 모두가 같은 화면으로 함께 볼 수 있어요.
            </p>
          </>
        )}

        {/* 요약 */}
        <div className="mt-6 flex gap-6 border-t border-ink-700 pt-4">
          <div>
            <p className="text-lg font-semibold text-ink-200">{totalCount}</p>
            <p className="text-xs text-ink-600">전체 콘티</p>
          </div>
          <div>
            <p className="text-lg font-semibold text-ink-200">{folderCount}</p>
            <p className="text-xs text-ink-600">폴더</p>
          </div>
        </div>
      </div>
    </section>
  );
}
