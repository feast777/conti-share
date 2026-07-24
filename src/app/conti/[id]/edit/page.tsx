import { notFound } from "next/navigation";
import ContiEditor from "@/components/ContiEditor";
import { requireSession } from "@/lib/auth";
import { getConti } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function EditContiPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireSession();

  const conti = await getConti(id);
  if (!conti) notFound();

  return <ContiEditor conti={conti} />;
}
