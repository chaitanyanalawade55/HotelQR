import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getAuthUser, getHotelByOwner } from "@/lib/supabase/cached-queries";
import { BrandingForm } from "./branding-form";
import type { Hotel, HotelSettings } from "@/types/database";

export default async function BrandingPage() {
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

  return (
    <BrandingForm
      hotel={hotel as Hotel}
      initialSettings={settings as HotelSettings | null}
    />
  );
}
