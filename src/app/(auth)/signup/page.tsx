"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Mail, Lock, Eye, EyeOff, UtensilsCrossed, Building2, Phone } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/Button";
import { createClient } from "@/lib/supabase/client";

function generateSlug(name: string) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .trim();
}

export default function SignupPage() {
  const router = useRouter();
  const [hotelName, setHotelName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  function validate() {
    const newErrors: Record<string, string> = {};
    if (!hotelName || hotelName.trim().length < 2)
      newErrors.hotelName = "Hotel name must be at least 2 characters";
    if (!email || !/^\S+@\S+\.\S+$/.test(email))
      newErrors.email = "Please enter a valid email";
    if (!password || password.length < 6)
      newErrors.password = "Password must be at least 6 characters";
    return newErrors;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const validationErrors = validate();
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }
    setErrors({});
    setLoading(true);

    const supabase = createClient();

    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
    });

    if (authError) {
      toast.error("Something went wrong. Please try again.");
      setLoading(false);
      return;
    }

    const userId = authData.user?.id;
    if (!userId) {
      toast.error("Something went wrong. Please try again.");
      setLoading(false);
      return;
    }

    let slug = generateSlug(hotelName);

    const { error: hotelError } = await supabase.from("hotels").insert({
      owner_id: userId,
      name: hotelName.trim(),
      slug,
      owner_email: email,
      phone: phone || null,
      status: "trial",
    });

    if (hotelError) {
      if (hotelError.code === "23505") {
        slug = `${slug}-${Math.floor(1000 + Math.random() * 9000)}`;
        const { error: retryError } = await supabase.from("hotels").insert({
          owner_id: userId,
          name: hotelName.trim(),
          slug,
          owner_email: email,
          phone: phone || null,
          status: "trial",
        });
        if (retryError) {
          toast.error("Something went wrong. Please try again.");
          setLoading(false);
          return;
        }
      } else {
        toast.error("Something went wrong. Please try again.");
        setLoading(false);
        return;
      }
    }

    toast.success("Account created! Welcome to MenuQR 🎉");
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "#1C1C2E" }}>
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

      <div className="flex-1 flex items-center justify-center px-5 py-8">
        <form onSubmit={handleSubmit} className="w-full max-w-sm">
          <h1 className="text-2xl font-bold text-white mb-1">Create your menu</h1>
          <p className="text-sm text-[#9CA3AF] mb-6">
            Get your digital menu live in 5 minutes.
          </p>

          <div className="flex flex-col gap-4">
            <DarkInput
              label="Hotel / Restaurant Name"
              type="text"
              placeholder="e.g. Spice Garden Restaurant"
              value={hotelName}
              onChange={(e) => setHotelName(e.target.value)}
              icon={<Building2 size={16} />}
              error={errors.hotelName}
              disabled={loading}
            />
            <DarkInput
              label="Email"
              type="email"
              placeholder="you@restaurant.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              icon={<Mail size={16} />}
              error={errors.email}
              disabled={loading}
            />
            <DarkInput
              label="Phone (optional)"
              type="tel"
              placeholder="9999999999"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              icon={<Phone size={16} />}
              disabled={loading}
            />
            <div className="w-full flex flex-col gap-1.5">
              <label className="text-sm font-medium text-[#9CA3AF]">Password</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9CA3AF] flex items-center">
                  <Lock size={16} />
                </span>
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="Min. 6 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
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
              {errors.password && (
                <p className="text-xs text-[#EF4444] mt-1">{errors.password}</p>
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
              Create free account
            </Button>
          </div>

          <p className="text-center text-sm text-[#6B7280] mt-6">
            Already have an account?{" "}
            <Link
              href="/login"
              className="text-[#F97316] font-medium hover:underline min-h-0 min-w-0"
            >
              Log in
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}

interface DarkInputProps {
  label: string;
  type?: string;
  placeholder?: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  icon?: React.ReactNode;
  error?: string;
  disabled?: boolean;
}

function DarkInput({ label, type = "text", placeholder, value, onChange, icon, error, disabled }: DarkInputProps) {
  return (
    <div className="w-full flex flex-col gap-1.5">
      <label className="text-sm font-medium text-[#9CA3AF]">{label}</label>
      <div className="relative">
        {icon && (
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9CA3AF] flex items-center">
            {icon}
          </span>
        )}
        <input
          type={type}
          placeholder={placeholder}
          value={value}
          onChange={onChange}
          disabled={disabled}
          className={[
            "w-full bg-white/10 border border-white/20 rounded-2xl px-4 py-3 text-sm text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-[#F97316] focus:border-transparent transition-all duration-150 disabled:opacity-60",
            icon ? "pl-10" : "",
            error ? "border-red-500" : "",
          ]
            .filter(Boolean)
            .join(" ")}
        />
      </div>
      {error && <p className="text-xs text-[#EF4444] mt-1">{error}</p>}
    </div>
  );
}
