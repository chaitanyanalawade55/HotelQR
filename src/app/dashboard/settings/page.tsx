"use client";
import { useState, useEffect } from "react";
import { Sparkles, Check, Trash2, ExternalLink, ShieldCheck, Zap } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { SystemStatusCard } from "./SystemStatusCard";

const GEMINI_KEY = "gemini_api_key";

export default function SettingsPage() {
  const [apiKey, setApiKey] = useState("");
  const [saved, setSaved] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<"pass" | "fail" | null>(null);

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
    setTestResult(null);
    setTimeout(() => setSaved(false), 1500);
  }

  function clear() {
    localStorage.removeItem(GEMINI_KEY);
    setApiKey("");
    setTestResult(null);
    toast.success("API key cleared");
  }

  async function testKey() {
    const key = apiKey.trim();
    if (!key) {
      toast.error("Enter an API key first");
      return;
    }
    setTesting(true);
    setTestResult(null);
    try {
      // Quick validation — call the Gemini API with a tiny text prompt.
      const { GoogleGenAI } = await import("@google/genai");
      const ai = new GoogleGenAI({ apiKey: key });
      const res = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: [{ role: "user", parts: [{ text: "Reply with only the word OK" }] }],
      });
      if (res?.text) {
        setTestResult("pass");
        toast.success("API key works! Gemini is ready.");
      } else {
        setTestResult("fail");
        toast.error("Key accepted but got empty response");
      }
    } catch (err: unknown) {
      setTestResult("fail");
      const msg = err instanceof Error ? err.message : "Unknown error";
      if (msg.includes("API_KEY_INVALID") || msg.includes("401")) {
        toast.error("Invalid API key. Check it and try again.");
      } else if (msg.includes("PERMISSION_DENIED") || msg.includes("403")) {
        toast.error("Key is valid but the Gemini API is not enabled for this project.");
      } else {
        toast.error(`Connection failed: ${msg}`);
      }
    }
    setTesting(false);
  }

  return (
    <div className="px-4 md:px-8 py-6 max-w-xl mx-auto space-y-4">
      <h1 className="text-xl font-bold text-[#0F0E17] mb-5">Settings</h1>

      <Card padding="lg">
        <div className="flex items-center gap-2 mb-1">
          <Sparkles size={16} className="text-[#F97316]" />
          <p className="text-sm font-semibold text-[#0F0E17]">AI Menu Scanner — Gemini API</p>
        </div>
        <p className="text-xs text-[#6B7280] mb-4">
          Add a free Gemini API key to enable AI-powered menu card scanning. Gemini reads your menu
          image and extracts items, prices, descriptions, and veg/non-veg tags automatically — no
          manual typing needed.
        </p>

        {/* How to get a key */}
        <div className="bg-[#F0FDF4] border border-[#BBF7D0] rounded-2xl p-3 mb-4">
          <p className="text-xs font-semibold text-[#166534] mb-2">How to get your free API key (2 min):</p>
          <ol className="text-xs text-[#15803D] space-y-1.5 list-decimal list-inside">
            <li>
              Go to{" "}
              <a
                href="https://aistudio.google.com/apikey"
                target="_blank"
                rel="noopener noreferrer"
                className="underline font-medium inline-flex items-center gap-0.5 min-h-0 min-w-0"
              >
                Google AI Studio <ExternalLink size={10} />
              </a>
            </li>
            <li>Sign in with your Google account</li>
            <li>Click &ldquo;Create API Key&rdquo; and select your Google Cloud project</li>
            <li>Copy the key (starts with <code className="bg-[#DCFCE7] px-1 rounded text-[11px]">AIza...</code>) and paste it below</li>
          </ol>
        </div>

        {/* Features */}
        <div className="flex flex-wrap gap-2 mb-4">
          <span className="inline-flex items-center gap-1 bg-[#FFF7ED] text-[#C2410C] text-[10px] font-medium px-2 py-1 rounded-full">
            <Zap size={10} /> 2-4 sec extraction
          </span>
          <span className="inline-flex items-center gap-1 bg-[#F0FDF4] text-[#166534] text-[10px] font-medium px-2 py-1 rounded-full">
            <ShieldCheck size={10} /> Free tier — no credit card
          </span>
          <span className="inline-flex items-center gap-1 bg-[#EFF6FF] text-[#1E40AF] text-[10px] font-medium px-2 py-1 rounded-full">
            <Sparkles size={10} /> Auto-detects veg/non-veg
          </span>
        </div>

        <Input
          type="password"
          value={apiKey}
          onChange={(e) => {
            setApiKey(e.target.value);
            setTestResult(null);
          }}
          placeholder="AIza..."
          label="Gemini API key"
        />

        {/* Test result badge */}
        {testResult === "pass" && (
          <div className="flex items-center gap-1.5 mt-2 text-[#10B981] text-xs font-medium">
            <Check size={14} /> Connected — Gemini AI is ready to use
          </div>
        )}
        {testResult === "fail" && (
          <div className="flex items-center gap-1.5 mt-2 text-[#EF4444] text-xs font-medium">
            <Trash2 size={14} /> Key is invalid or expired — check and try again
          </div>
        )}

        <div className="flex items-center gap-2 mt-4">
          <Button variant="primary" size="sm" icon={<Check size={14} />} onClick={save}>
            {saved ? "Saved" : "Save key"}
          </Button>
          {apiKey && (
            <>
              <Button
                variant="ghost"
                size="sm"
                onClick={testKey}
                loading={testing}
              >
                Test key
              </Button>
              <Button variant="ghost" size="sm" icon={<Trash2 size={14} />} onClick={clear} className="text-[#EF4444]">
                Clear
              </Button>
            </>
          )}
        </div>

        <p className="text-[10px] text-[#9CA3AF] mt-3">
          Your key is stored only in this browser&apos;s localStorage. It never touches our servers —
          API calls go directly from your browser to Google.
        </p>
      </Card>

      <SystemStatusCard />
    </div>
  );
}
