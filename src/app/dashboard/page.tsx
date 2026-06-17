import { redirect } from "next/navigation";
import Link from "next/link";
import { ExternalLink, UtensilsCrossed, Palette, QrCode } from "lucide-react";
import { createClient } from "@/lib/supabase/server";

// Only select the columns we render on this page.
const HOTEL_COLS = "id,name,slug,owner_id,status";

export default async function DashboardPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: hotel } = await supabase
    .from("hotels")
    .select(HOTEL_COLS)
    .eq("owner_id", user.id)
    .single();

  if (!hotel) redirect("/login");

  // Run all three count queries in parallel — 3x faster dashboard load.
  const [itemRes, catRes, availRes] = await Promise.all([
    supabase
      .from("menu_items")
      .select("*", { count: "exact", head: true })
      .eq("hotel_id", hotel.id),
    supabase
      .from("categories")
      .select("*", { count: "exact", head: true })
      .eq("hotel_id", hotel.id),
    supabase
      .from("menu_items")
      .select("*", { count: "exact", head: true })
      .eq("hotel_id", hotel.id)
      .eq("is_available", true),
  ]);

  const itemCount = itemRes.count ?? 0;
  const catCount = catRes.count ?? 0;
  const availCount = availRes.count ?? 0;
  const showChecklist = itemCount === 0;

  const quickTiles = [
    { icon: UtensilsCrossed, label: "Menu", href: "/dashboard/menu" },
    { icon: Palette, label: "Branding", href: "/dashboard/branding" },
    { icon: QrCode, label: "QR Code", href: "/dashboard/qr" },
  ];

  return (
    <div className="px-4 md:px-8 py-6">
      <div>
        <h1 className="text-xl font-bold text-[#0F0E17]">Good day! 👋</h1>
        <p className="text-sm text-[#6B7280] mt-0.5">{hotel.name}</p>
      </div>

      {showChecklist && (
        <div className="bg-[#FFF7ED] border border-[#FED7AA] rounded-3xl p-4 mt-5">
          <p className="text-sm font-semibold text-[#C2410C] mb-2">Let&apos;s get you started</p>
          <div className="space-y-1.5">
            <Link href="/dashboard/menu" className="text-sm text-[#9A3412] hover:text-[#C2410C] block">
              → Add menu categories &amp; items
            </Link>
            <Link href="/dashboard/branding" className="text-sm text-[#9A3412] hover:text-[#C2410C] block">
              → Upload your logo &amp; pick a theme color
            </Link>
            <Link href="/dashboard/qr" className="text-sm text-[#9A3412] hover:text-[#C2410C] block">
              → Download and print your QR code
            </Link>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 mt-5">
        <StatCard label="Total Items" value={itemCount} sub="on your menu" />
        <StatCard label="Categories" value={catCount} sub="sections" />
        <StatCard label="Available" value={availCount} sub="visible to customers" />
        <div className="bg-white rounded-3xl border border-[#E5E7EB] p-5">
          <p className="text-[10px] font-medium text-[#6B7280] uppercase tracking-widest">Status</p>
          <p
            className={[
              "text-3xl font-bold mt-1",
              hotel.status === "active" ? "text-[#10B981]" : "text-[#1C1C2E]",
            ].join(" ")}
          >
            {hotel.status === "active" ? "Live" : "Trial"}
          </p>
          <p className="text-xs text-[#9CA3AF] mt-0.5 capitalize">{hotel.status}</p>
        </div>
      </div>

      <div className="bg-[#1C1C2E] rounded-3xl p-5 mt-4">
        <p className="text-[10px] uppercase tracking-widest text-[#6B7280] mb-1">Your menu link</p>
        <p className="text-sm font-medium text-white break-all mb-3">
          {process.env.NEXT_PUBLIC_SITE_URL}/menu/{hotel.slug}
        </p>
        <a
          href={`/menu/${hotel.slug}`}
          target="_blank"
          rel="noopener noreferrer"
          className="bg-[#F97316] text-white rounded-2xl px-4 py-2.5 text-sm font-medium inline-flex items-center gap-2 min-h-0"
        >
          Preview your menu <ExternalLink size={14} />
        </a>
      </div>

      <div className="grid grid-cols-3 gap-3 mt-4">
        {quickTiles.map(({ icon: Icon, label, href }) => (
          <Link
            key={href}
            href={href}
            className="bg-white border border-[#E5E7EB] rounded-3xl p-4 flex flex-col items-center gap-2 hover:border-[#F97316] hover:shadow-sm transition-all cursor-pointer"
          >
            <Icon size={22} className="text-[#F97316]" />
            <span className="text-xs font-medium text-[#374151] text-center">{label}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}

function StatCard({ label, value, sub }: { label: string; value: number; sub: string }) {
  return (
    <div className="bg-white rounded-3xl border border-[#E5E7EB] p-5">
      <p className="text-[10px] font-medium text-[#6B7280] uppercase tracking-widest">{label}</p>
      <p className="text-3xl font-bold text-[#1C1C2E] mt-1">{value}</p>
      <p className="text-xs text-[#9CA3AF] mt-0.5">{sub}</p>
    </div>
  );
}
