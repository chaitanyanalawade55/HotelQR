import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// Gate: must be authenticated AND a super admin. A normal hotel owner or an
// anonymous visitor is redirected away. (is_super_admin() comes from 0008.)
export default async function SuperAdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: isSuper, error } = await supabase.rpc("is_super_admin");
  if (error || !isSuper) redirect("/dashboard");

  return <div className="min-h-screen bg-[#F3F4F6]">{children}</div>;
}
