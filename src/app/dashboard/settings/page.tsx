"use client";
import { useState, useEffect } from "react";
import { Sparkles, Check, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";

const GEMINI_KEY = "gemini_api_key";

export default function SettingsPage() {
  const [apiKey, setApiKey] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setApiKey(localStorage.getItem(GEMINI_KEY) ?? "");

    // Migrate legacy Vision API key → Gemini key (one-time).
    const legacyKey = localStorage.getItem("vision_api_key");
    if (legacyKey && !localStorage.getItem(GEMINI_KEY)) {
      localStorage.setItem(GEMINI_KEY, legacyKey);
      localStorage.removeItem("vision_api_key");
      setApiKey(legacyKey);
    }
  }, []);

  function save() {
    if (apiKey.trim()) {
      localStorage.setItem(GEMINI_KEY, apiKey.trim());
      toast.success("API key saved");
    } else {
      localStorage.removeItem(GEMINI_KEY);
      toast.success("API key cleared");
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  }

  function clear() {
    localStorage.removeItem(GEMINI_KEY);
    setApiKey("");
    toast.success("API key cleared");
  }

  return (
    <div className="px-4 md:px-8 py-6 max-w-xl mx-auto space-y-4">
      <h1 className="text-xl font-bold text-[#0F0E17] mb-5">Settings</h1>

      <Card padding="lg">
        <div className="flex items-center gap-2 mb-1">
          <Sparkles size={16} className="text-[#F97316]" />
          <p className="text-sm font-semibold text-[#0F0E17]">AI OCR — Gemini API</p>
        </div>
        <p className="text-xs text-[#6B7280] mb-4">
          Optional. Add a Gemini Developer API key for the best-accuracy menu scanning powered by
          Google&apos;s multimodal AI. The free tier requires no credit card. Without a key, the
          &ldquo;Scan menu card&rdquo; feature can still use OCR.space (cloud) or offline Tesseract.js.
          The key is stored only in this browser and never leaves your device except to call Google directly.
        </p>
        <Input
          type="password"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder="AIza..."
          label="Gemini API key"
        />
        <div className="flex items-center gap-2 mt-4">
          <Button variant="primary" size="sm" icon={<Check size={14} />} onClick={save}>
            {saved ? "Saved" : "Save key"}
          </Button>
          {apiKey && (
            <Button variant="ghost" size="sm" icon={<Trash2 size={14} />} onClick={clear} className="text-[#EF4444]">
              Clear
            </Button>
          )}
        </div>
      </Card>
    </div>
  );
}
