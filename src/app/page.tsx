import ContiBrowser from "@/components/ContiBrowser";
import NewContiForm from "@/components/NewContiForm";
import ThemeToggle from "@/components/ThemeToggle";
import { requireSession } from "@/lib/auth";
import { listAllFolders, listContis } from "@/lib/queries";
import { logout } from "./actions";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const session = await requireSession();
  const [allFolders, contis] = await Promise.all([listAllFolders(), listContis(null)]);
  const topFolders = allFolders.filter((f) => f.parent_id === null);

  return (
    <main className="mx-auto max-w-3xl px-5 py-8">
      <header className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink-200">Cadence</h1>
          <p className="mt-0.5 text-sm text-ink-400">{session.name}님</p>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <form action={logout}>
            <button className="rounded-lg border border-ink-700 px-3 py-1.5 text-sm text-ink-400 hover:text-ink-200">
              로그아웃
            </button>
          </form>
        </div>
      </header>

      <NewContiForm />

      <ContiBrowser currentFolderId={null} path={[]} subfolders={topFolders} contis={contis} />
    </main>
  );
}
