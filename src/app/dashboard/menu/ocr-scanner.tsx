"use client";
import { useState, useRef, useEffect } from "react";
import { Camera, X, Loader2, Plus, Trash2, Sparkles, Zap, Cpu } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/Button";
import { createClient } from "@/lib/supabase/client";
import { runOCR, extractMenuItems, type OCRProvider, type ExtractedMenuItem } from "@/lib/ocr";
import type { MenuItem } from "@/types/database";

type FoodType = "veg" | "non_veg" | "egg" | "vegan";
type ParsedItem = { name: string; price: number; description: string; food_type: FoodType; selected: boolean };
type Step = "upload" | "processing" | "review";

interface Props {
  hotelId: string;
  categoryId: string;
  categoryName: string;
  existingItemCount: number;
  onClose: () => void;
  onAdded: (items: MenuItem[]) => void;
}

/** Provider metadata for the dropdown UI. */
const PROVIDERS: { id: OCRProvider; label: string; icon: typeof Sparkles; desc: string; needsKey: boolean }[] = [
  { id: "gemini",    label: "Gemini AI ✨",     icon: Sparkles, desc: "Fastest & most accurate — free tier",     needsKey: true },
  { id: "ocrspace",  label: "OCR.space",        icon: Zap,      desc: "Fast cloud OCR — no sign-up",            needsKey: false },
  { id: "tesseract", label: "Offline (device)",  icon: Cpu,      desc: "Runs on your device — slower",           needsKey: false },
];

const GEMINI_KEY_STORAGE = "gemini_api_key";

/**
 * Regex-based parser for raw OCR text (used by OCR.space & Tesseract fallback).
 * Gemini uses its own structured JSON extraction and bypasses this entirely.
 */
function parseMenuText(rawText: string): ParsedItem[] {
  const lines = rawText.split("\n").map((l) => l.trim()).filter(Boolean);
  const items: ParsedItem[] = [];
  const priceRegex = /(?:₹|Rs\.?|INR\s?)?\s*(\d{2,4})(?:\.?\d{0,2})?(?:\s*\/?\s*-)?/g;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const priceMatch = line.match(priceRegex);
    if (priceMatch) {
      const price = parseFloat(priceMatch[priceMatch.length - 1].replace(/[₹Rs.INR\s/-]/gi, ""));
      const name = line.replace(priceRegex, "").replace(/\s+/g, " ").trim();

      let description = "";
      const next = lines[i + 1];
      if (next && !next.match(priceRegex) && next.length < 120) {
        description = next;
        i++; // consume the description line
      }

      if (name.length > 2 && price > 0 && price < 10000) {
        items.push({ name, price, description, food_type: "veg", selected: true });
      }
    }
  }
  return items;
}

/** Convert ExtractedMenuItem[] (from Gemini) to ParsedItem[] for the review UI. */
function toParsedItems(extracted: ExtractedMenuItem[]): ParsedItem[] {
  return extracted.map((item) => ({
    name: item.name,
    price: item.price,
    description: item.description,
    food_type: item.food_type,
    selected: true,
  }));
}

export function OCRScanner({ hotelId, categoryId, categoryName, existingItemCount, onClose, onAdded }: Props) {
  const [step, setStep] = useState<Step>("upload");
  const [progress, setProgress] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [provider, setProvider] = useState<OCRProvider>("tesseract");
  const [parsed, setParsed] = useState<ParsedItem[]>([]);
  const [saving, setSaving] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const supabase = createClient();

  // Auto-select Gemini if a key exists.
  useEffect(() => {
    const key = typeof window !== "undefined" ? localStorage.getItem(GEMINI_KEY_STORAGE) : null;
    if (key) setProvider("gemini");
  }, []);

  async function handleImage(file: File) {
    if (!file.type.startsWith("image/")) {
      toast.error("Please choose an image file");
      return;
    }
    setStep("processing");
    setProgress(0);

    try {
      const apiKey = typeof window !== "undefined" ? localStorage.getItem(GEMINI_KEY_STORAGE) : null;

      // Warn if Gemini selected but no key, fall back to tesseract.
      let activeProvider = provider;
      if (provider === "gemini" && !apiKey) {
        toast("No Gemini API key set — falling back to offline OCR");
        activeProvider = "tesseract";
      }

      let items: ParsedItem[];

      if (activeProvider === "gemini" && apiKey) {
        // ⚡ FAST PATH: Gemini structured extraction — returns parsed items directly.
        // No regex, no post-processing. AI understands the menu layout natively.
        const result = await extractMenuItems(file, apiKey);
        items = toParsedItems(result.items);
      } else {
        // FALLBACK: OCR.space / Tesseract → raw text → regex parsing.
        const result = await runOCR(file, activeProvider, {
          apiKey,
          onProgress: setProgress,
        });
        items = parseMenuText(result.text);
      }

      if (items.length === 0) {
        toast.error("Could not read menu items. Try a clearer photo.");
        setStep("upload");
        return;
      }

      setParsed(items);
      setStep("review");
    } catch (err) {
      console.error(err);
      toast.error("Something went wrong while reading the image.");
      setStep("upload");
    }
  }

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleImage(file);
  }

  function updateRow(index: number, patch: Partial<ParsedItem>) {
    setParsed((prev) => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  function removeRow(index: number) {
    setParsed((prev) => prev.filter((_, i) => i !== index));
  }

  function addBlankRow() {
    setParsed((prev) => [...prev, { name: "", price: 0, description: "", food_type: "veg", selected: true }]);
  }

  const checkedItems = parsed.filter((p) => p.selected && p.name.trim());

  async function confirmAdd() {
    if (checkedItems.length === 0) {
      toast.error("Select at least one item");
      return;
    }
    setSaving(true);
    const rows = checkedItems.map((item, i) => ({
      hotel_id: hotelId,
      category_id: categoryId,
      name: item.name.trim(),
      price: item.price,
      description: item.description.trim() || null,
      food_type: item.food_type,
      sort_order: existingItemCount + i,
      is_available: true,
    }));
    const { data, error } = await supabase.from("menu_items").insert(rows).select();
    setSaving(false);
    if (error) {
      toast.error("Could not add items. Try again.");
      return;
    }
    onAdded((data as unknown as MenuItem[]) ?? []);
    toast.success(`Added ${rows.length} items to your menu!`);
    onClose();
  }

  const showProgressBar = provider === "tesseract";

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      {step === "upload" && (
        <div className="bg-white rounded-3xl p-6 max-w-sm w-full mx-4">
          <div className="flex items-start justify-between mb-1">
            <h2 className="text-lg font-semibold text-[#0F0E17]">Scan your menu card</h2>
            <button onClick={onClose} className="text-[#9CA3AF] hover:text-[#0F0E17] min-h-0 min-w-0 p-1 -mr-1 -mt-1">
              <X size={18} />
            </button>
          </div>
          <p className="text-sm text-[#6B7280] mb-4">Take a photo or upload an image of your existing menu</p>

          <button
            type="button"
            onClick={() => fileInput.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              const file = e.dataTransfer.files?.[0];
              if (file) handleImage(file);
            }}
            className={[
              "w-full border-dashed border-2 rounded-2xl p-8 flex flex-col items-center justify-center gap-2 transition-colors",
              dragging ? "border-[#F97316] bg-[#FFF7ED]" : "border-[#E5E7EB]",
            ].join(" ")}
          >
            <Camera size={32} className="text-[#9CA3AF]" />
            <span className="text-sm text-[#6B7280]">Tap to photograph or upload</span>
          </button>
          <input
            ref={fileInput}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            capture="environment"
            className="hidden"
            onChange={onFileChange}
          />

          {/* ── OCR Provider Selector ── */}
          <div className="mt-4 space-y-1.5">
            <p className="text-xs font-medium text-[#374151]">OCR Engine</p>
            {PROVIDERS.map((p) => {
              const Icon = p.icon;
              const active = provider === p.id;
              return (
                <button
                  key={p.id}
                  onClick={() => setProvider(p.id)}
                  className={[
                    "w-full flex items-center gap-2.5 rounded-xl px-3 py-2 text-left transition-all border",
                    active
                      ? "border-[#F97316] bg-[#FFF7ED] ring-1 ring-[#F97316]/30"
                      : "border-[#E5E7EB] hover:border-[#D1D5DB]",
                  ].join(" ")}
                >
                  <Icon size={14} className={active ? "text-[#F97316]" : "text-[#9CA3AF]"} />
                  <div className="flex-1 min-w-0">
                    <span className={["text-xs font-medium", active ? "text-[#0F0E17]" : "text-[#374151]"].join(" ")}>
                      {p.label}
                    </span>
                    <p className="text-[10px] text-[#9CA3AF] leading-tight">{p.desc}</p>
                  </div>
                  <div
                    className={[
                      "w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0",
                      active ? "border-[#F97316]" : "border-[#D1D5DB]",
                    ].join(" ")}
                  >
                    {active && <div className="w-2 h-2 rounded-full bg-[#F97316]" />}
                  </div>
                </button>
              );
            })}
            {provider === "gemini" && !localStorage.getItem(GEMINI_KEY_STORAGE) && (
              <p className="text-[10px] text-[#EF4444] pl-1">⚠ Add your Gemini API key in Settings first</p>
            )}
          </div>

          <button onClick={onClose} className="text-[#6B7280] text-sm mt-4 w-full text-center min-h-0">
            Cancel
          </button>
        </div>
      )}

      {step === "processing" && (
        <div className="bg-white rounded-3xl p-6 max-w-sm w-full mx-4 flex flex-col items-center">
          <Loader2 size={32} className="animate-spin text-[#F97316] mb-3" />
          <p className="text-sm font-medium text-[#0F0E17]">
            {provider === "gemini" ? "AI is reading your menu..." : "Reading your menu..."}
          </p>
          {showProgressBar && (
            <>
              <div className="w-full bg-[#F3F4F6] rounded-full h-2 mt-4">
                <div
                  className="bg-[#F97316] h-2 rounded-full transition-all"
                  style={{ width: `${Math.round(progress * 100)}%` }}
                />
              </div>
              <p className="text-xs text-[#9CA3AF] mt-2">This takes 10-20 seconds</p>
            </>
          )}
          {!showProgressBar && (
            <p className="text-xs text-[#9CA3AF] mt-2">
              {provider === "gemini"
                ? "Extracting items, prices & food types — usually 2-4 seconds"
                : "Usually takes 1-3 seconds"}
            </p>
          )}
        </div>
      )}

      {step === "review" && (
        <div className="bg-white rounded-3xl p-6 max-w-md w-full mx-4 flex flex-col max-h-[85vh]">
          <div className="flex items-start justify-between mb-1">
            <h2 className="text-lg font-semibold text-[#0F0E17]">
              Found {parsed.length} item{parsed.length !== 1 ? "s" : ""} — review before adding
            </h2>
            <button onClick={onClose} className="text-[#9CA3AF] hover:text-[#0F0E17] min-h-0 min-w-0 p-1 -mr-1 -mt-1">
              <X size={18} />
            </button>
          </div>
          <p className="text-sm text-[#6B7280] mb-4">Uncheck any items you don&apos;t want to add</p>

          <div className="max-h-96 overflow-y-auto space-y-2 -mx-1 px-1">
            {parsed.map((row, i) => (
              <div key={i} className="flex items-center gap-2 bg-[#F8F9FA] rounded-2xl p-2">
                <input
                  type="checkbox"
                  checked={row.selected}
                  onChange={(e) => updateRow(i, { selected: e.target.checked })}
                  className="flex-shrink-0"
                />
                <input
                  value={row.name}
                  onChange={(e) => updateRow(i, { name: e.target.value })}
                  placeholder="Item name"
                  className="flex-1 min-w-0 bg-white border border-[#E5E7EB] rounded-xl px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-[#F97316]"
                />
                <input
                  type="number"
                  value={row.price}
                  onChange={(e) => updateRow(i, { price: parseFloat(e.target.value) || 0 })}
                  className="w-16 bg-white border border-[#E5E7EB] rounded-xl px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-[#F97316]"
                />
                <select
                  value={row.food_type}
                  onChange={(e) => updateRow(i, { food_type: e.target.value as FoodType })}
                  className="w-20 bg-white border border-[#E5E7EB] rounded-xl px-1 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-[#F97316]"
                >
                  <option value="veg">Veg</option>
                  <option value="non_veg">Non-Veg</option>
                  <option value="egg">Egg</option>
                  <option value="vegan">Vegan</option>
                </select>
                <button
                  onClick={() => removeRow(i)}
                  className="text-[#9CA3AF] hover:text-[#EF4444] flex-shrink-0 min-h-0 min-w-0 p-1"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            ))}

            <button
              onClick={addBlankRow}
              className="flex items-center gap-1.5 text-sm text-[#F97316] font-medium px-2 py-2 min-h-0"
            >
              <Plus size={15} /> Add a row manually
            </button>
          </div>

          <div className="flex flex-col gap-2 mt-4 pt-4 border-t border-[#E5E7EB]">
            <Button variant="primary" size="md" fullWidth loading={saving} onClick={confirmAdd}>
              Add {checkedItems.length} item{checkedItems.length !== 1 ? "s" : ""} to {categoryName}
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setStep("upload")}>
              Start over
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
