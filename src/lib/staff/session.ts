import { createClient } from "@/lib/supabase/client";
import type { StaffSession } from "@/types/database";

// Staff auth is token-based (see migration 0012): staff are not Supabase Auth
// users, so the opaque session token returned by staff_login lives in
// localStorage, scoped per hotel slug so two restaurants on one device don't
// clash. Every staff RPC takes this token.

const keyFor = (slug: string) => `staff-token-${slug}`;

export function getStaffToken(slug: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(keyFor(slug));
  } catch {
    return null;
  }
}

export function setStaffToken(slug: string, token: string) {
  try {
    localStorage.setItem(keyFor(slug), token);
  } catch {
    /* ignore */
  }
}

export function clearStaffToken(slug: string) {
  try {
    localStorage.removeItem(keyFor(slug));
  } catch {
    /* ignore */
  }
}

/** Validate a token and return the staff profile, or null if invalid/expired. */
export async function staffMe(token: string): Promise<StaffSession | null> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("staff_me", { p_token: token });
  if (error || !data) return null;
  return data as StaffSession;
}
