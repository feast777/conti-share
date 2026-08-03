import ContiBrowser from "@/components/ContiBrowser";
import HomeHero from "@/components/HomeHero";
import NewContiForm from "@/components/NewContiForm";
import ThemeToggle from "@/components/ThemeToggle";
import { LogoMark } from "@/components/icons";
import { requireSession } from "@/lib/auth";
import { listAllFolders, listContis } from "@/lib/queries";
import { logout } from "./actions";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const session = await requireSession();
  // 히어로는 폴더 안까지 포함한 전체에서 '다음 콘티'를 찾는다
  const [allFolders, allContis] = await Promise.all([listAllFolders(session.church), listContis(session.church, "all")]);
  const topFolders = allFolders.filter((f) => f.parent_id === null);
  const contis = allContis.filter((c) => c.folder_id === null);

  return (
    <main className="mx-auto max-w-3xl px-5 py-10 sm:py-14">
      <header className="mb-10 flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-accent text-on-accent shadow-[var(--shadow-card)]">
            <LogoMark />
          </span>
          <div className="min-w-0">
            <h1 className="text-[1.15rem] font-semibold leading-tight tracking-tight text-ink-200 sm:text-[1.35rem]">
              Worship
              <br className="sm:hidden" />
              <span className="hidden sm:inline"> </span>
              Conti Share
            </h1>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-0.5">
          <ThemeToggle />
          <form action={logout}>
            <button className="rounded-lg px-2.5 py-2 text-sm text-ink-400 transition hover:bg-ink-800 hover:text-ink-200">
              로그아웃
            </button>
          </form>
        </div>
      </header>

      <HomeHero name={session.name} contis={allContis} folders={allFolders} />

      <NewContiForm />

      <ContiBrowser currentFolderId={null} path={[]} subfolders={topFolders} contis={contis} />
    </main>
  );
}
