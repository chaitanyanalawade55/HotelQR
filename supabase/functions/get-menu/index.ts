// Supabase Edge Function (Deno) — OPTIONAL.
//
// The Next.js app does NOT use this by default: /menu/[slug] is statically
// generated with ISR (revalidate=60) + parallel Supabase queries, which already
// serves cached HTML from the CDN. This function is provided for teams who want
// to fetch the whole menu payload from the edge node nearest the customer.
//
// Deploy:  supabase functions deploy get-menu
//
// This file is Deno, not Node — it is excluded from the Next.js tsconfig.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const slug = url.searchParams.get("slug");
  if (!slug) return new Response("Missing slug", { status: 400 });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const baseSlug = slug.includes("-t") ? slug.split("-t")[0] : slug;

  const { data: hotel } = await supabase
    .from("hotels")
    .select("id,name,slug,address")
    .eq("slug", baseSlug)
    .single();
  if (!hotel) return new Response("Not found", { status: 404 });

  const [{ data: settings }, { data: categories }, { data: items }] = await Promise.all([
    supabase.from("hotel_settings").select("logo_url,theme_color,currency").eq("hotel_id", hotel.id).single(),
    supabase.from("categories").select("id,name,sort_order").eq("hotel_id", hotel.id).eq("is_active", true).order("sort_order"),
    supabase
      .from("menu_items")
      .select("id,category_id,name,description,price,image_url,food_type,sort_order,badge")
      .eq("hotel_id", hotel.id)
      .eq("is_available", true)
      .order("sort_order"),
  ]);

  return new Response(JSON.stringify({ hotel, settings, categories, items }), {
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "public, max-age=30, stale-while-revalidate=300",
      "Access-Control-Allow-Origin": "*",
    },
  });
});
