import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * Public health-check endpoint. Returns system status + latencies.
 * Superadmin status page polls this every 30s for live monitoring.
 */
export async function GET() {
  const start = Date.now();
  const checks: Record<string, { ok: boolean; latencyMs: number; detail?: string }> = {};

  // 1. Supabase connectivity
  try {
    const t0 = Date.now();
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    const { count, error } = await supabase
      .from("hotels")
      .select("*", { count: "exact", head: true });
    checks.supabase = {
      ok: !error,
      latencyMs: Date.now() - t0,
      detail: error ? error.message : `${count ?? 0} hotels`,
    };
  } catch (e) {
    checks.supabase = { ok: false, latencyMs: Date.now() - start, detail: String(e) };
  }

  // 2. Supabase Auth
  try {
    const t0 = Date.now();
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    const { error } = await supabase.auth.getSession();
    checks.auth = {
      ok: !error,
      latencyMs: Date.now() - t0,
      detail: error ? error.message : "reachable",
    };
  } catch (e) {
    checks.auth = { ok: false, latencyMs: Date.now() - start, detail: String(e) };
  }

  // 3. Supabase Storage
  try {
    const t0 = Date.now();
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    const { error } = await supabase.storage.listBuckets();
    checks.storage = {
      ok: !error,
      latencyMs: Date.now() - t0,
      detail: error ? error.message : "reachable",
    };
  } catch (e) {
    checks.storage = { ok: false, latencyMs: Date.now() - start, detail: String(e) };
  }

  // 4. Environment variables
  const requiredEnvs = [
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    "NEXT_PUBLIC_SITE_URL",
  ];
  const missingEnvs = requiredEnvs.filter((k) => !process.env[k]);
  checks.env = {
    ok: missingEnvs.length === 0,
    latencyMs: 0,
    detail: missingEnvs.length === 0 ? `${requiredEnvs.length}/${requiredEnvs.length} set` : `missing: ${missingEnvs.join(", ")}`,
  };

  const allOk = Object.values(checks).every((c) => c.ok);

  return NextResponse.json(
    {
      status: allOk ? "healthy" : "degraded",
      timestamp: new Date().toISOString(),
      totalLatencyMs: Date.now() - start,
      version: process.env.NEXT_PUBLIC_BUILD_SHA || "dev",
      buildTime: process.env.NEXT_PUBLIC_BUILD_TIME || "",
      region: process.env.VERCEL_REGION || "local",
      checks,
    },
    {
      status: allOk ? 200 : 503,
      headers: { "Cache-Control": "no-store" },
    }
  );
}
