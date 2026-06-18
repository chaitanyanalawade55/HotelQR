"use client";
import { useState, useRef, useMemo, useEffect, useCallback, memo } from "react";
import Image from "next/image";
import { Search, X, Plus, Minus, Bell, Star, Sparkles, Clock, CheckCircle2, XCircle, ChevronLeft } from "lucide-react";
import { toast } from "sonner";
import { VegIndicator } from "@/components/ui/VegIndicator";
import { createClient } from "@/lib/supabase/client";
import { uuid } from "@/lib/uuid";
import type { Hotel, HotelSettings, Category, MenuItem } from "@/types/database";

// Tiny valid JPEG used as a blur-up placeholder for item images.
const BLUR_DATA_URL =
  "data:image/jpeg;base64,/9j/2wBDAAMCAgICAgMCAgIDAwMDBAYEBAQEBAgGBgUGCQgKCgkICQkKDA8MCgsOCwkJDRENDg8QEBEQCgwSExIQEw8QEBD/2wBDAQMDAwQDBAgEBAgQCwkLEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBD/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAf/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCdABmX/9k=";

// A QR scan is always a phone — render a single mobile-width column, centered
// in a dark gutter on desktop.
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
type ActiveOrder = {
  id: string;
  token: string;
  placedAt: number;
  items: CartItem[];
  total: number;
  table: string;
  cancelMinutes: number;
  status: "new" | "cancelled";
};

function matchesFilters(item: MenuItem, q: string, foodFilter: FoodFilter) {
  if (item.is_available === false) return false;
  if (q && !item.name.toLowerCase().includes(q) && !(item.description ?? "").toLowerCase().includes(q)) return false;
  if (foodFilter === "veg" && item.food_type !== "veg" && item.food_type !== "vegan") return false;
  if (foodFilter === "non_veg" && item.food_type !== "non_veg") return false;
  return true;
}

// Merge newly-added cart lines into an existing order's lines, summing the
// quantity when the same dish is ordered again (for the local status display).
function mergeCartItems(existing: CartItem[], added: CartItem[]): CartItem[] {
  const merged = existing.map((c) => ({ ...c }));
  for (const a of added) {
    const found = merged.find((c) => c.itemId === a.itemId);
    if (found) found.qty += a.qty;
    else merged.push({ ...a });
  }
  return merged;
}

// Derive the table number from a table-specific slug ("hotel-t5-1234" -> "5").
function tableNumberFromSlug(slug: string): string | null {
  const idx = slug.indexOf("-t");
  if (idx === -1) return null;
  const after = slug.slice(idx + 2).replace(/-\d{4}$/, "");
  return after || null;
}

export function PublicMenuClassic({ hotel, settings, categories, items: initialItems, tableSlug }: Props) {
  const themeColor = settings?.theme_color ?? "#F97316";
  const themeLight = `${themeColor}26`;
  const cancelMinutes = settings?.order_cancel_minutes ?? 5;
  const tableNumber = useMemo(() => tableNumberFromSlug(tableSlug), [tableSlug]);
  const orderKey = `order-${hotel.id}-${tableSlug}`;

  const [items, setItems] = useState<MenuItem[]>(initialItems);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [foodFilter, setFoodFilter] = useState<FoodFilter>("all");
  const [activeCatId, setActiveCatId] = useState<string | null>(categories[0]?.id ?? null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [placing, setPlacing] = useState(false);
  const [manualTable, setManualTable] = useState("");
  const [ratings, setRatings] = useState<RatingAgg>({});
  const [ratingItem, setRatingItem] = useState<MenuItem | null>(null);
  const [activeOrder, setActiveOrder] = useState<ActiveOrder | null>(null);
  // The order-status screen overlays the menu. Hiding it (without clearing the
  // active order) lets the customer browse and add more items to the SAME order.
  const [statusOpen, setStatusOpen] = useState(false);
  const catTabRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const supabase = createClient();

  // Debounce search — prevents re-filtering 200+ items on every keystroke.
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search.trim().toLowerCase()), 150);
    return () => clearTimeout(timer);
  }, [search]);

  const logoInitial = hotel.name.charAt(0).toUpperCase();

  // Live menu — admin edits/enable/disable/add/delete reflect without a refresh.
  useEffect(() => {
    const channel = supabase
      .channel(`menu-${hotel.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "menu_items", filter: `hotel_id=eq.${hotel.id}` },
        (payload) => {
          if (payload.eventType === "DELETE") {
            const oldId = (payload.old as { id?: string }).id;
            if (oldId) setItems((prev) => prev.filter((i) => i.id !== oldId));
            return;
          }
          const row = payload.new as MenuItem;
          setItems((prev) => {
            const exists = prev.some((i) => i.id === row.id);
            return exists ? prev.map((i) => (i.id === row.id ? { ...i, ...row } : i)) : [...prev, row];
          });
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [hotel.id, supabase]);

  // All filtering runs in memory — zero network calls after the initial load.
  const filteredByCat = useMemo(() => {
    return categories.map((cat) => ({
      cat,
      items: items.filter((item) => item.category_id === cat.id && matchesFilters(item, debouncedSearch, foodFilter)),
    }));
  }, [items, categories, debouncedSearch, foodFilter]);

  const specialItems = useMemo(() => {
    return items.filter((item) => item.is_special && matchesFilters(item, debouncedSearch, foodFilter));
  }, [items, debouncedSearch, foodFilter]);

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

  // Restore a recently placed order (survives an accidental refresh).
  useEffect(() => {
    try {
      const raw = localStorage.getItem(orderKey);
      if (!raw) return;
      const saved = JSON.parse(raw) as ActiveOrder;
      if (Date.now() - saved.placedAt > 60 * 60 * 1000) {
        localStorage.removeItem(orderKey);
        return;
      }
      setActiveOrder(saved);
      setStatusOpen(true);
    } catch {
      /* ignore */
    }
  }, [orderKey]);

  function selectCat(catId: string) {
    setActiveCatId(catId);
    document.getElementById(`cat-${catId}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
    catTabRefs.current[catId]?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  }

  const addToCart = useCallback((item: MenuItem) => {
    setCart((prev) => {
      const existing = prev.find((c) => c.itemId === item.id);
      if (existing) return prev.map((c) => (c.itemId === item.id ? { ...c, qty: c.qty + 1 } : c));
      return [...prev, { itemId: item.id, name: item.name, price: item.price, qty: 1 }];
    });
  }, []);

  const changeQty = useCallback((itemId: string, delta: number) => {
    setCart((prev) =>
      prev.map((c) => (c.itemId === itemId ? { ...c, qty: c.qty + delta } : c)).filter((c) => c.qty > 0)
    );
  }, []);

  const cartTotal = useMemo(() => cart.reduce((sum, c) => sum + c.price * c.qty, 0), [cart]);
  const cartCount = useMemo(() => cart.reduce((sum, c) => sum + c.qty, 0), [cart]);

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

  function persistOrder(order: ActiveOrder | null) {
    try {
      if (order) localStorage.setItem(orderKey, JSON.stringify(order));
      else localStorage.removeItem(orderKey);
    } catch {
      /* ignore */
    }
  }

  // Try to append the current cart to an already-placed order on this table so
  // the manager sees the SAME order grow (a realtime UPDATE) rather than a
  // second row. Returns false if there's no open order to append to.
  async function appendToActiveOrder(): Promise<boolean> {
    if (!activeOrder || activeOrder.status !== "new") return false;
    const newItems = cart.map((c) => ({ item_id: c.itemId, name: c.name, price: c.price, qty: c.qty }));
    const { data, error } = await supabase.rpc("append_to_order", {
      p_order_id: activeOrder.id,
      p_token: activeOrder.token,
      p_items: newItems,
      p_added_total: cartTotal,
    });
    if (error || data !== true) return false;
    const merged = mergeCartItems(activeOrder.items, cart);
    const updated: ActiveOrder = { ...activeOrder, items: merged, total: activeOrder.total + cartTotal };
    persistOrder(updated);
    setActiveOrder(updated);
    setCart([]);
    setCartOpen(false);
    setStatusOpen(true);
    toast.success("Added to your order! 🎉");
    return true;
  }

  async function placeOrder() {
    if (cart.length === 0) return;
    setPlacing(true);

    // Same table, order still open → fold the new items into it.
    if (await appendToActiveOrder()) {
      setPlacing(false);
      return;
    }

    const table = activeOrder?.table ?? tableNumber ?? (manualTable.trim() || null);
    if (!table) {
      setPlacing(false);
      toast.error("Please enter your table number");
      return;
    }
    const id = uuid();
    const token = uuid();
    const row = {
      id,
      hotel_id: hotel.id,
      table_slug: tableSlug,
      table_number: table,
      items: cart.map((c) => ({ item_id: c.itemId, name: c.name, price: c.price, qty: c.qty })),
      total: cartTotal,
      status: "new" as const,
    };
    let { error } = await supabase.from("orders").insert({ ...row, cancel_token: token });
    // Pre-migration fallback (cancel_token column not added yet).
    if (error && (error.code === "42703" || /cancel_token/i.test(error.message))) {
      ({ error } = await supabase.from("orders").insert(row));
    }
    setPlacing(false);
    if (error) {
      // Surface the real cause — almost always a missing RLS INSERT policy on
      // `orders` for the anon role (run migration 0009). See console for code.
      console.error("Order insert failed:", error);
      toast.error(error.message ? `Could not place order: ${error.message}` : "Could not place order. Please try again.");
      return;
    }
    const order: ActiveOrder = {
      id,
      token,
      placedAt: Date.now(),
      items: cart,
      total: cartTotal,
      table,
      cancelMinutes,
      status: "new",
    };
    persistOrder(order);
    setActiveOrder(order);
    setStatusOpen(true);
    setCart([]);
    setCartOpen(false);
    setManualTable("");
    toast.success("Order placed! 🎉");
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

  async function cancelOrder() {
    if (!activeOrder) return;
    const { data, error } = await supabase.rpc("cancel_order", {
      p_order_id: activeOrder.id,
      p_token: activeOrder.token,
    });
    if (error || data !== true) {
      toast.error("Couldn't cancel — the window may have passed.");
      return;
    }
    const cancelled: ActiveOrder = { ...activeOrder, status: "cancelled" };
    persistOrder(cancelled);
    setActiveOrder(cancelled);
    toast.success("Order cancelled");
  }

  // "Add more items" — keep the active order, just drop back to the menu so the
  // next "Place order" appends to it.
  function addMoreItems() {
    setStatusOpen(false);
  }

  function dismissOrder() {
    persistOrder(null);
    setActiveOrder(null);
    setStatusOpen(false);
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
          {/* Specialities */}
          {specialItems.length > 0 && (
            <div className="mb-6">
              <div className="flex items-center gap-1.5 mb-3">
                <Sparkles size={16} style={{ color: themeColor }} />
                <span className="text-[15px] font-bold text-[#1C1C2E]">Our Specialities</span>
              </div>
              <div className="flex gap-3 overflow-x-auto scrollbar-hide -mx-4 px-4 pb-1 snap-x">
                {specialItems.map((item) => (
                  <SpecialCard
                    key={item.id}
                    item={item}
                    themeColor={themeColor}
                    onAdd={() => addToCart(item)}
                    onLongPress={() => setRatingItem(item)}
                  />
                ))}
              </div>
            </div>
          )}

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
                <div key={cat.id} id={`cat-${cat.id}`} className="scroll-mt-[156px]">
                  {/* Category divider */}
                  <div className="flex items-center gap-3 mb-3 py-1 sticky top-[156px] z-20" style={{ backgroundColor: "#FFFAF3" }}>
                    <div className="w-1 h-5 rounded-full" style={{ backgroundColor: themeColor }} />
                    <span className="text-xs font-bold text-[#1C1C2E] uppercase tracking-[0.08em]">{cat.name}</span>
                    <div className="flex-1 h-px bg-[#E5E7EB]" />
                    <span className="text-xs text-[#9CA3AF]">{catItems.length}</span>
                  </div>

                  <div className="grid grid-cols-2 gap-3 mb-6">
                    {catItems.map((item) => (
                      <GridItemCard
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

        {/* Re-open the active order when browsing to add more items (cart empty) */}
        {activeOrder && !statusOpen && cartCount === 0 && (
          <button
            onClick={() => setStatusOpen(true)}
            className="pointer-events-auto absolute bottom-0 inset-x-0 flex items-center justify-between px-5 py-4 text-left"
            style={{ backgroundColor: themeColor }}
          >
            <div>
              <p className="text-white text-sm font-medium">Your order · Table {activeOrder.table}</p>
              <p className="text-white/80 text-xs">Tap to view · add more from the menu</p>
            </div>
            <span className="text-white font-semibold text-sm">View order →</span>
          </button>
        )}

        {/* Cart bar */}
        {cartCount > 0 && (
          <button
            onClick={() => setCartOpen(true)}
            className="pointer-events-auto absolute bottom-0 inset-x-0 flex items-center justify-between px-5 py-4 text-left"
            style={{ backgroundColor: themeColor }}
          >
            <div>
              <p className="text-white text-sm font-medium">
                {cartCount} item{cartCount !== 1 ? "s" : ""}
              </p>
              <p className="text-white/80 text-xs">₹{cartTotal}</p>
            </div>
            <span className="text-white font-semibold text-sm">View order →</span>
          </button>
        )}
      </div>

      {/* Cart / order sheet */}
      {cartOpen && (
        <CartSheet
          cart={cart}
          total={cartTotal}
          themeColor={themeColor}
          tableNumber={tableNumber}
          manualTable={manualTable}
          setManualTable={setManualTable}
          placing={placing}
          appendMode={Boolean(activeOrder && activeOrder.status === "new")}
          onClose={() => setCartOpen(false)}
          onChangeQty={changeQty}
          onPlaceOrder={placeOrder}
        />
      )}

      {/* Rating bottom sheet */}
      {ratingItem && (
        <RatingSheet item={ratingItem} themeColor={themeColor} onClose={() => setRatingItem(null)} onRate={(v) => submitRating(ratingItem, v)} />
      )}

      {/* Order status — shown after placing, covering the menu like a redirect */}
      {activeOrder && statusOpen && (
        <OrderStatus
          order={activeOrder}
          themeColor={themeColor}
          onCancel={cancelOrder}
          onBack={dismissOrder}
          onAddMore={addMoreItems}
        />
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

function RatingStars({ avg, themeColor, count }: { avg: number; themeColor: string; count: number }) {
  return (
    <div className="flex items-center gap-0.5 mt-1">
      {[1, 2, 3, 4, 5].map((s) => {
        const filled = s <= Math.round(avg);
        return <Star key={s} size={9} style={{ color: filled ? themeColor : "#E5E7EB", fill: filled ? themeColor : "transparent" }} />;
      })}
      <span className="text-[10px] text-[#9CA3AF] ml-0.5">({count})</span>
    </div>
  );
}

function DishImage({ item, themeColor, sizes }: { item: MenuItem; themeColor: string; sizes: string }) {
  if (item.image_url) {
    return (
      <Image
        src={item.image_url}
        alt={item.name}
        fill
        sizes={sizes}
        loading="lazy"
        placeholder="blur"
        blurDataURL={BLUR_DATA_URL}
        className="object-cover"
      />
    );
  }
  return (
    <div className="w-full h-full flex items-center justify-center" style={{ backgroundColor: `${themeColor}14` }}>
      <span className="text-3xl opacity-50">🍽️</span>
    </div>
  );
}

function AddButton({ onAdd, themeColor }: { onAdd: () => void; themeColor: string }) {
  return (
    <button
      onClick={onAdd}
      className="absolute bottom-2 right-2 w-8 h-8 rounded-full flex items-center justify-center min-h-0 min-w-0 shadow-md"
      style={{ backgroundColor: themeColor }}
      aria-label="Add to order"
    >
      <Plus size={16} className="text-white" />
    </button>
  );
}

const GridItemCard = memo(function GridItemCard({
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
    <div className="bg-white rounded-2xl border border-[#E5E7EB] shadow-sm overflow-hidden flex flex-col relative">
      <div className="relative w-full aspect-[4/3]">
        <DishImage item={item} themeColor={themeColor} sizes="(max-width: 480px) 45vw, 210px" />
        {item.badge && (
          <span
            className="absolute top-2 left-2 text-white text-[10px] font-semibold px-2 py-0.5 rounded-full shadow"
            style={{ backgroundColor: themeColor }}
          >
            {item.badge}
          </span>
        )}
        <AddButton onAdd={onAdd} themeColor={themeColor} />
      </div>

      <div className="p-2.5 flex flex-col flex-1" {...longPress}>
        <div className="flex items-center gap-1">
          <VegIndicator type={item.food_type} />
          <span className="text-sm font-semibold text-[#0F0E17] leading-tight line-clamp-1">{item.name}</span>
        </div>
        {item.description && <p className="text-[11px] text-[#6B7280] mt-1 leading-snug line-clamp-2">{item.description}</p>}
        {rating && rating.count >= 3 && <RatingStars avg={avg} themeColor={themeColor} count={rating.count} />}
        <p className="text-sm font-bold mt-auto pt-2" style={{ color: themeColor }}>
          ₹{item.price}
        </p>
      </div>
    </div>
  );
});

const SpecialCard = memo(function SpecialCard({
  item,
  themeColor,
  onAdd,
  onLongPress,
}: {
  item: MenuItem;
  themeColor: string;
  onAdd: () => void;
  onLongPress: () => void;
}) {
  const longPress = useLongPress(onLongPress);
  return (
    <div
      className="flex-shrink-0 w-40 snap-start bg-white rounded-2xl border-2 overflow-hidden shadow-sm relative"
      style={{ borderColor: `${themeColor}55` }}
    >
      <div className="relative w-full aspect-[4/3]">
        <DishImage item={item} themeColor={themeColor} sizes="160px" />
        <span
          className="absolute top-2 left-2 flex items-center gap-0.5 text-white text-[10px] font-semibold px-1.5 py-0.5 rounded-full shadow"
          style={{ backgroundColor: themeColor }}
        >
          <Sparkles size={9} /> Special
        </span>
        <AddButton onAdd={onAdd} themeColor={themeColor} />
      </div>
      <div className="p-2.5" {...longPress}>
        <div className="flex items-center gap-1">
          <VegIndicator type={item.food_type} />
          <span className="text-sm font-semibold text-[#0F0E17] leading-tight line-clamp-1">{item.name}</span>
        </div>
        <p className="text-sm font-bold mt-1.5" style={{ color: themeColor }}>
          ₹{item.price}
        </p>
      </div>
    </div>
  );
});

const CartSheet = memo(function CartSheet({
  cart,
  total,
  themeColor,
  tableNumber,
  manualTable,
  setManualTable,
  placing,
  appendMode,
  onClose,
  onChangeQty,
  onPlaceOrder,
}: {
  cart: CartItem[];
  total: number;
  themeColor: string;
  tableNumber: string | null;
  manualTable: string;
  setManualTable: (v: string) => void;
  placing: boolean;
  appendMode: boolean;
  onClose: () => void;
  onChangeQty: (itemId: string, delta: number) => void;
  onPlaceOrder: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40" />
      <div className={`relative bg-white rounded-t-3xl w-full ${FRAME} p-5 pb-8 max-h-[85vh] flex flex-col`} onClick={(e) => e.stopPropagation()}>
        <div className="w-10 h-1 rounded-full bg-[#E5E7EB] mx-auto mb-4" />
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-bold text-[#0F0E17]">Your order</h2>
          {tableNumber ? (
            <span className="text-xs font-medium text-white px-2.5 py-1 rounded-full" style={{ backgroundColor: themeColor }}>
              Table {tableNumber}
            </span>
          ) : null}
        </div>

        {!tableNumber && (
          <input
            value={manualTable}
            onChange={(e) => setManualTable(e.target.value)}
            placeholder="Enter your table number"
            className="w-full bg-[#F8F9FA] border border-[#E5E7EB] rounded-2xl px-4 py-2.5 text-sm mb-3 focus:outline-none focus:ring-2 focus:border-transparent"
            style={{ "--tw-ring-color": themeColor } as React.CSSProperties}
          />
        )}

        {cart.length === 0 ? (
          <p className="text-sm text-[#9CA3AF] text-center py-10">Your cart is empty.</p>
        ) : (
          <div className="overflow-y-auto -mx-1 px-1 flex-1">
            {cart.map((c) => (
              <div key={c.itemId} className="flex items-center gap-3 py-2.5 border-b border-[#F3F4F6]">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[#0F0E17] truncate">{c.name}</p>
                  <p className="text-xs text-[#9CA3AF]">₹{c.price}</p>
                </div>
                <div className="flex items-center gap-2.5">
                  <button
                    onClick={() => onChangeQty(c.itemId, -1)}
                    className="w-7 h-7 rounded-full border border-[#E5E7EB] flex items-center justify-center text-[#374151] min-h-0 min-w-0"
                    aria-label="Decrease"
                  >
                    <Minus size={14} />
                  </button>
                  <span className="text-sm font-semibold w-4 text-center">{c.qty}</span>
                  <button
                    onClick={() => onChangeQty(c.itemId, 1)}
                    className="w-7 h-7 rounded-full flex items-center justify-center text-white min-h-0 min-w-0"
                    style={{ backgroundColor: themeColor }}
                    aria-label="Increase"
                  >
                    <Plus size={14} />
                  </button>
                </div>
                <span className="text-sm font-semibold text-[#0F0E17] w-14 text-right">₹{c.price * c.qty}</span>
              </div>
            ))}
          </div>
        )}

        <div className="flex items-center justify-between mt-4 mb-3">
          <span className="text-sm text-[#6B7280]">Total</span>
          <span className="text-lg font-bold text-[#0F0E17]">₹{total}</span>
        </div>

        <button
          onClick={onPlaceOrder}
          disabled={placing || cart.length === 0}
          className="w-full rounded-2xl py-3.5 text-white font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-50 active:scale-[0.98] transition-transform"
          style={{ backgroundColor: themeColor }}
        >
          {placing
            ? appendMode
              ? "Adding..."
              : "Placing order..."
            : `${appendMode ? "Add to order" : "Place order"} · ₹${total}`}
        </button>
      </div>
    </div>
  );
});

const RatingSheet = memo(function RatingSheet({
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
});

function OrderStatus({
  order,
  themeColor,
  onCancel,
  onBack,
  onAddMore,
}: {
  order: ActiveOrder;
  themeColor: string;
  onCancel: () => void | Promise<void>;
  onBack: () => void;
  onAddMore: () => void;
}) {
  const [now, setNow] = useState(() => Date.now());
  const [cancelling, setCancelling] = useState(false);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const remaining = Math.max(0, order.placedAt + order.cancelMinutes * 60_000 - now);
  const cancelled = order.status === "cancelled";
  const canCancel = !cancelled && order.cancelMinutes > 0 && remaining > 0;
  const mm = Math.floor(remaining / 60000);
  const ss = String(Math.floor((remaining % 60000) / 1000)).padStart(2, "0");

  async function handleCancel() {
    setCancelling(true);
    await onCancel();
    setCancelling(false);
  }

  return (
    <div className={`fixed inset-0 z-[60] mx-auto w-full ${FRAME} bg-[#FFFAF3] flex flex-col`}>
      {/* Header */}
      <div className="px-5 pt-6 pb-6 text-white" style={{ backgroundColor: cancelled ? "#6B7280" : themeColor }}>
        <button onClick={onBack} className="flex items-center gap-1 text-white/90 text-sm mb-4 min-h-0 min-w-0">
          <ChevronLeft size={16} /> Back to menu
        </button>
        <div className="flex items-center gap-3">
          {cancelled ? <XCircle size={30} className="text-white" /> : <CheckCircle2 size={30} className="text-white" />}
          <div>
            <h1 className="text-white text-xl font-semibold" style={{ fontFamily: "var(--font-display)" }}>
              {cancelled ? "Order cancelled" : "Order placed!"}
            </h1>
            <p className="text-white/80 text-xs mt-0.5">
              Table {order.table} · #{order.id.slice(-4).toUpperCase()}
            </p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4">
        {/* Items */}
        <div className="bg-white rounded-3xl border border-[#E5E7EB] p-4">
          {order.items.map((c) => (
            <div key={c.itemId} className="flex justify-between text-sm py-1.5">
              <span className="text-[#374151]">
                {c.name} × {c.qty}
              </span>
              <span className="text-[#6B7280]">₹{c.price * c.qty}</span>
            </div>
          ))}
          <div className="flex justify-between border-t border-[#E5E7EB] mt-2 pt-3">
            <span className="text-sm font-semibold text-[#0F0E17]">Total</span>
            <span className="text-sm font-bold" style={{ color: themeColor }}>
              ₹{order.total}
            </span>
          </div>
        </div>

        {/* Cancellation window */}
        {canCancel && (
          <div className="mt-4 bg-white rounded-3xl border border-[#E5E7EB] p-4">
            <div className="flex items-center gap-1.5 text-[#374151] text-sm">
              <Clock size={15} style={{ color: themeColor }} />
              You can cancel for the next{" "}
              <span className="font-bold tabular-nums" style={{ color: themeColor }}>
                {mm}:{ss}
              </span>
            </div>
            <button
              onClick={handleCancel}
              disabled={cancelling}
              className="mt-3 w-full border-2 border-[#EF4444] text-[#EF4444] rounded-2xl py-3 font-semibold text-sm disabled:opacity-50 active:scale-[0.98] transition-transform"
            >
              {cancelling ? "Cancelling..." : "Cancel order"}
            </button>
          </div>
        )}

        {!cancelled && !canCancel && order.cancelMinutes > 0 && (
          <p className="mt-4 text-center text-xs text-[#9CA3AF]">
            Cancellation window has passed — your order is being prepared. 👨‍🍳
          </p>
        )}

        {cancelled && <p className="mt-4 text-center text-sm text-[#6B7280]">This order was cancelled.</p>}

        <button
          onClick={cancelled ? onBack : onAddMore}
          className="mt-5 w-full rounded-2xl py-3.5 text-white font-semibold text-sm active:scale-[0.98] transition-transform"
          style={{ backgroundColor: themeColor }}
        >
          {cancelled ? "Back to menu" : "Add more items"}
        </button>
      </div>
    </div>
  );
}
