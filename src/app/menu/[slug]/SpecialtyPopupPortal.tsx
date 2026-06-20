"use client";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Sparkles, ChevronRight, X, Plus } from "lucide-react";

/**
 * SpecialtyPopupPortal — a fully self-contained nudge that wipes in (left → right)
 * just above the floating [MENU] button on every menu load/refresh. Tapping it
 * opens a bottom sheet listing the hotel's speciality items over a blurred menu
 * backdrop. Renders through a React portal into document.body so it never
 * touches, reflows, or restyles the existing menu/navigation DOM.
 */
export interface SpecialtyItem {
  id: string;
  name: string;
  price: number;
  description?: string | null;
  food_type?: string | null;
}

interface SpecialtyPopupPortalProps {
  /** Owner feature flag (and any other gate, e.g. "a special category exists"). */
  isEnabled: boolean;
  /** How long the nudge bar stays before auto-dismissing. */
  durationSeconds: number;
  /** The speciality items to list (already-configured specials, else default Water). */
  items: SpecialtyItem[];
  /** Brand colour for accents. */
  themeColor: string;
  /** Currency symbol for prices. */
  currencySymbol?: string;
  /** Optional: add an item straight to the cart from the sheet. */
  onAdd?: (itemId: string) => void;
  /** Optional: jump to the speciality section in the underlying menu. */
  onViewMenu?: () => void;
}

// Hardware-accelerated left-to-right wipe in, wipe out to the right.
const wipeAnimationVariants = {
  hidden: { clipPath: "inset(0 100% 0 0)", opacity: 0, scale: 0.95, originX: 0 },
  visible: {
    clipPath: "inset(0 0% 0 0)",
    opacity: 1,
    scale: 1,
    transition: { type: "spring", stiffness: 120, damping: 20 },
  },
  exit: {
    clipPath: "inset(0 0 0 100%)",
    opacity: 0,
    transition: { duration: 0.25, ease: "easeInOut" },
  },
} as const;

function dotColor(food?: string | null) {
  if (food === "non_veg") return "#EF4444";
  if (food === "egg") return "#F59E0B";
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
}: SpecialtyPopupPortalProps) {
  // Portals can only target document.body after the client has mounted.
  const [mounted, setMounted] = useState(false);
  const [barVisible, setBarVisible] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);

  useEffect(() => setMounted(true), []);

  // Show the bar shortly after mount, then auto-dismiss after the owner window.
  // (Tapping it opens the sheet, which is independent of this timer.)
  useEffect(() => {
    if (!isEnabled) return;
    const showTimer = setTimeout(() => setBarVisible(true), 500);
    const hideTimer = setTimeout(() => setBarVisible(false), 500 + Math.max(1, durationSeconds) * 1000);
    return () => {
      clearTimeout(showTimer);
      clearTimeout(hideTimer);
    };
  }, [isEnabled, durationSeconds]);

  if (!mounted || !isEnabled) return null;

  return createPortal(
    <>
      {/* ── Nudge bar — anchored above the MENU button. Centring lives on this
          static wrapper so Framer's scale/clip can't fight the translate. ── */}
      <div className="fixed bottom-[90px] left-1/2 -translate-x-1/2 z-[9999] pointer-events-none">
        <AnimatePresence>
          {barVisible && (
            <motion.div
              key="specialty-bar"
              variants={wipeAnimationVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              className="pointer-events-auto bg-white/95 backdrop-blur-md shadow-xl rounded-xl p-3 border border-orange-100 min-w-[280px] max-w-sm flex items-center gap-3"
            >
              <button
                onClick={() => {
                  setBarVisible(false);
                  setSheetOpen(true);
                }}
                className="flex items-center gap-3 flex-1 text-left min-h-0 min-w-0 p-0 bg-transparent"
              >
                <span
                  className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                  style={{ backgroundColor: `${themeColor}1A` }}
                >
                  <Sparkles size={18} style={{ color: themeColor }} />
                </span>
                <span className="flex-1 min-w-0">
                  <span className="block text-sm font-bold text-[#1C1C2E] truncate">
                    ✨ Chef&apos;s Specialities Available!
                  </span>
                  <span className="block text-xs text-[#6B7280] truncate">Tap to see today&apos;s specials</span>
                </span>
                <ChevronRight size={18} style={{ color: themeColor }} className="shrink-0" />
              </button>

              <button
                onClick={() => setBarVisible(false)}
                aria-label="Dismiss"
                className="w-6 h-6 rounded-full bg-[#F3F4F6] text-[#6B7280] flex items-center justify-center shrink-0 min-h-0 min-w-0 p-0"
              >
                <X size={13} />
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Speciality sheet — opens over a BLURRED menu backdrop. ── */}
      <AnimatePresence>
        {sheetOpen && (
          <motion.div
            key="specialty-sheet"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[9999] flex items-end justify-center"
            onClick={() => setSheetOpen(false)}
          >
            {/* Blurred menu behind the sheet. */}
            <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" />

            <motion.div
              initial={{ y: 80 }}
              animate={{ y: 0 }}
              exit={{ y: 80 }}
              transition={{ type: "spring", stiffness: 260, damping: 26 }}
              className="relative bg-white rounded-t-3xl w-full max-w-[460px] p-5 pb-8 max-h-[72vh] flex flex-col shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="w-10 h-1 rounded-full bg-[#E5E7EB] mx-auto mb-4" />
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Sparkles size={18} style={{ color: themeColor }} />
                  <h2 className="text-[17px] font-extrabold text-[#1C1C2E] tracking-tight">Chef&apos;s Specialities</h2>
                </div>
                <button
                  onClick={() => setSheetOpen(false)}
                  aria-label="Close"
                  className="w-8 h-8 rounded-full bg-[#F3F4F6] text-[#6B7280] flex items-center justify-center min-h-0 min-w-0 p-0"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="overflow-y-auto -mx-1 px-1">
                {items.length === 0 ? (
                  <p className="text-sm text-[#9CA3AF] text-center py-10">No specials right now.</p>
                ) : (
                  items.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center gap-3 py-3 border-b border-[#F0F0F2] last:border-0"
                    >
                      <span
                        className="w-3.5 h-3.5 rounded-sm border-2 flex items-center justify-center shrink-0 mt-0.5"
                        style={{ borderColor: dotColor(item.food_type) }}
                      >
                        <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: dotColor(item.food_type) }} />
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-[15px] font-semibold text-[#1C1C2E] truncate">{item.name}</p>
                        {item.description && (
                          <p className="text-xs text-[#6B7280] truncate">{item.description}</p>
                        )}
                        <p className="text-sm font-bold mt-0.5" style={{ color: themeColor }}>
                          {currencySymbol}
                          {item.price}
                        </p>
                      </div>
                      {onAdd && (
                        <button
                          onClick={() => onAdd(item.id)}
                          className="flex items-center gap-1 text-white text-xs font-bold rounded-full px-3 py-2 shrink-0 min-h-0"
                          style={{ backgroundColor: themeColor }}
                        >
                          <Plus size={14} /> Add
                        </button>
                      )}
                    </div>
                  ))
                )}
              </div>

              {onViewMenu && (
                <button
                  onClick={() => {
                    setSheetOpen(false);
                    onViewMenu();
                  }}
                  className="mt-4 w-full rounded-2xl py-3 text-sm font-bold text-white"
                  style={{ backgroundColor: themeColor }}
                >
                  View in full menu
                </button>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>,
    document.body
  );
}
