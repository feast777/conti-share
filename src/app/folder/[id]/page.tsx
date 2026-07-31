import { notFound } from "next/navigation";
import ContiBrowser from "@/components/ContiBrowser";
import FolderHeader from "@/components/FolderHeader";
import NewContiForm from "@/components/NewContiForm";
import { requireSession } from "@/lib/auth";
import { getFolder, listAllFolders, listContis } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function FolderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireSession();

  const folder = await getFolder(id);
  if (!folder) notFound();

  const [allFolders, contis] = await Promise.all([listAllFolders(), listContis(id)]);
  const byId = new Map(allFolders.map((f) => [f.id, f]));

  const children = allFolders.filter((f) => f.parent_id === id);

  // 조상 경로 (최상위 → 부모). 현재 폴더는 제외.
  const path: { id: string; name: string }[] = [];
  let cur = folder.parent_id ? byId.get(folder.parent_id) : undefined;
  const seen = new Set<string>();
  while (cur && !seen.has(cur.id)) {
    seen.add(cur.id);
    path.unshift({ id: cur.id, name: cur.name });
    cur = cur.parent_id ? byId.get(cur.parent_id) : undefined;
  }

  return (
    <main className="mx-auto max-w-3xl px-5 py-8">
      <FolderHeader id={folder.id} name={folder.name} parentId={folder.parent_id} />
      <NewContiForm folderId={folder.id} />
      <ContiBrowser
        currentFolderId={folder.id}
        path={path}
        subfolders={children}
        contis={contis}
      />
    </main>
  );
}
