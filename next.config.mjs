import bundleAnalyzer from "@next/bundle-analyzer";

const withBundleAnalyzer = bundleAnalyzer({ enabled: process.env.ANALYZE === "true" });

/** @type {import('next').NextConfig} */
const nextConfig = {
  // ── Production hardening ──
  reactStrictMode: true,
  poweredByHeader: false, // hide X-Powered-By: Next.js

  // ── Build telemetry — inlined at build time, readable on client & server.
  //    On Vercel, VERCEL_GIT_COMMIT_SHA is the deployed commit; build time is
  //    when this config is evaluated (i.e. the deployment build).
  env: {
    NEXT_PUBLIC_BUILD_SHA: (process.env.VERCEL_GIT_COMMIT_SHA || "").slice(0, 7),
    NEXT_PUBLIC_BUILD_TIME: new Date().toISOString(),
    NEXT_PUBLIC_DEPLOYER: process.env.DEPLOYER || "",
  },

  // ── Image optimization (mobile-first — QR scan = always phone) ──
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
    ],
    formats: ["image/avif", "image/webp"],
    deviceSizes: [390, 430, 640, 750, 1080],   // real phone widths
    imageSizes: [64, 128, 256],                  // thumbnails
    minimumCacheTTL: 86400,                      // 1 day — images rarely change
  },

  // ── Headers ──
  async headers() {
    return [
      // Public menu — ISR cache
      {
        source: "/menu/:slug",
        headers: [
          { key: "Cache-Control", value: "public, s-maxage=60, stale-while-revalidate=600" },
        ],
      },
      // Static assets — immutable, long TTL
      {
        source: "/_next/static/:path*",
        headers: [
          { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
        ],
      },
      // Service worker — must never be cached (browser checks for updates on every load)
      {
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
      // PWA manifest — short TTL so installs pick up icon/name changes quickly
      {
        source: "/manifest.json",
        headers: [
          { key: "Cache-Control", value: "public, max-age=0, must-revalidate" },
          { key: "Content-Type", value: "application/manifest+json" },
        ],
      },
      // PWA icons — week TTL (bump CACHE_VER in sw.js to bust on icon changes)
      {
        source: "/icons/:path*",
        headers: [
          { key: "Cache-Control", value: "public, max-age=604800, stale-while-revalidate=86400" },
        ],
      },
      // Security headers — all routes
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(self), microphone=()" },
        ],
      },
    ];
  },
};

export default withBundleAnalyzer(nextConfig);
