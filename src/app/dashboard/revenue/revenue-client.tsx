"use client";
import { useState, useEffect, useMemo } from "react";
import { 
  X, 
  Receipt, 
  Clock, 
  TrendingUp, 
  DollarSign, 
  BarChart3, 
  ArrowRightLeft,
  ChevronRight,
  UtensilsCrossed
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { createClient } from "@/lib/supabase/client";
import type { Hotel, HotelSettings, Order, TableQR } from "@/types/database";
import { computeBill, money, formatBillDate } from "@/lib/billing";
import { BillModal } from "../orders/bill-modal";

interface Props {
  hotel: Pick<Hotel, "id" | "name" | "address" | "phone">;
  settings: HotelSettings | null;
  initialOrders: Order[];
  initialTables: TableQR[];
}

// Table birds-eye view component for revenue dashboard
const TableRevenueIllustration = () => {
  return (
    <div className="relative w-16 h-16 flex items-center justify-center mx-auto my-2">
      {/* Chairs around the table */}
      <div className="absolute top-0 w-5 h-2 rounded-t-md bg-neutral-300" />
      <div className="absolute bottom-0 w-5 h-2 rounded-b-md bg-neutral-300" />
      <div className="absolute left-0 w-2 h-5 rounded-l-md bg-neutral-300" />
      <div className="absolute right-0 w-2 h-5 rounded-r-md bg-neutral-300" />

      {/* Central Table */}
      <div className="w-10 h-10 rounded-full flex items-center justify-center z-10 border-2 bg-white border-neutral-300 shadow-sm">
        <TrendingUp className="text-neutral-400" size={14} />
      </div>
    </div>
  );
};

export function RevenueClient({ hotel, settings, initialOrders, initialTables }: Props) {
  const [orders, setOrders] = useState<Order[]>(initialOrders);
  const [tables, setTables] = useState<TableQR[]>(initialTables);
  const [selectedTable, setSelectedTable] = useState<TableQR | null>(null);
  const [billOrder, setBillOrder] = useState<Order | null>(null);

  const supabase = createClient();

  // Listen to postgres updates to orders to keep history fresh
  useEffect(() => {
    const channel = supabase
      .channel(`revenue-history-${hotel.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orders", filter: `hotel_id=eq.${hotel.id}` },
        () => {
          supabase
            .from("orders")
            .select("*")
            .eq("hotel_id", hotel.id)
            .order("created_at", { ascending: false })
            .then(({ data }) => {
              if (data) setOrders(data);
            });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [hotel.id, supabase]);

  // Overall restaurant-wide aggregates
  const statsSummary = useMemo(() => {
    const completed = orders.filter((o) => o.status === "done");
    const totalRev = completed.reduce((sum, o) => sum + computeBill(o, settings).grandTotal, 0);
    const avgTicket = completed.length > 0 ? totalRev / completed.length : 0;

    return {
      revenue: totalRev,
      ordersCount: completed.length,
      avgTicketSize: avgTicket,
    };
  }, [orders, settings]);

  // Aggregate stats per table
  const tableDataList = useMemo(() => {
    return tables.map((t) => {
      const tableOrders = orders.filter((o) => o.table_number === t.table_number);
      const completed = tableOrders.filter((o) => o.status === "done");
      const rev = completed.reduce((sum, o) => sum + computeBill(o, settings).grandTotal, 0);

      return {
        table: t,
        ordersCount: completed.length,
        revenue: rev,
        allOrders: tableOrders,
      };
    });
  }, [tables, orders, settings]);

  // Active table detail view
  const selectedTableInfo = useMemo(() => {
    if (!selectedTable) return null;
    return tableDataList.find((td) => td.table.id === selectedTable.id);
  }, [selectedTable, tableDataList]);

  function handleMobileSaved(orderId: string, mobile: string) {
    setOrders((prev) => prev.map((o) => (o.id === orderId ? { ...o, customer_mobile: mobile || null } : o)));
    setBillOrder((prev) => (prev && prev.id === orderId ? { ...prev, customer_mobile: mobile || null } : prev));
  }

  return (
    <div className="px-4 md:px-8 py-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-neutral-900 tracking-tight">Revenue & History</h1>
        <p className="text-sm text-neutral-500">Track restaurant performance and previous table orders.</p>
      </div>

      {/* Aggregate Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card padding="md" className="flex items-center gap-4 bg-white border border-neutral-200 shadow-sm">
          <div className="p-3 rounded-2xl bg-amber-50 text-amber-600">
            <DollarSign size={24} />
          </div>
          <div>
            <p className="text-xs text-neutral-400 font-semibold uppercase tracking-wider">Total Revenue</p>
            <p className="text-xl font-bold text-neutral-900">
              {money(statsSummary.revenue, settings?.currency)}
            </p>
          </div>
        </Card>

        <Card padding="md" className="flex items-center gap-4 bg-white border border-neutral-200 shadow-sm">
          <div className="p-3 rounded-2xl bg-emerald-50 text-emerald-600">
            <Receipt size={24} />
          </div>
          <div>
            <p className="text-xs text-neutral-400 font-semibold uppercase tracking-wider">Completed Orders</p>
            <p className="text-xl font-bold text-neutral-900">{statsSummary.ordersCount}</p>
          </div>
        </Card>

        <Card padding="md" className="flex items-center gap-4 bg-white border border-neutral-200 shadow-sm">
          <div className="p-3 rounded-2xl bg-blue-50 text-blue-600">
            <BarChart3 size={24} />
          </div>
          <div>
            <p className="text-xs text-neutral-400 font-semibold uppercase tracking-wider">Avg Order Value</p>
            <p className="text-xl font-bold text-neutral-900">
              {money(statsSummary.avgTicketSize, settings?.currency)}
            </p>
          </div>
        </Card>
      </div>

      {/* Floor Plan Visualizer */}
      <div>
        <h2 className="text-base font-bold text-neutral-800 mb-4 flex items-center gap-2">
          <UtensilsCrossed size={16} /> Restaurant Layout (Select any table)
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-5">
          {tableDataList.map(({ table, ordersCount, revenue }) => {
            return (
              <motion.div
                key={table.id}
                whileHover={{ scale: 1.02 }}
                onClick={() => setSelectedTable(table)}
                className="bg-white border border-neutral-200 hover:border-neutral-900 rounded-3xl p-4 flex flex-col justify-between h-44 cursor-pointer transition-all shadow-sm hover:shadow-md"
              >
                {/* Table Number */}
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-neutral-800 bg-neutral-100 px-2.5 py-1 rounded-full">
                    {table.table_number}
                  </span>
                  <Badge variant="gray" className="text-[10px] px-2 py-0.5 font-bold">
                    {ordersCount} {ordersCount === 1 ? "order" : "orders"}
                  </Badge>
                </div>

                {/* Table graphic */}
                <TableRevenueIllustration />

                {/* Foot stats */}
                <div className="text-center mt-1">
                  <p className="text-[10px] text-neutral-400 uppercase tracking-wider font-semibold">Revenue</p>
                  <p className="text-sm font-extrabold text-neutral-900 mt-0.5">
                    {money(revenue, settings?.currency)}
                  </p>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* Side History Drawer */}
      <AnimatePresence>
        {selectedTableInfo && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.4 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedTable(null)}
              className="fixed inset-0 bg-black z-40"
            />

            {/* Slide Sheet */}
            <motion.aside
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 220 }}
              className="fixed right-0 top-0 bottom-0 w-full max-w-md bg-[#FAFAFA] border-l border-neutral-200 z-50 flex flex-col shadow-2xl overflow-hidden"
            >
              {/* Header */}
              <div className="px-5 py-4 bg-neutral-900 text-white flex items-center justify-between">
                <div>
                  <h2 className="text-base font-bold flex items-center gap-2">
                    <span className="bg-amber-500 text-neutral-900 text-xs px-2.5 py-1 rounded-full font-extrabold">
                      {selectedTableInfo.table.table_number}
                    </span>
                    History Logs
                  </h2>
                  <p className="text-[10px] text-neutral-400 mt-1 uppercase tracking-wide font-semibold">
                    Table lifetime transactions
                  </p>
                </div>
                <button
                  onClick={() => setSelectedTable(null)}
                  className="p-1 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Drawer Body */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {/* Stats Summary Card for Table */}
                <div className="grid grid-cols-2 gap-3 bg-white border border-neutral-200 rounded-3xl p-4 shadow-sm">
                  <div>
                    <p className="text-[10px] text-neutral-400 uppercase tracking-wider font-semibold">Orders</p>
                    <p className="text-base font-extrabold text-neutral-800 mt-0.5">
                      {selectedTableInfo.ordersCount} Completed
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] text-neutral-400 uppercase tracking-wider font-semibold">Revenue</p>
                    <p className="text-base font-extrabold text-neutral-800 mt-0.5">
                      {money(selectedTableInfo.revenue, settings?.currency)}
                    </p>
                  </div>
                </div>

                {/* Orders history list */}
                <div className="space-y-3">
                  <p className="text-xs font-bold text-neutral-800 uppercase tracking-wider px-1">Past Transactions</p>

                  {selectedTableInfo.allOrders.length === 0 ? (
                    <div className="text-center py-8 bg-white border border-neutral-200 rounded-3xl">
                      <p className="text-xs text-neutral-400">No transactions recorded yet.</p>
                    </div>
                  ) : (
                    selectedTableInfo.allOrders.map((order) => {
                      const breakdown = computeBill(order, settings);
                      const isCompleted = order.status === "done";
                      const isCancelled = order.status === "cancelled";

                      return (
                        <div
                          key={order.id}
                          onClick={() => {
                            if (!isCancelled) setBillOrder(order);
                          }}
                          className={`bg-white border rounded-3xl p-4 shadow-sm transition-all flex flex-col justify-between ${
                            isCancelled
                              ? "border-neutral-100 opacity-60 cursor-not-allowed select-none"
                              : "border-neutral-200 hover:border-neutral-400 cursor-pointer"
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-neutral-800">
                                #{order.id.slice(-6).toUpperCase()}
                              </span>
                              <Badge
                                variant={
                                  isCompleted ? "green" : isCancelled ? "red" : "orange"
                                }
                                className="text-[9px] px-1.5 py-0"
                              >
                                {order.status}
                              </Badge>
                            </div>
                            <span className="text-[10px] text-neutral-400 flex items-center gap-1">
                              <Clock size={10} />
                              {formatBillDate(order.created_at)}
                            </span>
                          </div>

                          <div className="text-xs text-neutral-500 my-2.5 leading-normal">
                            {(order.items ?? []).map((i) => `${i.name} × ${i.qty}`).join(" · ")}
                          </div>

                          <div className="flex items-center justify-between pt-2 border-t border-dashed border-neutral-100">
                            <span className="text-xs text-neutral-500 font-semibold">Grand Total:</span>
                            <span className="text-sm font-extrabold text-neutral-900">
                              {money(breakdown.grandTotal, settings?.currency)}
                            </span>
                          </div>

                          {!isCancelled && (
                            <div className="mt-3 flex items-center text-[11px] text-amber-600 font-bold justify-end gap-1">
                              Invoice options <ChevronRight size={12} />
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Bill Print/Share overlay */}
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
