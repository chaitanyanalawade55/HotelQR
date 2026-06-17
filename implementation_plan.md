# Replace Google Vision OCR with Alternative Providers

Replace the current Google Vision API OCR integration with three optimized alternatives — **Gemini Developer API** (recommended), **OCR.space**, and **client-side Tesseract.js** — organized in a clean, separate OCR directory.

## User Review Required

> [!IMPORTANT]
> The **Gemini API key** will be stored in `localStorage` (same approach as the current Vision API key). For production, you should set `GEMINI_API_KEY` as a Vercel environment variable and use a Next.js API route to proxy the call. This plan uses the client-side approach to keep it simple and free (no server needed).

> [!WARNING]
> The Google Vision API integration (`runVisionOCR`) will be **completely removed**. The `vision_api_key` localStorage key will be migrated to `gemini_api_key` on the Settings page.

## Proposed Changes

### New OCR Module — `src/lib/ocr/`

Create a dedicated **`src/lib/ocr/`** directory with a clean, modular architecture:

#### [NEW] [types.ts](file:///c:/Users/chaitanya%20nalawade/OneDrive/Desktop/Hotel%20Management%20QR/HotelQR/src/lib/ocr/types.ts)
- Define shared `OCRProvider` type (`"gemini" | "ocrspace" | "tesseract"`)
- Define `OCRResult` interface (`{ text: string; provider: OCRProvider }`)
- Define `OCRProgressCallback` type

#### [NEW] [gemini.ts](file:///c:/Users/chaitanya%20nalawade/OneDrive/Desktop/Hotel%20Management%20QR/HotelQR/src/lib/ocr/gemini.ts)
- **Option 1 (Recommended)**: Gemini Developer API using `@google/genai` SDK
- Uses `gemini-2.5-flash` model with multimodal content (image + text prompt)
- Reads API key from `localStorage` (`gemini_api_key`)
- Converts image `File` → base64, sends to Gemini, returns extracted text
- **Free tier, no credit card required**

#### [NEW] [ocrspace.ts](file:///c:/Users/chaitanya%20nalawade/OneDrive/Desktop/Hotel%20Management%20QR/HotelQR/src/lib/ocr/ocrspace.ts)
- **Option 2**: OCR.space free API endpoint
- Simple `fetch` to `https://api.ocr.space/parse/image` with the image as form data
- Uses free API key (`helloworld` for testing, or user-provided key)
- Fast (<1 second response)

#### [NEW] [tesseract.ts](file:///c:/Users/chaitanya%20nalawade/OneDrive/Desktop/Hotel%20Management%20QR/HotelQR/src/lib/ocr/tesseract.ts)
- **Option 3**: Client-side Tesseract.js (existing code, extracted to module)
- Runs entirely in the user's browser — 100% free, no timeouts
- Dynamic import of `tesseract.js` to keep it out of main bundle
- Includes progress callback support

#### [NEW] [index.ts](file:///c:/Users/chaitanya%20nalawade/OneDrive/Desktop/Hotel%20Management%20QR/HotelQR/src/lib/ocr/index.ts)
- Barrel export for all OCR providers
- `runOCR(file, provider, options)` dispatcher function that routes to the correct provider
- Central, clean API for the rest of the app to consume

---

### OCR Scanner Component

#### [MODIFY] [ocr-scanner.tsx](file:///c:/Users/chaitanya%20nalawade/OneDrive/Desktop/Hotel%20Management%20QR/HotelQR/src/app/dashboard/menu/ocr-scanner.tsx)
- **Remove** the inline `runVisionOCR` and `runTesseract` functions
- **Import** `runOCR` and `OCRProvider` from `@/lib/ocr`
- Replace the single `useVision` checkbox with a **provider dropdown** (Gemini AI ✨, OCR.space, Offline Tesseract)
- Default selection: `"gemini"` if a Gemini API key exists, else `"tesseract"`
- Update `handleImage` to call `runOCR(file, selectedProvider, { onProgress, apiKey })`
- Progress bar only shows for Tesseract provider; Gemini/OCR.space show a spinner

---

### Settings Page

#### [MODIFY] [page.tsx](file:///c:/Users/chaitanya%20nalawade/OneDrive/Desktop/Hotel%20Management%20QR/HotelQR/src/app/dashboard/settings/page.tsx)
- Change label from "AI OCR — Google Vision" → "AI OCR — Gemini API"
- Change localStorage key from `vision_api_key` → `gemini_api_key`
- Update description text to explain Gemini free tier (no credit card, multimodal AI)
- Update placeholder from `AIza...` → `AIza...` (same format for Gemini keys)
- Add a note that OCR.space and Tesseract don't need any API key

---

### Dependencies

#### [MODIFY] [package.json](file:///c:/Users/chaitanya%20nalawade/OneDrive/Desktop/Hotel%20Management%20QR/HotelQR/package.json)
- **Add** `@google/genai` dependency (Gemini SDK)
- `tesseract.js` already present ✅

## Verification Plan

### Manual Verification
- Build the project with `npm run build` to verify no TypeScript errors
- Verify the Settings page correctly saves/loads `gemini_api_key`
- Test each OCR provider selection in the scanner dropdown
