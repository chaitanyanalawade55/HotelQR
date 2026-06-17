export type Hotel = {
  id: string;
  owner_id: string;
  name: string;
  slug: string;
  owner_email: string;
  phone: string | null;
  address: string | null;
  status: "trial" | "active" | "suspended";
  created_at: string;
  updated_at: string;
};

export type HotelSettings = {
  id: string;
  hotel_id: string;
  logo_url: string | null;
  theme_color: string;
  accent_color: string;
  currency: string;
  default_language: string;
  subscription_tier: "basic" | "pro" | "enterprise";
  order_cancel_minutes: number;
};

export type Category = {
  id: string;
  hotel_id: string;
  name: string;
  sort_order: number;
  is_active: boolean;
  created_at: string;
};

export type MenuItem = {
  id: string;
  hotel_id: string;
  category_id: string | null;
  name: string;
  description: string | null;
  price: number;
  image_url: string | null;
  food_type: "veg" | "non_veg" | "egg" | "vegan";
  is_available: boolean;
  sort_order: number;
  badge: string | null;
  is_special: boolean;
  created_at: string;
  updated_at: string;
};

export type ItemRating = {
  id: string;
  item_id: string;
  hotel_id: string;
  rating: number;
  table_slug: string | null;
  created_at: string;
};

export type TableQR = {
  id: string;
  hotel_id: string;
  table_number: string;
  qr_slug: string;
  created_at: string;
};

export type Order = {
  id: string;
  hotel_id: string;
  table_slug: string | null;
  table_number: string | null;
  items: OrderItem[];
  total: number;
  status: "new" | "preparing" | "done" | "cancelled";
  cancel_token: string | null;
  created_at: string;
};

export type OrderItem = {
  item_id: string;
  name: string;
  price: number;
  qty: number;
};

export type WaiterCall = {
  id: string;
  hotel_id: string;
  table_slug: string | null;
  table_number: string | null;
  status: "pending" | "acknowledged";
  created_at: string;
};
