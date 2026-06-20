"use client";
import { useEffect, useState } from "react";
import { GitCommit, Clock, UserCog } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { createClient } from "@/lib/supabase/client";
import { BUILD_SHA, BUILD_TIME } from "@/lib/build-info";
import { relativeTime, formatDateTime } from "@/lib/relativeTime";

/**
 * "System Status & Versioning" — a read-only metadata card for the hotel
 * manager. Fetches its own data on mount so it never blocks the API-key form
 * above it. The deployment version/time are global (one Vercel build serves
 * every hotel); only the "last admin update" is hotel-specific.
 */
export function SystemStatusCard() {
  const [lastUpdate, setLastUpdate] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();
    let active = true;
    (async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) return;
        const { data: hotel } = await supabase
          .from("hotels")
          .select("id,updated_at")
          .eq("owner_id", user.id)
          .single();
        if (!hotel) return;
        const { data: lastItem } = await supabase
          .from("menu_items")
          .select("updated_at")
          .eq("hotel_id", hotel.id)
          .order("updated_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        // Most recent of: hotel profile change, or any menu edit.
        const candidates = [hotel.updated_at, lastItem?.updated_at].filter(Boolean) as string[];
        const newest = candidates.sort().at(-1) ?? null;
        if (active) setLastUpdate(newest);
      } catch {
        // Read-only telemetry — silently degrade.
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  return (
    <Card padding="lg">
      <p className="text-sm font-semibold text-[#0F0E17] mb-3">System Status &amp; Versioning</p>
      <div className="space-y-2.5">
        <Row
          icon={<UserCog size={14} className="text-[#6B7280]" />}
          label="Your Last Admin Update"
          value={loading ? "…" : relativeTime(lastUpdate)}
        />
        <Row
          icon={<GitCommit size={14} className="text-[#6B7280]" />}
          label="App Deployment Version"
          value={
            <span className="font-mono text-[11px] bg-[#F3F4F6] text-[#374151] px-2 py-0.5 rounded-md">
              {BUILD_SHA}
            </span>
          }
        />
        <Row
          icon={<Clock size={14} className="text-[#6B7280]" />}
          label="System Last Synced"
          value={formatDateTime(BUILD_TIME)}
        />
      </div>
    </Card>
  );
}

function Row({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="flex items-center gap-2 text-xs text-[#6B7280]">
        {icon}
        {label}
      </span>
      <span className="text-xs font-medium text-[#0F0E17] text-right">{value}</span>
    </div>
  );
}
