import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getAuthUser, getHotelByOwner } from "@/lib/supabase/cached-queries";
import { MenuManager } from "./menu-manager";
import type { Category, MenuItem } from "@/types/database";

export default async function MenuPage() {
  const user = await getAuthUser();
  if (!user) redirect("/login");

  const hotel = await getHotelByOwner(user.id);
  if (!hotel) redirect("/login");

  const supabase = await createClient();

  const { data: categories } = await supabase
    .from("categories")
    .select("*")
    .eq("hotel_id", hotel.id)
    .eq("is_active", true)
    .order("sort_order");

  const { data: items } = await supabase
    .from("menu_items")
    .select("*")
    .eq("hotel_id", hotel.id)
    .order("sort_order");

  return (
    <MenuManager
      hotelId={hotel.id}
      initialCategories={(categories as Category[]) ?? []}
      initialItems={(items as MenuItem[]) ?? []}
    />
  );
}
