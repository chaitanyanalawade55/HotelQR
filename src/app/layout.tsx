import type { Metadata, Viewport } from "next";
import { Toaster } from "sonner";
import { ServiceWorkerRegister } from "@/components/ServiceWorkerRegister";
import "./globals.css";

export const metadata: Metadata = {
  title: "MenuQR — Digital Menu Platform",
  description:
    "Replace printed menus with a branded digital menu customers access by scanning a QR code.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "MenuQR",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
  themeColor: "#F97316",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        {/* Open the Supabase TCP connection before any JS runs — shaves the
            first-auth RTT on cold loads and after browser restarts. */}
        <link rel="dns-prefetch" href={process.env.NEXT_PUBLIC_SUPABASE_URL} />
        <link rel="preconnect" href={process.env.NEXT_PUBLIC_SUPABASE_URL} />
        {/* Google Fonts */}
        <link rel="dns-prefetch" href="https://fonts.googleapis.com" />
        <link rel="dns-prefetch" href="https://fonts.gstatic.com" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/* Non-blocking font load — swap pattern prevents FOIT */}
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600&display=swap"
          media="print"
          // @ts-expect-error — onLoad is valid HTML but not typed in React
          onLoad="this.media='all'"
        />
        <noscript>
          <link
            rel="stylesheet"
            href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600&display=swap"
          />
        </noscript>
        {/* PWA icons */}
        <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
        <link rel="icon" type="image/svg+xml" href="/icons/icon.svg" />
        <link rel="icon" type="image/png" sizes="192x192" href="/icons/icon-192.png" />
      </head>
      <body>
        {children}
        <Toaster position="top-center" richColors />
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
