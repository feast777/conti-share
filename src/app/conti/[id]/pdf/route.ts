import { PDFDocument } from "pdf-lib";
import { requireSession } from "@/lib/auth";
import { getConti } from "@/lib/queries";

export const dynamic = "force-dynamic";

/**
 * 콘티에 속한 모든 곡의 악보를 (곡·악보 순서대로) 하나의 PDF 로 합쳐서 내려준다.
 * 이미지 악보는 한 장을 한 페이지로, PDF 악보는 페이지를 그대로 이어붙인다.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  await requireSession();
  const { id } = await params;

  const conti = await getConti(id);
  if (!conti) {
    return new Response("콘티를 찾을 수 없습니다.", { status: 404 });
  }

  const out = await PDFDocument.create();

  // 곡 → 악보 순서 (getConti 가 이미 order_index 로 정렬해서 준다)
  for (const song of conti.songs) {
    for (const sheet of song.sheets) {
      if (!sheet.url) continue;

      let bytes: ArrayBuffer;
      try {
        const res = await fetch(sheet.url);
        if (!res.ok) continue;
        bytes = await res.arrayBuffer();
      } catch {
        continue; // 파일 하나 못 받아도 나머지는 계속
      }

      try {
        if (sheet.kind === "pdf") {
          const src = await PDFDocument.load(bytes, { ignoreEncryption: true });
          const pages = await out.copyPages(src, src.getPageIndices());
          for (const p of pages) out.addPage(p);
        } else {
          const data = new Uint8Array(bytes);
          const isPng = sheet.file_name.toLowerCase().endsWith(".png");
          const img = isPng ? await out.embedPng(data) : await out.embedJpg(data);
          const page = out.addPage([img.width, img.height]);
          page.drawImage(img, { x: 0, y: 0, width: img.width, height: img.height });
        }
      } catch {
        continue; // 형식이 안 맞는 파일은 건너뛴다
      }
    }
  }

  if (out.getPageCount() === 0) {
    return new Response("이 콘티에는 내려받을 악보가 없습니다.", { status: 404 });
  }

  const pdf = await out.save();
  const fileName = `${conti.title || "콘티"}.pdf`;

  return new Response(pdf as BodyInit, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`,
    },
  });
}
