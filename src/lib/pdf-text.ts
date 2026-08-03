// Extrae el texto plano de un PDF en el navegador (pdf.js). Se usa para leer
// la Constancia de Situación Fiscal que el usuario sube en el onboarding —
// nunca se envía el PDF a un servidor, todo el parseo ocurre localmente.

import * as pdfjsLib from "pdfjs-dist";
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

export async function extractPdfText(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const loadingTask = pdfjsLib.getDocument({ data: buffer });
  try {
    const doc = await loadingTask.promise;
    const pageTexts: string[] = [];
    for (let pageNumber = 1; pageNumber <= doc.numPages; pageNumber++) {
      const page = await doc.getPage(pageNumber);
      const content = await page.getTextContent();
      const line = content.items
        .map((item) => ("str" in item ? item.str : ""))
        .join(" ")
        .replace(/\s+/g, " ")
        .trim();
      pageTexts.push(line);
    }
    return pageTexts.join("\n");
  } finally {
    await loadingTask.destroy();
  }
}
