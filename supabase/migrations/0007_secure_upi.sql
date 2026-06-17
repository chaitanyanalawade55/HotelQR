-- ============================================================
-- 0007_secure_upi.sql — Encrypted storage for hotel GPay/UPI details
-- Run in Supabase SQL Editor. Idempotent (safe to re-run).
-- ============================================================
-- Design:
--   * Secrets live in their OWN table (hotel_payment_secrets), never in the
--     publicly-readable hotel_settings.
--   * The symmetric key lives in Supabase Vault — never in app code or env.
--   * A BEFORE INSERT/UPDATE trigger encrypts the UPI id with pgp_sym_encrypt
--     (authenticated PGP encryption) and NULLs the plaintext, so raw UPI never
--     hits disk.
--   * Decryption is a SECURITY DEFINER function that (a) reads the Vault key and
--     (b) only returns data to the hotel's owner.
-- ============================================================

create extension if not exists pgcrypto;        -- pgp_sym_encrypt/decrypt, gen_random_bytes (schema: extensions)
create extension if not exists supabase_vault;   -- managed key storage (schema: vault)

-- 1. Managed symmetric key in Supabase Vault (generated once, server-side).
do $$
begin
  if not exists (select 1 from vault.secrets where name = 'hotel_upi_key') then
    perform vault.create_secret(
      encode(extensions.gen_random_bytes(32), 'base64'),
      'hotel_upi_key',
      'Symmetric key for hotel UPI encryption'
    );
  end if;
end $$;

-- 2. Dedicated secrets table (1:1 with a hotel).
create table if not exists public.hotel_payment_secrets (
  hotel_id uuid primary key references public.hotels(id) on delete cascade,
  merchant_name text,
  upi_id text,             -- transient plaintext input; the trigger nulls it
  upi_id_encrypted bytea,  -- ciphertext at rest
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 3. Transparent authenticated encryption on write.
create or replace function public.tg_encrypt_hotel_upi()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_key text;
begin
  if new.upi_id is not null and length(trim(new.upi_id)) > 0 then
    select decrypted_secret into v_key from vault.decrypted_secrets where name = 'hotel_upi_key';
    if v_key is null then
      raise exception 'UPI encryption key is missing from Vault';
    end if;
    new.upi_id_encrypted := extensions.pgp_sym_encrypt(new.upi_id, v_key);
  end if;
  new.upi_id := null;     -- plaintext NEVER persists to disk
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_encrypt_hotel_upi on public.hotel_payment_secrets;
create trigger trg_encrypt_hotel_upi
  before insert or update on public.hotel_payment_secrets
  for each row execute function public.tg_encrypt_hotel_upi();

-- 4. Row Level Security — OWNER ONLY. No anon/public policy exists, so the
--    anon (public menu) key cannot read this table at all.
alter table public.hotel_payment_secrets enable row level security;
revoke all on public.hotel_payment_secrets from anon;

drop policy if exists "payment_secrets_owner_select" on public.hotel_payment_secrets;
create policy "payment_secrets_owner_select" on public.hotel_payment_secrets
  for select using (hotel_id in (select id from public.hotels where owner_id = auth.uid()));

drop policy if exists "payment_secrets_owner_insert" on public.hotel_payment_secrets;
create policy "payment_secrets_owner_insert" on public.hotel_payment_secrets
  for insert with check (hotel_id in (select id from public.hotels where owner_id = auth.uid()));

drop policy if exists "payment_secrets_owner_update" on public.hotel_payment_secrets;
create policy "payment_secrets_owner_update" on public.hotel_payment_secrets
  for update using (hotel_id in (select id from public.hotels where owner_id = auth.uid()))
  with check (hotel_id in (select id from public.hotels where owner_id = auth.uid()));

-- 5. Decryption — ownership-checked; the Vault key is only ever read inside
--    this definer function, never by the client.
create or replace function public.get_hotel_payment(p_hotel_id uuid)
returns table (upi_id text, merchant_name text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_key text;
begin
  -- Authorization: caller must own the hotel.
  if not exists (
    select 1 from public.hotels h where h.id = p_hotel_id and h.owner_id = auth.uid()
  ) then
    raise exception 'Not authorized';
  end if;

  select decrypted_secret into v_key from vault.decrypted_secrets where name = 'hotel_upi_key';

  return query
    select
      case
        when ps.upi_id_encrypted is not null then extensions.pgp_sym_decrypt(ps.upi_id_encrypted, v_key)
        else null
      end,
      ps.merchant_name
    from public.hotel_payment_secrets ps
    where ps.hotel_id = p_hotel_id;
end;
$$;

revoke execute on function public.get_hotel_payment(uuid) from anon, public;
grant execute on function public.get_hotel_payment(uuid) to authenticated;
