"use client";
import { useState, useEffect, useMemo } from "react";
import { Bell, Search, Receipt, SlidersHorizontal } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { createClient } from "@/lib/supabase/client";
import type { Hotel, HotelSettings, Order, WaiterCall } from "@/types/database";
import { billNumber, computeBill, money } from "@/lib/billing";
import { BillModal } from "./bill-modal";

type FilterStatus = "all" | "new" | "preparing" | "done" | "cancelled";
type DateRange = "all" | "today" | "yesterday" | "7days";

function playBeep() {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.2);
  } catch {
    // audio not available
  }
}

function timeAgo(dateStr: string) {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

const statusBadgeVariant: Record<string, "orange" | "yellow" | "green" | "gray"> = {
  new: "orange",
  preparing: "yellow",
  done: "green",
  cancelled: "gray",
};

function inDateRange(dateStr: string, range: DateRange): boolean {
  if (range === "all") return true;
  const d = new Date(dateStr);
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const t = d.getTime();
  if (range === "today") return t >= startOfToday;
  if (range === "yesterday") return t >= startOfToday - 86400_000 && t < startOfToday;
  if (range === "7days") return t >= startOfToday - 6 * 86400_000;
  return true;
}

interface Props {
  hotel: Pick<Hotel, "id" | "name" | "address" | "phone">;
  settings: HotelSettings | null;
  initialOrders: Order[];
}

export function OrdersLive({ hotel, settings, initialOrders }: Props) {
  const [orders, setOrders] = useState<Order[]>(initialOrders);
  const [waiterCalls, setWaiterCalls] = useState<WaiterCall[]>([]);
  const [filter, setFilter] = useState<FilterStatus>("all");
  const [query, setQuery] = useState("");
  const [tableFilter, setTableFilter] = useState("all");
  const [dateRange, setDateRange] = useState<DateRange>("all");
  const [showFilters, setShowFilters] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [billOrder, setBillOrder] = useState<Order | null>(null);
  const [newOrderIds, setNewOrderIds] = useState<Set<string>>(new Set());
  const supabase = createClient();

  useEffect(() => {
    const channel = supabase
      .channel(`orders-${hotel.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "orders", filter: `hotel_id=eq.${hotel.id}` },
        (payload) => {
          const order = payload.new as Order;
          setOrders((prev) => [order, ...prev]);
          setNewOrderIds((prev) => new Set(prev).add(order.id));
          playBeep();
          toast.success(`New order from Table ${order.table_number ?? "?"}! 🛎️`);
          setTimeout(() => {
            setNewOrderIds((prev) => {
              const next = new Set(prev);
              next.delete(order.id);
              return next;
            });
          }, 10000);
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "orders", filter: `hotel_id=eq.${hotel.id}` },
        (payload) => {
          const updated = payload.new as Order;
          setOrders((prev) => prev.map((o) => (o.id === updated.id ? { ...o, ...updated } : o)));
        }
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "waiter_calls", filter: `hotel_id=eq.${hotel.id}` },
        (payload) => {
          setWaiterCalls((prev) => [payload.new as WaiterCall, ...prev]);
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [hotel.id, supabase]);

  async function updateStatus(orderId: string, status: Order["status"]) {
    await supabase.from("orders").update({ status }).eq("id", orderId);
    setOrders((prev) => prev.map((o) => o.id === orderId ? { ...o, status } : o));
  }

  async function acknowledgeWaiter(callId: string) {
    await supabase.from("waiter_calls").update({ status: "acknowledged" }).eq("id", callId);
    setWaiterCalls((prev) => prev.filter((c) => c.id !== callId));
  }

  function handleMobileSaved(orderId: string, mobile: string) {
    setOrders((prev) => prev.map((o) => (o.id === orderId ? { ...o, customer_mobile: mobile || null } : o)));
    setBillOrder((prev) => (prev && prev.id === orderId ? { ...prev, customer_mobile: mobile || null } : prev));
  }

  // Distinct table numbers for the table filter dropdown.
  const tables = useMemo(() => {
    const set = new Set<string>();
    for (const o of orders) if (o.table_number) set.add(o.table_number);
    return Array.from(set).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  }, [orders]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return orders.filter((o) => {
      if (filter !== "all" && o.status !== filter) return false;
      if (tableFilter !== "all" && o.table_number !== tableFilter) return false;
      if (!inDateRange(o.created_at, dateRange)) return false;
      if (q) {
        const haystack = [
          billNumber(o),
          o.id,
          o.table_number ?? "",
          o.customer_mobile ?? "",
          ...(o.items ?? []).map((i) => i.name),
        ]
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [orders, filter, tableFilter, dateRange, query]);

  const newCount = orders.filter((o) => o.status === "new").length;

  const chips: { label: string; value: FilterStatus }[] = [
    { label: "All", value: "all" },
    { label: "New", value: "new" },
    { label: "Preparing", value: "preparing" },
    { label: "Done", value: "done" },
    { label: "Cancelled", value: "cancelled" },
  ];

  const dateChips: { label: string; value: DateRange }[] = [
    { label: "All time", value: "all" },
    { label: "Today", value: "today" },
    { label: "Yesterday", value: "yesterday" },
    { label: "Last 7 days", value: "7days" },
  ];

  const activeFilterCount =
    (tableFilter !== "all" ? 1 : 0) + (dateRange !== "all" ? 1 : 0);

  return (
    <div className="px-4 md:px-8 py-6">
      <div className="flex items-center gap-3 mb-5">
        <h1 className="text-xl font-bold text-[#0F0E17]">Orders</h1>
        {newCount > 0 && <Badge variant="red">{newCount} new</Badge>}
      </div>

      {/* Search */}
      <div className="relative mb-3">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9CA3AF]" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by bill no, table, mobile or item…"
          className="w-full bg-white border border-[#E5E7EB] rounded-2xl pl-9 pr-3 py-2.5 text-sm text-[#0F0E17] placeholder:text-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#F97316] focus:border-transparent"
        />
      </div>

      {/* Status chips + filter toggle */}
      <div className="flex items-center gap-2 mb-3">
        <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide pb-1 flex-1 -mx-4 px-4">
          {chips.map(({ label, value }) => (
            <button
              key={value}
              onClick={() => setFilter(value)}
              className={[
                "px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap shrink-0 transition-all border",
                filter === value
                  ? "bg-[#1C1C2E] text-white border-[#1C1C2E]"
                  : "bg-white text-[#374151] border-[#E5E7EB] hover:border-[#1C1C2E]",
              ].join(" ")}
            >
              {label}
            </button>
          ))}
        </div>
        <button
          onClick={() => setShowFilters((v) => !v)}
          className={[
            "relative shrink-0 rounded-full border p-2.5 transition-all",
            showFilters || activeFilterCount > 0
              ? "bg-[#FFF7ED] border-[#F97316] text-[#C2410C]"
              : "bg-white border-[#E5E7EB] text-[#6B7280] hover:border-[#1C1C2E]",
          ].join(" ")}
          aria-label="More filters"
        >
          <SlidersHorizontal size={16} />
          {activeFilterCount > 0 && (
            <span className="absolute -top-1 -right-1 bg-[#F97316] text-white text-[9px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
              {activeFilterCount}
            </span>
          )}
        </button>
      </div>

      {/* Expandable filters: table + date range */}
      {showFilters && (
        <div className="bg-white border border-[#E5E7EB] rounded-2xl p-4 mb-3 space-y-4">
          <div>
            <p className="text-xs font-semibold text-[#374151] mb-2">Table</p>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setTableFilter("all")}
                className={[
                  "px-3 py-1.5 rounded-full text-xs font-medium border transition-all",
                  tableFilter === "all"
                    ? "bg-[#1C1C2E] text-white border-[#1C1C2E]"
                    : "bg-white text-[#374151] border-[#E5E7EB]",
                ].join(" ")}
              >
                All tables
              </button>
              {tables.map((t) => (
                <button
                  key={t}
                  onClick={() => setTableFilter(t)}
                  className={[
                    "px-3 py-1.5 rounded-full text-xs font-medium border transition-all",
                    tableFilter === t
                      ? "bg-[#1C1C2E] text-white border-[#1C1C2E]"
                      : "bg-white text-[#374151] border-[#E5E7EB]",
                  ].join(" ")}
                >
                  Table {t}
                </button>
              ))}
              {tables.length === 0 && <span className="text-xs text-[#9CA3AF]">No tables yet</span>}
            </div>
          </div>
          <div>
            <p className="text-xs font-semibold text-[#374151] mb-2">Date range</p>
            <div className="flex flex-wrap gap-2">
              {dateChips.map(({ label, value }) => (
                <button
                  key={value}
                  onClick={() => setDateRange(value)}
                  className={[
                    "px-3 py-1.5 rounded-full text-xs font-medium border transition-all",
                    dateRange === value
                      ? "bg-[#1C1C2E] text-white border-[#1C1C2E]"
                      : "bg-white text-[#374151] border-[#E5E7EB]",
                  ].join(" ")}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Waiter calls */}
      {waiterCalls.map((call) => (
        <div key={call.id} className="bg-[#FEFCE8] border border-[#FEF08A] rounded-3xl p-4 mb-3">
          <div className="flex items-center gap-2 mb-1">
            <Bell size={16} className="text-[#D97706]" />
            <p className="text-sm font-semibold text-[#854D0E]">Waiter requested</p>
          </div>
          <p className="text-xs text-[#92400E] mb-3">
            Table {call.table_number ?? "?"} is calling for assistance
          </p>
          <Button variant="secondary" size="sm" onClick={() => acknowledgeWaiter(call.id)}>
            Got it
          </Button>
        </div>
      ))}

      {/* Orders */}
      {filtered.length === 0 ? (
        <EmptyState
          icon={<Bell size={24} />}
          title={orders.length === 0 ? "No orders yet" : "No matching orders"}
          description={
            orders.length === 0
              ? "Orders will appear here when customers place them."
              : "Try adjusting your search or filters."
          }
        />
      ) : (
        <div className="space-y-3">
          {filtered.map((order) => {
            const isNew = newOrderIds.has(order.id);
            const isExpanded = expandedId === order.id;
            const t = computeBill(order, settings);
            return (
              <div
                key={order.id}
                className={[
                  "bg-white border rounded-3xl p-4 transition-all cursor-pointer",
                  isNew ? "animate-pulse ring-2 ring-[#F97316] border-[#F97316]" : "border-[#E5E7EB]",
                ].join(" ")}
                onClick={() => setExpandedId(isExpanded ? null : order.id)}
              >
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-[#0F0E17]">
                    Table {order.table_number ?? "?"} — Bill #{billNumber(order)}
                  </p>
                  <Badge variant={statusBadgeVariant[order.status] ?? "gray"}>
                    {order.status}
                  </Badge>
                </div>
                <p className="text-xs text-[#6B7280] mt-2">
                  {order.items?.map((i) => `${i.name} × ${i.qty}`).join(" · ")}
                </p>
                <div className="flex items-center justify-between mt-3">
                  <p className="text-sm font-semibold text-[#F97316]">
                    {money(t.grandTotal, settings?.currency)}
                  </p>
                  <p className="text-xs text-[#9CA3AF]">{timeAgo(order.created_at)}</p>
                </div>

                {isExpanded && (
                  <div className="mt-4 pt-4 border-t border-[#E5E7EB]">
                    <div className="space-y-1 mb-3">
                      {order.items?.map((item, i) => (
                        <div key={i} className="flex justify-between text-sm">
                          <span className="text-[#374151]">
                            {item.name} × {item.qty}
                            <span className="text-[#9CA3AF]"> @ {money(item.price, settings?.currency)}</span>
                          </span>
                          <span className="text-[#6B7280]">{money(item.price * item.qty, settings?.currency)}</span>
                        </div>
                      ))}
                    </div>
                    <div className="space-y-1 mb-4 pt-2 border-t border-dashed border-[#E5E7EB]">
                      <div className="flex justify-between text-xs text-[#6B7280]">
                        <span>Subtotal</span>
                        <span>{money(t.subtotal, settings?.currency)}</span>
                      </div>
                      {t.gstEnabled && (
                        <div className="flex justify-between text-xs text-[#6B7280]">
                          <span>GST ({t.gstPercent}%)</span>
                          <span>{money(t.gstAmount, settings?.currency)}</span>
                        </div>
                      )}
                      <div className="flex justify-between text-sm font-semibold text-[#0F0E17]">
                        <span>Total</span>
                        <span>{money(t.grandTotal, settings?.currency)}</span>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {order.status === "new" && (
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={(e) => { e.stopPropagation(); updateStatus(order.id, "preparing"); }}
                        >
                          Mark as preparing
                        </Button>
                      )}
                      {order.status === "preparing" && (
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={(e) => { e.stopPropagation(); updateStatus(order.id, "done"); }}
                        >
                          Mark as done
                        </Button>
                      )}
                      {order.status === "done" && (
                        <Button
                          variant="secondary"
                          size="sm"
                          icon={<Receipt size={14} />}
                          onClick={(e) => { e.stopPropagation(); setBillOrder(order); }}
                        >
                          View bill
                        </Button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {billOrder && (
        <BillModal
          order={billOrder}
          hotel={hotel}
          settings={settings}
          onClose={() => setBillOrder(null)}
          onMobileSaved={handleMobileSaved}
        />
      )}
    </div>
  );
}
