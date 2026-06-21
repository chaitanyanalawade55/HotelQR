/**
 * Per-request memoised Supabase queries using React.cache().
 *
 * In the App Router, layouts and pages for the same route render in the same
 * request. Without caching, dashboard/layout.tsx and dashboard/page.tsx both
 * call getUser() + the hotel query, hitting the DB twice. React.cache()
 * deduplicates them so the DB is hit exactly once per request.
 */
import { cache } from "react";
import { createClient } from "./server";

export const getAuthUser = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
});

// Columns shared between layout (shell nav) and dashboard home page.
const HOTEL_COLS = "id,name,slug,owner_id,status,address,phone,owner_email";

export const getHotelByOwner = cache(async (userId: string) => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("hotels")
    .select(HOTEL_COLS)
    .eq("owner_id", userId)
    .single();
  return data;
});
