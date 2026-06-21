import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import StatusClient from "./status-client";

export const metadata = { title: "System Status — MenuQR SuperAdmin" };

export default async function StatusPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/superadmin/login");

  const { data: isSuper } = await supabase.rpc("is_super_admin");
  if (!isSuper) redirect("/dashboard");

  return <StatusClient />;
}
