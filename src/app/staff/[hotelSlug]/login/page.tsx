"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Phone, Lock, Eye, EyeOff, UtensilsCrossed } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { createClient } from "@/lib/supabase/client";
import { getStaffToken, setStaffToken, staffMe } from "@/lib/staff/session";

export default function StaffLoginPage() {
  const router = useRouter();
  const params = useParams<{ hotelSlug: string }>();
  const slug = params.hotelSlug;
  const supabase = createClient();

  const [hotel, setHotel] = useState<{ id: string; name: string } | null>(null);
  const [resolving, setResolving] = useState(true);
  const [mobile, setMobile] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Resolve the hotel from the slug + bounce straight in if already signed in.
  useEffect(() => {
    let active = true;
    (async () => {
      const { data } = await supabase
        .from("hotels")
        .select("id,name")
        .eq("slug", slug)
        .maybeSingle();
      if (!active) return;
      setHotel((data as { id: string; name: string } | null) ?? null);
      setResolving(false);

      const token = getStaffToken(slug);
      if (token && (await staffMe(token))) router.replace(`/staff/${slug}`);
    })();
    return () => { active = false; };
  }, [slug, supabase, router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!hotel) return;
    setError("");
    setLoading(true);
    const { data, error: rpcError } = await supabase.rpc("staff_login", {
      p_hotel_id: hotel.id,
      p_mobile: mobile.trim(),
      p_password: password,
    });
    setLoading(false);
    if (rpcError || !data) {
      const msg = /disabled/i.test(rpcError?.message ?? "")
        ? "Your account has been disabled. Contact your manager."
        : "Invalid mobile number or password";
      setError(msg);
      return;
    }
    const { token } = data as { token: string };
    setStaffToken(slug, token);
    router.replace(`/staff/${slug}`);
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "#1C1C2E" }}>
      <div className="p-6">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-[#F97316] flex items-center justify-center">
            <UtensilsCrossed size={16} className="text-white" />
          </div>
          <span className="text-white text-xl font-semibold" style={{ fontFamily: "var(--font-display)" }}>
            Staff Portal
          </span>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center px-5">
        <form onSubmit={handleSubmit} className="w-full max-w-sm">
          {resolving ? (
            <p className="text-[#9CA3AF] text-sm text-center">Loading…</p>
          ) : !hotel ? (
            <div className="text-center">
              <h1 className="text-xl font-bold text-white mb-2">Restaurant not found</h1>
              <p className="text-sm text-[#9CA3AF]">Check the login link your manager shared with you.</p>
            </div>
          ) : (
            <>
              <h1 className="text-2xl font-bold text-white mb-1">{hotel.name}</h1>
              <p className="text-sm text-[#9CA3AF] mb-8">Sign in to your staff account.</p>

              <div className="flex flex-col gap-4">
                <div className="w-full flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-[#9CA3AF]">Mobile number</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9CA3AF] flex items-center">
                      <Phone size={16} />
                    </span>
                    <input
                      type="tel"
                      inputMode="numeric"
                      placeholder="Your mobile number"
                      value={mobile}
                      onChange={(e) => setMobile(e.target.value)}
                      required
                      disabled={loading}
                      className="w-full bg-white/10 border border-white/20 rounded-2xl px-4 py-3 pl-10 text-sm text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-[#F97316] focus:border-transparent transition-all duration-150 disabled:opacity-60"
                    />
                  </div>
                </div>

                <div className="w-full flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-[#9CA3AF]">Password</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9CA3AF] flex items-center">
                      <Lock size={16} />
                    </span>
                    <input
                      type={showPassword ? "text" : "password"}
                      placeholder="Your password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      disabled={loading}
                      className="w-full bg-white/10 border border-white/20 rounded-2xl px-4 py-3 pl-10 pr-10 text-sm text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-[#F97316] focus:border-transparent transition-all duration-150 disabled:opacity-60"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9CA3AF] hover:text-white min-h-0 min-w-0 p-1"
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  {error && <p className="text-xs text-[#EF4444] mt-1">{error}</p>}
                </div>

                <Button type="submit" variant="primary" size="lg" fullWidth loading={loading} className="mt-2">
                  Log in
                </Button>
              </div>
            </>
          )}
        </form>
      </div>
    </div>
  );
}
