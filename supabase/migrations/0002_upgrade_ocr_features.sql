-- ============================================================
-- MenuQR upgrade migration — run in Supabase SQL Editor
-- Adds: menu item badges, customer item ratings, slug index.
-- Safe to re-run (idempotent).
-- ============================================================




-- 1. Faster slug lookups for the public menu (hotels.slug is already unique,
--    so this is usually a no-op, but kept for completeness).
create index if not exists idx_hotels_slug on hotels(slug);

-- 2. Optional badge text on menu items ("Bestseller", "Chef's Pick", "New").
alter table menu_items add column if not exists badge text;

-- 3. Customer item ratings (1-5 stars) shown on the public menu.
create table if not exists item_ratings (
  id uuid primary key default uuid_generate_v4(),
  item_id uuid references menu_items(id) on delete cascade,
  hotel_id uuid references hotels(id) on delete cascade,
  rating int not null check (rating between 1 and 5),
  table_slug text,
  created_at timestamptz not null default now()
);

create index if not exists idx_ratings_item on item_ratings(item_id);
create index if not exists idx_ratings_hotel on item_ratings(hotel_id);

alter table item_ratings enable row level security;

-- Anonymous customers can leave ratings and read aggregates.
drop policy if exists "Public can insert ratings" on item_ratings;
create policy "Public can insert ratings" on item_ratings for insert with check (true);

drop policy if exists "Public can view ratings" on item_ratings;
create policy "Public can view ratings" on item_ratings for select using (true);
