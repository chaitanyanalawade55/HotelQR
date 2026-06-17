import type { OCRProgressCallback, OCRResult } from "./types";

/**
 * Extract text from an image using **Tesseract.js** running in the browser.
 *
 * - 100% free, no API key, no backend required.
 * - Dynamically imported so the ~5 MB language model never enters the main bundle.
 * - First run downloads the trained-data file; subsequent runs are cached.
 *
 * @param imageFile   The image to extract text from.
 * @param onProgress  Optional callback receiving a value from 0 → 1 during recognition.
 */
export async function runTesseractOCR(
  imageFile: File,
  onProgress?: OCRProgressCallback
): Promise<OCRResult> {
  const { createWorker } = await import("tesseract.js");

  const worker = await createWorker("eng", 1, {
    logger: (m: { status: string; progress: number }) => {
      if (m.status === "recognizing text" && onProgress) {
        onProgress(m.progress);
      }
    },
  });

  const {
    data: { text },
  } = await worker.recognize(imageFile);

  await worker.terminate();

  return { text, provider: "tesseract" };
}
