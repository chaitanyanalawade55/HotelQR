-- ============================================================
-- 0011_billing_gst.sql
-- Run in Supabase SQL Editor. Idempotent (safe to re-run).
-- ============================================================
-- Adds GST/billing support so a completed (done) order can be treated as a
-- professional bill/invoice:
--   1. hotel_settings.gst_enabled  — owner toggles GST on/off.
--   2. hotel_settings.gst_percent  — configurable GST percentage.
--   3. hotel_settings.gst_number   — optional GSTIN printed on the bill.
--   4. orders.customer_mobile      — optional phone for sharing the bill.
-- ============================================================

alter table hotel_settings add column if not exists gst_enabled boolean not null default false;
alter table hotel_settings add column if not exists gst_percent numeric not null default 5;
alter table hotel_settings add column if not exists gst_number text;

alter table orders add column if not exists customer_mobile text;
