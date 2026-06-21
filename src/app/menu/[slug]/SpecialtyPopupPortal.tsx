"use client";
import { useEffect, useRef } from "react";
import { useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { ChefHat, ChevronRight, X, Plus, Minus, ShoppingBag } from "lucide-react";

export interface SpecialtyItem {
  id: string;
  name: string;
  price: number;
  description?: string | null;
  food_type?: string | null;
  image_url?: string | null;
}

interface Props {
  isEnabled: boolean;
  durationSeconds: number;
  items: SpecialtyItem[];
  themeColor: string;
  currencySymbol?: string;
  /** Live cart qty map from the parent — drives the steppers and total. */
  cartQty?: Record<string, number>;
  onAdd?: (itemId: string) => void;
  onRemove?: (itemId: string) => void;
  onViewMenu?: () => void;
  persistent?: boolean;
}

const BAR_IN = {
  hidden:  { clipPath: "inset(0 100% 0 0)", opacity: 0, scale: 0.96 },
  visible: {
    clipPath: "inset(0 0% 0 0)",
    opacity: 1,
    scale: 1,
    transition: { type: "spring", stiffness: 110, damping: 18 },
  },
  exit: {
    clipPath: "inset(0 0 0 100%)",
    opacity: 0,
    transition: { duration: 0.22, ease: "easeIn" },
  },
} as const;

function foodDot(food?: string | null) {
  if (food === "non_veg") return "#EF4444";
  if (food === "egg")     return "#F59E0B";
  return "#10B981";
}

// ── Qty stepper — shows "Add" when 0, shows  − n +  when > 0 ──────────────
function Stepper({
  qty,
  themeColor,
  onAdd,
  onRemove,
}: {
  qty: number;
  themeColor: string;
  onAdd: () => void;
  onRemove: () => void;
}) {
  return (
    <div className="shrink-0">
      <AnimatePresence mode="wait" initial={false}>
        {qty === 0 ? (
          <motion.button
            key="add-btn"
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.8, opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={onAdd}
            className="flex items-center gap-1 text-white text-[12px] font-bold rounded-xl px-3 py-2 shadow-sm min-h-0 min-w-0"
            style={{ backgroundColor: themeColor }}
          >
            <Plus size={13} /> Add
          </motion.button>
        ) : (
          <motion.div
            key="stepper"
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.8, opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="flex items-center gap-1 rounded-xl overflow-hidden border-2"
            style={{ borderColor: themeColor }}
          >
            <button
              onClick={onRemove}
              className="w-8 h-8 flex items-center justify-center min-h-0 min-w-0 p-0 transition-colors"
              style={{ color: themeColor }}
            >
              <Minus size={14} />
            </button>

            {/* Animated number — key change triggers re-mount animation */}
            <AnimatePresence mode="wait" initial={false}>
              <motion.span
                key={qty}
                initial={{ y: -10, opacity: 0 }}
                animate={{ y: 0,  opacity: 1 }}
                exit={{   y:  10, opacity: 0 }}
                transition={{ duration: 0.12 }}
                className="w-6 text-center text-[13px] font-extrabold select-none"
                style={{ color: themeColor }}
              >
                {qty}
              </motion.span>
            </AnimatePresence>

            <button
              onClick={onAdd}
              className="w-8 h-8 flex items-center justify-center min-h-0 min-w-0 p-0 transition-colors"
              style={{ color: themeColor }}
            >
              <Plus size={14} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function SpecialtyPopupPortal({
  isEnabled,
  durationSeconds,
  items,
  themeColor,
  currencySymbol = "₹",
  cartQty = {},
  onAdd,
  onRemove,
  onViewMenu,
  persistent = true,
}: Props) {
  const [mounted,    setMounted]    = useState(false);
  const [barVisible, setBarVisible] = useState(false);
  const [sheetOpen,  setSheetOpen]  = useState(false);
  const navigatingRef = useRef(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!isEnabled) return;
    const show = setTimeout(() => setBarVisible(true), 400);
    if (persistent) return () => clearTimeout(show);
    const hide = setTimeout(
      () => setBarVisible(false),
      400 + Math.max(1, durationSeconds) * 1000
    );
    return () => { clearTimeout(show); clearTimeout(hide); };
  }, [isEnabled, durationSeconds, persistent]);

  useEffect(() => {
    if (persistent && !sheetOpen && isEnabled && !navigatingRef.current) {
      setBarVisible(true);
    }
    navigatingRef.current = false;
  }, [sheetOpen, persistent, isEnabled]);

  // Derived totals from live cartQty
  const sheetTotal   = items.reduce((s, i) => s + (cartQty[i.id] ?? 0) * i.price, 0);
  const sheetQtySum  = items.reduce((s, i) => s + (cartQty[i.id] ?? 0), 0);

  if (!mounted || !isEnabled) return null;

  const gradEnd = themeColor + "D9"; // ~85% opacity for gradient end

  function openSheet() {
    if (!persistent) setBarVisible(false);
    setSheetOpen(true);
  }

  function handleViewMenu() {
    navigatingRef.current = true;
    setBarVisible(false);
    setSheetOpen(false);
    onViewMenu?.();
  }

  return createPortal(
    <>
      {/* ── Nudge bar ─────────────────────────────────────────────────────── */}
      <div className="fixed bottom-[90px] left-1/2 -translate-x-1/2 z-[9999] pointer-events-none">
        <AnimatePresence>
          {barVisible && (
            <motion.button
              key="specialty-bar"
              variants={BAR_IN}
              initial="hidden"
              animate="visible"
              exit="exit"
              onClick={openSheet}
              className="pointer-events-auto relative rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.22)] overflow-hidden min-w-[285px] max-w-sm border-0 p-0 text-left cursor-pointer"
              style={{ background: `linear-gradient(135deg, ${themeColor}, ${gradEnd})` }}
            >
              <div className="flex items-center gap-3 px-4 py-3">
                <motion.div
                  animate={{ scale: [1, 1.18, 1], rotate: [0, -6, 6, 0] }}
                  transition={{ duration: 2.6, repeat: Infinity, ease: "easeInOut", repeatDelay: 0.8 }}
                  className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center shrink-0"
                >
                  <ChefHat size={20} className="text-white" />
                </motion.div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[13px] font-extrabold text-white leading-tight">
                      Chef&apos;s Specials
                    </span>
                    {items.length > 0 && (
                      <span className="bg-white/30 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full leading-none">
                        {items.length}
                      </span>
                    )}
                    {/* Cart badge on bar when items added */}
                    {sheetQtySum > 0 && (
                      <span className="bg-white text-[10px] font-extrabold px-1.5 py-0.5 rounded-full leading-none" style={{ color: themeColor }}>
                        {sheetQtySum} in cart
                      </span>
                    )}
                  </div>
                  <span className="text-[11px] text-white/80 mt-0.5 block">
                    Tap to explore today&apos;s picks ✨
                  </span>
                </div>

                <motion.div
                  animate={{ x: [0, 5, 0] }}
                  transition={{ duration: 1.3, repeat: Infinity, ease: "easeInOut" }}
                  className="shrink-0 bg-white/20 rounded-lg p-1.5"
                >
                  <ChevronRight size={16} className="text-white" />
                </motion.div>
              </div>

              {/* Shimmer */}
              <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-2xl">
                <motion.div
                  className="absolute top-0 bottom-0 w-1/3"
                  style={{ background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.18), transparent)" }}
                  animate={{ x: ["-100%", "400%"] }}
                  transition={{ duration: 2.2, repeat: Infinity, ease: "linear", repeatDelay: 2 }}
                />
              </div>
              <div className="h-[2px]" style={{ background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.4), transparent)" }} />
            </motion.button>
          )}
        </AnimatePresence>
      </div>

      {/* ── Bottom sheet ──────────────────────────────────────────────────── */}
      <AnimatePresence>
        {sheetOpen && (
          <motion.div
            key="sheet-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="fixed inset-0 z-[9999] flex items-end justify-center"
            onClick={() => setSheetOpen(false)}
          >
            <div className="absolute inset-0 bg-black/45 backdrop-blur-sm" />

            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", stiffness: 320, damping: 34 }}
              className="relative bg-[#F8F8FB] rounded-t-3xl w-full max-w-[460px] flex flex-col shadow-2xl max-h-[82vh]"
              onClick={(e) => e.stopPropagation()}
            >
              {/* ── Gradient header ── */}
              <div
                className="rounded-t-3xl px-5 pt-4 pb-5 shrink-0"
                style={{ background: `linear-gradient(135deg, ${themeColor}, ${gradEnd})` }}
              >
                <div className="w-10 h-1 rounded-full bg-white/30 mx-auto mb-4" />
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
                      <ChefHat size={20} className="text-white" />
                    </div>
                    <div>
                      <h2 className="text-[17px] font-extrabold text-white tracking-tight">
                        Chef&apos;s Specials
                      </h2>
                      <p className="text-[11px] text-white/70 mt-0.5">
                        {items.length === 0 ? "Check back soon" : `${items.length} dish${items.length !== 1 ? "es" : ""} available today`}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setSheetOpen(false)}
                    aria-label="Close"
                    className="w-9 h-9 rounded-full bg-white/20 text-white flex items-center justify-center min-h-0 min-w-0 p-0"
                  >
                    <X size={17} />
                  </button>
                </div>
              </div>

              {/* ── Items list ── */}
              <div className="overflow-y-auto flex-1 px-4 py-3 space-y-2.5">
                {items.length === 0 ? (
                  <p className="text-sm text-[#9CA3AF] text-center py-12">
                    No specials right now — check back soon!
                  </p>
                ) : (
                  items.map((item, i) => {
                    const qty = cartQty[item.id] ?? 0;
                    return (
                      <motion.div
                        key={item.id}
                        initial={{ opacity: 0, y: 14 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.05, type: "spring", stiffness: 260, damping: 22 }}
                        className="flex items-center gap-3 bg-white rounded-2xl px-3 py-3 shadow-sm transition-shadow"
                        style={qty > 0 ? { boxShadow: `0 0 0 2px ${themeColor}55, 0 1px 4px rgba(0,0,0,0.06)` } : { boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}
                      >
                        {/* Image or placeholder */}
                        {item.image_url ? (
                          <img
                            src={item.image_url}
                            alt={item.name}
                            loading="lazy"
                            className="w-[68px] h-[68px] rounded-xl object-cover shrink-0"
                          />
                        ) : (
                          <div
                            className="w-[68px] h-[68px] rounded-xl shrink-0 flex items-center justify-center text-2xl"
                            style={{ backgroundColor: `${themeColor}18` }}
                          >
                            🍽️
                          </div>
                        )}

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          {/* Veg/non-veg indicator + name */}
                          <div className="flex items-center gap-1.5 mb-0.5">
                            <span
                              className="w-3 h-3 rounded-sm border-[1.5px] flex items-center justify-center shrink-0"
                              style={{ borderColor: foodDot(item.food_type) }}
                            >
                              <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: foodDot(item.food_type) }} />
                            </span>
                            <p className="text-[14px] font-bold text-[#1C1C2E] truncate leading-tight">
                              {item.name}
                            </p>
                          </div>

                          {item.description && (
                            <p className="text-[11px] text-[#6B7280] line-clamp-2 leading-snug mb-1">
                              {item.description}
                            </p>
                          )}

                          <p className="text-[14px] font-extrabold leading-none" style={{ color: themeColor }}>
                            {currencySymbol}{item.price}
                          </p>
                        </div>

                        {/* Stepper */}
                        {(onAdd || onRemove) && (
                          <Stepper
                            qty={qty}
                            themeColor={themeColor}
                            onAdd={() => onAdd?.(item.id)}
                            onRemove={() => onRemove?.(item.id)}
                          />
                        )}
                      </motion.div>
                    );
                  })
                )}
              </div>

              {/* ── Total bar — slides up when cart has items ── */}
              <AnimatePresence>
                {sheetTotal > 0 && (
                  <motion.div
                    key="total-bar"
                    initial={{ y: 40, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: 40, opacity: 0 }}
                    transition={{ type: "spring", stiffness: 280, damping: 26 }}
                    className="mx-4 mb-3 shrink-0"
                  >
                    <div
                      className="flex items-center justify-between rounded-2xl px-4 py-3"
                      style={{ background: `linear-gradient(135deg, ${themeColor}18, ${themeColor}2A)` }}
                    >
                      <div className="flex items-center gap-2">
                        <ShoppingBag size={16} style={{ color: themeColor }} />
                        <div>
                          <p className="text-[11px] font-semibold text-[#6B7280]">
                            {sheetQtySum} item{sheetQtySum !== 1 ? "s" : ""} from specials
                          </p>
                          <AnimatePresence mode="wait" initial={false}>
                            <motion.p
                              key={sheetTotal}
                              initial={{ y: -6, opacity: 0 }}
                              animate={{ y: 0,  opacity: 1 }}
                              exit={{   y:  6, opacity: 0 }}
                              transition={{ duration: 0.14 }}
                              className="text-[18px] font-extrabold leading-tight"
                              style={{ color: themeColor }}
                            >
                              {currencySymbol}{sheetTotal}
                            </motion.p>
                          </AnimatePresence>
                        </div>
                      </div>
                      <span className="text-[11px] font-bold px-2.5 py-1 rounded-lg text-white" style={{ backgroundColor: themeColor }}>
                        In cart ✓
                      </span>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* ── View full menu CTA ── */}
              {onViewMenu && (
                <div className="px-4 pb-7 pt-1 shrink-0">
                  <button
                    onClick={handleViewMenu}
                    className="w-full rounded-2xl py-3.5 text-[14px] font-bold text-white shadow-md"
                    style={{ background: `linear-gradient(135deg, ${themeColor}, ${gradEnd})` }}
                  >
                    View specials in full menu →
                  </button>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>,
    document.body
  );
}
