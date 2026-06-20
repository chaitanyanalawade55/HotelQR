-- ============================================================
-- Speciality category + Water default + special-nudge settings
-- Run in the Supabase SQL Editor (idempotent — safe to re-run).
-- ============================================================
-- Goals:
--   1. Every hotel has a "Speciality" category pinned FIRST (sort_order = -1).
--   2. That category always has a default "Water" item at ₹20.
--   3. New hotels get both automatically (trigger on hotels insert).
--   4. Owner-configurable "special menu" nudge popup (enabled + duration).

-- 1. Popup-nudge settings on hotel_settings.
alter table hotel_settings add column if not exists special_nudge_enabled boolean not null default true;
alter table hotel_settings add column if not exists special_nudge_seconds int not null default 5;

-- 2. Idempotent seeder: ensure ONE hotel has the Speciality category + Water item.
--    SECURITY DEFINER so it works from the signup trigger regardless of RLS.
create or replace function ensure_speciality(p_hotel_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cat uuid;
begin
  select id into v_cat
    from categories
    where hotel_id = p_hotel_id and lower(name) = 'speciality'
    limit 1;

  if v_cat is null then
    insert into categories (hotel_id, name, sort_order, is_active)
      values (p_hotel_id, 'Speciality', -1, true)
      returning id into v_cat;
  else
    -- Keep it pinned first and visible.
    update categories set sort_order = -1, is_active = true where id = v_cat;
  end if;

  -- Default Water item — always present so the category is never empty.
  if not exists (
    select 1 from menu_items
      where hotel_id = p_hotel_id and category_id = v_cat and lower(name) = 'water'
  ) then
    insert into menu_items
      (hotel_id, category_id, name, description, price, food_type, is_available, sort_order)
      values
      (p_hotel_id, v_cat, 'Water', 'Packaged drinking water', 20, 'veg', true, 0);
  end if;
end;
$$;

-- 3. Backfill every existing hotel.
do $$
declare
  r record;
begin
  for r in select id from hotels loop
    perform ensure_speciality(r.id);
  end loop;
end;
$$;

-- 4. Auto-seed Speciality + Water whenever a new hotel is created.
create or replace function trg_seed_speciality()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform ensure_speciality(new.id);
  return new;
end;
$$;

drop trigger if exists seed_speciality on hotels;
create trigger seed_speciality
  after insert on hotels
  for each row execute function trg_seed_speciality();
