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

  // 곡 → 악보 순서대로 펼친다 (getConti 가 이미 order_index 로 정렬해서 준다)
  const sheets = conti.songs.flatMap((song) => song.sheets).filter((s) => s.url);

  // 파일은 한꺼번에 내려받는다 (순서대로 하나씩 받으면 느려서 병렬로).
  // Promise.all 은 순서를 유지하므로 병합 순서는 그대로다.
  const downloads = await Promise.all(
    sheets.map(async (sheet) => {
      try {
        const res = await fetch(sheet.url!);
        if (!res.ok) return null;
        return { sheet, bytes: await res.arrayBuffer() };
      } catch {
        return null; // 파일 하나 못 받아도 나머지는 계속
      }
    })
  );

  // 병합은 순서대로 (pdf-lib 는 단일 스레드라 여기서 병렬화 이득이 없다)
  for (const item of downloads) {
    if (!item) continue;
    const { sheet, bytes } = item;
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
