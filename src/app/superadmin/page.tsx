import Link from "next/link";
import { redirect } from "next/navigation";
import { ShieldCheck, ExternalLink, ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
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
  if (!user) redirect("/login");

  // RLS (0008) lets a super admin read every hotel.
  const { data } = await supabase
    .from("hotels")
    .select("id,name,slug,owner_email,phone,status,created_at")
    .order("created_at", { ascending: false });
  const hotels = (data as Hotel[]) ?? [];

  return (
    <div className="max-w-4xl mx-auto px-4 md:px-8 py-8">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <ShieldCheck size={20} className="text-[#F97316]" />
          <h1 className="text-xl font-bold text-[#0F0E17]">Super Admin</h1>
        </div>
        <Link href="/dashboard" className="text-sm text-[#6B7280] hover:text-[#0F0E17] flex items-center gap-1">
          <ArrowLeft size={14} /> Dashboard
        </Link>
      </div>
      <p className="text-sm text-[#6B7280] mb-6">
        {hotels.length} hotel{hotels.length !== 1 ? "s" : ""} across the platform.
      </p>

      <div className="space-y-3">
        {hotels.map((h) => (
          <div key={h.id} className="bg-white border border-[#E5E7EB] rounded-3xl p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-semibold text-[#0F0E17] truncate">{h.name}</p>
                  <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${statusStyle[h.status] ?? "bg-[#F3F4F6] text-[#6B7280]"}`}>
                    {h.status}
                  </span>
                </div>
                <p className="text-xs text-[#6B7280] mt-1 truncate">{h.owner_email}</p>
                {h.phone && <p className="text-xs text-[#9CA3AF] mt-0.5">{h.phone}</p>}
                <p className="text-[11px] text-[#9CA3AF] mt-1">
                  /{h.slug} · joined {new Date(h.created_at).toLocaleDateString()}
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

        {hotels.length === 0 && (
          <p className="text-sm text-[#9CA3AF] text-center py-12">No hotels yet.</p>
        )}
      </div>
    </div>
  );
}
