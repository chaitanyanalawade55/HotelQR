/**
 * OCR Module — Unified text extraction from images.
 *
 * This module provides three interchangeable OCR providers:
 *   1. **Gemini 2.5 Flash** (recommended) — free-tier multimodal AI, best accuracy.
 *      - `extractMenuItems()` — structured JSON extraction (fastest path for menus)
 *      - `runGeminiOCR()`     — raw text extraction
 *   2. **OCR.space**          — free cloud API, fast, no sign-up.
 *   3. **Tesseract.js**       — 100% client-side, no API key, fully offline-capable.
 *
 * Usage:
 *   import { runOCR, extractMenuItems } from "@/lib/ocr";
 *   const result = await extractMenuItems(file, apiKey);  // structured
 *   const result = await runOCR(file, "ocrspace");        // raw text
 */

export type {
  OCRProvider,
  OCRResult,
  OCROptions,
  OCRProgressCallback,
  ExtractedMenuItem,
  MenuExtractionResult,
} from "./types";

import type { OCRProvider, OCRResult, OCROptions } from "./types";
import { runGeminiOCR } from "./gemini";
import { runOCRSpace } from "./ocrspace";
import { runTesseractOCR } from "./tesseract";

// Re-export individual providers for advanced use-cases.
export { runGeminiOCR, extractMenuItems } from "./gemini";
export { runOCRSpace } from "./ocrspace";
export { runTesseractOCR } from "./tesseract";

/**
 * Run OCR on an image using the specified provider.
 * Returns raw text — use `extractMenuItems()` for structured Gemini extraction.
 *
 * @param imageFile  The image file to extract text from.
 * @param provider   Which OCR engine to use.
 * @param options    Provider-specific options (API key, progress callback, etc.).
 */
export async function runOCR(
  imageFile: File,
  provider: OCRProvider,
  options: OCROptions = {}
): Promise<OCRResult> {
  switch (provider) {
    case "gemini":
      if (!options.apiKey) throw new Error("Gemini API key is required. Add it in Settings.");
      return runGeminiOCR(imageFile, options.apiKey);

    case "ocrspace":
      return runOCRSpace(imageFile, options.apiKey);

    case "tesseract":
      return runTesseractOCR(imageFile, options.onProgress);

    default:
      throw new Error(`Unknown OCR provider: ${provider}`);
  }
}
