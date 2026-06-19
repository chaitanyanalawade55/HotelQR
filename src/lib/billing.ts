import type { Hotel, HotelSettings, Order } from "@/types/database";

const CURRENCY_SYMBOLS: Record<string, string> = {
  INR: "₹",
  USD: "$",
  EUR: "€",
  GBP: "£",
  AED: "د.إ",
};

export function currencySymbol(currency?: string | null): string {
  return CURRENCY_SYMBOLS[currency ?? "INR"] ?? "₹";
}

/** A short, human-friendly bill number derived from the order id. */
export function billNumber(order: Pick<Order, "id">): string {
  return order.id.slice(-6).toUpperCase();
}

export type BillTotals = {
  subtotal: number;
  gstEnabled: boolean;
  gstPercent: number;
  gstAmount: number;
  grandTotal: number;
};

/**
 * Computes the bill breakdown. The stored `order.total` is the pre-tax subtotal
 * (the customer-facing menu never adds GST), so GST is applied on top here when
 * the owner has it enabled.
 */
export function computeBill(
  order: Pick<Order, "items" | "total">,
  settings: Pick<HotelSettings, "gst_enabled" | "gst_percent"> | null
): BillTotals {
  const subtotal = Array.isArray(order.items)
    ? order.items.reduce((sum, i) => sum + i.price * i.qty, 0)
    : order.total ?? 0;

  const gstEnabled = Boolean(settings?.gst_enabled);
  const gstPercent = gstEnabled ? Number(settings?.gst_percent ?? 0) : 0;
  const gstAmount = gstEnabled ? round2((subtotal * gstPercent) / 100) : 0;
  const grandTotal = round2(subtotal + gstAmount);

  return { subtotal: round2(subtotal), gstEnabled, gstPercent, gstAmount, grandTotal };
}

export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export function money(amount: number, currency?: string | null): string {
  return `${currencySymbol(currency)}${round2(amount).toFixed(2)}`;
}

export function formatBillDate(dateStr: string): string {
  return new Date(dateStr).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const STATUS_LABEL: Record<Order["status"], string> = {
  new: "Unpaid",
  preparing: "Unpaid",
  done: "Paid",
  cancelled: "Cancelled",
};

export function paymentStatus(order: Pick<Order, "status">): string {
  return STATUS_LABEL[order.status] ?? "—";
}

/** Plain-text bill, used for WhatsApp / native share. */
export function buildBillText(
  order: Order,
  hotel: Pick<Hotel, "name" | "address" | "phone">,
  settings: HotelSettings | null
): string {
  const t = computeBill(order, settings);
  const cur = settings?.currency;
  const lines: string[] = [];
  lines.push(`*${hotel.name}*`);
  if (hotel.address) lines.push(hotel.address);
  if (hotel.phone) lines.push(`Ph: ${hotel.phone}`);
  if (settings?.gst_number) lines.push(`GSTIN: ${settings.gst_number}`);
  lines.push("--------------------------------");
  lines.push(`Bill No: ${billNumber(order)}`);
  lines.push(`Date: ${formatBillDate(order.created_at)}`);
  if (order.table_number) lines.push(`Table: ${order.table_number}`);
  lines.push("--------------------------------");
  for (const i of order.items ?? []) {
    lines.push(`${i.name} x${i.qty}  ${money(i.price * i.qty, cur)}`);
  }
  lines.push("--------------------------------");
  lines.push(`Subtotal: ${money(t.subtotal, cur)}`);
  if (t.gstEnabled) lines.push(`GST (${t.gstPercent}%): ${money(t.gstAmount, cur)}`);
  lines.push(`*Total: ${money(t.grandTotal, cur)}*`);
  lines.push(`Status: ${paymentStatus(order)}`);
  lines.push("--------------------------------");
  lines.push("Thank you! Visit again 🙏");
  return lines.join("\n");
}

/** Self-contained printable HTML for a bill — opened in a new window to print. */
export function buildBillHtml(
  order: Order,
  hotel: Pick<Hotel, "name" | "address" | "phone">,
  settings: HotelSettings | null
): string {
  const t = computeBill(order, settings);
  const cur = settings?.currency;
  const esc = (s: string) =>
    s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));

  const rows = (order.items ?? [])
    .map(
      (i) => `<tr>
        <td>${esc(i.name)}</td>
        <td class="c">${i.qty}</td>
        <td class="r">${money(i.price, cur)}</td>
        <td class="r">${money(i.price * i.qty, cur)}</td>
      </tr>`
    )
    .join("");

  return `<!doctype html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Bill ${billNumber(order)}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: 'Courier New', monospace; color: #111; margin: 0; padding: 16px; }
  .bill { max-width: 360px; margin: 0 auto; }
  h1 { font-size: 18px; text-align: center; margin: 0 0 2px; }
  .muted { color: #555; font-size: 11px; text-align: center; margin: 1px 0; }
  .meta { font-size: 12px; margin: 10px 0; }
  .meta div { display: flex; justify-content: space-between; }
  hr { border: none; border-top: 1px dashed #999; margin: 8px 0; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; }
  th { text-align: left; border-bottom: 1px solid #333; padding: 4px 0; }
  td { padding: 4px 0; vertical-align: top; }
  .c { text-align: center; } .r { text-align: right; }
  .tot div { display: flex; justify-content: space-between; font-size: 12px; padding: 2px 0; }
  .grand { font-weight: bold; font-size: 15px; border-top: 1px solid #333; padding-top: 6px; margin-top: 4px; }
  .thanks { text-align: center; font-size: 12px; margin-top: 12px; }
  @media print { body { padding: 0; } }
</style></head><body>
<div class="bill">
  <h1>${esc(hotel.name)}</h1>
  ${hotel.address ? `<p class="muted">${esc(hotel.address)}</p>` : ""}
  ${hotel.phone ? `<p class="muted">Ph: ${esc(hotel.phone)}</p>` : ""}
  ${settings?.gst_number ? `<p class="muted">GSTIN: ${esc(settings.gst_number)}</p>` : ""}
  <hr>
  <div class="meta">
    <div><span>Bill No</span><span>${billNumber(order)}</span></div>
    <div><span>Date</span><span>${esc(formatBillDate(order.created_at))}</span></div>
    ${order.table_number ? `<div><span>Table</span><span>${esc(order.table_number)}</span></div>` : ""}
    ${order.customer_mobile ? `<div><span>Mobile</span><span>${esc(order.customer_mobile)}</span></div>` : ""}
    <div><span>Status</span><span>${paymentStatus(order)}</span></div>
  </div>
  <table>
    <thead><tr><th>Item</th><th class="c">Qty</th><th class="r">Rate</th><th class="r">Amount</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
  <hr>
  <div class="tot">
    <div><span>Subtotal</span><span>${money(t.subtotal, cur)}</span></div>
    ${t.gstEnabled ? `<div><span>GST (${t.gstPercent}%)</span><span>${money(t.gstAmount, cur)}</span></div>` : ""}
    <div class="grand"><span>Total</span><span>${money(t.grandTotal, cur)}</span></div>
  </div>
  <p class="thanks">Thank you! Visit again 🙏</p>
</div>
<script>window.onload = function(){ window.print(); }</script>
</body></html>`;
}
