import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PublicMenu } from "./public-menu";
import type { Hotel, HotelSettings, Category, MenuItem } from "@/types/database";

interface PageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ table?: string }>;
}

export default async function PublicMenuPage({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const { table } = await searchParams;
  const supabase = await createClient();

  // Support table-specific slugs like "hotel-slug-t5-1234"
  const baseSlug = slug.includes("-t") ? slug.split("-t")[0] : slug;

  const { data: hotel } = await supabase
    .from("hotels")
    .select("*")
    .eq("slug", baseSlug)
    .single();

  if (!hotel) notFound();

  const { data: settings } = await supabase
    .from("hotel_settings")
    .select("*")
    .eq("hotel_id", hotel.id)
    .single();

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
    <PublicMenu
      hotel={hotel as Hotel}
      settings={settings as HotelSettings | null}
      categories={(categories as Category[]) ?? []}
      items={(items as MenuItem[]) ?? []}
      tableParam={table ?? null}
      tableSlug={slug}
    />
  );
}
