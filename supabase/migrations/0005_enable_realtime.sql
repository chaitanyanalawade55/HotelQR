-- ============================================================
-- Enable Realtime — run in Supabase SQL Editor (safe to re-run)
-- ============================================================
-- Adds the tables to the `supabase_realtime` publication so postgres_changes
-- events stream to the browser:
--   * menu_items     → live menu updates for customers (enable/disable, edits)
--   * orders         → live orders on the dashboard
--   * waiter_calls   → live waiter requests on the dashboard
-- (Equivalent to flipping these on under Database → Replication.)

do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'menu_items') then
    alter publication supabase_realtime add table menu_items;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'orders') then
    alter publication supabase_realtime add table orders;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'waiter_calls') then
    alter publication supabase_realtime add table waiter_calls;
  end if;
end $$;
