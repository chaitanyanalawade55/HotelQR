"use client";
import { useState, useRef, useMemo, useEffect } from "react";
import Image from "next/image";
import { Search, X, Plus, Bell, Star } from "lucide-react";
import { toast } from "sonner";
import { VegIndicator } from "@/components/ui/VegIndicator";
import { createClient } from "@/lib/supabase/client";
import type { Hotel, HotelSettings, Category, MenuItem } from "@/types/database";

// Tiny valid JPEG used as a blur-up placeholder for item images.
const BLUR_DATA_URL =
  "data:image/jpeg;base64,/9j/2wBDAAMCAgICAgMCAgIDAwMDBAYEBAQEBAgGBgUGCQgKCgkICQkKDA8MCgsOCwkJDRENDg8QEBEQCgwSExIQEw8QEBD/2wBDAQMDAwQDBAgEBAgQCwkLEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBD/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAf/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCdABmX/9k=";

// The public menu is intentionally a single mobile-width column (a QR scan is
// always a phone). On desktop it sits centered in a dark gutter like a device.
const FRAME = "max-w-[460px]";

interface CartItem {
  itemId: string;
  name: string;
  price: number;
  qty: number;
}

interface Props {
  hotel: Hotel;
  settings: HotelSettings | null;
  categories: Category[];
  items: MenuItem[];
  tableSlug: string;
}

type FoodFilter = "all" | "veg" | "non_veg";
type RatingAgg = Record<string, { sum: number; count: number }>;

// Derive the table number from a table-specific slug ("hotel-t5-1234" -> "5").
function tableNumberFromSlug(slug: string): string | null {
  const idx = slug.indexOf("-t");
  if (idx === -1) return null;
  const after = slug.slice(idx + 2).replace(/-\d{4}$/, "");
  return after || null;
}

export function PublicMenu({ hotel, settings, categories, items, tableSlug }: Props) {
  const themeColor = settings?.theme_color ?? "#F97316";
  const themeLight = `${themeColor}26`;
  const tableNumber = useMemo(() => tableNumberFromSlug(tableSlug), [tableSlug]);

  const [search, setSearch] = useState("");
  const [foodFilter, setFoodFilter] = useState<FoodFilter>("all");
  const [activeCatId, setActiveCatId] = useState<string | null>(categories[0]?.id ?? null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [ratings, setRatings] = useState<RatingAgg>({});
  const [ratingItem, setRatingItem] = useState<MenuItem | null>(null);
  const catTabRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const supabase = createClient();

  const logoInitial = hotel.name.charAt(0).toUpperCase();

  // All filtering runs in memory — zero network calls after the initial load.
  const filteredByCat = useMemo(() => {
    const q = search.trim().toLowerCase();
    return categories.map((cat) => {
      const catItems = items.filter((item) => {
        if (item.category_id !== cat.id) return false;
        if (q && !item.name.toLowerCase().includes(q) && !(item.description ?? "").toLowerCase().includes(q)) return false;
        if (foodFilter === "veg" && item.food_type !== "veg" && item.food_type !== "vegan") return false;
        if (foodFilter === "non_veg" && item.food_type !== "non_veg") return false;
        return true;
      });
      return { cat, items: catItems };
    });
  }, [items, categories, search, foodFilter]);

  const hasResults = useMemo(() => filteredByCat.some((g) => g.items.length > 0), [filteredByCat]);

  // Load rating aggregates after mount (non-blocking — menu renders instantly).
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const { data } = await supabase.from("item_ratings").select("item_id,rating").eq("hotel_id", hotel.id);
        if (!active || !data) return;
        const agg: RatingAgg = {};
        for (const r of data as { item_id: string; rating: number }[]) {
          const a = agg[r.item_id] ?? { sum: 0, count: 0 };
          a.sum += r.rating;
          a.count += 1;
          agg[r.item_id] = a;
        }
        setRatings(agg);
      } catch {
        // ratings table may not exist yet — ignore
      }
    })();
    return () => {
      active = false;
    };
  }, [hotel.id, supabase]);

  function selectCat(catId: string) {
    setActiveCatId(catId);
    catTabRefs.current[catId]?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  }

  function addToCart(item: MenuItem) {
    setCart((prev) => {
      const existing = prev.find((c) => c.itemId === item.id);
      if (existing) return prev.map((c) => (c.itemId === item.id ? { ...c, qty: c.qty + 1 } : c));
      return [...prev, { itemId: item.id, name: item.name, price: item.price, qty: 1 }];
    });
  }

  const cartTotal = cart.reduce((sum, c) => sum + c.price * c.qty, 0);
  const cartCount = cart.reduce((sum, c) => sum + c.qty, 0);

  async function callWaiter() {
    const COOLDOWN_KEY = `waiter-${hotel.id}-${tableSlug}`;
    const last = localStorage.getItem(COOLDOWN_KEY);
    if (last && Date.now() - parseInt(last) < 5 * 60 * 1000) {
      toast("Already called — your waiter is on their way");
      return;
    }
    toast("Calling your waiter...");
    await supabase.from("waiter_calls").insert({
      hotel_id: hotel.id,
      table_slug: tableSlug,
      table_number: tableNumber,
      status: "pending",
    });
    localStorage.setItem(COOLDOWN_KEY, Date.now().toString());
  }

  async function submitRating(item: MenuItem, value: number) {
    const key = `rated-${item.id}`;
    if (sessionStorage.getItem(key)) {
      toast("You already rated this dish");
      setRatingItem(null);
      return;
    }
    setRatings((prev) => {
      const a = prev[item.id] ?? { sum: 0, count: 0 };
      return { ...prev, [item.id]: { sum: a.sum + value, count: a.count + 1 } };
    });
    sessionStorage.setItem(key, String(value));
    setRatingItem(null);
    toast.success("Thanks for rating! 🙏");
    try {
      await supabase.from("item_ratings").insert({
        item_id: item.id,
        hotel_id: hotel.id,
        rating: value,
        table_slug: tableSlug,
      });
    } catch {
      // ignore — rating already reflected locally
    }
  }

  return (
    <div className="min-h-screen w-full bg-[#15161F] flex justify-center">
      {/* Mobile-width menu column */}
      <div
        className={`relative w-full ${FRAME} min-h-screen bg-[#FFFAF3] md:shadow-2xl`}
        style={{ "--theme": themeColor, "--theme-light": themeLight } as React.CSSProperties}
      >
        {/* Header */}
        <div className="px-5 pt-6 pb-5" style={{ backgroundColor: themeColor }}>
          <div className="flex items-center gap-3">
            <div className="w-[52px] h-[52px] rounded-full border-2 border-white/30 overflow-hidden flex items-center justify-center flex-shrink-0 bg-white/20 relative">
              {settings?.logo_url ? (
                <Image src={settings.logo_url} alt="" width={52} height={52} priority className="w-full h-full object-cover" />
              ) : (
                <span className="text-white text-xl font-semibold" style={{ fontFamily: "var(--font-display)" }}>
                  {logoInitial}
                </span>
              )}
            </div>
            <div>
              <h1 className="text-white text-xl font-semibold" style={{ fontFamily: "var(--font-display)" }}>
                {hotel.name}
              </h1>
              {hotel.address && <p className="text-white/70 text-xs mt-0.5">{hotel.address}</p>}
              {tableNumber && (
                <span className="inline-block bg-white/20 text-white text-xs px-2 py-0.5 rounded-full mt-2">
                  Table {tableNumber}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Sticky filter bar */}
        <div className="sticky top-0 z-30 bg-white border-b border-[#E5E7EB] shadow-sm">
          {/* Search */}
          <div className="px-4 pt-3 pb-2 relative">
            <Search size={16} className="absolute left-7 top-1/2 -translate-y-1/2 mt-1 text-[#9CA3AF]" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search dishes..."
              className="w-full bg-[#F8F9FA] border border-[#E5E7EB] rounded-2xl pl-9 pr-9 py-2.5 text-sm text-[#0F0E17] placeholder:text-[#9CA3AF] focus:outline-none focus:ring-2 focus:border-transparent transition-all"
              style={{ "--tw-ring-color": themeColor } as React.CSSProperties}
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-7 top-1/2 -translate-y-1/2 mt-1 text-[#9CA3AF] min-h-0 min-w-0 p-0"
              >
                <X size={16} />
              </button>
            )}
          </div>

          {/* Food filter pills */}
          <div className="flex gap-2 px-4 pb-2 overflow-x-auto scrollbar-hide">
            {(["all", "veg", "non_veg"] as FoodFilter[]).map((f) => (
              <button
                key={f}
                onClick={() => setFoodFilter(f)}
                className={[
                  "px-3 py-1.5 rounded-full text-xs font-medium transition-all flex items-center gap-1.5 shrink-0 border min-h-0",
                  foodFilter === f ? "text-white border-transparent" : "bg-white text-[#6B7280] border-[#E5E7EB]",
                ].join(" ")}
                style={foodFilter === f ? { backgroundColor: themeColor } : {}}
              >
                {f === "veg" && <span className="w-2 h-2 rounded-full bg-[#10B981]" />}
                {f === "non_veg" && <span className="w-2 h-2 rounded-full bg-[#EF4444]" />}
                {f === "all" ? "All" : f === "veg" ? "Veg" : "Non-Veg"}
              </button>
            ))}
          </div>

          {/* Category tabs */}
          <div className="flex gap-2 px-4 pb-2 overflow-x-auto scrollbar-hide">
            {categories.map((cat) => (
              <button
                key={cat.id}
                ref={(el) => {
                  catTabRefs.current[cat.id] = el;
                }}
                onClick={() => selectCat(cat.id)}
                className={[
                  "px-3 py-1.5 rounded-full text-xs font-medium transition-all shrink-0 border min-h-0",
                  activeCatId === cat.id ? "text-white border-transparent" : "bg-white text-[#6B7280] border-[#E5E7EB]",
                ].join(" ")}
                style={activeCatId === cat.id ? { backgroundColor: themeColor } : {}}
              >
                {cat.name}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="px-4 py-4 pb-28">
          {!hasResults ? (
            <div className="flex flex-col items-center text-center py-20">
              <span className="text-4xl mb-3">🍽️</span>
              <p className="text-[#374151] font-medium">Nothing found</p>
              <p className="text-sm text-[#9CA3AF] mt-1">Try a different search or adjust your filters.</p>
            </div>
          ) : (
            filteredByCat.map(({ cat, items: catItems }) => {
              if (catItems.length === 0) return null;
              return (
                <div key={cat.id} id={`cat-${cat.id}`}>
                  {/* Category divider */}
                  <div className="flex items-center gap-3 mb-3 py-1 sticky top-[156px] z-20" style={{ backgroundColor: "#FFFAF3" }}>
                    <div className="w-1 h-5 rounded-full" style={{ backgroundColor: themeColor }} />
                    <span className="text-xs font-bold text-[#1C1C2E] uppercase tracking-[0.08em]">{cat.name}</span>
                    <div className="flex-1 h-px bg-[#E5E7EB]" />
                    <span className="text-xs text-[#9CA3AF]">{catItems.length}</span>
                  </div>

                  <div className="space-y-3 mb-6">
                    {catItems.map((item) => (
                      <ItemCard
                        key={item.id}
                        item={item}
                        themeColor={themeColor}
                        rating={ratings[item.id]}
                        onAdd={() => addToCart(item)}
                        onLongPress={() => setRatingItem(item)}
                      />
                    ))}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-[#9CA3AF] py-4">Powered by MenuQR</p>
      </div>

      {/* Fixed controls, aligned to the mobile frame */}
      <div className={`fixed inset-0 z-40 mx-auto w-full ${FRAME} pointer-events-none`}>
        {/* Waiter call button */}
        <button
          onClick={callWaiter}
          className={[
            "pointer-events-auto absolute right-4 w-[52px] h-[52px] rounded-full bg-white border-2 shadow-lg flex items-center justify-center min-h-0 min-w-0",
            cartCount > 0 ? "bottom-28" : "bottom-6",
          ].join(" ")}
          style={{ borderColor: themeColor }}
          title="Call waiter"
        >
          <Bell size={22} style={{ color: themeColor }} />
        </button>

        {/* Cart bar */}
        {cartCount > 0 && (
          <div
            className="pointer-events-auto absolute bottom-0 inset-x-0 flex items-center justify-between px-5 py-4"
            style={{ backgroundColor: themeColor }}
          >
            <div>
              <p className="text-white text-sm font-medium">
                {cartCount} item{cartCount !== 1 ? "s" : ""}
              </p>
              <p className="text-white/80 text-xs">₹{cartTotal}</p>
            </div>
            <p className="text-white font-semibold text-sm">View order →</p>
          </div>
        )}
      </div>

      {/* Rating bottom sheet */}
      {ratingItem && (
        <RatingSheet item={ratingItem} themeColor={themeColor} onClose={() => setRatingItem(null)} onRate={(v) => submitRating(ratingItem, v)} />
      )}
    </div>
  );
}

function useLongPress(onLongPress: () => void, ms = 500) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clear = () => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
  };
  const start = () => {
    clear();
    timer.current = setTimeout(onLongPress, ms);
  };
  return {
    onTouchStart: start,
    onTouchEnd: clear,
    onTouchMove: clear,
    onMouseDown: start,
    onMouseUp: clear,
    onMouseLeave: clear,
  };
}

function ItemCard({
  item,
  themeColor,
  rating,
  onAdd,
  onLongPress,
}: {
  item: MenuItem;
  themeColor: string;
  rating?: { sum: number; count: number };
  onAdd: () => void;
  onLongPress: () => void;
}) {
  const longPress = useLongPress(onLongPress);
  const avg = rating && rating.count > 0 ? rating.sum / rating.count : 0;

  return (
    <div className="bg-white rounded-3xl border border-[#E5E7EB] flex overflow-hidden relative shadow-sm">
      <div className="flex-1 p-4" {...longPress}>
        <div className="flex items-center gap-1.5">
          <VegIndicator type={item.food_type} />
          <span className="text-sm font-semibold text-[#0F0E17]">{item.name}</span>
        </div>
        {item.description && (
          <p className="text-xs text-[#6B7280] mt-1.5 leading-relaxed line-clamp-2 ml-5">{item.description}</p>
        )}

        {rating && rating.count >= 3 && (
          <div className="flex items-center gap-0.5 ml-5 mt-1">
            {[1, 2, 3, 4, 5].map((s) => {
              const filled = s <= Math.round(avg);
              return (
                <Star
                  key={s}
                  size={10}
                  style={{ color: filled ? themeColor : "#E5E7EB", fill: filled ? themeColor : "transparent" }}
                />
              );
            })}
            <span className="text-[10px] text-[#9CA3AF] ml-0.5">({rating.count})</span>
          </div>
        )}

        {item.badge && (
          <span
            className="inline-block text-white text-[10px] font-semibold px-2 py-0.5 rounded-full mt-2 ml-5"
            style={{ backgroundColor: themeColor }}
          >
            {item.badge}
          </span>
        )}

        <p className="text-sm font-bold mt-2.5 ml-5" style={{ color: themeColor }}>
          ₹{item.price}
        </p>
      </div>

      {item.image_url && (
        <div className="w-24 flex-shrink-0 relative">
          <Image
            src={item.image_url}
            alt={item.name}
            fill
            sizes="(max-width: 640px) 96px, 96px"
            loading="lazy"
            placeholder="blur"
            blurDataURL={BLUR_DATA_URL}
            className="object-cover"
          />
        </div>
      )}

      <button
        onClick={onAdd}
        className="absolute bottom-3 right-3 w-8 h-8 rounded-full flex items-center justify-center min-h-0 min-w-0 shadow-sm"
        style={{ backgroundColor: themeColor }}
      >
        <Plus size={16} className="text-white" />
      </button>
    </div>
  );
}

function RatingSheet({
  item,
  themeColor,
  onClose,
  onRate,
}: {
  item: MenuItem;
  themeColor: string;
  onClose: () => void;
  onRate: (value: number) => void;
}) {
  const [hover, setHover] = useState(0);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40" />
      <div className={`relative bg-white rounded-t-3xl w-full ${FRAME} p-6 pb-9`} onClick={(e) => e.stopPropagation()}>
        <div className="w-10 h-1 rounded-full bg-[#E5E7EB] mx-auto mb-5" />
        <p className="text-center text-sm text-[#6B7280]">How was</p>
        <p className="text-center text-base font-semibold text-[#0F0E17] mb-6">{item.name}</p>
        <div className="flex items-center justify-center gap-2">
          {[1, 2, 3, 4, 5].map((s) => {
            const active = s <= hover;
            return (
              <button
                key={s}
                onMouseEnter={() => setHover(s)}
                onMouseLeave={() => setHover(0)}
                onClick={() => onRate(s)}
                className="w-10 h-10 flex items-center justify-center min-h-0 min-w-0"
                aria-label={`Rate ${s} star${s > 1 ? "s" : ""}`}
              >
                <Star size={34} style={{ color: active ? themeColor : "#E5E7EB", fill: active ? themeColor : "transparent" }} />
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
