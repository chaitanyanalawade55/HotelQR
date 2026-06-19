-- ============================================================
-- 0012_staff_portal.sql — Staff Portal
-- Run in Supabase SQL Editor. Idempotent (safe to re-run).
-- ============================================================
-- Adds a third actor: STAFF (waiter/cashier/chef/cleaner).
--   * Managers (hotel owners) create/manage staff + assign tables — plain owner
--     RLS, exactly like the rest of the dashboard.
--   * Staff are NOT Supabase Auth users (the app has no service-role key). They
--     log in with mobile + password via a SECURITY DEFINER RPC that returns an
--     opaque session token (kept in localStorage) — the same capability-token
--     pattern customers use for cancel_order / append_to_order (0006/0009).
--   * Passwords are hashed with pgcrypto crypt()/gen_salt('bf') (pgcrypto is
--     already enabled — see 0007).
--   * Realtime "Call Waiter" alerts reach the staff portal (anon key) via a
--     hotel-scoped realtime.send() broadcast from a trigger, guarded so it can
--     NEVER break a customer order insert.
-- ============================================================

create extension if not exists pgcrypto;

-- ------------------------------------------------------------
-- 1. Tables
-- ------------------------------------------------------------
create table if not exists public.staff (
  id uuid primary key default gen_random_uuid(),
  hotel_id uuid not null references public.hotels(id) on delete cascade,
  staff_code text not null,
  full_name text not null,
  mobile text not null,
  email text,
  gender text,
  date_of_birth date,
  address text,
  emergency_contact_name text,
  emergency_contact_number text,
  joining_date date,
  profile_url text,
  role text not null default 'waiter',
  shift text,
  salary numeric,
  is_active boolean not null default true,
  password_hash text,                       -- set only via RPC, never from client
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (hotel_id, mobile),
  unique (hotel_id, staff_code)
);
create index if not exists idx_staff_hotel on public.staff(hotel_id);

create table if not exists public.staff_table_assignments (
  id uuid primary key default gen_random_uuid(),
  hotel_id uuid not null references public.hotels(id) on delete cascade,
  staff_id uuid not null references public.staff(id) on delete cascade,
  table_id uuid not null references public.tables(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (staff_id, table_id)
);
create index if not exists idx_sta_hotel on public.staff_table_assignments(hotel_id);
create index if not exists idx_sta_staff on public.staff_table_assignments(staff_id);

create table if not exists public.staff_sessions (
  token text primary key default encode(extensions.gen_random_bytes(32), 'hex'),
  staff_id uuid not null references public.staff(id) on delete cascade,
  hotel_id uuid not null references public.hotels(id) on delete cascade,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '30 days')
);
create index if not exists idx_staff_sessions_staff on public.staff_sessions(staff_id);

-- Reuse orders / waiter_calls for staff context.
alter table public.orders add column if not exists assigned_staff_id uuid references public.staff(id) on delete set null;
alter table public.orders add column if not exists notes text;
alter table public.waiter_calls add column if not exists assigned_staff_id uuid references public.staff(id) on delete set null;

-- ------------------------------------------------------------
-- 2. Triggers
-- ------------------------------------------------------------
-- 2a. Auto Staff ID per hotel (e.g. STF-0001) when not supplied.
create or replace function public.tg_staff_code()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.staff_code is null or new.staff_code = '' then
    new.staff_code := 'STF-' || lpad(
      ((select count(*) from public.staff where hotel_id = new.hotel_id) + 1)::text, 4, '0');
  end if;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_staff_code on public.staff;
create trigger trg_staff_code before insert or update on public.staff
  for each row execute function public.tg_staff_code();

-- 2b. Auto-assign a waiter to customer-initiated orders / waiter calls based on
--     the table assignment (earliest), so "assigned waiter" is known everywhere.
create or replace function public.tg_assign_staff_by_table()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.assigned_staff_id is null and new.table_number is not null then
    select sta.staff_id into new.assigned_staff_id
    from public.staff_table_assignments sta
    join public.tables t on t.id = sta.table_id
    where sta.hotel_id = new.hotel_id and t.table_number = new.table_number
    order by sta.created_at
    limit 1;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_orders_assign_staff on public.orders;
create trigger trg_orders_assign_staff before insert on public.orders
  for each row execute function public.tg_assign_staff_by_table();

drop trigger if exists trg_waiter_assign_staff on public.waiter_calls;
create trigger trg_waiter_assign_staff before insert on public.waiter_calls
  for each row execute function public.tg_assign_staff_by_table();

-- 2c. Realtime broadcast to the hotel's staff channel. Fully guarded — if the
--     realtime API isn't available it silently no-ops and never blocks the write.
create or replace function public.tg_staff_broadcast()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_payload jsonb;
begin
  v_payload := jsonb_build_object(
    'src', tg_table_name,
    'op', tg_op,
    'id', new.id,
    'table_number', new.table_number,
    'status', case when tg_table_name = 'orders' then new.status else null end,
    'assigned_staff_id', new.assigned_staff_id
  );
  begin
    perform realtime.send(v_payload, 'staff_event', 'staff:' || new.hotel_id::text, false);
  exception when others then
    null; -- realtime unavailable / different signature — never break the host write
  end;
  return new;
end;
$$;

drop trigger if exists trg_orders_broadcast on public.orders;
create trigger trg_orders_broadcast after insert or update on public.orders
  for each row execute function public.tg_staff_broadcast();

drop trigger if exists trg_waiter_broadcast on public.waiter_calls;
create trigger trg_waiter_broadcast after insert on public.waiter_calls
  for each row execute function public.tg_staff_broadcast();

-- ------------------------------------------------------------
-- 3. RLS — managers (hotel owners) manage their own staff
-- ------------------------------------------------------------
alter table public.staff enable row level security;
alter table public.staff_table_assignments enable row level security;
alter table public.staff_sessions enable row level security;

revoke all on public.staff_sessions from anon, authenticated;
-- password_hash is never read or written by the client; only RPCs touch it.
revoke insert, update on public.staff from anon;
grant select, insert, update, delete on public.staff to authenticated;
grant select, insert, delete on public.staff_table_assignments to authenticated;
-- Column-level: authenticated may write everything EXCEPT password_hash.
revoke update (password_hash) on public.staff from authenticated;

drop policy if exists "staff_owner_all" on public.staff;
create policy "staff_owner_all" on public.staff
  for all to authenticated
  using (hotel_id in (select id from public.hotels where owner_id = auth.uid()))
  with check (hotel_id in (select id from public.hotels where owner_id = auth.uid()));

drop policy if exists "sta_owner_all" on public.staff_table_assignments;
create policy "sta_owner_all" on public.staff_table_assignments
  for all to authenticated
  using (hotel_id in (select id from public.hotels where owner_id = auth.uid()))
  with check (hotel_id in (select id from public.hotels where owner_id = auth.uid()));

-- Optional: live manager list. Safe to re-run.
do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'staff') then
    alter publication supabase_realtime add table public.staff;
  end if;
end $$;

-- ------------------------------------------------------------
-- 4. Internal helpers (DEFINER, not client-callable)
-- ------------------------------------------------------------
create or replace function public._owns_hotel(p_hotel_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (select 1 from public.hotels where id = p_hotel_id and owner_id = auth.uid());
$$;
revoke execute on function public._owns_hotel(uuid) from anon, public;
grant execute on function public._owns_hotel(uuid) to authenticated;

-- Validate a staff session token → returns the staff row (raises on failure).
create or replace function public._staff_session(p_token text)
returns public.staff
language plpgsql
security definer
set search_path = public
as $$
declare
  v_staff public.staff%rowtype;
  v_session public.staff_sessions%rowtype;
begin
  if p_token is null or p_token = '' then raise exception 'unauthorized'; end if;
  select * into v_session from public.staff_sessions where token = p_token;
  if not found then raise exception 'unauthorized'; end if;
  if v_session.expires_at < now() then
    delete from public.staff_sessions where token = p_token;
    raise exception 'unauthorized';
  end if;
  select * into v_staff from public.staff where id = v_session.staff_id;
  if not found or v_staff.is_active = false then raise exception 'unauthorized'; end if;
  update public.staff_sessions set last_seen_at = now() where token = p_token;
  return v_staff;
end;
$$;
revoke execute on function public._staff_session(text) from anon, public;

-- Public-facing JSON for a staff row (never includes password_hash) + tables.
create or replace function public._staff_json(v_staff public.staff)
returns jsonb
language sql
security definer
set search_path = public
stable
as $$
  select jsonb_build_object(
    'id', v_staff.id,
    'hotel_id', v_staff.hotel_id,
    'staff_code', v_staff.staff_code,
    'full_name', v_staff.full_name,
    'mobile', v_staff.mobile,
    'email', v_staff.email,
    'role', v_staff.role,
    'shift', v_staff.shift,
    'is_active', v_staff.is_active,
    'profile_url', v_staff.profile_url,
    'assigned_tables', coalesce((
      select jsonb_agg(jsonb_build_object('table_id', t.id, 'table_number', t.table_number) order by t.table_number)
      from public.staff_table_assignments sta
      join public.tables t on t.id = sta.table_id
      where sta.staff_id = v_staff.id
    ), '[]'::jsonb)
  );
$$;
revoke execute on function public._staff_json(public.staff) from anon, public;

-- ------------------------------------------------------------
-- 5. Manager RPCs (owner-checked)
-- ------------------------------------------------------------
create or replace function public.manager_create_staff(
  p_hotel_id uuid,
  p_full_name text,
  p_mobile text,
  p_password text,
  p_role text default 'waiter',
  p_shift text default null,
  p_email text default null,
  p_gender text default null,
  p_dob date default null,
  p_address text default null,
  p_emergency_name text default null,
  p_emergency_number text default null,
  p_joining_date date default null,
  p_salary numeric default null,
  p_profile_url text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_staff public.staff%rowtype;
begin
  if not public._owns_hotel(p_hotel_id) then raise exception 'not authorized'; end if;
  if coalesce(trim(p_full_name), '') = '' then raise exception 'full name required'; end if;
  if coalesce(trim(p_mobile), '') = '' then raise exception 'mobile required'; end if;
  if coalesce(p_password, '') = '' then raise exception 'password required'; end if;

  insert into public.staff (
    hotel_id, full_name, mobile, email, gender, date_of_birth, address,
    emergency_contact_name, emergency_contact_number, joining_date, profile_url,
    role, shift, salary, password_hash
  ) values (
    p_hotel_id, p_full_name, p_mobile, p_email, p_gender, p_dob, p_address,
    p_emergency_name, p_emergency_number, p_joining_date, p_profile_url,
    coalesce(nullif(trim(p_role), ''), 'waiter'), p_shift, p_salary,
    extensions.crypt(p_password, extensions.gen_salt('bf'))
  )
  returning * into v_staff;

  return public._staff_json(v_staff);
end;
$$;
grant execute on function public.manager_create_staff(uuid, text, text, text, text, text, text, text, date, text, text, text, date, numeric, text) to authenticated;

create or replace function public.manager_set_staff_password(p_staff_id uuid, p_password text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_hotel uuid;
begin
  select hotel_id into v_hotel from public.staff where id = p_staff_id;
  if v_hotel is null or not public._owns_hotel(v_hotel) then raise exception 'not authorized'; end if;
  if coalesce(p_password, '') = '' then raise exception 'password required'; end if;
  update public.staff set password_hash = extensions.crypt(p_password, extensions.gen_salt('bf')), updated_at = now() where id = p_staff_id;
  return true;
end;
$$;
grant execute on function public.manager_set_staff_password(uuid, text) to authenticated;

-- ------------------------------------------------------------
-- 6. Staff RPCs (token-gated)
-- ------------------------------------------------------------
create or replace function public.staff_login(p_hotel_id uuid, p_mobile text, p_password text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_staff public.staff%rowtype;
  v_token text;
begin
  select * into v_staff from public.staff
   where hotel_id = p_hotel_id and mobile = trim(p_mobile);
  if not found then raise exception 'invalid credentials'; end if;
  if v_staff.is_active = false then raise exception 'account disabled'; end if;
  if v_staff.password_hash is null
     or extensions.crypt(p_password, v_staff.password_hash) <> v_staff.password_hash then
    raise exception 'invalid credentials';
  end if;

  insert into public.staff_sessions (staff_id, hotel_id)
  values (v_staff.id, v_staff.hotel_id)
  returning token into v_token;

  return jsonb_build_object('token', v_token, 'staff', public._staff_json(v_staff));
end;
$$;
grant execute on function public.staff_login(uuid, text, text) to anon, authenticated;

create or replace function public.staff_me(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_staff public.staff%rowtype;
begin
  v_staff := public._staff_session(p_token);
  return public._staff_json(v_staff);
end;
$$;
grant execute on function public.staff_me(text) to anon, authenticated;

create or replace function public.staff_logout(p_token text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.staff_sessions where token = p_token;
  return true;
end;
$$;
grant execute on function public.staff_logout(text) to anon, authenticated;

create or replace function public.staff_menu(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_staff public.staff%rowtype;
begin
  v_staff := public._staff_session(p_token);
  return jsonb_build_object(
    'categories', coalesce((
      select jsonb_agg(to_jsonb(c) order by c.sort_order)
      from (
        select id, name, sort_order from public.categories
        where hotel_id = v_staff.hotel_id and is_active = true
      ) c
    ), '[]'::jsonb),
    'items', coalesce((
      select jsonb_agg(to_jsonb(i) order by i.sort_order)
      from (
        select id, category_id, name, description, price, image_url, food_type,
               is_available, is_special, badge, sort_order
        from public.menu_items
        where hotel_id = v_staff.hotel_id
      ) i
    ), '[]'::jsonb)
  );
end;
$$;
grant execute on function public.staff_menu(text) to anon, authenticated;

-- Active (incomplete) orders for the staff's assigned tables (+ unassigned).
create or replace function public.staff_active_orders(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_staff public.staff%rowtype;
begin
  v_staff := public._staff_session(p_token);
  return coalesce((
    select jsonb_agg(to_jsonb(x) order by x.created_at desc)
    from (
      select o.id, o.table_number, o.items, o.total, o.status, o.notes, o.created_at,
             o.assigned_staff_id, s2.full_name as assigned_staff_name
      from public.orders o
      left join public.staff s2 on s2.id = o.assigned_staff_id
      where o.hotel_id = v_staff.hotel_id
        and o.status in ('new', 'preparing')
        and (
          o.assigned_staff_id = v_staff.id
          or o.assigned_staff_id is null
          or o.table_number in (
            select t.table_number from public.staff_table_assignments sta
            join public.tables t on t.id = sta.table_id
            where sta.staff_id = v_staff.id
          )
        )
    ) x
  ), '[]'::jsonb);
end;
$$;
grant execute on function public.staff_active_orders(text) to anon, authenticated;

create or replace function public.staff_create_order(
  p_token text,
  p_table_number text,
  p_items jsonb,
  p_total numeric,
  p_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_staff public.staff%rowtype;
  v_id uuid;
begin
  v_staff := public._staff_session(p_token);
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'order is empty';
  end if;
  if coalesce(trim(p_table_number), '') = '' then raise exception 'table required'; end if;

  insert into public.orders (hotel_id, table_number, items, total, status, assigned_staff_id, notes)
  values (v_staff.hotel_id, trim(p_table_number), p_items, coalesce(p_total, 0), 'new', v_staff.id, p_notes)
  returning id into v_id;
  return v_id;
end;
$$;
grant execute on function public.staff_create_order(text, text, jsonb, numeric, text) to anon, authenticated;

-- Replace items (add/increase/decrease/remove) — only while the kitchen has not
-- started, i.e. status = 'new'.
create or replace function public.staff_update_order_items(
  p_token text,
  p_order_id uuid,
  p_items jsonb,
  p_total numeric
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_staff public.staff%rowtype;
  v_order public.orders%rowtype;
begin
  v_staff := public._staff_session(p_token);
  select * into v_order from public.orders where id = p_order_id;
  if not found or v_order.hotel_id <> v_staff.hotel_id then raise exception 'not found'; end if;
  if v_order.status <> 'new' then raise exception 'order already in the kitchen'; end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'order is empty';
  end if;
  update public.orders set items = p_items, total = coalesce(p_total, 0) where id = p_order_id;
  return true;
end;
$$;
grant execute on function public.staff_update_order_items(text, uuid, jsonb, numeric) to anon, authenticated;

-- Status transitions: new→preparing, new→cancelled, preparing→done, preparing→cancelled.
create or replace function public.staff_update_order_status(
  p_token text,
  p_order_id uuid,
  p_status text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_staff public.staff%rowtype;
  v_order public.orders%rowtype;
  v_ok boolean;
begin
  v_staff := public._staff_session(p_token);
  select * into v_order from public.orders where id = p_order_id;
  if not found or v_order.hotel_id <> v_staff.hotel_id then raise exception 'not found'; end if;

  v_ok := (v_order.status = 'new' and p_status in ('preparing', 'cancelled'))
       or (v_order.status = 'preparing' and p_status in ('done', 'cancelled'));
  if not v_ok then raise exception 'invalid status change: % -> %', v_order.status, p_status; end if;

  update public.orders set status = p_status where id = p_order_id;
  return true;
end;
$$;
grant execute on function public.staff_update_order_status(text, uuid, text) to anon, authenticated;

create or replace function public.staff_waiter_calls(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_staff public.staff%rowtype;
begin
  v_staff := public._staff_session(p_token);
  return coalesce((
    select jsonb_agg(to_jsonb(x) order by x.created_at desc)
    from (
      select w.id, w.table_number, w.created_at, w.assigned_staff_id
      from public.waiter_calls w
      where w.hotel_id = v_staff.hotel_id
        and w.status = 'pending'
        and (
          w.assigned_staff_id = v_staff.id
          or w.assigned_staff_id is null
          or w.table_number in (
            select t.table_number from public.staff_table_assignments sta
            join public.tables t on t.id = sta.table_id
            where sta.staff_id = v_staff.id
          )
        )
    ) x
  ), '[]'::jsonb);
end;
$$;
grant execute on function public.staff_waiter_calls(text) to anon, authenticated;

create or replace function public.staff_ack_waiter(p_token text, p_call_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_staff public.staff%rowtype;
begin
  v_staff := public._staff_session(p_token);
  update public.waiter_calls set status = 'acknowledged'
   where id = p_call_id and hotel_id = v_staff.hotel_id;
  return true;
end;
$$;
grant execute on function public.staff_ack_waiter(text, uuid) to anon, authenticated;

-- ------------------------------------------------------------
-- 7. Storage bucket for staff profile pictures
-- ------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('staff-photos', 'staff-photos', true)
on conflict (id) do nothing;

drop policy if exists "staff_photos_public_read" on storage.objects;
create policy "staff_photos_public_read" on storage.objects
  for select to anon, authenticated using (bucket_id = 'staff-photos');

drop policy if exists "staff_photos_auth_write" on storage.objects;
create policy "staff_photos_auth_write" on storage.objects
  for insert to authenticated with check (bucket_id = 'staff-photos');

drop policy if exists "staff_photos_auth_update" on storage.objects;
create policy "staff_photos_auth_update" on storage.objects
  for update to authenticated using (bucket_id = 'staff-photos');

drop policy if exists "staff_photos_auth_delete" on storage.objects;
create policy "staff_photos_auth_delete" on storage.objects
  for delete to authenticated using (bucket_id = 'staff-photos');
