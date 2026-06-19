-- ============================================================
-- 0014_staff_menu_all_categories.sql
-- Run in Supabase SQL Editor. Idempotent (safe to re-run).
-- ============================================================
-- Fix: staff couldn't see items whose category is inactive (or items with no
-- category). The customer menu intentionally hides those, but staff must be
-- able to take orders for ANY item. staff_menu now returns ALL categories
-- (the frontend also buckets anything uncategorised under "Other items").
-- ============================================================

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
        select id, name, sort_order, is_active from public.categories
        where hotel_id = v_staff.hotel_id
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
