"use client";
import { useState, useRef, useEffect } from "react";
import {
  Plus, X, Check, Pencil, Trash2, ImagePlus, UtensilsCrossed, Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/Button";
import { Input, TextArea, Select } from "@/components/ui/Input";
import { Toggle } from "@/components/ui/Toggle";
import { EmptyState } from "@/components/ui/EmptyState";
import { VegIndicator } from "@/components/ui/VegIndicator";
import { createClient } from "@/lib/supabase/client";
import type { Category, MenuItem } from "@/types/database";

interface Props {
  hotelId: string;
  initialCategories: Category[];
  initialItems: MenuItem[];
}

export function MenuManager({ hotelId, initialCategories, initialItems }: Props) {
  const [categories, setCategories] = useState<Category[]>(initialCategories);
  const [items, setItems] = useState<MenuItem[]>(initialItems);
  const [activeCatId, setActiveCatId] = useState<string | null>(
    initialCategories[0]?.id ?? null
  );
  const [showAddCat, setShowAddCat] = useState(false);
  const [newCatName, setNewCatName] = useState("");
  const [addingCat, setAddingCat] = useState(false);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const catInputRef = useRef<HTMLInputElement>(null);
const supabase = createClient();

  useEffect(() => {
    if (showAddCat) catInputRef.current?.focus();
  }, [showAddCat]);

  const catItems = items.filter((i) => i.category_id === activeCatId);
  const activeCategory = categories.find((c) => c.id === activeCatId);

  async function addCategory() {
    if (!newCatName.trim()) return;
    setAddingCat(true);
    const { data, error } = await supabase
      .from("categories")
      .insert({ hotel_id: hotelId, name: newCatName.trim(), sort_order: categories.length, is_active: true })
      .select()
      .single();
    if (error) { toast.error("Something went wrong"); setAddingCat(false); return; }
    setCategories((prev) => [...prev, data as Category]);
    setActiveCatId(data.id);
    setNewCatName("");
    setShowAddCat(false);
    setAddingCat(false);
    toast.success("Category added");
  }

  async function deleteCategory(catId: string) {
    const { error } = await supabase.from("categories").delete().eq("id", catId);
    if (error) { toast.error("Something went wrong"); return; }
    setCategories((prev) => prev.filter((c) => c.id !== catId));
    if (activeCatId === catId) setActiveCatId(categories.find((c) => c.id !== catId)?.id ?? null);
    toast.success("Category deleted");
  }

  async function addItem() {
    if (!activeCatId) return;
    const { data, error } = await supabase
      .from("menu_items")
      .insert({
        hotel_id: hotelId,
        category_id: activeCatId,
        name: "New item",
        price: 0,
        food_type: "veg",
        is_available: true,
        sort_order: catItems.length,
      })
      .select()
      .single();
    if (error) { toast.error("Something went wrong"); return; }
    setItems((prev) => [...prev, data as MenuItem]);
    setEditingItemId(data.id);
  }

  async function saveItem(item: MenuItem) {
    const { error } = await supabase
      .from("menu_items")
      .update({ name: item.name, description: item.description, price: item.price, food_type: item.food_type, image_url: item.image_url })
      .eq("id", item.id);
    if (error) { toast.error("Something went wrong"); return; }
    toast.success("Changes saved");
    setEditingItemId(null);
  }

  async function deleteItem(itemId: string) {
    const { error } = await supabase.from("menu_items").delete().eq("id", itemId);
    if (error) { toast.error("Something went wrong"); return; }
    setItems((prev) => prev.filter((i) => i.id !== itemId));
    setEditingItemId(null);
    toast.success("Item removed");
  }

  async function toggleAvailable(item: MenuItem) {
    const { error } = await supabase
      .from("menu_items")
      .update({ is_available: !item.is_available })
      .eq("id", item.id);
    if (error) { toast.error("Something went wrong"); return; }
    setItems((prev) => prev.map((i) => i.id === item.id ? { ...i, is_available: !i.is_available } : i));
  }

  function updateEditItem(id: string, patch: Partial<MenuItem>) {
    setItems((prev) => prev.map((i) => i.id === id ? { ...i, ...patch } : i));
  }

  async function uploadImage(item: MenuItem, file: File) {
    if (file.size > 2 * 1024 * 1024) { toast.error("Image must be under 2MB"); return; }
    const ext = file.name.split(".").pop();
    const path = `${hotelId}/${item.id}.${ext}`;
    const { error: uploadError } = await supabase.storage
      .from("menu-images")
      .upload(path, file, { upsert: true });
    if (uploadError) { toast.error("Image upload failed. Try again."); return; }
    const { data: urlData } = supabase.storage.from("menu-images").getPublicUrl(path);
    const url = `${urlData.publicUrl}?t=${Date.now()}`;
    updateEditItem(item.id, { image_url: url });
    toast.success("Image uploaded");
  }

  return (
    <div className="px-4 md:px-8 py-6">
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-xl font-bold text-[#0F0E17]">Menu</h1>
        {activeCatId && (
          <Button variant="secondary" size="sm" icon={<Plus size={14} />} onClick={addItem}>
            Add item
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
                onClick={(e) => { e.stopPropagation(); deleteCategory(cat.id); }}
              >
                <X size={12} />
              </span>
            )}
          </button>
        ))}
        <button
          onClick={() => setShowAddCat(true)}
          className="flex items-center px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap shrink-0 bg-[#FFF7ED] text-[#F97316] border border-[#FED7AA]"
        >
          <Plus size={12} className="mr-1" /> Add
        </button>
      </div>

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
                if (e.key === "Escape") { setShowAddCat(false); setNewCatName(""); }
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
              onClick={() => { setShowAddCat(false); setNewCatName(""); }}
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
          description='Add sections like Starters, Main Course, or Beverages to organise your menu.'
          action={
            <Button variant="primary" size="md" onClick={() => setShowAddCat(true)}>
              Add category
            </Button>
          }
        />
      )}

      {/* Item count */}
      {activeCategory && (
        <p className="text-sm text-[#6B7280] mb-3 mt-3">
          {catItems.length} items in{" "}
          <span className="font-medium text-[#0F0E17]">{activeCategory.name}</span>
        </p>
      )}

      {/* No items */}
      {activeCategory && catItems.length === 0 && editingItemId === null && (
        <EmptyState
          icon={<UtensilsCrossed size={24} />}
          title="No items yet"
          description="Add your first dish to this category."
          action={
            <Button variant="primary" size="md" onClick={addItem}>
              Add item
            </Button>
          }
        />
      )}

      {/* Item cards */}
      <div className="space-y-3">
        {catItems.map((item) =>
          editingItemId === item.id ? (
            <EditItemCard
              key={item.id}
              item={item}
              onUpdate={(patch) => updateEditItem(item.id, patch)}
              onSave={() => saveItem(item)}
              onCancel={() => setEditingItemId(null)}
              onDelete={() => deleteItem(item.id)}
              onImageSelect={(file) => uploadImage(item, file)}
            />
          ) : (
            <ViewItemCard
              key={item.id}
              item={item}
              onEdit={() => setEditingItemId(item.id)}
              onToggle={() => toggleAvailable(item)}
              onImageClick={() => {
                setEditingItemId(item.id);
              }}
            />
          )
        )}
      </div>
    </div>
  );
}

function ViewItemCard({
  item,
  onEdit,
  onToggle,
  onImageClick,
}: {
  item: MenuItem;
  onEdit: () => void;
  onToggle: () => void;
  onImageClick: () => void;
}) {
  return (
    <div className="bg-white border border-[#E5E7EB] rounded-3xl overflow-hidden transition-all">
      <div className="flex items-center gap-3 p-3">
        {/* Thumbnail */}
        <button
          onClick={onImageClick}
          className="w-12 h-12 rounded-2xl overflow-hidden flex-shrink-0 min-h-0 min-w-0"
        >
          {item.image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={item.image_url} alt={item.name} className="w-full h-full object-cover" />
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
          </div>
          {item.description && (
            <p className="text-xs text-[#6B7280] truncate mt-0.5">{item.description}</p>
          )}
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
            <img src={item.image_url} alt="" className="w-full h-full object-cover" />
          ) : (
            <ImagePlus size={20} className="text-[#D1D5DB]" />
          )}
        </button>
        <input ref={hiddenInput} type="file" accept="image/*" className="hidden" onChange={handleFile} />
        <Input
          value={item.name}
          onChange={(e) => onUpdate({ name: e.target.value })}
          placeholder="Item name"
        />
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

      {/* Row 4: actions */}
      <div className="flex items-center gap-2">
        <Button variant="primary" size="sm" icon={<Check size={14} />} onClick={onSave}>Save</Button>
        <Button variant="secondary" size="sm" icon={<X size={14} />} onClick={onCancel}>Cancel</Button>
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
