"use client";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { ChefHat, ChevronRight, X, Plus } from "lucide-react";

/**
 * SpecialtyPopupPortal — animated nudge bar + bottom sheet for Chef's Specials.
 *
 * Bar slides in from the left after 400 ms and stays visible permanently
 * (persistent = true default). Tapping opens a gradient bottom sheet listing
 * each special with veg/non-veg indicator, description, price, and an Add button.
 *
 * Renders through a React portal into document.body so it never reflows the
 * underlying menu layout or interferes with sticky nav positioning.
 */

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
  /** Ignored when persistent = true. */
  durationSeconds: number;
  items: SpecialtyItem[];
  themeColor: string;
  currencySymbol?: string;
  onAdd?: (itemId: string) => void;
  onViewMenu?: () => void;
  /** When true the bar never auto-dismisses and has no × button. Default: true. */
  persistent?: boolean;
}

const BAR_IN: Record<string, unknown> = {
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
};

function dotColor(food?: string | null) {
  if (food === "non_veg") return "#EF4444";
  if (food === "egg")     return "#F59E0B";
  return "#10B981";
}

export function SpecialtyPopupPortal({
  isEnabled,
  durationSeconds,
  items,
  themeColor,
  currencySymbol = "₹",
  onAdd,
  onViewMenu,
  persistent = true,
}: Props) {
  const [mounted,    setMounted]    = useState(false);
  const [barVisible, setBarVisible] = useState(false);
  const [sheetOpen,  setSheetOpen]  = useState(false);

  // Tracks whether the sheet was closed via "View in menu" navigation vs a
  // normal dismiss. Set synchronously before setSheetOpen so the effect below
  // can read it before React re-renders and resets it.
  const navigatingRef = useRef(false);

  useEffect(() => setMounted(true), []);

  // Show bar shortly after mount.
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

  // In persistent mode: restore bar when the sheet is dismissed normally.
  // Skip when the user navigated away via "View in menu" — bar stays hidden
  // so it doesn't pop back over the section they just jumped to.
  useEffect(() => {
    if (persistent && !sheetOpen && isEnabled && !navigatingRef.current) {
      setBarVisible(true);
    }
    navigatingRef.current = false; // reset after each close
  }, [sheetOpen, persistent, isEnabled]);

  if (!mounted || !isEnabled) return null;

  // Slightly translucent end for gradient variety.
  const gradEnd = themeColor + "E0";

  function openSheet() {
    if (!persistent) setBarVisible(false);
    setSheetOpen(true);
  }

  function handleViewMenu() {
    navigatingRef.current = true; // tell the effect not to restore the bar
    setBarVisible(false);
    setSheetOpen(false);
    onViewMenu?.();
  }

  return createPortal(
    <>
      {/* ── Nudge bar — anchored above the floating MENU button ── */}
      <div className="fixed bottom-[90px] left-1/2 -translate-x-1/2 z-[9999] pointer-events-none">
        <AnimatePresence>
          {barVisible && (
            <motion.button
              key="specialty-bar"
              variants={BAR_IN as Parameters<typeof motion.button>[0]["variants"]}
              initial="hidden"
              animate="visible"
              exit="exit"
              onClick={openSheet}
              className="pointer-events-auto relative rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.22)] overflow-hidden min-w-[285px] max-w-sm border-0 p-0 text-left cursor-pointer"
              style={{
                background: `linear-gradient(135deg, ${themeColor} 0%, ${gradEnd} 100%)`,
              }}
            >
              {/* Main content row */}
              <div className="flex items-center gap-3 px-4 py-3">
                {/* Pulsing chef-hat icon */}
                <motion.div
                  animate={{ scale: [1, 1.18, 1], rotate: [0, -6, 6, 0] }}
                  transition={{ duration: 2.6, repeat: Infinity, ease: "easeInOut", repeatDelay: 0.8 }}
                  className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center shrink-0"
                >
                  <ChefHat size={20} className="text-white drop-shadow-sm" />
                </motion.div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[13px] font-extrabold text-white leading-tight tracking-tight">
                      Chef&apos;s Specials
                    </span>
                    {items.length > 0 && (
                      <span className="bg-white/30 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full leading-none">
                        {items.length}
                      </span>
                    )}
                  </div>
                  <span className="text-[11px] text-white/80 mt-0.5 block">
                    Tap to explore today&apos;s picks ✨
                  </span>
                </div>

                {/* Animated chevron */}
                <motion.div
                  animate={{ x: [0, 5, 0] }}
                  transition={{ duration: 1.3, repeat: Infinity, ease: "easeInOut" }}
                  className="shrink-0 bg-white/20 rounded-lg p-1.5"
                >
                  <ChevronRight size={16} className="text-white" />
                </motion.div>

                {/* Non-persistent dismiss × */}
                {!persistent && (
                  <button
                    onClick={(e) => { e.stopPropagation(); setBarVisible(false); }}
                    aria-label="Dismiss"
                    className="w-6 h-6 rounded-full bg-white/25 text-white flex items-center justify-center shrink-0 min-h-0 min-w-0 p-0"
                  >
                    <X size={12} />
                  </button>
                )}
              </div>

              {/* Sliding shimmer strip — hardware-accelerated via translateX */}
              <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-2xl">
                <motion.div
                  className="absolute top-0 bottom-0 w-1/3"
                  style={{
                    background:
                      "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.18) 50%, transparent 100%)",
                  }}
                  animate={{ x: ["-100%", "400%"] }}
                  transition={{ duration: 2.2, repeat: Infinity, ease: "linear", repeatDelay: 2 }}
                />
              </div>

              {/* 1 px bottom accent line */}
              <div
                className="h-[2px] w-full"
                style={{
                  background:
                    "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.45) 50%, transparent 100%)",
                }}
              />
            </motion.button>
          )}
        </AnimatePresence>
      </div>

      {/* ── Bottom sheet ── */}
      <AnimatePresence>
        {sheetOpen && (
          <motion.div
            key="specialty-sheet"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="fixed inset-0 z-[9999] flex items-end justify-center"
            onClick={() => setSheetOpen(false)}
          >
            {/* Blurred backdrop */}
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />

            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", stiffness: 300, damping: 32 }}
              className="relative bg-white rounded-t-3xl w-full max-w-[460px] flex flex-col shadow-2xl max-h-[80vh]"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Gradient header */}
              <div
                className="rounded-t-3xl px-5 pt-4 pb-5 shrink-0"
                style={{
                  background: `linear-gradient(135deg, ${themeColor} 0%, ${gradEnd} 100%)`,
                }}
              >
                {/* Drag handle */}
                <div className="w-10 h-1 rounded-full bg-white/30 mx-auto mb-4" />

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
                      <ChefHat size={18} className="text-white" />
                    </div>
                    <div>
                      <h2 className="text-[16px] font-extrabold text-white tracking-tight leading-tight">
                        Chef&apos;s Specials
                      </h2>
                      <p className="text-[11px] text-white/75 mt-0.5">
                        {items.length === 0
                          ? "Check back soon"
                          : `${items.length} dish${items.length !== 1 ? "es" : ""} today`}
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={() => setSheetOpen(false)}
                    aria-label="Close"
                    className="w-8 h-8 rounded-full bg-white/25 text-white flex items-center justify-center min-h-0 min-w-0 p-0"
                  >
                    <X size={16} />
                  </button>
                </div>
              </div>

              {/* Items */}
              <div className="overflow-y-auto flex-1 px-5 py-3">
                {items.length === 0 ? (
                  <p className="text-sm text-[#9CA3AF] text-center py-10">
                    No specials right now — check back soon!
                  </p>
                ) : (
                  <div>
                    {items.map((item, i) => (
                      <motion.div
                        key={item.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.045 }}
                        className="flex items-center gap-3 py-3.5 border-b border-[#F0F0F2] last:border-0"
                      >
                        {/* Veg/non-veg indicator */}
                        <span
                          className="w-3.5 h-3.5 rounded-sm border-2 flex items-center justify-center shrink-0 mt-0.5"
                          style={{ borderColor: dotColor(item.food_type) }}
                        >
                          <span
                            className="w-1.5 h-1.5 rounded-full"
                            style={{ backgroundColor: dotColor(item.food_type) }}
                          />
                        </span>

                        <div className="flex-1 min-w-0">
                          <p className="text-[15px] font-semibold text-[#1C1C2E] truncate">
                            {item.name}
                          </p>
                          {item.description && (
                            <p className="text-xs text-[#6B7280] truncate mt-0.5">
                              {item.description}
                            </p>
                          )}
                          <p
                            className="text-sm font-bold mt-1"
                            style={{ color: themeColor }}
                          >
                            {currencySymbol}
                            {item.price}
                          </p>
                        </div>

                        {/* Thumbnail */}
                        {item.image_url && (
                          <img
                            src={item.image_url}
                            alt={item.name}
                            loading="lazy"
                            className="w-[60px] h-[60px] rounded-xl object-cover shrink-0 border border-[#F0F0F2]"
                          />
                        )}

                        {onAdd && (
                          <button
                            onClick={() => onAdd(item.id)}
                            className="flex items-center gap-1 text-white text-xs font-bold rounded-full px-3 py-2 shrink-0 min-h-0 shadow-sm"
                            style={{ backgroundColor: themeColor }}
                          >
                            <Plus size={13} /> Add
                          </button>
                        )}
                      </motion.div>
                    ))}
                  </div>
                )}
              </div>

              {/* View full menu CTA */}
              {onViewMenu && (
                <div className="px-5 pb-7 pt-2 shrink-0">
                  <button
                    onClick={handleViewMenu}
                    className="w-full rounded-2xl py-3.5 text-sm font-bold text-white shadow-md"
                    style={{
                      background: `linear-gradient(135deg, ${themeColor} 0%, ${gradEnd} 100%)`,
                    }}
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
