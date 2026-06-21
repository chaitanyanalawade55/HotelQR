# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
yarn install --ignore-engines   # install dependencies (--ignore-engines needed for Node version quirks)
yarn dev                        # start dev server at http://localhost:3000
yarn build                      # production build
yarn lint                       # ESLint
ANALYZE=true yarn build         # bundle analysis
```

No test suite exists — verify changes by running the app.

## Environment Variables

Create `.env.local` with:

```
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

The Google Vision / Gemini API key is entered in the dashboard Settings UI and stored in `localStorage` — it is not an env var.

## Architecture

**MenuQR** is a multi-tenant SaaS where each hotel/restaurant gets a branded digital menu at `/menu/[slug]`. The dashboard (`/dashboard`) is the owner admin panel. Staff use a separate portal at `/staff/[hotelSlug]`.

### Supabase Client Contexts

Three client flavors exist — use the right one or you'll break ISR or SSR:

| Import | Use when |
|--------|----------|
| `@/lib/supabase/client` | Client Components (singleton, reuses one WebSocket) |
| `@/lib/supabase/server` | Server Components, Server Actions, Route Handlers |
| `@/lib/supabase/static` | ISR pages (`/menu/[slug]`) — no cookies, no session |

Always call `supabase.auth.getUser()` to validate the JWT (not `getSession()`, which is spoofable).

### Public Menu (ISR)

`src/app/menu/[slug]/page.tsx` is `force-static` + `revalidate = 60`. It uses `createStaticClient()` because cookie-based clients opt the page into dynamic rendering. Table-specific slugs are formatted as `{hotelSlug}-t{tableNumber}`; `toBaseSlug()` strips the table suffix before querying the hotel.

### Staff Auth

Staff are **not** Supabase Auth users. They authenticate via the `staff_login` RPC which returns an opaque token stored in `localStorage` at key `staff-token-{hotelSlug}`. All subsequent staff RPCs take this token as `p_token`. See `src/lib/staff/session.ts`.

### OCR Pipeline

`src/lib/ocr/index.ts` exports a unified `runOCR(file, provider, options)` plus `extractMenuItems()` (structured Gemini path). Three providers:
- **Gemini 2.5 Flash** — preferred; requires a Gemini API key from the user
- **OCR.space** — free cloud API, no sign-up
- **Tesseract.js** — fully offline; dynamically imported to stay out of the main bundle

### Database Migrations

Schema changes go in `supabase/migrations/` as numbered SQL files (`0016_…sql`). Run them manually in the Supabase SQL Editor — there is no migration CLI wired up. Migrations must be written to be safe to re-run where possible.

### Key Design Constraints

- **UPI/payment details** are encrypted at rest via a Postgres `BEFORE INSERT/UPDATE` trigger on `hotel_payment_secrets`. Plaintext is sent from the Server Action; never from the client.
- **Super-admin** access is gated by the `is_super_admin()` RPC (migration 0008). The `superadmin/` portal reads across all hotels via RLS policies that allow this.
- **Heavy libs** (`tesseract.js`, `qrcode`) are dynamically imported — keep them out of initial bundles.
- **Image uploads** are compressed client-side to WebP before upload (`src/lib/compressImage.ts`). Storage buckets: `menu-images` and `hotel-logos` (both public).
- **Realtime** is used on the orders dashboard — the `orders` and `waiter_calls` tables must have Realtime enabled in Supabase.
- **GST** is applied only on the bill (dashboard), never on the customer-facing menu price. `computeBill()` in `src/lib/billing.ts` is the single source of truth.
- All dashboard queries select only needed columns (never `SELECT *`) and run in parallel with `Promise.all`.
