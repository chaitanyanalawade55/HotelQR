import type { OCRResult } from "./types";

const DEFAULT_OCRSPACE_KEY = "helloworld"; // Free demo key — works for low-volume testing.
const ENDPOINT = "https://api.ocr.space/parse/image";

/**
 * Extract text from an image using the **OCR.space** free API.
 *
 * - No sign-up required (uses the demo key by default).
 * - Fast: typically < 1 second response.
 * - Good accuracy for printed text; less suited for handwriting.
 *
 * @param imageFile  The image to extract text from.
 * @param apiKey     Optional — a personal OCR.space API key for higher rate limits.
 */
export async function runOCRSpace(imageFile: File, apiKey?: string | null): Promise<OCRResult> {
  const key = apiKey?.trim() || DEFAULT_OCRSPACE_KEY;

  const formData = new FormData();
  formData.append("file", imageFile);
  formData.append("language", "eng");
  formData.append("isOverlayRequired", "false");
  formData.append("scale", "true"); // Pre-process: upscale small images.
  formData.append("OCREngine", "2");  // Engine 2 is more accurate for dense text.

  const response = await fetch(ENDPOINT, {
    method: "POST",
    headers: { apikey: key },
    body: formData,
  });

  if (!response.ok) {
    throw new Error(`OCR.space returned HTTP ${response.status}`);
  }

  const data = await response.json();

  if (data.IsErroredOnProcessing) {
    const msg = data.ErrorMessage?.join(", ") || "OCR.space processing error";
    throw new Error(msg);
  }

  const text = (data.ParsedResults ?? [])
    .map((r: { ParsedText?: string }) => r.ParsedText ?? "")
    .join("\n")
    .trim();

  return { text, provider: "ocrspace" };
}
