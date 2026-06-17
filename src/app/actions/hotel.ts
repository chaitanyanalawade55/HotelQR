"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

/**
 * Server Actions for a hotel's sensitive payment details.
 *
 * Security model:
 *  - 'use server' → this code never ships to the client bundle.
 *  - Auth is verified with supabase.auth.getUser() (validates the JWT with the
 *    Supabase auth server — not the spoofable getSession()).
 *  - Authorization = the user must OWN the hotel (this app's admin/manager).
 *  - We use the RLS-compliant authenticated client (NOT a service-role key).
 *    The DB trigger encrypts on write and the get_hotel_payment() RPC enforces
 *    ownership + holds the Vault key, so no super-admin key is needed here.
 *    (To switch to service-role: create a client with SUPABASE_SERVICE_ROLE_KEY
 *    — a server-only env var — and keep the same ownership check below.)
 */

const PaymentSchema = z.object({
  hotelId: z.string().uuid("Invalid hotel id"),
  // UPI VPA, e.g. "name@okhdfcbank"
  upiId: z
    .string()
    .trim()
    .regex(/^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64}$/, "Enter a valid UPI ID (e.g. name@bank)"),
  merchantName: z.string().trim().min(1, "Merchant name is required").max(100),
});

export type ActionResult = { ok: true } | { ok: false; error: string };

async function getAuthorizedHotel(hotelId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { supabase, authorized: false as const };

  const { data: hotel } = await supabase
    .from("hotels")
    .select("id")
    .eq("id", hotelId)
    .eq("owner_id", user.id) // admin/manager == hotel owner
    .maybeSingle();

  return { supabase, authorized: Boolean(hotel) as boolean };
}

/** Save UPI details. Plaintext is sent to Postgres, which encrypts it via the
 *  BEFORE INSERT/UPDATE trigger before it is written to disk. */
export async function saveHotelPayment(input: unknown): Promise<ActionResult> {
  const parsed = PaymentSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const { hotelId, upiId, merchantName } = parsed.data;

  const { supabase, authorized } = await getAuthorizedHotel(hotelId);
  if (!authorized) return { ok: false, error: "Not authorized for this hotel" };

  const { error } = await supabase
    .from("hotel_payment_secrets")
    .upsert(
      { hotel_id: hotelId, upi_id: upiId, merchant_name: merchantName },
      { onConflict: "hotel_id" }
    );

  if (error) {
    return { ok: false, error: "Could not save payment details" };
  }

  revalidatePath("/dashboard/settings");
  return { ok: true };
}

export type HotelPayment = { upiId: string | null; merchantName: string | null };

/** Fetch decrypted UPI details for the owner via the ownership-checked RPC. */
export async function getHotelPayment(hotelId: string): Promise<HotelPayment | null> {
  if (!z.string().uuid().safeParse(hotelId).success) return null;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase.rpc("get_hotel_payment", { p_hotel_id: hotelId });
  if (error || !Array.isArray(data) || data.length === 0) return null;

  const row = data[0] as { upi_id: string | null; merchant_name: string | null };
  return { upiId: row.upi_id, merchantName: row.merchant_name };
}
