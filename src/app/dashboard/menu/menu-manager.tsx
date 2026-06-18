"use client";
import { useState, useRef, useEffect, useMemo, ReactNode } from "react";
import {
  Plus, X, Check, Pencil, Trash2, ImagePlus, UtensilsCrossed, Loader2, Camera, Search, GripVertical, Star,
} from "lucide-react";
import { toast } from "sonner";
import {
  DndContext, closestCenter, PointerSensor, KeyboardSensor, useSensor, useSensors, type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext, verticalListSortingStrategy, useSortable, sortableKeyboardCoordinates, arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import dynamic from "next/dynamic";
import { Button } from "@/components/ui/Button";
import { Input, TextArea, Select } from "@/components/ui/Input";
import { Toggle } from "@/components/ui/Toggle";
import { EmptyState } from "@/components/ui/EmptyState";
import { VegIndicator } from "@/components/ui/VegIndicator";
import { createClient } from "@/lib/supabase/client";
import { compressImage } from "@/lib/compressImage";
import type { Category, MenuItem } from "@/types/database";

// Lazy-load OCR scanner — the Gemini SDK + Tesseract.js are heavy and only
// needed when the user clicks "Scan menu card". This keeps the initial
// dashboard menu bundle ~30KB lighter.
const OCRScanner = dynamic(
  () => import("./ocr-scanner").then((m) => m.OCRScanner),
  { ssr: false, loading: () => <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center"><Loader2 size={32} className="animate-spin text-[#F97316]" /></div> }
);

// RFC4122 v4 — native crypto when available, with a fallback for insecure
// contexts (e.g. opening the dev server over a LAN IP, where crypto.randomUUID
// is undefined). Generating the id client-side lets the add be fully optimistic.
function uuid(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

interface Props {
  hotelId: string;
  initialCategories: Category[];
  initialItems: MenuItem[];
}

export function MenuManager({ hotelId, initialCategories, initialItems }: Props) {
  const [categories, setCategories] = useState<Category[]>(initialCategories);
  const [items, setItems] = useState<MenuItem[]>(initialItems);
  const [activeCatId, setActiveCatId] = useState<string | null>(initialCategories[0]?.id ?? null);
  const [showAddCat, setShowAddCat] = useState(false);
  const [newCatName, setNewCatName] = useState("");
  const [addingCat, setAddingCat] = useState(false);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [showOCR, setShowOCR] = useState(false);
  const catInputRef = useRef<HTMLInputElement>(null);
  const editSnapshot = useRef<MenuItem | null>(null);
  const supabase = createClient();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  useEffect(() => {
    if (showAddCat) catInputRef.current?.focus();
  }, [showAddCat]);

  const activeCategory = categories.find((c) => c.id === activeCatId);

  const catItems = useMemo(
    () =>
      items
        .filter((i) => i.category_id === activeCatId)
        .sort((a, b) => a.sort_order - b.sort_order),
    [items, activeCatId]
  );

  const visibleItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return catItems;
    return catItems.filter(
      (i) => i.name.toLowerCase().includes(q) || (i.description ?? "").toLowerCase().includes(q)
    );
  }, [catItems, search]);

  // Drag-to-reorder only in plain browse mode (not while searching or editing).
  const dragEnabled = !search && editingItemId === null && visibleItems.length > 1;

  async function addCategory() {
    if (!newCatName.trim()) return;
    setAddingCat(true);
    const { data, error } = await supabase
      .from("categories")
      .insert({ hotel_id: hotelId, name: newCatName.trim(), sort_order: categories.length, is_active: true })
      .select()
      .single();
    if (error) {
      toast.error("Something went wrong");
      setAddingCat(false);
      return;
    }
    setCategories((prev) => [...prev, data as Category]);
    setActiveCatId(data.id);
    setNewCatName("");
    setShowAddCat(false);
    setAddingCat(false);
    toast.success("Category added");
  }

  async function deleteCategory(catId: string) {
    const { error } = await supabase.from("categories").delete().eq("id", catId);
    if (error) {
      toast.error("Something went wrong");
      return;
    }
    setCategories((prev) => prev.filter((c) => c.id !== catId));
    if (activeCatId === catId) setActiveCatId(categories.find((c) => c.id !== catId)?.id ?? null);
    toast.success("Category deleted");
  }

  // Optimistic add — opens the editor instantly, then inserts in the background.
  async function addItem() {
    if (!activeCatId) return;
    const id = uuid();
    const now = new Date().toISOString();
    // Place the new item at the TOP of the list so its editor is right there.
    const minOrder = catItems.length ? Math.min(...catItems.map((i) => i.sort_order)) : 0;
    const newOrder = minOrder - 1;
    const optimistic: MenuItem = {
      id,
      hotel_id: hotelId,
      category_id: activeCatId,
      name: "",
      description: null,
      price: 0,
      image_url: null,
      food_type: "veg",
      is_available: true,
      sort_order: newOrder,
      badge: null,
      is_special: false,
      created_at: now,
      updated_at: now,
    };
    setItems((prev) => [...prev, optimistic]);
    editSnapshot.current = optimistic;
    setEditingItemId(id);
    // Scroll up so the editor (now at the top of the list) is visible.
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });

    const { error } = await supabase.from("menu_items").insert({
      id,
      hotel_id: hotelId,
      category_id: activeCatId,
      name: optimistic.name,
      price: optimistic.price,
      food_type: optimistic.food_type,
      is_available: true,
      sort_order: newOrder,
    });
    if (error) {
      setItems((prev) => prev.filter((i) => i.id !== id));
      setEditingItemId((cur) => (cur === id ? null : cur));
      toast.error("Could not add item");
    }
  }

  function startEdit(item: MenuItem) {
    editSnapshot.current = { ...item };
    setEditingItemId(item.id);
  }

  function restoreSnapshot() {
    const snap = editSnapshot.current;
    if (snap) setItems((prev) => prev.map((i) => (i.id === snap.id ? snap : i)));
  }

  // Optimistic save — UI already reflects edits; revert if the write fails.
  async function saveItem(item: MenuItem) {
    if (!item.name || !item.name.trim()) {
      toast.error("Item name cannot be empty.");
      return;
    }
    if (!item.price || item.price <= 0) {
      toast.error("Item price must be greater than 0.");
      return;
    }
    
    setEditingItemId(null);
    const base = {
      name: item.name,
      description: item.description,
      price: item.price,
      food_type: item.food_type,
      image_url: item.image_url,
    };
    let { error } = await supabase
      .from("menu_items")
      .update({ ...base, badge: item.badge, is_special: item.is_special })
      .eq("id", item.id);
    // If optional columns (badge/is_special) aren't migrated yet, persist the rest.
    if (error && (error.code === "42703" || /badge|is_special/i.test(error.message))) {
      ({ error } = await supabase.from("menu_items").update(base).eq("id", item.id));
    }
    if (error) {
      restoreSnapshot();
      toast.error("Save failed, changes reverted");
      return;
    }
    toast.success("Changes saved");
  }

  function cancelEdit() {
    restoreSnapshot();
    setEditingItemId(null);
  }

  async function deleteItem(itemId: string) {
    const snapshot = items;
    setItems((prev) => prev.filter((i) => i.id !== itemId));
    setEditingItemId(null);
    const { error } = await supabase.from("menu_items").delete().eq("id", itemId);
    if (error) {
      setItems(snapshot);
      toast.error("Delete failed");
      return;
    }
    toast.success("Item removed");
  }

  // Optimistic availability toggle — instant UI, revert on error.
  async function toggleAvailable(item: MenuItem) {
    const next = !item.is_available;
    setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, is_available: next } : i)));
    const { error } = await supabase.from("menu_items").update({ is_available: next }).eq("id", item.id);
    if (error) {
      setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, is_available: !next } : i)));
      toast.error("Failed to update");
    }
  }

  async function bulkSetAvailable(value: boolean) {
    if (!activeCatId) return;
    const snapshot = items;
    setItems((prev) => prev.map((i) => (i.category_id === activeCatId ? { ...i, is_available: value } : i)));
    const { error } = await supabase
      .from("menu_items")
      .update({ is_available: value })
      .eq("hotel_id", hotelId)
      .eq("category_id", activeCatId);
    if (error) {
      setItems(snapshot);
      toast.error("Something went wrong");
      return;
    }
    toast.success(value ? "All items marked available" : "All items marked unavailable");
  }

  function updateEditItem(id: string, patch: Partial<MenuItem>) {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...patch } : i)));
  }

  async function uploadImage(item: MenuItem, file: File) {
    if (file.size > 10 * 1024 * 1024) {
      toast.error("Image must be under 10MB");
      return;
    }
    toast.info("Optimising image...");
    let blob: Blob;
    try {
      blob = await compressImage(file, 800, 0.82);
    } catch {
      toast.error("Could not process image");
      return;
    }
    const path = `${hotelId}/${item.id}.webp`;
    const { error: uploadError } = await supabase.storage
      .from("menu-images")
      .upload(path, blob, { upsert: true, contentType: "image/webp" });
    if (uploadError) {
      toast.error("Image upload failed. Try again.");
      return;
    }
    const { data: urlData } = supabase.storage.from("menu-images").getPublicUrl(path);
    const url = `${urlData.publicUrl}?t=${Date.now()}`;
    updateEditItem(item.id, { image_url: url });
    toast.success("Image uploaded");
  }

  function handleDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const ids = visibleItems.map((i) => i.id);
    const oldIndex = ids.indexOf(active.id as string);
    const newIndex = ids.indexOf(over.id as string);
    if (oldIndex < 0 || newIndex < 0) return;
    const reordered = arrayMove(visibleItems, oldIndex, newIndex);
    const orderById = new Map(reordered.map((it, idx) => [it.id, idx]));
    setItems((prev) => prev.map((it) => (orderById.has(it.id) ? { ...it, sort_order: orderById.get(it.id)! } : it)));
    reordered.forEach(async (it, idx) => {
      const { error } = await supabase.from("menu_items").update({ sort_order: idx }).eq("id", it.id);
      if (error) toast.error("Could not save new order");
    });
  }

  return (
    <div className="px-4 md:px-8 py-6 pb-28 md:pb-12">
      <div className="flex items-center justify-between mb-5 gap-2">
        <h1 className="text-xl font-bold text-[#0F0E17]">Menu</h1>
        {activeCatId && (
          <Button variant="secondary" size="sm" icon={<Camera size={14} />} onClick={() => setShowOCR(true)}>
            Scan menu card
          </Button>
        )}
      </div>

      {/* Category chips */}
      <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide pb-2 -mx-4 px-4">
        {categories.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setActiveCatId(cat.id)}
            className={[
              "flex items-center px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap shrink-0 transition-all border",
              activeCatId === cat.id
                ? "bg-[#1C1C2E] text-white border-[#1C1C2E]"
                : "bg-white text-[#374151] border-[#E5E7EB] hover:border-[#1C1C2E]",
            ].join(" ")}
          >
            {cat.name}
            {activeCatId === cat.id && (
              <span
                className="ml-1.5 opacity-60 hover:opacity-100"
                onClick={(e) => {
                  e.stopPropagation();
                  deleteCategory(cat.id);
                }}
              >
                <X size={12} />
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Add category — on its own line so it never scrolls off-screen */}
      <button
        onClick={() => setShowAddCat(true)}
        className="flex items-center w-fit px-4 py-2 mt-1 rounded-full text-sm font-medium bg-[#FFF7ED] text-[#F97316] border border-[#FED7AA]"
      >
        <Plus size={12} className="mr-1" /> Add category
      </button>

      {/* Add category input */}
      {showAddCat && (
        <div className="bg-white border border-[#E5E7EB] rounded-3xl p-4 mb-4 mt-3">
          <div className="flex items-center gap-2">
            <input
              ref={catInputRef}
              value={newCatName}
              onChange={(e) => setNewCatName(e.target.value)}
              placeholder="e.g. Starters, Main Course..."
              className="flex-1 bg-[#F8F9FA] border border-[#E5E7EB] rounded-2xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#F97316] focus:border-transparent"
              onKeyDown={(e) => {
                if (e.key === "Enter") addCategory();
                if (e.key === "Escape") {
                  setShowAddCat(false);
                  setNewCatName("");
                }
              }}
            />
            <button
              onClick={addCategory}
              disabled={addingCat}
              className="bg-[#10B981] text-white rounded-2xl px-3 py-2.5 flex items-center justify-center min-h-0"
            >
              {addingCat ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
            </button>
            <button
              onClick={() => {
                setShowAddCat(false);
                setNewCatName("");
              }}
              className="bg-white border border-[#E5E7EB] text-[#374151] rounded-2xl px-3 py-2.5 min-h-0"
            >
              <X size={16} />
            </button>
          </div>
        </div>
      )}

      {/* No categories */}
      {categories.length === 0 && (
        <EmptyState
          icon={<Plus size={24} />}
          title="Create your first category"
          description="Add sections like Starters, Main Course, or Beverages to organise your menu."
          action={
            <Button variant="primary" size="md" onClick={() => setShowAddCat(true)}>
              Add category
            </Button>
          }
        />
      )}

      {activeCategory && (
        <>
          {/* Search */}
          <div className="relative mt-4 mb-3">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9CA3AF]" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search items..."
              className="w-full bg-white border border-[#E5E7EB] rounded-2xl pl-9 pr-9 py-2.5 text-sm text-[#0F0E17] placeholder:text-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#F97316] focus:border-transparent"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9CA3AF] min-h-0 min-w-0 p-0"
              >
                <X size={16} />
              </button>
            )}
          </div>

          {/* Count + bulk actions */}
          <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
            <p className="text-sm text-[#6B7280]">
              {search ? (
                <>
                  {visibleItems.length} result{visibleItems.length !== 1 ? "s" : ""} for{" "}
                  <span className="font-medium text-[#0F0E17]">&ldquo;{search}&rdquo;</span>
                </>
              ) : (
                <>
                  {catItems.length} items in{" "}
                  <span className="font-medium text-[#0F0E17]">{activeCategory.name}</span>
                </>
              )}
            </p>
            {catItems.length > 0 && (
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="sm" onClick={() => bulkSetAvailable(true)}>
                  All available
                </Button>
                <Button variant="ghost" size="sm" onClick={() => bulkSetAvailable(false)}>
                  All unavailable
                </Button>
              </div>
            )}
          </div>
        </>
      )}

      {/* No items */}
      {activeCategory && catItems.length === 0 && editingItemId === null && (
        <EmptyState
          icon={<UtensilsCrossed size={24} />}
          title="No items yet"
          description="Add your first dish, or scan an existing menu card to import in seconds."
          action={
            <Button variant="primary" size="md" onClick={addItem}>
              Add item
            </Button>
          }
        />
      )}

      {/* Item cards */}
      {dragEnabled ? (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={visibleItems.map((i) => i.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-3">
              {visibleItems.map((item) => (
                <SortableViewCard
                  key={item.id}
                  item={item}
                  onEdit={() => startEdit(item)}
                  onToggle={() => toggleAvailable(item)}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      ) : (
        <div className="space-y-3">
          {visibleItems.map((item) =>
            editingItemId === item.id ? (
              <EditItemCard
                key={item.id}
                item={item}
                onUpdate={(patch) => updateEditItem(item.id, patch)}
                onSave={() => saveItem(item)}
                onCancel={cancelEdit}
                onDelete={() => deleteItem(item.id)}
                onImageSelect={(file) => uploadImage(item, file)}
              />
            ) : (
              <ViewItemCard
                key={item.id}
                item={item}
                onEdit={() => startEdit(item)}
                onToggle={() => toggleAvailable(item)}
              />
            )
          )}
          {search && visibleItems.length === 0 && (
            <p className="text-sm text-[#9CA3AF] text-center py-8">No items match your search.</p>
          )}
        </div>
      )}

      {/* OCR overlay */}
      {showOCR && activeCatId && activeCategory && (
        <OCRScanner
          hotelId={hotelId}
          categoryId={activeCatId}
          categoryName={activeCategory.name}
          existingItemCount={catItems.length}
          onClose={() => setShowOCR(false)}
          onAdded={(newItems) => {
            setItems((prev) => [...prev, ...newItems]);
            setShowOCR(false);
          }}
        />
      )}

      {/* Centered, thumb-reachable add button */}
      {activeCatId && editingItemId === null && (
        <button
          onClick={addItem}
          aria-label="Add item"
          className="fixed z-30 left-1/2 -translate-x-1/2 bottom-[72px] md:left-auto md:right-8 md:translate-x-0 md:bottom-8 flex items-center gap-2 bg-[#F97316] hover:bg-[#EA6C0A] active:scale-95 text-white font-semibold text-sm rounded-full pl-5 pr-6 py-3.5 shadow-lg shadow-black/25 transition-all"
        >
          <Plus size={20} /> Add item
        </button>
      )}
    </div>
  );
}

function SortableViewCard({
  item,
  onEdit,
  onToggle,
}: {
  item: MenuItem;
  onEdit: () => void;
  onToggle: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
    zIndex: isDragging ? 10 : undefined,
  };
  return (
    <div ref={setNodeRef} style={style}>
      <ViewItemCard
        item={item}
        onEdit={onEdit}
        onToggle={onToggle}
        dragHandle={
          <button
            className="touch-none cursor-grab active:cursor-grabbing text-[#D1D5DB] hover:text-[#9CA3AF] min-h-0 min-w-0 px-0.5 flex-shrink-0"
            aria-label="Drag to reorder"
            {...attributes}
            {...listeners}
          >
            <GripVertical size={16} />
          </button>
        }
      />
    </div>
  );
}

function ViewItemCard({
  item,
  onEdit,
  onToggle,
  dragHandle,
}: {
  item: MenuItem;
  onEdit: () => void;
  onToggle: () => void;
  dragHandle?: ReactNode;
}) {
  return (
    <div className="bg-white border border-[#E5E7EB] rounded-3xl overflow-hidden transition-all">
      <div className="flex items-center gap-2 p-3">
        {dragHandle}
        {/* Thumbnail */}
        <button onClick={onEdit} className="w-12 h-12 rounded-2xl overflow-hidden flex-shrink-0 min-h-0 min-w-0">
          {item.image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={item.image_url} alt={item.name} loading="lazy" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full border-2 border-dashed border-[#E5E7EB] bg-[#F8F9FA] flex items-center justify-center">
              <ImagePlus size={18} className="text-[#D1D5DB]" />
            </div>
          )}
        </button>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <VegIndicator type={item.food_type} />
            <span className="text-sm font-medium text-[#0F0E17] truncate">{item.name}</span>
            {item.is_special && <Star size={12} className="text-[#F97316] fill-[#F97316] flex-shrink-0" />}
            {item.badge && (
              <span className="text-[10px] font-semibold text-[#F97316] bg-[#FFF7ED] border border-[#FED7AA] px-1.5 py-0.5 rounded-full flex-shrink-0">
                {item.badge}
              </span>
            )}
          </div>
          {item.description && <p className="text-xs text-[#6B7280] truncate mt-0.5">{item.description}</p>}
          <p className="text-sm font-semibold text-[#F97316] mt-1">₹{item.price}</p>
        </div>

        {/* Actions */}
        <div className="flex-shrink-0 flex flex-col items-center gap-2">
          <Toggle checked={item.is_available} onChange={onToggle} size="sm" />
          <button
            onClick={onEdit}
            className="w-8 h-8 flex items-center justify-center rounded-xl text-[#9CA3AF] hover:text-[#1C1C2E] hover:bg-[#F8F9FA] min-h-0 min-w-0"
          >
            <Pencil size={15} />
          </button>
        </div>
      </div>
    </div>
  );
}

function EditItemCard({
  item,
  onUpdate,
  onSave,
  onCancel,
  onDelete,
  onImageSelect,
}: {
  item: MenuItem;
  onUpdate: (patch: Partial<MenuItem>) => void;
  onSave: () => void;
  onCancel: () => void;
  onDelete: () => void;
  onImageSelect: (file: File) => void;
}) {
  const [uploading, setUploading] = useState(false);
  const hiddenInput = useRef<HTMLInputElement | null>(null);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    await onImageSelect(file);
    setUploading(false);
  }

  return (
    <div className="bg-white border-2 border-[#F97316] rounded-3xl p-4 space-y-3 shadow-md">
      {/* Row 1: image + name */}
      <div className="flex items-start gap-3">
        <button
          type="button"
          onClick={() => hiddenInput.current?.click()}
          className="w-16 h-16 rounded-2xl border-2 border-dashed border-[#E5E7EB] flex items-center justify-center flex-shrink-0 overflow-hidden min-h-0 min-w-0"
        >
          {uploading ? (
            <Loader2 size={20} className="animate-spin text-[#9CA3AF]" />
          ) : item.image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={item.image_url} alt="" loading="lazy" className="w-full h-full object-cover" />
          ) : (
            <ImagePlus size={20} className="text-[#D1D5DB]" />
          )}
        </button>
        <input ref={hiddenInput} type="file" accept="image/*" className="hidden" onChange={handleFile} />
        <Input value={item.name} onChange={(e) => onUpdate({ name: e.target.value })} placeholder="Item name" />
      </div>

      {/* Row 2: description */}
      <TextArea
        rows={2}
        value={item.description ?? ""}
        onChange={(e) => onUpdate({ description: e.target.value })}
        placeholder="Description (optional)"
      />

      {/* Row 3: price + food type */}
      <div className="flex gap-3">
        <div className="relative w-28">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#374151] text-sm font-medium">₹</span>
          <input
            type="number"
            step="0.01"
            min="0"
            value={item.price}
            onChange={(e) => onUpdate({ price: parseFloat(e.target.value) || 0 })}
            className="w-full border border-[#E5E7EB] rounded-2xl pl-7 pr-3 py-3 text-sm text-[#0F0E17] focus:outline-none focus:ring-2 focus:ring-[#F97316] focus:border-transparent"
          />
        </div>
        <Select
          value={item.food_type}
          onChange={(e) => onUpdate({ food_type: e.target.value as MenuItem["food_type"] })}
          className="flex-1"
        >
          <option value="veg">Veg</option>
          <option value="non_veg">Non-Veg</option>
          <option value="egg">Egg</option>
          <option value="vegan">Vegan</option>
        </Select>
      </div>

      {/* Row 4: badge */}
      <Input
        value={item.badge ?? ""}
        maxLength={20}
        onChange={(e) => onUpdate({ badge: e.target.value })}
        placeholder="Badge (optional) — e.g. Bestseller, Chef's Pick, New"
      />

      {/* Row 5: speciality */}
      <div className="flex items-center justify-between bg-[#FFF7ED] border border-[#FED7AA] rounded-2xl px-3 py-2.5">
        <div className="flex items-center gap-2">
          <Star size={15} className="text-[#F97316] fill-[#F97316]" />
          <span className="text-sm text-[#7C3A00]">Speciality — show first on the menu</span>
        </div>
        <Toggle checked={item.is_special ?? false} onChange={(v) => onUpdate({ is_special: v })} size="sm" />
      </div>

      {/* Row 6: actions */}
      <div className="flex items-center gap-2">
        <Button variant="primary" size="sm" icon={<Check size={14} />} onClick={onSave}>
          Save
        </Button>
        <Button variant="secondary" size="sm" icon={<X size={14} />} onClick={onCancel}>
          Cancel
        </Button>
        <Button
          variant="ghost"
          size="sm"
          icon={<Trash2 size={14} />}
          onClick={onDelete}
          className="ml-auto text-[#EF4444] hover:bg-[#FEF2F2]"
        >
          Delete
        </Button>
      </div>
    </div>
  );
}
