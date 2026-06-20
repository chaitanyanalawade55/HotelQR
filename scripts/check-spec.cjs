/* eslint-disable */
const { createClient } = require("@supabase/supabase-js");
const ws = require("ws");
const sb = createClient(
  "https://chrzzzworkzppcezcuwl.supabase.co",
  "sb_publishable_HrbbxV-lrXf1A4QfSgsETQ_Ncbe4BOZ",
  { auth: { persistSession: false }, realtime: { transport: ws } }
);
(async () => {
  const { data: hotels, error: he } = await sb.from("hotels").select("id,name,slug");
  console.log("hotels err:", he?.message, "count:", hotels?.length);
  for (const h of hotels || []) {
    const { data: cats } = await sb
      .from("categories")
      .select("id,name,sort_order,is_active")
      .eq("hotel_id", h.id)
      .order("sort_order");
    const spec = (cats || []).find((c) => /special/i.test(c.name));
    let waterInfo = "NO SPECIALITY CATEGORY";
    if (spec) {
      const { data: items } = await sb
        .from("menu_items")
        .select("name,price,is_available")
        .eq("category_id", spec.id);
      waterInfo = JSON.stringify(items);
    }
    console.log(`\n[${h.slug}] ${h.name}`);
    console.log("  cats:", (cats || []).map((c) => `${c.name}(so=${c.sort_order},act=${c.is_active})`).join(" | "));
    console.log("  spec items:", waterInfo);
  }
  process.exit(0);
})();
