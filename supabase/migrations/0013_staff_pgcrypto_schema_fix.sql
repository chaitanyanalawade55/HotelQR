-- ============================================================
-- 0013_staff_pgcrypto_schema_fix.sql
-- Run in Supabase SQL Editor. Idempotent (safe to re-run).
-- ============================================================
-- Fix for: "function gen_salt(unknown) does not exist" when creating staff.
--
-- On Supabase, pgcrypto lives in the `extensions` schema (not `public`). The
-- staff RPCs pin `search_path = public`, so the bare crypt()/gen_salt()/
-- gen_random_bytes() calls couldn't be resolved. This schema-qualifies them as
-- extensions.* — matching the convention already used in 0007 (UPI encryption).
--
-- Only the affected objects are recreated; everything else from 0012 is intact.
-- ============================================================

create extension if not exists pgcrypto;

-- 1. Session-token default (used on staff_login insert).
alter table public.staff_sessions
  alter column token set default encode(extensions.gen_random_bytes(32), 'hex');

-- 2. manager_create_staff — hashes the password with extensions.crypt/gen_salt.
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

-- 3. manager_set_staff_password — reset password (extensions-qualified).
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

-- 4. staff_login — verify password with extensions.crypt.
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
