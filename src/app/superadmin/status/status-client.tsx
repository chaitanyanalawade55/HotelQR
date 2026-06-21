"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  Activity,
  Database,
  Shield,
  HardDrive,
  Settings2,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Clock,
  GitCommit,
  Globe,
  ArrowLeft,
  Wifi,
  WifiOff,
} from "lucide-react";

type Check = { ok: boolean; latencyMs: number; detail?: string };

type HealthData = {
  status: "healthy" | "degraded";
  timestamp: string;
  totalLatencyMs: number;
  version: string;
  buildTime: string;
  region: string;
  checks: Record<string, Check>;
};

const CHECK_META: Record<string, { label: string; icon: typeof Database; desc: string }> = {
  supabase: { label: "Database", icon: Database, desc: "Supabase Postgres connectivity" },
  auth: { label: "Auth Service", icon: Shield, desc: "Supabase Auth endpoint" },
  storage: { label: "File Storage", icon: HardDrive, desc: "Supabase Storage buckets" },
  env: { label: "Environment", icon: Settings2, desc: "Required environment variables" },
};

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString("en-IN", {
      timeZone: "Asia/Kolkata",
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  } catch {
    return iso;
  }
}

function StatusDot({ ok }: { ok: boolean }) {
  return (
    <span
      className={[
        "inline-block w-2.5 h-2.5 rounded-full flex-shrink-0",
        ok ? "bg-[#10B981] shadow-[0_0_6px_#10B981]" : "bg-[#EF4444] shadow-[0_0_6px_#EF4444]",
      ].join(" ")}
    />
  );
}

export default function StatusClient() {
  const [data, setData] = useState<HealthData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);

  const fetchHealth = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/health", { cache: "no-store" });
      const json = await res.json();
      setData(json);
      setLastChecked(new Date());
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHealth();
  }, [fetchHealth]);

  // Auto-refresh every 30s
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(fetchHealth, 30_000);
    return () => clearInterval(interval);
  }, [autoRefresh, fetchHealth]);

  const isHealthy = data?.status === "healthy";
  const checksArr = data ? Object.entries(data.checks) : [];

  return (
    <div className="max-w-3xl mx-auto px-4 md:px-8 py-6">
      {/* Back link */}
      <Link
        href="/superadmin"
        className="inline-flex items-center gap-1.5 text-sm text-[#6B7280] hover:text-[#0F0E17] mb-5"
      >
        <ArrowLeft size={14} /> Back to Admin
      </Link>

      {/* Main status banner */}
      <div
        className={[
          "rounded-3xl p-6 mb-6 border",
          isHealthy
            ? "bg-gradient-to-br from-[#ECFDF5] to-[#D1FAE5] border-[#A7F3D0]"
            : data
            ? "bg-gradient-to-br from-[#FEF2F2] to-[#FECACA] border-[#FCA5A5]"
            : "bg-white border-[#E5E7EB]",
        ].join(" ")}
      >
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            {loading ? (
              <RefreshCw size={28} className="text-[#6B7280] animate-spin" />
            ) : isHealthy ? (
              <CheckCircle2 size={28} className="text-[#047857]" />
            ) : (
              <XCircle size={28} className="text-[#B91C1C]" />
            )}
            <div>
              <h1 className="text-xl font-bold text-[#0F0E17]">
                {loading ? "Checking..." : isHealthy ? "All Systems Operational" : "System Degraded"}
              </h1>
              {lastChecked && (
                <p className="text-xs text-[#6B7280] mt-0.5">
                  Last checked: {formatTime(lastChecked.toISOString())}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setAutoRefresh(!autoRefresh)}
              title={autoRefresh ? "Auto-refresh ON (30s)" : "Auto-refresh OFF"}
              className={[
                "p-2 rounded-xl transition-all",
                autoRefresh ? "text-[#047857] bg-[#ECFDF5]" : "text-[#9CA3AF] bg-[#F3F4F6]",
              ].join(" ")}
            >
              {autoRefresh ? <Wifi size={16} /> : <WifiOff size={16} />}
            </button>
            <button
              onClick={fetchHealth}
              disabled={loading}
              className="p-2 rounded-xl bg-white border border-[#E5E7EB] text-[#374151] hover:bg-[#F9FAFB] transition-all disabled:opacity-50"
              title="Refresh now"
            >
              <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
            </button>
          </div>
        </div>

        {error && (
          <div className="bg-[#FEF2F2] border border-[#FCA5A5] rounded-2xl p-3 mt-3">
            <p className="text-sm text-[#B91C1C]">Failed to reach health endpoint: {error}</p>
          </div>
        )}

        {data && (
          <div className="flex flex-wrap gap-x-6 gap-y-1 mt-2 text-xs text-[#6B7280]">
            <span className="flex items-center gap-1">
              <Clock size={12} /> Response: {data.totalLatencyMs}ms
            </span>
            <span className="flex items-center gap-1">
              <Globe size={12} /> Region: {data.region}
            </span>
            <span className="flex items-center gap-1">
              <GitCommit size={12} /> Version: <code className="bg-white/50 px-1 rounded">{data.version}</code>
            </span>
          </div>
        )}
      </div>

      {/* Individual checks */}
      <h2 className="text-sm font-semibold text-[#0F0E17] mb-3 flex items-center gap-2">
        <Activity size={15} /> Service Health
      </h2>
      <div className="space-y-3 mb-8">
        {checksArr.map(([key, check]) => {
          const meta = CHECK_META[key] || { label: key, icon: Activity, desc: "" };
          const Icon = meta.icon;
          return (
            <div
              key={key}
              className="bg-white border border-[#E5E7EB] rounded-2xl p-4 flex items-center gap-4 hover:shadow-sm transition-shadow"
            >
              <div
                className={[
                  "w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0",
                  check.ok ? "bg-[#ECFDF5]" : "bg-[#FEF2F2]",
                ].join(" ")}
              >
                <Icon size={18} className={check.ok ? "text-[#047857]" : "text-[#B91C1C]"} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-[#0F0E17]">{meta.label}</p>
                  <StatusDot ok={check.ok} />
                </div>
                <p className="text-xs text-[#6B7280] mt-0.5">{meta.desc}</p>
                {check.detail && (
                  <p className="text-xs text-[#9CA3AF] mt-0.5 truncate">{check.detail}</p>
                )}
              </div>
              <div className="text-right flex-shrink-0">
                <p className={["text-lg font-bold", check.ok ? "text-[#047857]" : "text-[#B91C1C]"].join(" ")}>
                  {check.ok ? "UP" : "DOWN"}
                </p>
                {check.latencyMs > 0 && (
                  <p className="text-[10px] text-[#9CA3AF]">{check.latencyMs}ms</p>
                )}
              </div>
            </div>
          );
        })}

        {checksArr.length === 0 && !loading && (
          <p className="text-sm text-[#9CA3AF] text-center py-8">No health data available.</p>
        )}
      </div>

      {/* Build info */}
      {data && (
        <>
          <h2 className="text-sm font-semibold text-[#0F0E17] mb-3 flex items-center gap-2">
            <GitCommit size={15} /> Deployment Info
          </h2>
          <div className="bg-[#1C1C2E] rounded-2xl p-5 text-white">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-[10px] uppercase tracking-widest text-[#6B7280] mb-1">Version</p>
                <p className="font-mono text-sm">{data.version}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-widest text-[#6B7280] mb-1">Region</p>
                <p className="text-sm">{data.region}</p>
              </div>
              <div className="col-span-2">
                <p className="text-[10px] uppercase tracking-widest text-[#6B7280] mb-1">Build Time</p>
                <p className="text-sm">{data.buildTime ? formatTime(data.buildTime) : "—"}</p>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Footer */}
      <p className="text-center text-[10px] text-[#9CA3AF] mt-8">
        Auto-refreshes every 30s · Superadmin access only
      </p>
    </div>
  );
}
