/* eslint-disable */
// ============================================================================
// seed-demo.cjs — creates a fully-populated demo hotel account.
//
//   node scripts/seed-demo.cjs
//
// Signs up (or signs in) the demo owner, creates the hotel + settings,
// categories, ~35 real menu items (names, descriptions, prices, veg/non-veg,
// badges, specials) with real food photos uploaded to Supabase storage, and a
// few QR tables. Idempotent — safe to re-run (it wipes the hotel's menu first).
// ============================================================================

const { createClient } = require("@supabase/supabase-js");

const SUPABASE_URL = "https://chrzzzworkzppcezcuwl.supabase.co";
const ANON = "sb_publishable_HrbbxV-lrXf1A4QfSgsETQ_Ncbe4BOZ";

const EMAIL = "owner@spicegarden.in";
const PASSWORD = "SpiceGarden@2026";
const HOTEL_NAME = "Spice Garden Multicuisine Restaurant";
const HOTEL_SLUG = "spice-garden";
const HOTEL_ADDRESS = "Shop 12, MG Road, Camp, Pune, Maharashtra 411001";
const HOTEL_PHONE = "9028001234";
const THEME = "#D14728";

const ws = require("ws");
const supabase = createClient(SUPABASE_URL, ANON, {
  auth: { persistSession: false },
  realtime: { transport: ws },
});

// ── helpers ────────────────────────────────────────────────────────────────
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const uuid = () => require("crypto").randomUUID();

async function mealdb(path) {
  const r = await fetch(`https://www.themealdb.com/api/json/v1/1/${path}`);
  const j = await r.json();
  return j.meals || [];
}

const NONVEG = /chicken|lamb|mutton|beef|pork|goat|fish|prawn|shrimp|crab|meat|bacon|ham|duck|turkey|salmon|tuna|seafood|kebab|keema/i;
const EGG = /\begg|omelet/i;
function foodType(name, catKey) {
  if (EGG.test(name)) return "egg";
  if (NONVEG.test(name)) return "non_veg";
  if (["chicken", "seafood", "lamb"].includes(catKey)) return "non_veg";
  return "veg";
}

// Appetising menu copy per section (rotated) so descriptions read like a real
// menu rather than cooking steps.
const DESCS = {
  starters: [
    "Crispy, golden and tossed in our signature house spices — the perfect start to your meal.",
    "Char-grilled to perfection and served with a tangy mint chutney and onion rings.",
    "A street-style favourite, hand-battered and fried fresh to order.",
  ],
  chicken: [
    "Succulent pieces slow-cooked in a velvety tomato-onion gravy. Best with butter naan.",
    "Marinated overnight in yoghurt and spices, then finished in the tandoor.",
    "Rich, creamy and mildly spiced — a guest favourite served sizzling hot.",
  ],
  seafood: [
    "Fresh catch of the day, delicately spiced and pan-seared to lock in the flavour.",
    "Coastal-style preparation in a coconut and curry-leaf masala.",
    "Lightly battered and crisp-fried, served with house tartare.",
  ],
  vegetarian: [
    "Garden-fresh vegetables in a fragrant, lightly spiced gravy — pure comfort food.",
    "A wholesome classic simmered with aromatic spices and fresh cream.",
    "Slow-cooked the traditional way and finished with a touch of butter.",
  ],
  lamb: [
    "Tender, fall-apart pieces braised low and slow in a deep, spiced gravy.",
    "A royal preparation layered with saffron, fried onions and warm spices.",
    "Hearty and robust, simmered until the flavours melt together.",
  ],
  desserts: [
    "House-made and served warm — the sweetest way to end your meal.",
    "A timeless indulgence, rich, soft and lightly fragrant.",
    "Cool, creamy and just the right amount of sweet.",
  ],
};
function makeDesc(catKey, i) {
  const pool = DESCS[catKey] || DESCS.vegetarian;
  return pool[i % pool.length];
}

function priceFor(catKey, i, n) {
  const ranges = {
    starters: [180, 340],
    chicken: [280, 480],
    seafood: [360, 680],
    vegetarian: [200, 380],
    lamb: [340, 620],
    desserts: [120, 260],
  };
  const [min, max] = ranges[catKey] || [200, 400];
  const raw = min + ((max - min) * i) / Math.max(1, n - 1);
  return Math.round(raw / 10) * 10 - 1; // ₹...9 pricing
}

// ── menu plan ────────────────────────────────────────────────────────────────
const PLAN = [
  { name: "Starters", key: "starters", src: "filter.php?c=Starter", count: 6 },
  { name: "Chicken Specials", key: "chicken", src: "filter.php?c=Chicken", count: 7 },
  { name: "Seafood", key: "seafood", src: "filter.php?c=Seafood", count: 5 },
  { name: "Vegetarian Delights", key: "vegetarian", src: "filter.php?c=Vegetarian", count: 6 },
  { name: "Lamb & Mutton", key: "lamb", src: "filter.php?c=Lamb", count: 5 },
  { name: "Desserts", key: "desserts", src: "filter.php?c=Dessert", count: 6 },
];

// Curated beverages (no DB images — the menu renders these as clean text rows).
const BEVERAGES = [
  ["Masala Chai", 60, "Aromatic Indian tea brewed with ginger, cardamom and milk."],
  ["Sweet Lassi", 90, "Thick, chilled yoghurt drink — smooth and refreshing."],
  ["Mango Lassi", 120, "Creamy yoghurt blended with sweet Alphonso mango."],
  ["Fresh Lime Soda", 80, "Zesty lime with soda — sweet, salted or mixed."],
  ["Cold Coffee", 140, "Rich filter coffee blended with milk and ice cream."],
  ["Masala Buttermilk", 70, "Spiced churned buttermilk with curry leaves and cumin."],
];

const BADGES = ["Bestseller", "Chef's Special", "Must Try", "New", "Popular"];

async function ensureSession() {
  // Try sign in first (account may already exist from a previous run).
  let si = await supabase.auth.signInWithPassword({ email: EMAIL, password: PASSWORD });
  if (si.data?.session) return si.data.user;

  const su = await supabase.auth.signUp({ email: EMAIL, password: PASSWORD });
  if (su.data?.session) return su.data.user;
  if (su.error && !/already/i.test(su.error.message)) throw su.error;

  si = await supabase.auth.signInWithPassword({ email: EMAIL, password: PASSWORD });
  if (si.data?.session) return si.data.user;
  throw new Error("Could not establish a session: " + (si.error?.message || su.error?.message));
}

async function main() {
  console.log("→ authenticating", EMAIL);
  const user = await ensureSession();
  console.log("  ✓ user", user.id);

  // hotel ----------------------------------------------------------------
  let { data: hotel } = await supabase.from("hotels").select("*").eq("owner_id", user.id).maybeSingle();
  if (!hotel) {
    const ins = await supabase
      .from("hotels")
      .insert({
        owner_id: user.id,
        name: HOTEL_NAME,
        slug: HOTEL_SLUG,
        owner_email: EMAIL,
        phone: HOTEL_PHONE,
        address: HOTEL_ADDRESS,
        status: "active",
      })
      .select()
      .single();
    if (ins.error) throw ins.error;
    hotel = ins.data;
  }
  console.log("  ✓ hotel", hotel.slug, hotel.id);

  // settings -------------------------------------------------------------
  const settings = {
    hotel_id: hotel.id,
    theme_color: THEME,
    currency: "₹",
    logo_url: null,
    menu_layout: "modern",
    order_cancel_minutes: 5,
    gst_enabled: true,
    gst_percent: 5,
    gst_number: "27AABCS1234F1Z5",
  };
  let setRes = await supabase.from("hotel_settings").upsert(settings, { onConflict: "hotel_id" });
  if (setRes.error) {
    await supabase.from("hotel_settings").upsert(
      { hotel_id: hotel.id, theme_color: THEME, currency: "₹", logo_url: null, menu_layout: "modern" },
      { onConflict: "hotel_id" }
    );
  }
  console.log("  ✓ settings");

  // wipe existing menu (idempotent re-run) -------------------------------
  await supabase.from("menu_items").delete().eq("hotel_id", hotel.id);
  await supabase.from("categories").delete().eq("hotel_id", hotel.id);
  console.log("  ✓ cleared old menu");

  // categories -----------------------------------------------------------
  const catRows = PLAN.map((p, i) => ({ hotel_id: hotel.id, name: p.name, sort_order: i, is_active: true }));
  catRows.push({ hotel_id: hotel.id, name: "Beverages", sort_order: PLAN.length, is_active: true });
  const catIns = await supabase.from("categories").insert(catRows).select();
  if (catIns.error) throw catIns.error;
  const catByName = Object.fromEntries(catIns.data.map((c) => [c.name, c.id]));
  console.log("  ✓ categories", catIns.data.length);

  // items ----------------------------------------------------------------
  let total = 0;
  let specialBudget = 6;
  let missingExtras = false;
  let wantedSpecials = 0;
  let wantedBadges = 0;

  for (const sec of PLAN) {
    const pool = await mealdb(sec.src);
    const chosen = pool.slice(0, sec.count);
    let i = 0;
    for (const meal of chosen) {
      const id = uuid();
      const name = meal.strMeal;
      const price = priceFor(sec.key, i, chosen.length);
      const ftype = foodType(name, sec.key);

      // badge on the first two of each section + sprinkle
      let badge = null;
      if (i === 0) badge = "Bestseller";
      else if (i === 1) badge = BADGES[(total + 2) % BADGES.length];
      else if (i % 4 === 0) badge = "Must Try";

      // specials — the eye-catching ones (carousel)
      let is_special = false;
      if (specialBudget > 0 && (i === 0) && ["chicken", "seafood", "lamb", "desserts"].includes(sec.key)) {
        is_special = true;
        specialBudget--;
      } else if (specialBudget > 0 && sec.key === "starters" && i === 1) {
        is_special = true;
        specialBudget--;
      }

      // upload image
      let image_url = null;
      try {
        const imgRes = await fetch(meal.strMealThumb);
        const buf = Buffer.from(await imgRes.arrayBuffer());
        const path = `${hotel.id}/${id}.jpg`;
        const up = await supabase.storage.from("menu-images").upload(path, buf, {
          upsert: true,
          contentType: "image/jpeg",
        });
        if (!up.error) image_url = supabase.storage.from("menu-images").getPublicUrl(path).data.publicUrl;
        else console.log("    ! image upload failed for", name, up.error.message);
      } catch (e) {
        console.log("    ! image fetch failed for", name, e.message);
      }

      const row = {
        id,
        hotel_id: hotel.id,
        category_id: catByName[sec.name],
        name,
        description: makeDesc(sec.key, i),
        price,
        image_url,
        food_type: ftype,
        is_available: true,
        sort_order: i,
        badge,
        is_special,
      };
      let ins = await supabase.from("menu_items").insert(row);
      // Graceful degrade if badge/is_special columns aren't migrated on this DB.
      if (ins.error && (ins.error.code === "42703" || /badge|is_special/i.test(ins.error.message))) {
        const { badge: _b, is_special: _s, ...base } = row;
        ins = await supabase.from("menu_items").insert(base);
        if (!ins.error) missingExtras = true;
      }
      if (ins.error) {
        console.log("    ! item insert failed", name, ins.error.message);
      } else {
        total++;
        if (is_special) wantedSpecials++;
        if (badge) wantedBadges++;
        process.stdout.write(`    + ${name}${is_special ? " ★" : ""}\n`);
      }
      i++;
    }
  }

  // beverages (no image) --------------------------------------------------
  let bi = 0;
  for (const [name, price, desc] of BEVERAGES) {
    const row = {
      id: uuid(),
      hotel_id: hotel.id,
      category_id: catByName["Beverages"],
      name,
      description: desc,
      price,
      image_url: null,
      food_type: "veg",
      is_available: true,
      sort_order: bi,
      badge: bi === 0 ? "Bestseller" : null,
      is_special: false,
    };
    let ins = await supabase.from("menu_items").insert(row);
    if (ins.error && (ins.error.code === "42703" || /badge|is_special/i.test(ins.error.message))) {
      const { badge: _b, is_special: _s, ...base } = row;
      ins = await supabase.from("menu_items").insert(base);
    }
    if (!ins.error) {
      total++;
      bi++;
    }
  }
  console.log("  ✓ items inserted:", total);

  // tables / QR ----------------------------------------------------------
  const existingTables = await supabase.from("tables").select("id").eq("hotel_id", hotel.id);
  if (!existingTables.data || existingTables.data.length === 0) {
    const tableRows = [];
    for (let n = 1; n <= 6; n++) {
      const rand = Math.floor(1000 + Math.random() * 9000);
      tableRows.push({ hotel_id: hotel.id, table_number: String(n), qr_slug: `${hotel.slug}-t${n}-${rand}` });
    }
    const tRes = await supabase.from("tables").insert(tableRows).select();
    console.log("  ✓ tables:", tRes.data?.length ?? 0, tRes.error ? `(err: ${tRes.error.message})` : "");
  } else {
    console.log("  ✓ tables already exist:", existingTables.data.length);
  }

  console.log("\n========================================");
  console.log("DEMO ACCOUNT READY");
  console.log("  Login   :", `${SUPABASE_URL.includes("supabase") ? "" : ""}`.length ? "" : "");
  console.log("  Email   :", EMAIL);
  console.log("  Password:", PASSWORD);
  console.log("  Hotel   :", HOTEL_NAME);
  console.log("  Menu URL: /menu/" + hotel.slug);
  console.log("  Items   :", total);
  console.log("========================================");
  if (missingExtras) {
    console.log("\n⚠  This Supabase project is missing the badge/is_special columns,");
    console.log("   so 'Bestseller' badges and the Specials carousel are OFF.");
    console.log("   To enable them, run this once in the Supabase SQL editor:\n");
    console.log("   alter table menu_items add column if not exists badge text;");
    console.log("   alter table menu_items add column if not exists is_special boolean not null default false;");
    console.log(`\n   Then re-run: node scripts/seed-demo.cjs  (would set ${wantedSpecials} specials, ${wantedBadges} badges)`);
  }
}

main().catch((e) => {
  console.error("SEED FAILED:", e.message || e);
  process.exit(1);
});
