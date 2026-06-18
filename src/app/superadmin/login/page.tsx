"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck, Loader2, Eye, EyeOff, Mail, Lock } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export default function SuperAdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const supabase = createClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    if (signInError) {
      setError("Invalid email or password.");
      setLoading(false);
      return;
    }

    // Only super admins may proceed — otherwise sign back out immediately.
    const { data: isSuper } = await supabase.rpc("is_super_admin");
    if (!isSuper) {
      await supabase.auth.signOut();
      setError("This account does not have super-admin access.");
      setLoading(false);
      return;
    }

    router.push("/superadmin");
    router.refresh();
  }

  return (
    <div className="min-h-screen bg-[#0F1115] flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-[#F97316] flex items-center justify-center mb-3">
            <ShieldCheck size={26} className="text-white" />
          </div>
          <h1 className="text-white text-2xl font-semibold" style={{ fontFamily: "var(--font-display)" }}>
            Super Admin
          </h1>
          <p className="text-white/50 text-sm mt-1">Platform control panel</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="relative">
            <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/40" />
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email"
              autoComplete="email"
              required
              className="w-full bg-white/10 border border-white/20 rounded-2xl pl-10 pr-4 py-3 text-sm text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-[#F97316] focus:border-transparent"
            />
          </div>

          <div className="relative">
            <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/40" />
            <input
              type={showPw ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              autoComplete="current-password"
              required
              className="w-full bg-white/10 border border-white/20 rounded-2xl pl-10 pr-10 py-3 text-sm text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-[#F97316] focus:border-transparent"
            />
            <button
              type="button"
              onClick={() => setShowPw((s) => !s)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/70 min-h-0 min-w-0 p-1"
              aria-label={showPw ? "Hide password" : "Show password"}
            >
              {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>

          {error && <p className="text-[#FCA5A5] text-sm">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full inline-flex items-center justify-center gap-2 bg-[#F97316] hover:bg-[#EA6C0A] text-white font-semibold text-sm rounded-2xl py-3.5 disabled:opacity-50 active:scale-[0.98] transition-all"
          >
            {loading ? (
              <>
                <Loader2 size={16} className="animate-spin" /> Signing in…
              </>
            ) : (
              "Sign in"
            )}
          </button>
        </form>

        <p className="text-center text-white/30 text-xs mt-6">Authorized personnel only.</p>
      </div>
    </div>
  );
}
