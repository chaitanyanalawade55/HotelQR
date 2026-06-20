"use client";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Sparkles, ChevronRight, X } from "lucide-react";

/**
 * SpecialtyPopupPortal — a fully self-contained nudge that wipes in above the
 * floating [MENU] button, holds for a configurable window, then wipes out and
 * unmounts. It renders through a React portal into document.body so it never
 * touches, reflows, or restyles the existing menu/navigation DOM.
 *
 * Drop-in: <SpecialtyPopupPortal isEnabled durationSeconds={10} onSpecialtyClick={fn} />
 */
interface SpecialtyPopupPortalProps {
  /** Owner feature flag (and any other gate, e.g. "a special category exists"). */
  isEnabled: boolean;
  /** How long the popup stays on screen before auto-dismissing. */
  durationSeconds: number;
  /** Fired when the customer taps the popup (jump to the special menu). */
  onSpecialtyClick: () => void;
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

export function SpecialtyPopupPortal({ isEnabled, durationSeconds, onSpecialtyClick }: SpecialtyPopupPortalProps) {
  // Portals can only target document.body after the client has mounted.
  const [mounted, setMounted] = useState(false);
  const [showPopup, setShowPopup] = useState(false);

  useEffect(() => setMounted(true), []);

  // Show shortly after mount (clean entrance), then auto-dismiss after the
  // owner-configured window. AnimatePresence plays the exit before unmount.
  useEffect(() => {
    if (!isEnabled) return;
    const showTimer = setTimeout(() => setShowPopup(true), 500);
    const hideTimer = setTimeout(() => setShowPopup(false), 500 + Math.max(1, durationSeconds) * 1000);
    return () => {
      clearTimeout(showTimer);
      clearTimeout(hideTimer);
    };
  }, [isEnabled, durationSeconds]);

  if (!mounted || !isEnabled) return null;

  return createPortal(
    // Anchor layer: matches the menu's horizontal centre without owning any
    // existing node. pointer-events-none so it never intercepts taps when empty.
    // Centring lives here (static transform) so Framer's scale/clip on the card
    // below can't fight the translate.
    <div className="fixed bottom-[90px] left-1/2 -translate-x-1/2 z-[9999] pointer-events-none">
      <AnimatePresence>
        {showPopup && (
          <motion.div
            key="specialty-popup"
            variants={wipeAnimationVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="pointer-events-auto bg-white/95 backdrop-blur-md shadow-xl rounded-xl p-3 border border-orange-100 min-w-[280px] max-w-sm flex items-center gap-3"
          >
            <button
              onClick={() => {
                setShowPopup(false);
                onSpecialtyClick();
              }}
              className="flex items-center gap-3 flex-1 text-left min-h-0 min-w-0 p-0 bg-transparent"
            >
              <span className="w-9 h-9 rounded-lg bg-orange-50 flex items-center justify-center shrink-0">
                <Sparkles size={18} className="text-orange-500" />
              </span>
              <span className="flex-1 min-w-0">
                <span className="block text-sm font-bold text-[#1C1C2E] truncate">
                  ✨ Chef&apos;s Specialities Available!
                </span>
                <span className="block text-xs text-[#6B7280] truncate">Tap to view today&apos;s special menu</span>
              </span>
              <ChevronRight size={18} className="text-orange-500 shrink-0" />
            </button>

            <button
              onClick={() => setShowPopup(false)}
              aria-label="Dismiss"
              className="w-6 h-6 rounded-full bg-[#F3F4F6] text-[#6B7280] flex items-center justify-center shrink-0 min-h-0 min-w-0 p-0"
            >
              <X size={13} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>,
    document.body
  );
}
