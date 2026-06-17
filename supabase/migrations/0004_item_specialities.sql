-- ============================================================
-- Specialities — run in Supabase SQL Editor (safe to re-run)
-- ============================================================
-- Lets a hotel admin flag signature dishes. The public menu shows these first,
-- in a highlighted "Our Specialities" section.

alter table menu_items add column if not exists is_special boolean not null default false;

-- Partial index — only the (few) special rows are indexed.
create index if not exists idx_menu_items_special on menu_items(hotel_id) where is_special;
