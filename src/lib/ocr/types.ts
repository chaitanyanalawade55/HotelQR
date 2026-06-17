/** Supported OCR provider identifiers. */
export type OCRProvider = "gemini" | "ocrspace" | "tesseract";

/** Standardised result returned by every provider. */
export interface OCRResult {
  text: string;
  provider: OCRProvider;
}

/** A single menu item extracted by smart AI extraction (Gemini). */
export interface ExtractedMenuItem {
  name: string;
  price: number;
  description: string;
  food_type: "veg" | "non_veg" | "egg" | "vegan";
}

/** Result from smart menu extraction — structured items, not raw text. */
export interface MenuExtractionResult {
  items: ExtractedMenuItem[];
  provider: OCRProvider;
}

/** Progress callback (0 → 1) — only meaningful for Tesseract. */
export type OCRProgressCallback = (progress: number) => void;

/** Options bag passed into the unified `runOCR` dispatcher. */
export interface OCROptions {
  /** API key for the selected provider (Gemini / OCR.space). */
  apiKey?: string | null;
  /** Progress callback — only used by the Tesseract provider. */
  onProgress?: OCRProgressCallback;
}
