"use client";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import {
  UtensilsCrossed,
  LayoutDashboard,
  Palette,
  QrCode,
  LogOut,
  ShoppingBag,
} from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import type { Hotel } from "@/types/database";

interface DashboardShellProps {
  hotel: Hotel;
  children: React.ReactNode;
}

const navItems = [
  { href: "/dashboard", label: "Home", icon: LayoutDashboard },
  { href: "/dashboard/menu", label: "Menu", icon: UtensilsCrossed },
  { href: "/dashboard/branding", label: "Branding", icon: Palette },
  { href: "/dashboard/qr", label: "QR", icon: QrCode },
  { href: "/dashboard/orders", label: "Orders", icon: ShoppingBag },
];

export function DashboardShell({ hotel, children }: DashboardShellProps) {
  const pathname = usePathname();
  const router = useRouter();

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    toast.success("Logged out");
    router.push("/login");
    router.refresh();
  }

  function isActive(href: string) {
    if (href === "/dashboard") return pathname === "/dashboard";
    return pathname.startsWith(href);
  }

  const menuUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/menu/${hotel.slug}`
      : `/menu/${hotel.slug}`;

  return (
    <div className="min-h-screen">
      {/* Mobile top bar */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-40 flex items-center justify-between px-4 h-[52px] bg-[#1C1C2E]">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-xl bg-[#F97316] flex items-center justify-center">
            <UtensilsCrossed size={14} className="text-white" />
          </div>
          <span className="text-white font-bold text-base">MenuQR</span>
        </div>
        <a
          href={`/menu/${hotel.slug}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[#F97316] text-xs font-medium min-h-0 min-w-0"
        >
          View menu ↗
        </a>
      </div>

      {/* Desktop sidebar */}
      <aside className="hidden md:flex flex-col fixed left-0 top-0 bottom-0 w-64 z-30 bg-[#1C1C2E]">
        <div className="flex items-center gap-2.5 px-5 py-5 border-b border-white/10">
          <div className="w-8 h-8 rounded-xl bg-[#F97316] flex items-center justify-center">
            <UtensilsCrossed size={16} className="text-white" />
          </div>
          <span
            className="text-white text-xl font-semibold"
            style={{ fontFamily: "var(--font-display)" }}
          >
            MenuQR
          </span>
        </div>

        <div className="px-5 py-4 border-b border-white/10">
          <p className="text-[#6B7280] text-[10px] uppercase tracking-widest mb-0.5">
            Your restaurant
          </p>
          <p className="text-white text-sm font-medium truncate">{hotel.name}</p>
          <a
            href={`/menu/${hotel.slug}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[#F97316] text-xs flex items-center gap-1 mt-1 hover:underline min-h-0 min-w-0"
          >
            View menu ↗
          </a>
        </div>

        <nav className="px-3 py-4 space-y-1 flex-1">
          {navItems.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={[
                "flex items-center gap-3 px-3 py-3 text-sm font-medium rounded-2xl transition-all duration-150",
                isActive(href)
                  ? "bg-[#F97316] text-white"
                  : "text-[#6B7280] hover:bg-white/8 hover:text-white",
              ].join(" ")}
            >
              <Icon size={18} />
              {label}
            </Link>
          ))}
        </nav>

        <div className="border-t border-white/10 p-3">
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 px-3 py-3 text-sm font-medium text-[#6B7280] hover:bg-white/8 hover:text-white rounded-2xl w-full transition-all duration-150"
          >
            <LogOut size={18} />
            Logout
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="md:ml-64 pt-[52px] md:pt-0 pb-[76px] md:pb-0 min-h-screen">
        {children}
      </main>

      {/* Mobile bottom navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-[#E5E7EB] flex items-stretch h-[60px]">
        {navItems.slice(0, 4).map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={[
              "flex-1 flex flex-col items-center justify-center gap-0.5",
              isActive(href) ? "text-[#F97316]" : "text-[#9CA3AF]",
            ].join(" ")}
          >
            <Icon size={20} />
            <span className="text-[10px] font-medium">{label}</span>
          </Link>
        ))}
        <button
          onClick={handleLogout}
          className="flex-1 flex flex-col items-center justify-center gap-0.5 text-[#9CA3AF]"
        >
          <LogOut size={20} />
          <span className="text-[10px] font-medium">Logout</span>
        </button>
      </nav>
    </div>
  );
}
