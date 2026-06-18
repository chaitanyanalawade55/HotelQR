"use client";
import { Copy, Share2 } from "lucide-react";
import { toast } from "sonner";

/** Copy / Share buttons for the menu link (browser-only APIs). */
export function MenuLinkActions({ url, name }: { url: string; name: string }) {
  // Resolve to an absolute URL even if NEXT_PUBLIC_SITE_URL wasn't set.
  function resolve() {
    if (url.startsWith("http")) return url;
    if (typeof window !== "undefined") return window.location.origin + url;
    return url;
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(resolve());
      toast.success("Link copied to clipboard");
    } catch {
      toast.error("Couldn't copy the link");
    }
  }

  async function shareLink() {
    const link = resolve();
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title: name, text: `Check out the menu for ${name}`, url: link });
      } catch {
        /* user dismissed the share sheet — ignore */
      }
    } else {
      try {
        await navigator.clipboard.writeText(link);
        toast.success("Link copied to clipboard");
      } catch {
        toast.error("Sharing isn't supported here");
      }
    }
  }

  const btn =
    "bg-white/10 text-white border border-white/20 rounded-2xl px-4 py-2.5 text-sm font-medium inline-flex items-center gap-2 hover:bg-white/20 transition-colors min-h-0";

  return (
    <>
      <button onClick={copyLink} className={btn}>
        <Copy size={14} /> Copy link
      </button>
      <button onClick={shareLink} className={btn}>
        <Share2 size={14} /> Share
      </button>
    </>
  );
}
