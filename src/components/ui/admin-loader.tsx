"use client";

/**
 * AdminLoader — full-screen enterprise loading screen for the MenuQR dashboard.
 *
 * FM v12 compatibility notes (bugs fixed vs initial version):
 *  1. motion.svg removed — SVG elements don't honour CSS transform-origin the
 *     same way HTML elements do in Safari/Firefox. FM v12's style reconciler
 *     throws when it tries to inject originX/originY onto an SVG node.
 *     Fix: wrap the rotating arc in a motion.div; the inner svg is static.
 *  2. boxShadow keyframe array removed — FM v12's value parser tokenises both
 *     strings and requires identical token counts to interpolate. "0 0 0 0px"
 *     and "0 0 0 10px" differ in the zero token format and the parser throws.
 *     Fix: pulse via scale + opacity on a plain div ring instead.
 *  3. originX/originY in style on motion.svg removed for the same reason as 1.
 */

import { useState, useEffect, memo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { UtensilsCrossed } from "lucide-react";

// ─── types ────────────────────────────────────────────────────────────────────

export interface AdminLoaderProps {
  /**
   * Hotel / restaurant name from Supabase.
   * Personalised title when trimmed value is 1–50 characters.
   * Undefined / null / empty / >50 chars → generic fallback.
   */
  hotelName?: string | null;
  /**
   * Rotating slogans (e.g. from a Supabase settings row).
   * Falls back to DEFAULT_SLOGANS when undefined or empty.
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

const SLOGAN_INTERVAL_MS = 5_000;

// ─── helpers ──────────────────────────────────────────────────────────────────

function resolveTitle(hotelName?: string | null): string {
  const name = hotelName?.trim();
  if (name && name.length >= 1 && name.length <= 50) {
    return `${name} Secured Admin is loading…`;
  }
  return "Hotel Admin is Loading…";
}

// ─── SpinnerRing ──────────────────────────────────────────────────────────────

/**
 * Rotating arc built from two SVGs:
 *  • A static track SVG (never re-rendered)
 *  • A motion.div (CSS transform-origin safe) that wraps the arc SVG
 *
 * Pulse ring uses scale+opacity — no boxShadow animation (FM v12 parser bug).
 */
const SpinnerRing = memo(function SpinnerRing() {
  return (
    <div className="relative w-[92px] h-[92px]" aria-hidden="true">

      {/* Static track ring — never animated, no layout cost */}
      <svg
        viewBox="0 0 92 92"
        className="absolute inset-0 w-full h-full"
        aria-hidden="true"
      >
        <circle
          cx="46" cy="46" r="40"
          fill="none"
          stroke="rgba(249,115,22,0.13)"
          strokeWidth="4.5"
        />
      </svg>

      {/* Rotating arc — motion.div handles CSS transform-origin correctly
          in every browser including Safari. The SVG inside is a passive child. */}
      <motion.div
        className="absolute inset-0"
        animate={{ rotate: 360 }}
        transition={{ duration: 1.25, repeat: Infinity, ease: "linear" }}
        style={{ originX: "50%", originY: "50%" }}
        aria-hidden="true"
      >
        <svg viewBox="0 0 92 92" className="w-full h-full" aria-hidden="true">
          <circle
            cx="46" cy="46" r="40"
            fill="none"
            stroke="#F97316"
            strokeWidth="4.5"
            strokeLinecap="round"
            strokeDasharray="188 64"
          />
        </svg>
      </motion.div>

      {/* Pulse ring — scale+opacity only, NO boxShadow (FM v12 parser bug) */}
      <motion.div
        className="absolute inset-0 rounded-full border-2 border-[#F97316]/30"
        animate={{ scale: [1, 1.18, 1], opacity: [0.4, 0, 0.4] }}
        transition={{ duration: 1.8, repeat: Infinity, ease: "easeOut" }}
        aria-hidden="true"
      />

      {/* Centred brand icon */}
      <div className="absolute inset-0 flex items-center justify-center">
        <motion.div
          animate={{ scale: [1, 1.1, 1], opacity: [0.8, 1, 0.8] }}
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
  // Hydration guard — server emits a static shell; Framer Motion only mounts
  // after the client's first commit. Prevents SSR/CSR tree mismatches.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const slogans =
    slogansProp && slogansProp.length > 0
      ? slogansProp
      : (DEFAULT_SLOGANS as string[]);

  const [sloganIdx, setSloganIdx] = useState(0);

  useEffect(() => {
    if (slogans.length <= 1) return;
    const id = setInterval(
      () => setSloganIdx((prev) => (prev + 1) % slogans.length),
      SLOGAN_INTERVAL_MS,
    );
    return () => clearInterval(id); // ← always cleared, zero memory leaks
  }, [slogans]);

  const title = resolveTitle(hotelName);

  // ── Static shell (SSR / pre-hydration) ──────────────────────────────────
  if (!mounted) {
    return (
      <div
        className="fixed inset-0 z-50 bg-[#1C1C2E]"
        role="status"
        aria-live="polite"
        aria-label={title}
      />
    );
  }

  // ── Animated client shell ────────────────────────────────────────────────
  return (
    <div
      className="fixed inset-0 z-50 overflow-hidden bg-[#1C1C2E] flex flex-col select-none"
      role="status"
      aria-live="polite"
      aria-label={title}
    >
      {/* ── Progress bar ─────────────────────────────────────────────────── */}
      <div className="absolute top-0 left-0 right-0 h-[3px] bg-white/[0.06] z-20">
        <motion.div
          className="h-full bg-gradient-to-r from-[#F97316] via-[#FB923C] to-[#FDBA74]"
          style={{ originX: 0 }}
          initial={{ scaleX: 0 }}
          animate={{ scaleX: [0, 0.55, 0.75, 0.87, 0.93, 0.96] }}
          transition={{
            duration: 10,
            ease: "easeOut",
            times: [0, 0.15, 0.35, 0.60, 0.82, 1],
          }}
        />
      </div>

      {/* ── Ambient blobs — transform-only, GPU layer, no layout ──────────── */}
      <motion.div
        className="absolute rounded-full pointer-events-none"
        style={{
          top: "-20%", left: "-20%",
          width: 600, height: 600,
          background:
            "radial-gradient(circle, rgba(249,115,22,0.08) 0%, transparent 68%)",
          filter: "blur(72px)",
        }}
        animate={{ x: [0, 50, -25, 0], y: [0, -35, 50, 0] }}
        transition={{ duration: 20, repeat: Infinity, ease: "easeInOut" }}
        aria-hidden="true"
      />
      <motion.div
        className="absolute rounded-full pointer-events-none"
        style={{
          bottom: "-20%", right: "-20%",
          width: 520, height: 520,
          background:
            "radial-gradient(circle, rgba(99,102,241,0.07) 0%, transparent 68%)",
          filter: "blur(72px)",
        }}
        animate={{ x: [0, -40, 28, 0], y: [0, 45, -35, 0] }}
        transition={{ duration: 26, repeat: Infinity, ease: "easeInOut" }}
        aria-hidden="true"
      />
      {/* Subtle grid texture */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.018) 1px,transparent 1px)," +
            "linear-gradient(90deg,rgba(255,255,255,0.018) 1px,transparent 1px)",
          backgroundSize: "48px 48px",
        }}
        aria-hidden="true"
      />

      {/* ── Logo ─────────────────────────────────────────────────────────── */}
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

      {/* ── Centre stack ─────────────────────────────────────────────────── */}
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
          <h1 className="text-white text-[18px] font-semibold leading-snug tracking-[-0.015em]" aria-hidden="true">
            {title}
          </h1>

          {/* Fixed-height container prevents layout shift between slogans */}
          <div className="h-[22px] flex items-center justify-center overflow-hidden w-full">
            <AnimatePresence mode="wait">
              <motion.p
                key={sloganIdx}
                className="text-[#6B7280] text-[13.5px] leading-relaxed text-center w-full"
                initial={{ opacity: 0, y: 9 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -9 }}
                transition={{ duration: 0.36, ease: "easeInOut" }}
                aria-live="polite"
                aria-atomic="true"
              >
                {slogans[sloganIdx]}
              </motion.p>
            </AnimatePresence>
          </div>
        </motion.div>

        {/* Pulsing dots */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4, delay: 0.28 }}
        >
          <PulsingDots />
        </motion.div>
      </div>

      {/* ── Footer ───────────────────────────────────────────────────────── */}
      <motion.p
        className="absolute bottom-5 left-0 right-0 text-center text-[11px] text-white/20 tracking-wide"
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
