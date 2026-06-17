-- ============================================================
-- Security hardening — run in Supabase SQL Editor
-- ============================================================
-- Problem: the "Public can view hotels" RLS policy lets the anonymous key read
-- EVERY column of `hotels`, including owner_email and phone. The anon key is
-- public (it ships in the browser), so anyone could harvest those.
--
-- Fix: column-level grants. The anonymous (public menu) role may read only the
-- columns the menu needs. Logged-in owners use the `authenticated` role, which
-- is untouched here, so the dashboard still sees every column of THEIR OWN
-- hotel (row access is still enforced by the existing owner RLS policy).
-- ============================================================

revoke select on hotels from anon;
grant select (id, name, slug, address) on hotels to anon;

-- Optional: hide the subscription tier from anonymous visitors too.
-- (hotel_settings has no credentials, but the tier is none of a customer's business.)
revoke select on hotel_settings from anon;
grant select (id, hotel_id, logo_url, theme_color, accent_color, currency, default_language) on hotel_settings to anon;
