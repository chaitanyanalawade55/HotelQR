import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * A cookie-less Supabase client for statically-generated public pages.
 *
 * The public menu (/menu/[slug]) is rendered with `dynamic = "force-static"`
 * + ISR. Using the cookie-based server client would opt the route into dynamic
 * rendering, so we use the anon key directly here. All data read through this
 * client is protected by the "Public can view ..." RLS policies.
 */
export function createStaticClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } }
  );
}
