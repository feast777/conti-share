import { notFound } from "next/navigation";
import ContiViewer from "@/components/ContiViewer";
import { requireSession } from "@/lib/auth";
import { getAnnotations, getConti } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function ContiPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requireSession();

  const [conti, annotations] = await Promise.all([getConti(id, session.church), getAnnotations(id, session.church)]);
  if (!conti) notFound();

  return <ContiViewer conti={conti} annotations={annotations} me={session.name} />;
}
