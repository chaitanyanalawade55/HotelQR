-- ============================================================
-- 0009_orders_insert_and_append.sql
-- Run in Supabase SQL Editor. Idempotent (safe to re-run).
-- ============================================================
-- Fixes:
--   1. "Could not place order" — guarantees the public (anon) key may INSERT
--      into `orders`. RLS is on, but the base INSERT policy/grant for anon was
--      missing (or was revoked when other anon grants were tightened), so every
--      customer insert was rejected with 42501 (row-level security violation).
--   2. "Add more items to the same order" — a SECURITY DEFINER RPC that appends
--      items to an EXISTING order (validated by the customer's cancel_token),
--      so the manager's Live Orders sees the same order grow via a realtime
--      UPDATE instead of a second order row.
-- ============================================================

-- Orders is customer-writable but owner-readable.
alter table public.orders enable row level security;

-- ------------------------------------------------------------
-- 1. Public can PLACE an order (the fix for "could not place order").
-- ------------------------------------------------------------
grant insert on public.orders to anon, authenticated;

drop policy if exists "orders_public_insert" on public.orders;
create policy "orders_public_insert" on public.orders
  for insert to anon, authenticated
  with check (true);

-- ------------------------------------------------------------
-- 2. Hotel owner can READ + UPDATE their own hotel's orders (dashboard).
--    (Additive — leaves any pre-existing owner policies in place.)
-- ------------------------------------------------------------
grant select, update on public.orders to authenticated;

drop policy if exists "orders_owner_select" on public.orders;
create policy "orders_owner_select" on public.orders
  for select to authenticated
  using (hotel_id in (select id from public.hotels where owner_id = auth.uid()));

drop policy if exists "orders_owner_update" on public.orders;
create policy "orders_owner_update" on public.orders
  for update to authenticated
  using (hotel_id in (select id from public.hotels where owner_id = auth.uid()))
  with check (hotel_id in (select id from public.hotels where owner_id = auth.uid()));

-- ------------------------------------------------------------
-- 3. Append more items to the SAME order (customer "Add more items").
--    Token-gated so only the customer who placed it can append, and only while
--    the order is still open (new/preparing). Bypasses RLS safely via DEFINER.
-- ------------------------------------------------------------
create or replace function public.append_to_order(
  p_order_id uuid,
  p_token text,
  p_items jsonb,
  p_added_total numeric
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders%rowtype;
begin
  select * into v_order from public.orders where id = p_order_id;
  if not found then return false; end if;
  if v_order.cancel_token is null or v_order.cancel_token <> p_token then return false; end if;
  if v_order.status not in ('new', 'preparing') then return false; end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' then return false; end if;

  update public.orders
     set items = coalesce(items, '[]'::jsonb) || p_items,
         total = coalesce(total, 0) + coalesce(p_added_total, 0)
   where id = p_order_id;

  return true;
end;
$$;

grant execute on function public.append_to_order(uuid, text, jsonb, numeric) to anon, authenticated;
