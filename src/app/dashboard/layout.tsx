import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getAuthUser, getHotelByOwner } from "@/lib/supabase/cached-queries";
import { DashboardShell } from "./shell";
import type { Hotel } from "@/types/database";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Both calls are memoised per-request — if dashboard/page.tsx calls them
  // too, they return cached results without hitting the DB again.
  const user = await getAuthUser();
  if (!user) redirect("/login");

  const hotel = await getHotelByOwner(user.id);
  if (!hotel) redirect("/login");

  // Super-admin flag for the nav link (graceful if migration 0008 isn't applied).
  const supabase = await createClient();
  const { data: isSuperAdmin } = await supabase.rpc("is_super_admin");

  return (
    <DashboardShell hotel={hotel as Hotel} isSuperAdmin={Boolean(isSuperAdmin)}>
      {children}
    </DashboardShell>
  );
}
