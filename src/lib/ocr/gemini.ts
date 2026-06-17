import { GoogleGenAI } from "@google/genai";
import type { OCRResult, MenuExtractionResult, ExtractedMenuItem } from "./types";

/** Reusable helper: File → base64 string. */
async function fileToBase64(imageFile: File): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string).split(",")[1]);
    reader.onerror = reject;
    reader.readAsDataURL(imageFile);
  });
}

/**
 * Extract raw text from an image using Gemini 2.5 Flash.
 * Used as a fallback for generic OCR — prefer `extractMenuItems` for menus.
 */
export async function runGeminiOCR(imageFile: File, apiKey: string): Promise<OCRResult> {
  if (!apiKey) throw new Error("Gemini API key is required");

  const ai = new GoogleGenAI({ apiKey });
  const base64 = await fileToBase64(imageFile);
  const mimeType = imageFile.type || "image/jpeg";

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: [
      {
        role: "user",
        parts: [
          { inlineData: { data: base64, mimeType } },
          {
            text:
              "Extract all text from this image accurately. " +
              "Preserve the original layout as closely as possible. " +
              "Do not add commentary, explanations, or formatting — return only the raw text.",
          },
        ],
      },
    ],
  });

  return { text: response?.text ?? "", provider: "gemini" };
}

/**
 * ⚡ Smart Menu Extraction — Gemini returns structured JSON directly.
 *
 * Instead of OCR → regex, this asks Gemini to understand the menu image
 * and return clean, structured items with name, price, description, and
 * food type already parsed. This is:
 *   - **Much faster** (single API call, no post-processing)
 *   - **Far more accurate** (AI understands context, layout, currencies)
 *   - **Auto-detects food type** (veg/non-veg from symbols & context)
 *
 * @param imageFile  Menu card image.
 * @param apiKey     Gemini Developer API key.
 */
export async function extractMenuItems(imageFile: File, apiKey: string): Promise<MenuExtractionResult> {
  if (!apiKey) throw new Error("Gemini API key is required");

  const ai = new GoogleGenAI({ apiKey });
  const base64 = await fileToBase64(imageFile);
  const mimeType = imageFile.type || "image/jpeg";

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: [
      {
        role: "user",
        parts: [
          { inlineData: { data: base64, mimeType } },
          {
            text: `You are a menu card data extractor. Analyze this menu card image and extract every food/drink item.

Return ONLY a valid JSON array (no markdown, no code fences, no explanation). Each object must have:
- "name": string — the item name, cleaned up (proper capitalization, no trailing dots/dashes)
- "price": number — the price as a plain number (no currency symbols). If multiple sizes, use the base/smallest price.
- "description": string — a brief description if visible on the menu, otherwise empty string ""
- "food_type": one of "veg", "non_veg", "egg", "vegan" — detect from:
  • Green dot/square symbol = "veg"
  • Red/brown dot/square symbol = "non_veg"
  • Yellow dot/square or egg symbol = "egg"
  • If no symbol visible, infer from the item name (chicken/mutton/fish = "non_veg", paneer/dal = "veg")
  • Default to "veg" if uncertain

Rules:
- Extract ALL items, do not skip any
- Ignore section headers, category names, restaurant info — only extract orderable items with prices
- If price is not visible for an item, skip that item
- Clean up OCR artifacts (extra spaces, garbled characters)
- Return [] if no menu items found

Example output:
[{"name":"Butter Chicken","price":320,"description":"Creamy tomato-based curry","food_type":"non_veg"},{"name":"Dal Makhani","price":220,"description":"","food_type":"veg"}]`,
          },
        ],
      },
    ],
  });

  const raw = (response?.text ?? "").trim();

  // Parse the JSON response — handle potential markdown code fences.
  let jsonStr = raw;
  const fenceMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) jsonStr = fenceMatch[1].trim();

  let items: ExtractedMenuItem[] = [];
  try {
    const parsed = JSON.parse(jsonStr);
    if (Array.isArray(parsed)) {
      items = parsed
        .filter((item: Record<string, unknown>) => item.name && typeof item.price === "number" && item.price > 0)
        .map((item: Record<string, unknown>) => ({
          name: String(item.name).trim(),
          price: Number(item.price),
          description: String(item.description ?? "").trim(),
          food_type: (["veg", "non_veg", "egg", "vegan"].includes(String(item.food_type))
            ? String(item.food_type)
            : "veg") as ExtractedMenuItem["food_type"],
        }));
    }
  } catch {
    // If JSON parse fails, return empty — scanner will show "try a clearer photo" message.
    console.warn("Gemini menu extraction: failed to parse JSON response:", raw);
  }

  return { items, provider: "gemini" };
}
