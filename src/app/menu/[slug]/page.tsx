import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createStaticClient } from "@/lib/supabase/static";
import { PublicMenu } from "./public-menu";
import type { Hotel, HotelSettings, Category, MenuItem } from "@/types/database";

interface PageProps {
  params: Promise<{ slug: string }>;
}

// Columns that always exist (badge is appended separately so a missing-column
// error before the migration doesn't take down the whole menu).
const ITEM_COLS = "id,category_id,name,description,price,image_url,food_type,is_available,sort_order";

// ISR — page is pre-rendered HTML, regenerated at most once every 60s.
export const dynamic = "force-static";
export const revalidate = 60;

function toBaseSlug(slug: string) {
  return slug.includes("-t") ? slug.split("-t")[0] : slug;
}

// Pre-build every hotel's menu (and per-table variants) at deploy time so a
// QR scan lands on cached HTML with zero server wait.
export async function generateStaticParams() {
  try {
    const supabase = createStaticClient();
    const [{ data: hotels }, { data: tables }] = await Promise.all([
      supabase.from("hotels").select("slug"),
      supabase.from("tables").select("qr_slug"),
    ]);
    const slugs = [
      ...(hotels ?? []).map((h) => h.slug as string),
      ...(tables ?? []).map((t) => t.qr_slug as string).filter(Boolean),
    ];
    return slugs.map((slug) => ({ slug }));
  } catch {
    // No DB at build time → generate pages on-demand instead.
    return [];
  }
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const supabase = createStaticClient();
  const { data: hotel } = await supabase
    .from("hotels")
    .select("name,address")
    .eq("slug", toBaseSlug(slug))
    .single();

  if (!hotel) return { title: "Menu not found" };

  const title = `${hotel.name} — Digital Menu`;
  return {
    title,
    description: `View the full menu for ${hotel.name}${hotel.address ? ` at ${hotel.address}` : ""}`,
    openGraph: { title, description: "Scan to view our menu", type: "website" },
  };
}

export default async function PublicMenuPage({ params }: PageProps) {
  const { slug } = await params;
  const supabase = createStaticClient();

  const { data: hotel } = await supabase
    .from("hotels")
    .select("id,name,slug,address")
    .eq("slug", toBaseSlug(slug))
    .single();

  if (!hotel) notFound();

  // Fetch the three datasets in parallel; select only the columns we render.
  const [categoriesRes, itemsRes, settingsRes] = await Promise.all([
    supabase
      .from("categories")
      .select("id,name,sort_order")
      .eq("hotel_id", hotel.id)
      .eq("is_active", true)
      .order("sort_order"),
    supabase
      .from("menu_items")
      .select(`${ITEM_COLS},badge,is_special`)
      .eq("hotel_id", hotel.id)
      .eq("is_available", true)
      .order("sort_order"),
    supabase
      .from("hotel_settings")
      .select("logo_url,theme_color,currency,order_cancel_minutes")
      .eq("hotel_id", hotel.id)
      .single(),
  ]);

  // Gracefully degrade if optional columns haven't been migrated yet — the menu
  // still renders, just without badges / specials / a custom cancel window.
  let items: unknown = itemsRes.data;
  if (itemsRes.error) {
    const retry = await supabase
      .from("menu_items")
      .select(ITEM_COLS)
      .eq("hotel_id", hotel.id)
      .eq("is_available", true)
      .order("sort_order");
    items = retry.data;
  }

  let settings: unknown = settingsRes.data;
  if (settingsRes.error) {
    const retry = await supabase
      .from("hotel_settings")
      .select("logo_url,theme_color,currency")
      .eq("hotel_id", hotel.id)
      .single();
    settings = retry.data;
  }

  return (
    <PublicMenu
      hotel={hotel as unknown as Hotel}
      settings={(settings as unknown as HotelSettings) ?? null}
      categories={(categoriesRes.data as unknown as Category[]) ?? []}
      items={(items as unknown as MenuItem[]) ?? []}
      tableSlug={slug}
    />
  );
}
