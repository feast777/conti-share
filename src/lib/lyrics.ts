"use client";

import { getPdfDocument } from "./pdf";

export type SheetLite = { kind: "pdf" | "image"; url?: string; page_count: number };

// Tesseract 워커는 한 번만 만들어 추출 내내 재사용한다 (매번 초기화하면 느리다)
let workerPromise: Promise<import("tesseract.js").Worker> | null = null;
async function getWorker() {
  if (!workerPromise) {
    workerPromise = import("tesseract.js").then((m) => m.createWorker("kor"));
  }
  return workerPromise;
}
export async function terminateWorker() {
  if (workerPromise) {
    const w = await workerPromise;
    await w.terminate();
    workerPromise = null;
  }
}

async function ocr(image: Blob | HTMLCanvasElement): Promise<string> {
  const worker = await getWorker();
  const { data } = await worker.recognize(image);
  return data.text || "";
}

function hangulCount(s: string) {
  return (s.match(/[가-힣]/g) || []).length;
}

/** PDF 글자 레이어에서 텍스트를 뽑는다 (줄바꿈 유지). 글자 레이어가 없으면 짧게 나온다. */
async function pdfText(url: string, pages: number): Promise<string> {
  const doc = await getPdfDocument(url);
  let out = "";
  for (let p = 1; p <= Math.max(1, pages); p++) {
    const page = await doc.getPage(p);
    const content = await page.getTextContent();
    for (const it of content.items) {
      if ("str" in it) {
        out += it.str;
        if (it.hasEOL) out += "\n";
      }
    }
    out += "\n";
  }
  return out;
}

/** 글자 레이어가 없는(스캔) PDF → 페이지를 이미지로 그려 OCR */
async function pdfOcr(url: string, pages: number): Promise<string> {
  const doc = await getPdfDocument(url);
  let out = "";
  for (let p = 1; p <= Math.max(1, pages); p++) {
    const page = await doc.getPage(p);
    const viewport = page.getViewport({ scale: 2 });
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(viewport.width);
    canvas.height = Math.round(viewport.height);
    await page.render({ canvas, viewport }).promise;
    out += (await ocr(canvas)) + "\n";
  }
  return out;
}

/** 악보 한 장에서 텍스트를 뽑는다. PDF 는 글자 레이어 우선, 없으면 OCR. 이미지는 OCR. */
export async function extractSheetText(sheet: SheetLite): Promise<string> {
  if (!sheet.url) return "";
  if (sheet.kind === "pdf") {
    const text = await pdfText(sheet.url, sheet.page_count);
    if (hangulCount(text) >= 5) return text; // 글자 레이어 있음 → 그대로(정확)
    return await pdfOcr(sheet.url, sheet.page_count); // 스캔 PDF → OCR
  }
  const blob = await (await fetch(sheet.url)).blob();
  return await ocr(blob);
}

/** 뽑은 텍스트에서 가사만 남긴다 — 한글이 든 줄만, 공백 정리. (코드·숫자·음표 잡음 제거) */
export function cleanLyrics(raw: string): string {
  return raw
    .split(/\r?\n/)
    .map((l) => l.replace(/\s+/g, " ").trim())
    .filter((l) => /[가-힣]/.test(l) && l.replace(/[^가-힣]/g, "").length >= 2)
    .join("\n");
}
