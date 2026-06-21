import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getAuthUser, getHotelByOwner } from "@/lib/supabase/cached-queries";
import { QRManager } from "./qr-manager";
import type { Hotel, HotelSettings, TableQR } from "@/types/database";

export default async function QRPage() {
  const user = await getAuthUser();
  if (!user) redirect("/login");

  const hotel = await getHotelByOwner(user.id);
  if (!hotel) redirect("/login");

  const supabase = await createClient();

  const { data: settings } = await supabase
    .from("hotel_settings")
    .select("*")
    .eq("hotel_id", hotel.id)
    .single();

  const { data: tables } = await supabase
    .from("tables")
    .select("*")
    .eq("hotel_id", hotel.id)
    .order("created_at");

  return (
    <QRManager
      hotel={hotel as Hotel}
      settings={settings as HotelSettings | null}
      initialTables={(tables as TableQR[]) ?? []}
    />
  );
}
