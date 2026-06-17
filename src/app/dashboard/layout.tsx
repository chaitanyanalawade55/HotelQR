import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { DashboardShell } from "./shell";
import type { Hotel } from "@/types/database";

// Only select the columns the shell actually uses — not SELECT *
const HOTEL_COLS = "id,name,slug,owner_id,status,address,phone,owner_email";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: hotel } = await supabase
    .from("hotels")
    .select(HOTEL_COLS)
    .eq("owner_id", user.id)
    .single();

  if (!hotel) {
    redirect("/login");
  }

  return <DashboardShell hotel={hotel as Hotel}>{children}</DashboardShell>;
}
