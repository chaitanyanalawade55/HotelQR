"use client";

import { useState, useTransition } from "react";
import { ShieldCheck, Loader2, Check, AlertCircle } from "lucide-react";
import { saveHotelPayment } from "@/app/actions/hotel";

interface Props {
  hotelId: string;
  /** Decrypted values, fetched server-side and passed in by the parent page. */
  initialUpiId?: string;
  initialMerchantName?: string;
}

/**
 * Admin form for a hotel's GPay/UPI payment details.
 * Sensitive data only ever travels to the `saveHotelPayment` Server Action
 * (a server boundary) — no encryption keys or secrets are bundled client-side.
 */
export function AdminSettingsForm({ hotelId, initialUpiId = "", initialMerchantName = "" }: Props) {
  const [upiId, setUpiId] = useState(initialUpiId);
  const [merchantName, setMerchantName] = useState(initialMerchantName);
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setResult(null);
    startTransition(async () => {
      const res = await saveHotelPayment({ hotelId, upiId: upiId.trim(), merchantName: merchantName.trim() });
      setResult(res.ok ? { ok: true, text: "Payment details saved & encrypted." } : { ok: false, text: res.error });
    });
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-white border border-[#E5E7EB] rounded-3xl p-5 max-w-xl w-full"
    >
      <div className="flex items-center gap-2 mb-1">
        <ShieldCheck size={18} className="text-[#10B981]" />
        <h2 className="text-sm font-semibold text-[#0F0E17]">GPay / UPI payment details</h2>
      </div>
      <p className="text-xs text-[#6B7280] mb-5">
        Your UPI ID is encrypted at rest and never stored in plain text.
      </p>

      <div className="space-y-4">
        <div>
          <label htmlFor="merchantName" className="block text-sm font-medium text-[#374151] mb-1.5">
            Merchant name
          </label>
          <input
            id="merchantName"
            name="merchantName"
            type="text"
            value={merchantName}
            onChange={(e) => setMerchantName(e.target.value)}
            placeholder="e.g. ChaiPani Hotel"
            autoComplete="off"
            required
            className="w-full bg-white border border-[#E5E7EB] rounded-2xl px-4 py-3 text-sm text-[#0F0E17] placeholder:text-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#F97316] focus:border-transparent transition-all"
          />
        </div>

        <div>
          <label htmlFor="upiId" className="block text-sm font-medium text-[#374151] mb-1.5">
            UPI ID
          </label>
          <input
            id="upiId"
            name="upiId"
            type="text"
            inputMode="email"
            value={upiId}
            onChange={(e) => setUpiId(e.target.value)}
            placeholder="name@okhdfcbank"
            autoComplete="off"
            spellCheck={false}
            required
            className="w-full bg-white border border-[#E5E7EB] rounded-2xl px-4 py-3 text-sm text-[#0F0E17] placeholder:text-[#9CA3AF] font-mono focus:outline-none focus:ring-2 focus:ring-[#F97316] focus:border-transparent transition-all"
          />
        </div>
      </div>

      {result && (
        <div
          className={[
            "flex items-center gap-2 mt-4 text-sm rounded-2xl px-3 py-2.5",
            result.ok ? "bg-[#ECFDF5] text-[#047857]" : "bg-[#FEF2F2] text-[#B91C1C]",
          ].join(" ")}
        >
          {result.ok ? <Check size={15} /> : <AlertCircle size={15} />}
          {result.text}
        </div>
      )}

      <button
        type="submit"
        disabled={pending}
        className="mt-5 w-full inline-flex items-center justify-center gap-2 bg-[#F97316] hover:bg-[#EA6C0A] text-white font-semibold text-sm rounded-2xl py-3.5 disabled:opacity-50 active:scale-[0.98] transition-all"
      >
        {pending ? (
          <>
            <Loader2 size={16} className="animate-spin" /> Saving securely…
          </>
        ) : (
          "Save payment details"
        )}
      </button>
    </form>
  );
}
