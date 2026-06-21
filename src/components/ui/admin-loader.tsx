"use client";

/**
 * AdminLoader — full-screen enterprise loading screen for the MenuQR dashboard.
 *
 * Architecture decisions:
 *  • "use client" required for Framer Motion + intervals.
 *  • Module-level constants (DEFAULT_SLOGANS, SLOGAN_INTERVAL_MS) are evaluated
 *    once at import time — no recreation on render.
 *  • `mounted` guard: server renders a zero-content shell; client fills it after
 *    hydration. Prevents React hydration mismatches from Framer Motion's
 *    client-only animation values.
 *  • setInterval is always cleared in the useEffect cleanup — zero memory leaks.
 *  • Sub-components are wrapped in React.memo so parent re-renders (e.g. slogan
 *    index change) never re-render the spinner or dots.
 *  • Named motion imports only — no `import * as motion` to keep bundle tight.
 */

import { useState, useEffect, memo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { UtensilsCrossed } from "lucide-react";

// ─── types ────────────────────────────────────────────────────────────────────

export interface AdminLoaderProps {
  /**
   * Hotel / restaurant name from Supabase.
   * Title personalisation fires when the trimmed value is 1–50 characters.
   * Undefined, null, empty, or >50 chars → generic fallback title.
   */
  hotelName?: string | null;
  /**
   * Rotating slogans pulled from Supabase (e.g. a `settings` table row).
   * When undefined or empty the built-in DEFAULT_SLOGANS are used instead.
   */
  slogans?: string[];
}

// ─── module-level constants ───────────────────────────────────────────────────

const DEFAULT_SLOGANS: readonly string[] = [
  "Preparing your dashboard with care…",
  "Loading your menu intelligence…",
  "Securing your restaurant data…",
  "Connecting to your kitchen's heartbeat…",
  "Every detail, perfectly in place…",
  "Your guests deserve the best — so do you…",
];

/** Exact duration between slogan transitions as required. */
const SLOGAN_INTERVAL_MS = 5_000;

// ─── title resolver ───────────────────────────────────────────────────────────

/**
 * Returns the personalised title when hotelName is usable (≤50 chars),
 * otherwise falls back to the generic form.
 */
function resolveTitle(hotelName?: string | null): string {
  const name = hotelName?.trim();
  if (name && name.length >= 1 && name.length <= 50) {
    return `${name} Secured Admin is loading…`;
  }
  return "Hotel Admin is Loading…";
}

// ─── SpinnerRing ──────────────────────────────────────────────────────────────

/**
 * Indeterminate SVG ring spinner.
 * The track circle is static (no React re-render on tick).
 * The animated arc uses transform: rotate via Framer Motion — GPU-composited,
 * never triggers layout.
 * memo() ensures the dashboard title / slogan state changes never repaint this.
 */
const SpinnerRing = memo(function SpinnerRing() {
  return (
    <div className="relative w-[92px] h-[92px]" aria-hidden="true">
      {/* Static track ring */}
      <svg
        viewBox="0 0 92 92"
        className="absolute inset-0 w-full h-full"
        aria-hidden="true"
      >
        <circle
          cx="46"
          cy="46"
          r="40"
          fill="none"
          stroke="rgba(249,115,22,0.13)"
          strokeWidth="4.5"
        />
      </svg>

      {/* Spinning arc — GPU layer via Framer rotate */}
      <motion.svg
        viewBox="0 0 92 92"
        className="absolute inset-0 w-full h-full"
        animate={{ rotate: 360 }}
        transition={{ duration: 1.25, repeat: Infinity, ease: "linear" }}
        style={{ originX: "50%", originY: "50%" }}
        aria-hidden="true"
      >
        <defs>
          <linearGradient id="arc-grad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#F97316" stopOpacity="0.6" />
            <stop offset="100%" stopColor="#FDBA74" stopOpacity="1" />
          </linearGradient>
        </defs>
        <circle
          cx="46"
          cy="46"
          r="40"
          fill="none"
          stroke="url(#arc-grad)"
          strokeWidth="4.5"
          strokeLinecap="round"
          strokeDasharray="188 63"
        />
      </motion.svg>

      {/* Outer glow pulse */}
      <motion.div
        className="absolute inset-0 rounded-full"
        style={{ boxShadow: "0 0 0 0 rgba(249,115,22,0.3)" }}
        animate={{ boxShadow: ["0 0 0 0px rgba(249,115,22,0.3)", "0 0 0 10px rgba(249,115,22,0)"] }}
        transition={{ duration: 1.6, repeat: Infinity, ease: "easeOut" }}
        aria-hidden="true"
      />

      {/* Centred brand icon — breathes slowly */}
      <div className="absolute inset-0 flex items-center justify-center">
        <motion.div
          animate={{ scale: [1, 1.1, 1], opacity: [0.85, 1, 0.85] }}
          transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
          aria-hidden="true"
        >
          <UtensilsCrossed size={22} className="text-[#F97316]" />
        </motion.div>
      </div>
    </div>
  );
});

// ─── PulsingDots ──────────────────────────────────────────────────────────────

/**
 * Three staggered dots that signal active work.
 * memo() prevents re-renders from slogan index state.
 */
const PulsingDots = memo(function PulsingDots() {
  return (
    <div className="flex items-center gap-[7px]" aria-hidden="true">
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="block w-[5px] h-[5px] rounded-full bg-[#F97316]"
          animate={{ opacity: [0.2, 1, 0.2], scale: [0.8, 1.1, 0.8] }}
          transition={{
            duration: 1.3,
            delay: i * 0.16,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
      ))}
    </div>
  );
});

// ─── AdminLoader ──────────────────────────────────────────────────────────────

export const AdminLoader = memo(function AdminLoader({
  hotelName,
  slogans: slogansProp,
}: AdminLoaderProps) {
  // Hydration guard — server emits a static shell; animations mount only after
  // the client has committed its first paint.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // Resolve the active slogan list: user-provided or built-in fallback.
  const slogans =
    slogansProp && slogansProp.length > 0
      ? slogansProp
      : (DEFAULT_SLOGANS as string[]);

  const [sloganIdx, setSloganIdx] = useState(0);

  useEffect(() => {
    if (slogans.length <= 1) return; // nothing to rotate
    const id = setInterval(
      () => setSloganIdx((prev) => (prev + 1) % slogans.length),
      SLOGAN_INTERVAL_MS,
    );
    return () => clearInterval(id); // ← always cleared — no memory leak
  }, [slogans]);

  const title = resolveTitle(hotelName);

  // ── Static shell (SSR / pre-hydration) ─────────────────────────────────────
  // Matches the client tree structurally so React never sees a mismatch.
  if (!mounted) {
    return (
      <div
        className="fixed inset-0 z-50 bg-[#1C1C2E] flex items-center justify-center"
        role="status"
        aria-live="polite"
        aria-label={title}
      />
    );
  }

  // ── Animated client shell ───────────────────────────────────────────────────
  return (
    <div
      className="fixed inset-0 z-50 overflow-hidden bg-[#1C1C2E] flex flex-col select-none"
      role="status"
      aria-live="polite"
      aria-label={title}
    >
      {/* ── Progress bar ───────────────────────────────────────────────────── */}
      {/* Fakes a deterministic load: races toward ~96 % then holds. */}
      <div className="absolute top-0 left-0 right-0 h-[3px] bg-white/[0.06] z-20">
        <motion.div
          className="h-full"
          style={{
            originX: 0,
            background:
              "linear-gradient(90deg, #F97316 0%, #FB923C 60%, #FDBA74 100%)",
          }}
          initial={{ scaleX: 0 }}
          animate={{ scaleX: [0, 0.55, 0.75, 0.87, 0.93, 0.96] }}
          transition={{
            duration: 10,
            ease: "easeOut",
            times: [0, 0.15, 0.35, 0.6, 0.82, 1],
          }}
        />
      </div>

      {/* ── Ambient background blobs ───────────────────────────────────────── */}
      {/* GPU-composited transforms only — zero layout thrashing. */}
      <motion.div
        className="absolute pointer-events-none"
        style={{
          top: "-20%",
          left: "-20%",
          width: 600,
          height: 600,
          borderRadius: "50%",
          background:
            "radial-gradient(circle, rgba(249,115,22,0.08) 0%, transparent 68%)",
          filter: "blur(72px)",
        }}
        animate={{ x: [0, 50, -25, 0], y: [0, -35, 50, 0] }}
        transition={{ duration: 20, repeat: Infinity, ease: "easeInOut" }}
        aria-hidden="true"
      />
      <motion.div
        className="absolute pointer-events-none"
        style={{
          bottom: "-20%",
          right: "-20%",
          width: 520,
          height: 520,
          borderRadius: "50%",
          background:
            "radial-gradient(circle, rgba(99,102,241,0.07) 0%, transparent 68%)",
          filter: "blur(72px)",
        }}
        animate={{ x: [0, -40, 28, 0], y: [0, 45, -35, 0] }}
        transition={{ duration: 26, repeat: Infinity, ease: "easeInOut" }}
        aria-hidden="true"
      />
      {/* Subtle grid texture overlay — only visual, pointer events off */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.018) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.018) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
        }}
        aria-hidden="true"
      />

      {/* ── Logo — top-left ────────────────────────────────────────────────── */}
      <motion.div
        className="absolute top-6 left-6 flex items-center gap-2.5 z-10"
        initial={{ opacity: 0, x: -16 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
      >
        <div
          className="w-8 h-8 rounded-xl bg-[#F97316] flex items-center justify-center"
          style={{ boxShadow: "0 0 18px rgba(249,115,22,0.45)" }}
        >
          <UtensilsCrossed size={16} className="text-white" aria-hidden="true" />
        </div>
        <span
          className="text-white text-xl font-semibold tracking-tight"
          style={{ fontFamily: "var(--font-display)" }}
        >
          MenuQR
        </span>
      </motion.div>

      {/* ── Centre stack ───────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col items-center justify-center gap-9 px-6">

        {/* Spinner */}
        <motion.div
          initial={{ opacity: 0, scale: 0.75 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.55, ease: [0.34, 1.56, 0.64, 1] }}
        >
          <SpinnerRing />
        </motion.div>

        {/* Title + slogan */}
        <motion.div
          className="flex flex-col items-center gap-4 text-center max-w-[340px]"
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.14, ease: "easeOut" }}
        >
          {/* Static title — changes only when hotelName prop changes. */}
          <h1
            className="text-white text-[18px] font-semibold leading-snug tracking-[-0.015em]"
            // Screen readers read this immediately via aria-label on the wrapper.
            aria-hidden="true"
          >
            {title}
          </h1>

          {/* Slogan carousel — fixed-height container prevents layout shift. */}
          <div className="h-[22px] flex items-center justify-center overflow-hidden w-full">
            <AnimatePresence mode="wait">
              <motion.p
                key={sloganIdx}
                className="text-[#6B7280] text-[13.5px] leading-relaxed text-center w-full"
                initial={{ opacity: 0, y: 9 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -9 }}
                transition={{ duration: 0.36, ease: "easeInOut" }}
                // Each new slogan is announced to screen readers.
                aria-live="polite"
                aria-atomic="true"
              >
                {slogans[sloganIdx]}
              </motion.p>
            </AnimatePresence>
          </div>
        </motion.div>

        {/* Pulsing activity indicator */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4, delay: 0.28 }}
        >
          <PulsingDots />
        </motion.div>
      </div>

      {/* ── Footer ─────────────────────────────────────────────────────────── */}
      <motion.p
        className="absolute bottom-5 left-0 right-0 text-center text-[11px] text-white/18 tracking-wide"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.4, delay: 0.5 }}
        aria-hidden="true"
      >
        Secured by MenuQR &mdash; Enterprise Edition
      </motion.p>
    </div>
  );
});
