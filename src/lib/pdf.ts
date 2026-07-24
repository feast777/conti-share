"use client";

import type { PDFDocumentProxy } from "pdfjs-dist";

type PdfModule = typeof import("pdfjs-dist");

let modulePromise: Promise<PdfModule> | null = null;

function loadPdfjs(): Promise<PdfModule> {
  modulePromise ??= import("pdfjs-dist").then((mod) => {
    mod.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
    return mod;
  });
  return modulePromise;
}

/** 같은 악보를 페이지마다 다시 내려받지 않도록 문서를 캐시한다. */
const docCache = new Map<string, Promise<PDFDocumentProxy>>();

export function getPdfDocument(url: string): Promise<PDFDocumentProxy> {
  let doc = docCache.get(url);
  if (!doc) {
    doc = loadPdfjs().then((pdfjs) => pdfjs.getDocument({ url }).promise);
    docCache.set(url, doc);
  }
  return doc;
}

/** 업로드 직전에 PDF 페이지 수를 알아낸다. */
export async function readPdfPageCount(file: File): Promise<number> {
  const pdfjs = await loadPdfjs();
  const buffer = await file.arrayBuffer();
  const task = pdfjs.getDocument({ data: new Uint8Array(buffer) });
  const doc = await task.promise;
  const count = doc.numPages;
  await task.destroy();
  return count;
}
