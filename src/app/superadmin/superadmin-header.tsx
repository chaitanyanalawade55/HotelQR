"use client";
import { useRouter } from "next/navigation";
import { ShieldCheck, LogOut } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";

export function SuperAdminHeader() {
  const router = useRouter();

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    toast.success("Signed out");
    router.push("/superadmin/login");
    router.refresh();
  }

  return (
    <header className="bg-[#1C1C2E] sticky top-0 z-20">
      <div className="max-w-5xl mx-auto px-4 md:px-8 h-14 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShieldCheck size={18} className="text-[#F97316]" />
          <span className="text-white font-semibold">Super Admin</span>
        </div>
        <button
          onClick={handleLogout}
          className="flex items-center gap-1.5 text-sm text-white/70 hover:text-white min-h-0 min-w-0"
        >
          <LogOut size={15} /> Sign out
        </button>
      </div>
    </header>
  );
}
