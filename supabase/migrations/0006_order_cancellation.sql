-- ============================================================
-- Customer order cancellation — run in Supabase SQL Editor (idempotent)
-- ============================================================
-- Lets a customer cancel their own order within an admin-configurable window.

-- 1. Allow the 'cancelled' status.
alter table orders drop constraint if exists orders_status_check;
alter table orders add constraint orders_status_check
  check (status in ('new', 'preparing', 'done', 'cancelled'));

-- 2. Secret token so ONLY the customer who placed the order can cancel it.
alter table orders add column if not exists cancel_token text;

-- 3. Admin-configurable cancellation window (minutes). 0 = cancellation disabled.
alter table hotel_settings add column if not exists order_cancel_minutes int not null default 5;

-- 4. Secure cancel: validates the token + window server-side and bypasses RLS
--    safely (SECURITY DEFINER). The anon key can only ever flip its own order to
--    'cancelled', and only while it is still 'new' and inside the window.
create or replace function cancel_order(p_order_id uuid, p_token text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders%rowtype;
  v_minutes int;
begin
  select * into v_order from public.orders where id = p_order_id;
  if not found then return false; end if;
  if v_order.cancel_token is null or v_order.cancel_token <> p_token then return false; end if;
  if v_order.status <> 'new' then return false; end if;

  select order_cancel_minutes into v_minutes from public.hotel_settings where hotel_id = v_order.hotel_id;
  v_minutes := coalesce(v_minutes, 5);
  if v_minutes <= 0 then return false; end if;
  if now() > v_order.created_at + make_interval(mins => v_minutes) then return false; end if;

  update public.orders set status = 'cancelled' where id = p_order_id;
  return true;
end;
$$;

grant execute on function cancel_order(uuid, text) to anon, authenticated;
