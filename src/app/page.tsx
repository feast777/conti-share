import ContiBrowser from "@/components/ContiBrowser";
import { requireSession } from "@/lib/auth";
import { listAllFolders, listContis } from "@/lib/queries";
import { createConti, logout } from "./actions";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const session = await requireSession();
  const today = new Date().toISOString().slice(0, 10);
  const [allFolders, contis] = await Promise.all([listAllFolders(), listContis(null)]);
  const topFolders = allFolders.filter((f) => f.parent_id === null);

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

      <ContiBrowser currentFolderId={null} path={[]} subfolders={topFolders} contis={contis} />
    </main>
  );
}
