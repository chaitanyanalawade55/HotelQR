import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { OrdersLive } from "./orders-live";
import type { Order } from "@/types/database";

export default async function OrdersPage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: hotel } = await supabase
    .from("hotels")
    .select("id")
    .eq("owner_id", user.id)
    .single();

  if (!hotel) redirect("/login");

  const { data: orders } = await supabase
    .from("orders")
    .select("*")
    .eq("hotel_id", hotel.id)
    .order("created_at", { ascending: false })
    .limit(50);

  return (
    <OrdersLive
      hotelId={hotel.id}
      initialOrders={(orders as Order[]) ?? []}
    />
  );
}
