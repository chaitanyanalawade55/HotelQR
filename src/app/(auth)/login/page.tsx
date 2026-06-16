"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Mail, Lock, Eye, EyeOff, UtensilsCrossed } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/Button";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const supabase = createClient();
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password });

    if (authError) {
      setError("Invalid email or password");
      setLoading(false);
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ background: "#1C1C2E" }}
    >
      <div className="p-6">
        <div className="flex items-center gap-2.5">
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
      </div>

      <div className="flex-1 flex items-center justify-center px-5">
        <form onSubmit={handleSubmit} className="w-full max-w-sm">
          <h1 className="text-2xl font-bold text-white mb-1">Welcome back</h1>
          <p className="text-sm text-[#9CA3AF] mb-8">
            Log in to manage your digital menu.
          </p>

          <div className="flex flex-col gap-4">
            <div className="w-full flex flex-col gap-1.5">
              <label className="text-sm font-medium text-[#9CA3AF]">Email</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9CA3AF] flex items-center">
                  <Mail size={16} />
                </span>
                <input
                  type="email"
                  placeholder="you@restaurant.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
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
              {error && (
                <p className="text-xs text-[#EF4444] mt-1">{error}</p>
              )}
            </div>

            <Button
              type="submit"
              variant="primary"
              size="lg"
              fullWidth
              loading={loading}
              className="mt-2"
            >
              Log in
            </Button>
          </div>

          <p className="text-center text-sm text-[#6B7280] mt-6">
            Don&apos;t have an account?{" "}
            <Link
              href="/signup"
              className="text-[#F97316] font-medium hover:underline min-h-0 min-w-0"
            >
              Sign up free
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
