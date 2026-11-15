import { getDocument, GlobalWorkerOptions } from "pdfjs-dist";
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { createWorker, OEM } from "tesseract.js";
import type { ClassBlock } from "@workspace/api-client-react";
import { parseIcsSchedule, parseScheduleText } from "@/lib/schedule-parser";

GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

const MAX_BYTES = 12 * 1024 * 1024;
const MAX_PDF_PAGES = 12;

async function imageText(file: File, onProgress: (message: string) => void) {
  const worker = await createWorker("eng", OEM.LSTM_ONLY, {
    logger: (event) => { if (event.status) onProgress(event.status); },
  });
  try {
    return (await worker.recognize(file)).data.text;
  } finally {
    await worker.terminate();
  }
}

export async function importScheduleFile(
  file: File,
  onProgress: (message: string) => void = () => {},
): Promise<ClassBlock[]> {
  if (file.size > MAX_BYTES) throw new Error("Choose a file smaller than 12 MB.");
  const name = file.name.toLowerCase();
  if (name.endsWith(".ics") || file.type === "text/calendar") {
    return parseIcsSchedule(await file.text());
  }
  let text = "";
  if (name.endsWith(".pdf") || file.type === "application/pdf") {
    const pdfTask = getDocument({ data: new Uint8Array(await file.arrayBuffer()) });
    const pdf = await pdfTask.promise;
    if (pdf.numPages > MAX_PDF_PAGES) {
      await pdfTask.destroy();
      throw new Error("Choose a PDF with 12 pages or fewer.");
    }
    const pages: string[] = [];
    for (let i = 1; i <= pdf.numPages; i++) {
      onProgress(`Reading page ${i} of ${pdf.numPages}`);
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      const lines: string[] = [];
      let lastY: number | undefined;
      for (const item of content.items) {
        if (!("str" in item)) continue;
        const y = item.transform?.[5];
        if (lastY !== undefined && y !== undefined && Math.abs(y - lastY) > 3) lines.push("\n");
        lines.push(item.str);
        lastY = y;
      }
      pages.push(lines.join(" "));
    }
    text = pages.join("\n");
    if (text.replace(/\s/g, "").length < 30) {
      onProgress("Scanning the PDF in your browser");
      const worker = await createWorker("eng", OEM.LSTM_ONLY, {
        logger: (event) => { if (event.status) onProgress(event.status); },
      });
      try {
        const scanned: string[] = [];
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const viewport = page.getViewport({ scale: 1.5 });
          const canvas = document.createElement("canvas");
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          const context = canvas.getContext("2d");
          if (!context) continue;
          await page.render({ canvasContext: context, canvas, viewport }).promise;
          scanned.push((await worker.recognize(canvas)).data.text);
        }
        text = scanned.join("\n");
      } finally {
        await worker.terminate();
      }
    }
    await pdfTask.destroy();
  } else if (file.type.startsWith("image/") || /\.(png|jpe?g|webp)$/i.test(name)) {
    onProgress("Reading the image in your browser");
    text = await imageText(file, onProgress);
  } else {
    throw new Error("Choose an .ics, PDF, or image file.");
  }
  return parseScheduleText(text);
}
