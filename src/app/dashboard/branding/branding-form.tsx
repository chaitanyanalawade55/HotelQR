"use client";
import { useState, useRef } from "react";
import { Upload, Trash2, Check } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Select } from "@/components/ui/Input";
import { VegIndicator } from "@/components/ui/VegIndicator";
import { createClient } from "@/lib/supabase/client";
import type { Hotel, HotelSettings } from "@/types/database";

const SWATCHES = [
  { color: "#F97316", name: "Saffron" },
  { color: "#1C1C2E", name: "Navy" },
  { color: "#0D9488", name: "Teal" },
  { color: "#2E7D4F", name: "Forest" },
  { color: "#7C3AED", name: "Violet" },
  { color: "#BE123C", name: "Ruby" },
  { color: "#D97706", name: "Amber" },
  { color: "#374151", name: "Slate" },
];

const CURRENCIES = [
  { value: "INR", label: "₹ Indian Rupee" },
  { value: "USD", label: "$ US Dollar" },
  { value: "EUR", label: "€ Euro" },
  { value: "GBP", label: "£ British Pound" },
  { value: "AED", label: "د.إ UAE Dirham" },
];

interface Props {
  hotel: Hotel;
  initialSettings: HotelSettings | null;
}

export function BrandingForm({ hotel, initialSettings }: Props) {
  const [themeColor, setThemeColor] = useState(initialSettings?.theme_color ?? "#F97316");
  const [currency, setCurrency] = useState(initialSettings?.currency ?? "INR");
  const [logoUrl, setLogoUrl] = useState(initialSettings?.logo_url ?? null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const logoInput = useRef<HTMLInputElement>(null);
  const supabase = createClient();

  async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { toast.error("Image must be under 2MB"); return; }
    setUploading(true);
    const ext = file.name.split(".").pop();
    const path = `${hotel.id}/logo.${ext}`;
    const { error } = await supabase.storage.from("hotel-logos").upload(path, file, { upsert: true });
    if (error) { toast.error("Image upload failed. Try again."); setUploading(false); return; }
    const { data: urlData } = supabase.storage.from("hotel-logos").getPublicUrl(path);
    setLogoUrl(`${urlData.publicUrl}?t=${Date.now()}`);
    setUploading(false);
    toast.success("Image uploaded");
  }

  async function handleRemoveLogo() {
    setLogoUrl(null);
  }

  async function handleSave() {
    setSaving(true);
    const payload = { hotel_id: hotel.id, theme_color: themeColor, currency, logo_url: logoUrl };
    const { error } = await supabase
      .from("hotel_settings")
      .upsert(payload, { onConflict: "hotel_id" });
    setSaving(false);
    if (error) { toast.error("Something went wrong."); return; }
    toast.success("Branding saved!");
  }

  return (
    <div className="px-4 md:px-8 py-6 max-w-xl mx-auto space-y-4">
      <h1 className="text-xl font-bold text-[#0F0E17] mb-5">Branding</h1>

      {/* Logo card */}
      <Card padding="lg">
        <p className="text-sm font-semibold text-[#0F0E17] mb-4">Restaurant logo</p>
        <div className="flex items-center gap-4">
          <div
            className="w-20 h-20 rounded-2xl overflow-hidden border-2 flex items-center justify-center bg-[#F8F9FA] flex-shrink-0"
            style={{ borderColor: themeColor }}
          >
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logoUrl} alt="Logo" className="w-full h-full object-cover" />
            ) : (
              <span className="text-xs text-[#9CA3AF]">No logo</span>
            )}
          </div>
          <div className="flex flex-col gap-2">
            <input ref={logoInput} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={handleLogoUpload} />
            <Button variant="secondary" size="sm" icon={<Upload size={14} />} loading={uploading} onClick={() => logoInput.current?.click()}>
              Upload logo
            </Button>
            {logoUrl && (
              <Button variant="ghost" size="sm" icon={<Trash2 size={14} />} onClick={handleRemoveLogo} className="text-[#EF4444]">
                Remove
              </Button>
            )}
            <p className="text-xs text-[#9CA3AF] mt-1">PNG, JPG or WEBP · Max 2MB</p>
          </div>
        </div>
      </Card>

      {/* Theme color card */}
      <Card padding="lg">
        <p className="text-sm font-semibold text-[#0F0E17] mb-3">Theme color</p>
        <div className="grid grid-cols-4 gap-2 mb-3">
          {SWATCHES.map(({ color }) => (
            <button
              key={color}
              onClick={() => setThemeColor(color)}
              className="h-12 rounded-2xl flex items-center justify-center cursor-pointer active:scale-95 transition-transform relative min-h-0"
              style={{
                backgroundColor: color,
                ...(themeColor === color ? { outline: "2px solid #0F0E17", outlineOffset: 2 } : {}),
              }}
            >
              {themeColor === color && <Check size={18} className="text-white" />}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <input
            type="color"
            value={themeColor}
            onChange={(e) => setThemeColor(e.target.value)}
            className="w-10 h-10 rounded-xl border border-[#E5E7EB] cursor-pointer p-0.5"
          />
          <span className="text-sm text-[#374151] font-mono">{themeColor}</span>
        </div>
      </Card>

      {/* Currency card */}
      <Card padding="lg">
        <p className="text-sm font-semibold text-[#0F0E17] mb-3">Currency</p>
        <Select value={currency} onChange={(e) => setCurrency(e.target.value)}>
          {CURRENCIES.map(({ value, label }) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </Select>
      </Card>

      {/* Live preview */}
      <Card padding="none">
        <p className="text-xs text-[#6B7280] uppercase tracking-widest px-4 pt-4 mb-3">
          How customers see your menu
        </p>
        <div className="rounded-3xl overflow-hidden border border-[#E5E7EB] mx-4 mb-4">
          <div className="px-4 py-4 flex items-center gap-3" style={{ backgroundColor: themeColor }}>
            <div className="w-10 h-10 rounded-full bg-white/25 overflow-hidden flex items-center justify-center flex-shrink-0">
              {logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={logoUrl} alt="" className="w-full h-full object-cover" />
              ) : null}
            </div>
            <div>
              <p
                className="text-white text-base font-semibold leading-tight"
                style={{ fontFamily: "var(--font-display)" }}
              >
                {hotel.name}
              </p>
              {hotel.address && (
                <p className="text-white/70 text-xs mt-0.5">{hotel.address}</p>
              )}
            </div>
          </div>
          <div className="bg-white px-4 py-3">
            <div className="flex items-center gap-1.5 mb-0.5">
              <VegIndicator type="veg" />
              <span className="text-sm font-medium text-[#0F0E17]">Paneer Butter Masala</span>
            </div>
            <p className="text-xs text-[#6B7280] mt-0.5">Rich tomato-based curry with cream</p>
            <p className="text-sm font-semibold mt-1" style={{ color: themeColor }}>₹320</p>
          </div>
        </div>
      </Card>

      <Button variant="primary" size="lg" fullWidth loading={saving} onClick={handleSave}>
        Save branding
      </Button>
    </div>
  );
}
