import Link from "next/link";
import { redirect } from "next/navigation";
import { ExternalLink, GitCommit, Clock } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { SuperAdminHeader } from "./superadmin-header";
import { BUILD_SHA, BUILD_TIME } from "@/lib/build-info";
import { relativeTime, formatDateTime } from "@/lib/relativeTime";
import type { Hotel } from "@/types/database";

const statusStyle: Record<string, string> = {
  active: "bg-[#ECFDF5] text-[#047857]",
  trial: "bg-[#FFF7ED] text-[#C2410C]",
  suspended: "bg-[#FEF2F2] text-[#B91C1C]",
};

export default async function SuperAdminPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/superadmin/login");

  const { data: isSuper } = await supabase.rpc("is_super_admin");
  if (!isSuper) redirect("/dashboard");

  // RLS (migration 0008) lets a super admin read across all hotels.
  const [hotelsRes, ordersCountRes, itemsCountRes, itemTimesRes] = await Promise.all([
    supabase
      .from("hotels")
      .select("id,name,slug,owner_email,phone,status,created_at,updated_at")
      .order("created_at", { ascending: false }),
    supabase.from("orders").select("*", { count: "exact", head: true }),
    supabase.from("menu_items").select("*", { count: "exact", head: true }),
    supabase.from("menu_items").select("hotel_id,updated_at"),
  ]);

  const hotels = (hotelsRes.data as Hotel[]) ?? [];
  const activeCount = hotels.filter((h) => h.status === "active").length;

  // Most-recent menu edit per hotel → combined with profile changes gives each
  // hotel's "last admin update". One pass, newest wins.
  const lastMenuEdit = new Map<string, string>();
  for (const row of (itemTimesRes.data as { hotel_id: string; updated_at: string }[] | null) ?? []) {
    if (!row.updated_at) continue;
    const prev = lastMenuEdit.get(row.hotel_id);
    if (!prev || row.updated_at > prev) lastMenuEdit.set(row.hotel_id, row.updated_at);
  }
  const lastAdminUpdate = (h: Hotel) =>
    [h.updated_at, lastMenuEdit.get(h.id)].filter(Boolean).sort().at(-1) ?? null;

  const stats = [
    { label: "Hotels", value: hotels.length },
    { label: "Active", value: activeCount },
    { label: "Orders", value: ordersCountRes.count ?? 0 },
    { label: "Menu items", value: itemsCountRes.count ?? 0 },
  ];

  return (
    <div className="min-h-screen bg-[#F3F4F6]">
      <SuperAdminHeader />

      <div className="max-w-5xl mx-auto px-4 md:px-8 py-6">
        {/* Platform stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-7">
          {stats.map((s) => (
            <div key={s.label} className="bg-white border border-[#E5E7EB] rounded-3xl p-4">
              <p className="text-2xl font-bold text-[#0F0E17]">{s.value}</p>
              <p className="text-xs text-[#6B7280] mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>

        {/* System monitoring — deployment is global (one Vercel build serves
            every hotel), so the version/time are shown once here. */}
        <div className="bg-gray-50 rounded-xl p-4 border border-gray-100 mb-7">
          <p className="text-sm font-semibold text-[#0F0E17] mb-3">System monitoring</p>
          <div className="flex flex-wrap gap-x-8 gap-y-3">
            <div className="flex items-center gap-2">
              <GitCommit size={15} className="text-[#6B7280]" />
              <span className="text-xs text-[#6B7280]">Live production version</span>
              <span className="font-mono text-[11px] bg-white border border-[#E5E7EB] text-[#374151] px-2 py-0.5 rounded-md">
                {BUILD_SHA}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Clock size={15} className="text-[#6B7280]" />
              <span className="text-xs text-[#6B7280]">Build timestamp</span>
              <span className="text-xs font-medium text-[#0F0E17]">{formatDateTime(BUILD_TIME)}</span>
            </div>
          </div>
        </div>

        <h2 className="text-sm font-semibold text-[#0F0E17] mb-3">All hotels</h2>
        <div className="space-y-3">
          {hotels.map((h) => (
            <div key={h.id} className="bg-white border border-[#E5E7EB] rounded-3xl p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-[#0F0E17] truncate">{h.name}</p>
                    <span
                      className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${statusStyle[h.status] ?? "bg-[#F3F4F6] text-[#6B7280]"}`}
                    >
                      {h.status}
                    </span>
                  </div>
                  <p className="text-xs text-[#6B7280] mt-1 truncate">{h.owner_email}</p>
                  {h.phone && <p className="text-xs text-[#9CA3AF] mt-0.5">{h.phone}</p>}
                  <p className="text-[11px] text-[#9CA3AF] mt-1">
                    /{h.slug} · joined {new Date(h.created_at).toLocaleDateString()}
                  </p>
                  <p className="text-[11px] text-[#6B7280] mt-1">
                    Updated {relativeTime(lastAdminUpdate(h))}
                  </p>
                </div>
                <Link
                  href={`/menu/${h.slug}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-shrink-0 text-[#F97316] text-xs font-medium flex items-center gap-1 hover:underline"
                >
                  Menu <ExternalLink size={12} />
                </Link>
              </div>
            </div>
          ))}

          {hotels.length === 0 && <p className="text-sm text-[#9CA3AF] text-center py-12">No hotels yet.</p>}
        </div>
      </div>
    </div>
  );
}
