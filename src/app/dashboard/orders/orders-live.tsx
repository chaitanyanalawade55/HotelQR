"use client";
import { useState, useEffect } from "react";
import { Bell } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { createClient } from "@/lib/supabase/client";
import type { Order, WaiterCall } from "@/types/database";

type FilterStatus = "all" | "new" | "preparing" | "done";

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
  return `${Math.floor(diff / 3600)}h ago`;
}

const statusBadgeVariant: Record<string, "orange" | "yellow" | "green"> = {
  new: "orange",
  preparing: "yellow",
  done: "green",
};

interface Props {
  hotelId: string;
  initialOrders: Order[];
}

export function OrdersLive({ hotelId, initialOrders }: Props) {
  const [orders, setOrders] = useState<Order[]>(initialOrders);
  const [waiterCalls, setWaiterCalls] = useState<WaiterCall[]>([]);
  const [filter, setFilter] = useState<FilterStatus>("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [newOrderIds, setNewOrderIds] = useState<Set<string>>(new Set());
  const supabase = createClient();

  useEffect(() => {
    const channel = supabase
      .channel(`orders-${hotelId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "orders", filter: `hotel_id=eq.${hotelId}` },
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
        { event: "UPDATE", schema: "public", table: "orders", filter: `hotel_id=eq.${hotelId}` },
        (payload) => {
          const updated = payload.new as Order;
          setOrders((prev) => prev.map((o) => (o.id === updated.id ? { ...o, ...updated } : o)));
        }
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "waiter_calls", filter: `hotel_id=eq.${hotelId}` },
        (payload) => {
          setWaiterCalls((prev) => [payload.new as WaiterCall, ...prev]);
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [hotelId, supabase]);

  async function updateStatus(orderId: string, status: Order["status"]) {
    await supabase.from("orders").update({ status }).eq("id", orderId);
    setOrders((prev) => prev.map((o) => o.id === orderId ? { ...o, status } : o));
  }

  async function acknowledgeWaiter(callId: string) {
    await supabase.from("waiter_calls").update({ status: "acknowledged" }).eq("id", callId);
    setWaiterCalls((prev) => prev.filter((c) => c.id !== callId));
  }

  const filtered = filter === "all" ? orders : orders.filter((o) => o.status === filter);
  const newCount = orders.filter((o) => o.status === "new").length;

  const chips: { label: string; value: FilterStatus }[] = [
    { label: "All", value: "all" },
    { label: "New", value: "new" },
    { label: "Preparing", value: "preparing" },
    { label: "Done", value: "done" },
  ];

  return (
    <div className="px-4 md:px-8 py-6">
      <div className="flex items-center gap-3 mb-5">
        <h1 className="text-xl font-bold text-[#0F0E17]">Live Orders</h1>
        {newCount > 0 && (
          <Badge variant="red">{newCount} new</Badge>
        )}
      </div>

      {/* Filter chips */}
      <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide pb-2 -mx-4 px-4 mb-4">
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
          title="No orders yet"
          description="Orders will appear here when customers place them."
        />
      ) : (
        <div className="space-y-3">
          {filtered.map((order) => {
            const isNew = newOrderIds.has(order.id);
            const isExpanded = expandedId === order.id;
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
                    Table {order.table_number ?? "?"} — Order #{order.id.slice(-4).toUpperCase()}
                  </p>
                  <Badge variant={statusBadgeVariant[order.status] ?? "gray"}>
                    {order.status}
                  </Badge>
                </div>
                <p className="text-xs text-[#6B7280] mt-2">
                  {order.items?.map((i) => `${i.name} × ${i.qty}`).join(" · ")}
                </p>
                <div className="flex items-center justify-between mt-3">
                  <p className="text-sm font-semibold text-[#F97316]">₹{order.total}</p>
                  <p className="text-xs text-[#9CA3AF]">{timeAgo(order.created_at)}</p>
                </div>

                {isExpanded && (
                  <div className="mt-4 pt-4 border-t border-[#E5E7EB]">
                    <div className="space-y-1 mb-4">
                      {order.items?.map((item, i) => (
                        <div key={i} className="flex justify-between text-sm">
                          <span className="text-[#374151]">{item.name} × {item.qty}</span>
                          <span className="text-[#6B7280]">₹{item.price * item.qty}</span>
                        </div>
                      ))}
                    </div>
                    <div className="flex gap-2">
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
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
