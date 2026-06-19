import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { StaffManager } from "./staff-manager";
import type { Hotel, Staff, StaffTableAssignment, TableQR } from "@/types/database";

export default async function StaffPage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: hotel } = await supabase
    .from("hotels")
    .select("id,name,slug")
    .eq("owner_id", user.id)
    .single();

  if (!hotel) redirect("/login");

  const [staffRes, tablesRes, assignRes] = await Promise.all([
    supabase.from("staff").select("*").eq("hotel_id", hotel.id).order("created_at"),
    supabase.from("tables").select("*").eq("hotel_id", hotel.id).order("created_at"),
    supabase.from("staff_table_assignments").select("*").eq("hotel_id", hotel.id),
  ]);

  return (
    <StaffManager
      hotel={hotel as Pick<Hotel, "id" | "name" | "slug">}
      initialStaff={(staffRes.data as Staff[]) ?? []}
      tables={(tablesRes.data as TableQR[]) ?? []}
      initialAssignments={(assignRes.data as StaffTableAssignment[]) ?? []}
    />
  );
}
