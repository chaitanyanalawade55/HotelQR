import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { OrdersLive } from "./orders-live";
import type { HotelSettings, Order } from "@/types/database";

export default async function OrdersPage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: hotel } = await supabase
    .from("hotels")
    .select("id,name,address,phone")
    .eq("owner_id", user.id)
    .single();

  if (!hotel) redirect("/login");

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
