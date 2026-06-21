import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getAuthUser, getHotelByOwner } from "@/lib/supabase/cached-queries";
import { OrdersLive } from "./orders-live";
import type { HotelSettings, Order } from "@/types/database";

export default async function OrdersPage() {
  const user = await getAuthUser();
  if (!user) redirect("/login");

  const hotel = await getHotelByOwner(user.id);
  if (!hotel) redirect("/login");

  const supabase = await createClient();

  const [ordersRes, settingsRes] = await Promise.all([
    supabase
      .from("orders")
      .select("*")
      .eq("hotel_id", hotel.id)
      .order("created_at", { ascending: false })
      .limit(200),
    supabase.from("hotel_settings").select("*").eq("hotel_id", hotel.id).maybeSingle(),
  ]);

  return (
    <OrdersLive
      hotel={hotel}
      settings={(settingsRes.data as HotelSettings | null) ?? null}
      initialOrders={(ordersRes.data as Order[]) ?? []}
    />
  );
}
