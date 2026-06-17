-- ============================================================
-- 0008_super_admin.sql — Super-admin role with access to ALL hotels & data
-- Run in Supabase SQL Editor. Idempotent.
-- ============================================================
-- Model:
--   * super_admins(user_id) lists the privileged accounts.
--   * It is NOT writable by normal users (no insert/update/delete policy), so
--     nobody can self-promote. Bootstrap the first super admin manually below.
--   * is_super_admin() is SECURITY DEFINER, used in RLS and by the app.
--   * Each table gets an ADDITIVE permissive policy granting super admins full
--     access, on top of (not replacing) the existing owner-only policies.
-- ============================================================

create table if not exists public.super_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.super_admins enable row level security;
revoke all on public.super_admins from anon;

-- Membership check — reads super_admins regardless of RLS (definer), so it is
-- safe to call from inside other policies without recursion.
create or replace function public.is_super_admin()
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select exists (select 1 from public.super_admins where user_id = auth.uid());
$$;

revoke execute on function public.is_super_admin() from anon, public;
grant execute on function public.is_super_admin() to authenticated;

-- Super admins can read the membership list; nobody (except service_role / SQL
-- editor) can modify it.
drop policy if exists "super_admins_select" on public.super_admins;
create policy "super_admins_select" on public.super_admins
  for select to authenticated using (public.is_super_admin());

-- Additive full-access policy for super admins on every app table that exists.
do $$
declare
  t text;
begin
  foreach t in array array[
    'hotels', 'hotel_settings', 'categories', 'menu_items', 'tables',
    'orders', 'waiter_calls', 'item_ratings', 'hotel_payment_secrets'
  ]
  loop
    if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = t) then
      if not exists (
        select 1 from pg_policies
        where schemaname = 'public' and tablename = t and policyname = 'superadmin_full_access'
      ) then
        execute format(
          'create policy "superadmin_full_access" on public.%I for all to authenticated using (public.is_super_admin()) with check (public.is_super_admin())',
          t
        );
      end if;
    end if;
  end loop;
end $$;

-- ============================================================
-- BOOTSTRAP — make a user a super admin (run once, replace the UUID).
-- Find the id under Authentication → Users, or:
--   select id, email from auth.users where email = 'you@example.com';
-- Then:
--   insert into public.super_admins (user_id)
--   values ('00000000-0000-0000-0000-000000000000')
--   on conflict do nothing;
-- ============================================================
