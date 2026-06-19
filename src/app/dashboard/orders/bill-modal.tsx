"use client";
import { useState } from "react";
import { X, Printer, Share2, MessageCircle, Check } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/Button";
import { createClient } from "@/lib/supabase/client";
import type { Hotel, HotelSettings, Order } from "@/types/database";
import {
  billNumber,
  buildBillHtml,
  buildBillText,
  computeBill,
  formatBillDate,
  money,
  paymentStatus,
} from "@/lib/billing";

interface Props {
  order: Order;
  hotel: Pick<Hotel, "name" | "address" | "phone">;
  settings: HotelSettings | null;
  onClose: () => void;
  onMobileSaved: (orderId: string, mobile: string) => void;
}

export function BillModal({ order, hotel, settings, onClose, onMobileSaved }: Props) {
  const [mobile, setMobile] = useState(order.customer_mobile ?? "");
  const [savingMobile, setSavingMobile] = useState(false);
  const supabase = createClient();

  const cur = settings?.currency;
  const t = computeBill(order, settings);
  const orderWithMobile: Order = { ...order, customer_mobile: mobile.trim() || null };

  async function saveMobile() {
    const value = mobile.trim();
    setSavingMobile(true);
    const { error } = await supabase
      .from("orders")
      .update({ customer_mobile: value || null })
      .eq("id", order.id);
    setSavingMobile(false);
    if (error) {
      toast.error("Could not save mobile number");
      return;
    }
    onMobileSaved(order.id, value);
    toast.success(value ? "Mobile number saved" : "Mobile number cleared");
  }

  function handlePrint() {
    const html = buildBillHtml(orderWithMobile, hotel, settings);
    const w = window.open("", "_blank", "width=400,height=640");
    if (!w) {
      toast.error("Allow pop-ups to print the bill");
      return;
    }
    w.document.open();
    w.document.write(html);
    w.document.close();
  }

  async function handleShare() {
    const text = buildBillText(orderWithMobile, hotel, settings);
    if (navigator.share) {
      try {
        await navigator.share({ title: `Bill ${billNumber(order)} · ${hotel.name}`, text });
        return;
      } catch {
        // user cancelled or share unsupported — fall through to clipboard
      }
    }
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Bill copied to clipboard");
    } catch {
      toast.error("Could not share the bill");
    }
  }

  function handleWhatsApp() {
    const text = buildBillText(orderWithMobile, hotel, settings);
    const num = mobile.replace(/[^\d]/g, "");
    // A 10-digit Indian number gets the country code; otherwise share without a
    // recipient so the owner can pick the chat.
    const to = num.length === 10 ? `91${num}` : num;
    const base = to ? `https://wa.me/${to}` : "https://wa.me/";
    window.open(`${base}?text=${encodeURIComponent(text)}`, "_blank");
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-[#F8F9FA] w-full md:max-w-md md:rounded-3xl rounded-t-3xl max-h-[92vh] overflow-y-auto shadow-2xl">
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between px-4 py-3 bg-[#1C1C2E]">
          <p className="text-sm font-semibold text-white">Bill #{billNumber(order)}</p>
          <button onClick={onClose} className="text-white/70 hover:text-white p-1" aria-label="Close">
            <X size={18} />
          </button>
        </div>

        {/* Receipt */}
        <div className="p-4">
          <div className="bg-white rounded-2xl border border-[#E5E7EB] p-5">
            {/* Hotel header */}
            <div className="text-center border-b border-dashed border-[#D1D5DB] pb-3 mb-3">
              <p className="text-base font-bold text-[#0F0E17]">{hotel.name}</p>
              {hotel.address && <p className="text-[11px] text-[#6B7280] mt-0.5">{hotel.address}</p>}
              {hotel.phone && <p className="text-[11px] text-[#6B7280]">Ph: {hotel.phone}</p>}
              {settings?.gst_number && (
                <p className="text-[11px] text-[#6B7280]">GSTIN: {settings.gst_number}</p>
              )}
            </div>

            {/* Meta */}
            <div className="text-xs text-[#374151] space-y-1 mb-3">
              <div className="flex justify-between">
                <span className="text-[#6B7280]">Bill No</span>
                <span className="font-medium">{billNumber(order)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#6B7280]">Date</span>
                <span className="font-medium">{formatBillDate(order.created_at)}</span>
              </div>
              {order.table_number && (
                <div className="flex justify-between">
                  <span className="text-[#6B7280]">Table</span>
                  <span className="font-medium">{order.table_number}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-[#6B7280]">Payment</span>
                <span className="font-medium text-[#059669]">{paymentStatus(order)}</span>
              </div>
            </div>

            {/* Items table */}
            <div className="border-t border-dashed border-[#D1D5DB] pt-2">
              <div className="flex text-[10px] font-semibold text-[#9CA3AF] uppercase tracking-wide pb-1.5 border-b border-[#F3F4F6]">
                <span className="flex-1">Item</span>
                <span className="w-8 text-center">Qty</span>
                <span className="w-16 text-right">Rate</span>
                <span className="w-16 text-right">Amount</span>
              </div>
              {(order.items ?? []).map((item, i) => (
                <div key={i} className="flex text-xs text-[#374151] py-1.5 border-b border-[#F9FAFB]">
                  <span className="flex-1 pr-1">{item.name}</span>
                  <span className="w-8 text-center">{item.qty}</span>
                  <span className="w-16 text-right">{money(item.price, cur)}</span>
                  <span className="w-16 text-right font-medium">{money(item.price * item.qty, cur)}</span>
                </div>
              ))}
            </div>

            {/* Totals */}
            <div className="mt-3 space-y-1">
              <div className="flex justify-between text-xs text-[#374151]">
                <span>Subtotal</span>
                <span>{money(t.subtotal, cur)}</span>
              </div>
              {t.gstEnabled ? (
                <div className="flex justify-between text-xs text-[#374151]">
                  <span>GST ({t.gstPercent}%)</span>
                  <span>{money(t.gstAmount, cur)}</span>
                </div>
              ) : null}
              <div className="flex justify-between text-base font-bold text-[#0F0E17] pt-2 mt-1 border-t border-[#1C1C2E]">
                <span>Total</span>
                <span>{money(t.grandTotal, cur)}</span>
              </div>
            </div>

            <p className="text-center text-[11px] text-[#9CA3AF] mt-4">Thank you! Visit again 🙏</p>
          </div>

          {/* Customer mobile (optional) */}
          <div className="bg-white rounded-2xl border border-[#E5E7EB] p-4 mt-3">
            <label className="text-xs font-semibold text-[#374151]">Customer mobile (optional)</label>
            <p className="text-[11px] text-[#9CA3AF] mb-2">Used to share the bill on WhatsApp.</p>
            <div className="flex items-center gap-2">
              <input
                type="tel"
                inputMode="numeric"
                value={mobile}
                onChange={(e) => setMobile(e.target.value)}
                placeholder="9876543210"
                className="flex-1 border border-[#E5E7EB] rounded-2xl px-3 py-2.5 text-sm text-[#0F0E17] focus:outline-none focus:ring-2 focus:ring-[#F97316] focus:border-transparent"
              />
              <Button
                variant="secondary"
                size="sm"
                icon={<Check size={14} />}
                loading={savingMobile}
                onClick={saveMobile}
                disabled={mobile.trim() === (order.customer_mobile ?? "")}
              >
                Save
              </Button>
            </div>
          </div>

          {/* Actions */}
          <div className="grid grid-cols-3 gap-2 mt-3">
            <Button variant="secondary" size="md" icon={<Printer size={16} />} onClick={handlePrint}>
              Print
            </Button>
            <Button variant="secondary" size="md" icon={<Share2 size={16} />} onClick={handleShare}>
              Share
            </Button>
            <Button variant="primary" size="md" icon={<MessageCircle size={16} />} onClick={handleWhatsApp}>
              WhatsApp
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
