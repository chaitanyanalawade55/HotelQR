"use client";
import { useState, useEffect } from "react";
import { Sparkles, Check, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";

const VISION_KEY = "vision_api_key";

export default function SettingsPage() {
  const [apiKey, setApiKey] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setApiKey(localStorage.getItem(VISION_KEY) ?? "");
  }, []);

  function save() {
    if (apiKey.trim()) {
      localStorage.setItem(VISION_KEY, apiKey.trim());
      toast.success("API key saved");
    } else {
      localStorage.removeItem(VISION_KEY);
      toast.success("API key cleared");
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  }

  function clear() {
    localStorage.removeItem(VISION_KEY);
    setApiKey("");
    toast.success("API key cleared");
  }

  return (
    <div className="px-4 md:px-8 py-6 max-w-xl mx-auto space-y-4">
      <h1 className="text-xl font-bold text-[#0F0E17] mb-5">Settings</h1>

      <Card padding="lg">
        <div className="flex items-center gap-2 mb-1">
          <Sparkles size={16} className="text-[#F97316]" />
          <p className="text-sm font-semibold text-[#0F0E17]">AI OCR — Google Vision</p>
        </div>
        <p className="text-xs text-[#6B7280] mb-4">
          Optional. Add a Google Cloud Vision API key for higher-accuracy menu scanning. Without a key, the
          &ldquo;Scan menu card&rdquo; feature uses offline OCR (Tesseract.js), which works but is less accurate.
          The key is stored only in this browser and never leaves your device except to call Google directly.
        </p>
        <Input
          type="password"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder="AIza..."
          label="Vision API key"
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
