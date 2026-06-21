import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getAuthUser, getHotelByOwner } from "@/lib/supabase/cached-queries";
import { StaffManager } from "./staff-manager";
import type { Hotel, Staff, StaffTableAssignment, TableQR } from "@/types/database";

export default async function StaffPage() {
  const user = await getAuthUser();
  if (!user) redirect("/login");

  const hotel = await getHotelByOwner(user.id);
  if (!hotel) redirect("/login");

  const supabase = await createClient();

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
