"use client";
import { useState, useRef, useCallback } from "react";
import { Search, X, Plus, Bell } from "lucide-react";
import { toast } from "sonner";
import { VegIndicator } from "@/components/ui/VegIndicator";
import { createClient } from "@/lib/supabase/client";
import type { Hotel, HotelSettings, Category, MenuItem } from "@/types/database";

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
  tableParam: string | null;
  tableSlug: string;
}

type FoodFilter = "all" | "veg" | "non_veg";

export function PublicMenu({ hotel, settings, categories, items, tableParam, tableSlug }: Props) {
  const themeColor = settings?.theme_color ?? "#F97316";
  const themeLight = `${themeColor}26`;
  const [search, setSearch] = useState("");
  const [foodFilter, setFoodFilter] = useState<FoodFilter>("all");
  const [activeCatId, setActiveCatId] = useState<string | null>(categories[0]?.id ?? null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const catTabRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const supabase = createClient();

  const logoInitial = hotel.name.charAt(0).toUpperCase();

  function filterItems(catId: string) {
    return items.filter((item) => {
      if (item.category_id !== catId) return false;
      if (search) {
        const q = search.toLowerCase();
        if (!item.name.toLowerCase().includes(q) && !(item.description ?? "").toLowerCase().includes(q)) return false;
      }
      if (foodFilter === "veg" && item.food_type !== "veg" && item.food_type !== "vegan") return false;
      if (foodFilter === "non_veg" && item.food_type !== "non_veg") return false;
      return true;
    });
  }

  const hasResults = categories.some((cat) => filterItems(cat.id).length > 0);

  function selectCat(catId: string) {
    setActiveCatId(catId);
    catTabRefs.current[catId]?.scrollIntoView({
      behavior: "smooth",
      inline: "center",
      block: "nearest",
    });
  }

  function addToCart(item: MenuItem) {
    setCart((prev) => {
      const existing = prev.find((c) => c.itemId === item.id);
      if (existing) return prev.map((c) => c.itemId === item.id ? { ...c, qty: c.qty + 1 } : c);
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
      table_number: tableParam,
      status: "pending",
    });
    localStorage.setItem(COOLDOWN_KEY, Date.now().toString());
  }

  return (
    <div
      className="min-h-screen"
      style={
        {
          "--theme": themeColor,
          "--theme-light": themeLight,
          backgroundColor: "#FFFAF3",
        } as React.CSSProperties
      }
    >
      {/* Header */}
      <div className="px-5 pt-6 pb-5" style={{ backgroundColor: themeColor }}>
        <div className="flex items-center gap-3">
          <div className="w-[52px] h-[52px] rounded-full border-2 border-white/30 overflow-hidden flex items-center justify-center flex-shrink-0 bg-white/20">
            {settings?.logo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={settings.logo_url} alt="" className="w-full h-full object-cover" />
            ) : (
              <span
                className="text-white text-xl font-semibold"
                style={{ fontFamily: "var(--font-display)" }}
              >
                {logoInitial}
              </span>
            )}
          </div>
          <div>
            <h1
              className="text-white text-xl font-semibold"
              style={{ fontFamily: "var(--font-display)" }}
            >
              {hotel.name}
            </h1>
            {hotel.address && (
              <p className="text-white/70 text-xs mt-0.5">{hotel.address}</p>
            )}
            {tableParam && (
              <span className="inline-block bg-white/20 text-white text-xs px-2 py-0.5 rounded-full mt-2">
                Table {tableParam}
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
                foodFilter === f
                  ? "text-white border-transparent"
                  : "bg-white text-[#6B7280] border-[#E5E7EB]",
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
              ref={(el) => { catTabRefs.current[cat.id] = el; }}
              onClick={() => selectCat(cat.id)}
              className={[
                "px-3 py-1.5 rounded-full text-xs font-medium transition-all shrink-0 border min-h-0",
                activeCatId === cat.id
                  ? "text-white border-transparent"
                  : "bg-white text-[#6B7280] border-[#E5E7EB]",
              ].join(" ")}
              style={activeCatId === cat.id ? { backgroundColor: themeColor } : {}}
            >
              {cat.name}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="px-4 py-4 pb-28 max-w-2xl mx-auto">
        {!hasResults ? (
          <div className="flex flex-col items-center text-center py-20">
            <span className="text-4xl mb-3">🍽️</span>
            <p className="text-[#374151] font-medium">Nothing found</p>
            <p className="text-sm text-[#9CA3AF] mt-1">Try a different search or adjust your filters.</p>
          </div>
        ) : (
          categories.map((cat) => {
            const catItems = filterItems(cat.id);
            if (catItems.length === 0) return null;
            return (
              <div key={cat.id} id={`cat-${cat.id}`}>
                {/* Category divider */}
                <div className="flex items-center gap-3 mb-3 py-1 sticky top-[156px] z-20" style={{ backgroundColor: "#FFFAF3" }}>
                  <div className="w-1 h-5 rounded-full" style={{ backgroundColor: themeColor }} />
                  <span className="text-xs font-bold text-[#1C1C2E] uppercase tracking-[0.08em]">
                    {cat.name}
                  </span>
                  <div className="flex-1 h-px bg-[#E5E7EB]" />
                  <span className="text-xs text-[#9CA3AF]">{catItems.length}</span>
                </div>

                <div className="space-y-3 mb-6">
                  {catItems.map((item) => (
                    <ItemCard
                      key={item.id}
                      item={item}
                      themeColor={themeColor}
                      onAdd={() => addToCart(item)}
                    />
                  ))}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Waiter call button */}
      <button
        onClick={callWaiter}
        className={[
          "fixed right-4 z-40 w-[52px] h-[52px] rounded-full bg-white border-2 shadow-lg flex items-center justify-center min-h-0 min-w-0",
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
          className="fixed bottom-0 left-0 right-0 z-40 flex items-center justify-between px-5 py-4"
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

      {/* Footer */}
      <p className="text-center text-xs text-[#9CA3AF] py-4">Powered by MenuQR</p>
    </div>
  );
}

function ItemCard({
  item,
  themeColor,
  onAdd,
}: {
  item: MenuItem;
  themeColor: string;
  onAdd: () => void;
}) {
  return (
    <div className="bg-white rounded-3xl border border-[#E5E7EB] flex overflow-hidden relative">
      <div className="flex-1 p-4">
        <div className="flex items-center gap-1.5">
          <VegIndicator type={item.food_type} />
          <span className="text-sm font-semibold text-[#0F0E17]">{item.name}</span>
        </div>
        {item.description && (
          <p className="text-xs text-[#6B7280] mt-1.5 leading-relaxed line-clamp-2 ml-5">
            {item.description}
          </p>
        )}
        <p className="text-sm font-bold mt-2.5 ml-5" style={{ color: themeColor }}>
          ₹{item.price}
        </p>
      </div>

      {item.image_url && (
        <div className="w-24 flex-shrink-0 relative">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={item.image_url} alt={item.name} className="w-full h-full object-cover" />
          {!item.is_available && (
            <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
              <span className="text-white text-[10px] font-bold bg-black/50 px-2 py-0.5 rounded-full">
                Unavailable
              </span>
            </div>
          )}
        </div>
      )}

      {item.is_available && (
        <button
          onClick={onAdd}
          className="absolute bottom-3 right-3 w-8 h-8 rounded-full flex items-center justify-center min-h-0 min-w-0 shadow-sm"
          style={{ backgroundColor: themeColor }}
        >
          <Plus size={16} className="text-white" />
        </button>
      )}
    </div>
  );
}
