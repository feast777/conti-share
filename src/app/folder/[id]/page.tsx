import { notFound } from "next/navigation";
import ContiBrowser from "@/components/ContiBrowser";
import FolderHeader from "@/components/FolderHeader";
import { requireSession } from "@/lib/auth";
import { getFolder, listContis, listFolders } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function FolderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireSession();

  const folder = await getFolder(id);
  if (!folder) notFound();

  const [folders, contis] = await Promise.all([listFolders(), listContis(id)]);

  return (
    <main className="mx-auto max-w-3xl px-5 py-8">
      <FolderHeader id={folder.id} name={folder.name} />
      <ContiBrowser folders={folders} contis={contis} currentFolderId={folder.id} />
    </main>
  );
}
