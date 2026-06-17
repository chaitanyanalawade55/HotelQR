import { createBrowserClient } from "@supabase/ssr";

let client: ReturnType<typeof createBrowserClient> | null = null;

/**
 * Singleton Supabase browser client.
 *
 * At scale (1L+ hotels, 1Cr+ users) creating a new client on every render
 * causes redundant WebSocket connections and memory churn. This ensures a
 * single instance — and a single Realtime connection — per browser tab.
 */
export function createClient() {
  if (client) return client;
  client = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  return client;
}
