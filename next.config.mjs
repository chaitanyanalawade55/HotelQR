import bundleAnalyzer from "@next/bundle-analyzer";

const withBundleAnalyzer = bundleAnalyzer({ enabled: process.env.ANALYZE === "true" });

/** @type {import('next').NextConfig} */
const nextConfig = {
  // ── Production hardening ──
  reactStrictMode: true,
  poweredByHeader: false, // hide X-Powered-By: Next.js

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
