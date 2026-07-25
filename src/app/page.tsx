import Link from "next/link";
import { requireSession } from "@/lib/auth";
import { listContis } from "@/lib/queries";
import { createConti, logout } from "./actions";

export const dynamic = "force-dynamic";

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

function formatDate(iso: string) {
  const d = new Date(`${iso}T00:00:00`);
  return `${d.getMonth() + 1}월 ${d.getDate()}일 (${WEEKDAYS[d.getDay()]})`;
}

export default async function HomePage() {
  const session = await requireSession();
  const contis = await listContis();
  const today = new Date().toISOString().slice(0, 10);

  return (
    <main className="mx-auto max-w-3xl px-5 py-8">
      <header className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white">찬양팀 콘티</h1>
          <p className="mt-0.5 text-sm text-ink-400">{session.name}님</p>
        </div>
        <form action={logout}>
          <button className="rounded-lg border border-ink-700 px-3 py-1.5 text-sm text-ink-400 hover:text-white">
            로그아웃
          </button>
        </form>
      </header>

      <form
        action={createConti}
        className="mb-8 flex flex-col gap-2 rounded-xl border border-ink-700 bg-ink-900 p-4 sm:flex-row"
      >
        <input
          name="title"
          placeholder="콘티 이름 (예: 주일 1부 예배)"
          className="flex-1"
          required
        />
        <input name="service_date" type="date" defaultValue={today} className="sm:w-44" />
        <button className="rounded-lg bg-accent px-4 py-2 font-medium text-ink-950">
          새 콘티
        </button>
      </form>

      {contis.length === 0 ? (
        <p className="rounded-xl border border-dashed border-ink-700 p-10 text-center text-sm text-ink-600">
          아직 콘티가 없습니다. 위에서 첫 콘티를 만들어 보세요.
        </p>
      ) : (
        <ul className="space-y-2">
          {contis.map((c) => (
            <li
              key={c.id}
              className="flex items-center gap-2 rounded-xl border border-ink-700 bg-ink-900 pr-3 transition hover:border-ink-600 hover:bg-ink-800"
            >
              <Link href={`/conti/${c.id}`} className="flex min-w-0 flex-1 items-center gap-4 p-4">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-white">{c.title}</p>
                  <p className="mt-0.5 text-sm text-ink-400">
                    {formatDate(c.service_date)} · {c.song_count}곡
                    {c.created_by && ` · ${c.created_by}`}
                  </p>
                </div>
              </Link>
              <a
                href={`/conti/${c.id}/pdf`}
                className="shrink-0 rounded-lg border border-ink-700 px-3 py-1.5 text-xs text-ink-400 transition hover:border-ink-500 hover:text-white"
                title="이 콘티의 악보 전체를 PDF 로 내려받기"
              >
                PDF
              </a>
              <span className="shrink-0 text-ink-600">›</span>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
