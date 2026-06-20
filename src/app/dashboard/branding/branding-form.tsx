"use client";
import { useState, useRef } from "react";
import { Upload, Trash2, Check } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Select } from "@/components/ui/Input";
import { Toggle } from "@/components/ui/Toggle";
import { VegIndicator } from "@/components/ui/VegIndicator";
import { createClient } from "@/lib/supabase/client";
import { compressImage } from "@/lib/compressImage";
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
  const [cancelEnabled, setCancelEnabled] = useState((initialSettings?.order_cancel_minutes ?? 0) > 0);
  const [cancelMinutes, setCancelMinutes] = useState(initialSettings?.order_cancel_minutes || 5);
  const [menuLayout, setMenuLayout] = useState<"classic" | "modern" | "premium">(initialSettings?.menu_layout ?? "classic");
  const [gstEnabled, setGstEnabled] = useState(initialSettings?.gst_enabled ?? false);
  const [gstPercent, setGstPercent] = useState(initialSettings?.gst_percent ?? 5);
  const [gstNumber, setGstNumber] = useState(initialSettings?.gst_number ?? "");
  const [nudgeEnabled, setNudgeEnabled] = useState(initialSettings?.special_nudge_enabled ?? true);
  const [nudgeSeconds, setNudgeSeconds] = useState(initialSettings?.special_nudge_seconds ?? 5);
  const [logoUrl, setLogoUrl] = useState(initialSettings?.logo_url ?? null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const logoInput = useRef<HTMLInputElement>(null);
  const supabase = createClient();

  async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { toast.error("Image must be under 10MB"); return; }
    setUploading(true);
    toast.info("Optimising image...");
    let blob: Blob;
    try {
      blob = await compressImage(file, 400, 0.85);
    } catch {
      toast.error("Could not process image");
      setUploading(false);
      return;
    }
    const path = `${hotel.id}/logo.webp`;
    const { error } = await supabase.storage
      .from("hotel-logos")
      .upload(path, blob, { upsert: true, contentType: "image/webp" });
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
    const cancelValue = cancelEnabled ? cancelMinutes : 0;
    const base = { hotel_id: hotel.id, theme_color: themeColor, currency, logo_url: logoUrl, menu_layout: menuLayout };
    const full = {
      ...base,
      order_cancel_minutes: cancelValue,
      gst_enabled: gstEnabled,
      gst_percent: gstPercent,
      gst_number: gstNumber.trim() || null,
      special_nudge_enabled: nudgeEnabled,
      special_nudge_seconds: nudgeSeconds,
    };
    let { error } = await supabase.from("hotel_settings").upsert(full, { onConflict: "hotel_id" });
    // Fall back progressively if newer columns haven't been migrated yet.
    if (error && (error.code === "42703" || /column/i.test(error.message))) {
      ({ error } = await supabase
        .from("hotel_settings")
        .upsert({ ...base, order_cancel_minutes: cancelValue }, { onConflict: "hotel_id" }));
    }
    if (error && (error.code === "42703" || /order_cancel_minutes/i.test(error.message))) {
      ({ error } = await supabase.from("hotel_settings").upsert(base, { onConflict: "hotel_id" }));
    }
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

      {/* GST card */}
      <Card padding="lg">
        <div className="flex items-center justify-between mb-1">
          <p className="text-sm font-semibold text-[#0F0E17]">GST / Tax</p>
          <Toggle checked={gstEnabled} onChange={setGstEnabled} />
        </div>
        <p className="text-xs text-[#6B7280] mb-3">
          When enabled, GST is calculated on completed-order bills and shown separately.
        </p>
        {gstEnabled && (
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <input
                type="number"
                min={0}
                max={100}
                step={0.5}
                value={gstPercent}
                onChange={(e) => setGstPercent(Math.max(0, Math.min(100, parseFloat(e.target.value) || 0)))}
                className="w-24 border border-[#E5E7EB] rounded-2xl px-3 py-2.5 text-sm text-[#0F0E17] focus:outline-none focus:ring-2 focus:ring-[#F97316] focus:border-transparent"
              />
              <span className="text-sm text-[#374151]">% GST rate</span>
            </div>
            <div>
              <label className="text-xs font-medium text-[#374151]">GSTIN (optional)</label>
              <input
                type="text"
                value={gstNumber}
                onChange={(e) => setGstNumber(e.target.value.toUpperCase())}
                placeholder="22AAAAA0000A1Z5"
                maxLength={15}
                className="mt-1 w-full border border-[#E5E7EB] rounded-2xl px-3 py-2.5 text-sm text-[#0F0E17] uppercase placeholder:normal-case focus:outline-none focus:ring-2 focus:ring-[#F97316] focus:border-transparent"
              />
              <p className="text-[11px] text-[#9CA3AF] mt-1">Printed on the bill header if provided.</p>
            </div>
          </div>
        )}
      </Card>

      {/* Menu layout card */}
      <Card padding="lg">
        <p className="text-sm font-semibold text-[#0F0E17] mb-1">Menu Layout</p>
        <p className="text-xs text-[#6B7280] mb-3">Choose the design for your customer-facing menu.</p>
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => setMenuLayout("classic")}
            className={`border rounded-2xl p-4 text-left transition-all ${
              menuLayout === "classic" ? "border-[#F97316] bg-[#FFF7ED]" : "border-[#E5E7EB] bg-white hover:border-[#F97316]/50"
            }`}
          >
            <p className="text-sm font-semibold text-[#0F0E17] mb-1">Classic</p>
            <p className="text-[11px] text-[#6B7280]">Standard functional design, clean and simple.</p>
          </button>
          <button
            onClick={() => setMenuLayout("modern")}
            className={`border rounded-2xl p-4 text-left transition-all relative overflow-hidden ${
              menuLayout === "modern" ? "border-[#F97316] bg-[#FFF7ED]" : "border-[#E5E7EB] bg-white hover:border-[#F97316]/50"
            }`}
          >
            <div className="absolute top-0 right-0 bg-[#F97316] text-white text-[9px] font-bold px-2 py-0.5 rounded-bl-lg uppercase tracking-wider">Premium</div>
            <p className="text-sm font-semibold text-[#0F0E17] mb-1">Modern</p>
            <p className="text-[11px] text-[#6B7280]">Sleek animations, glassmorphism, optimized for ordering.</p>
          </button>
        </div>

        {/* Premium (beta) — full-width, the home for the latest features. */}
        <button
          onClick={() => setMenuLayout("premium")}
          className={`mt-3 w-full border rounded-2xl p-4 text-left transition-all relative overflow-hidden ${
            menuLayout === "premium" ? "border-[#7C3AED] bg-[#F5F3FF]" : "border-[#E5E7EB] bg-white hover:border-[#7C3AED]/50"
          }`}
        >
          <div className="absolute top-0 right-0 bg-[#7C3AED] text-white text-[9px] font-bold px-2 py-0.5 rounded-bl-lg uppercase tracking-wider">
            Beta
          </div>
          <p className="text-sm font-semibold text-[#0F0E17] mb-1">Modernized Premium Menu View</p>
          <p className="text-[11px] text-[#6B7280]">
            Compact, high-density cards so guests see more dishes at a glance, an always-on Speciality bar, and the
            latest features first. Best for premium hotels.
          </p>
        </button>
      </Card>

      {/* Order cancellation window */}
      <Card padding="lg">
        <div className="flex items-center justify-between mb-1">
          <p className="text-sm font-semibold text-[#0F0E17]">Order cancellation window</p>
          <Toggle checked={cancelEnabled} onChange={setCancelEnabled} />
        </div>
        <p className="text-xs text-[#6B7280] mb-3">
          When enabled, customers can cancel their own order for a short window after placing it. Off by default.
        </p>
        {cancelEnabled && (
          <div className="flex items-center gap-3">
            <input
              type="number"
              min={1}
              max={60}
              value={cancelMinutes}
              onChange={(e) => setCancelMinutes(Math.max(1, Math.min(60, parseInt(e.target.value) || 1)))}
              className="w-20 border border-[#E5E7EB] rounded-2xl px-3 py-2.5 text-sm text-[#0F0E17] focus:outline-none focus:ring-2 focus:ring-[#F97316] focus:border-transparent"
            />
            <span className="text-sm text-[#374151]">minutes to cancel</span>
          </div>
        )}
      </Card>

      {/* Special-menu nudge popup */}
      <Card padding="lg">
        <div className="flex items-center justify-between mb-1">
          <p className="text-sm font-semibold text-[#0F0E17]">Special menu popup</p>
          <Toggle checked={nudgeEnabled} onChange={setNudgeEnabled} />
        </div>
        <p className="text-xs text-[#6B7280] mb-3">
          When enabled, a popup wipes in when customers open your menu, nudging them to your Speciality section. It auto-dismisses after the time below.
        </p>
        {nudgeEnabled && (
          <div className="flex items-center gap-3">
            <input
              type="number"
              min={1}
              max={30}
              value={nudgeSeconds}
              onChange={(e) => setNudgeSeconds(Math.max(1, Math.min(30, parseInt(e.target.value) || 1)))}
              className="w-20 border border-[#E5E7EB] rounded-2xl px-3 py-2.5 text-sm text-[#0F0E17] focus:outline-none focus:ring-2 focus:ring-[#F97316] focus:border-transparent"
            />
            <span className="text-sm text-[#374151]">seconds on screen</span>
          </div>
        )}
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
