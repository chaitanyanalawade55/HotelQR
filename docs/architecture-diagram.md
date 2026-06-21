# MenuQR — Visual Architecture

> Diagram-first companion to [`ARCHITECTURE.md`](../ARCHITECTURE.md).
> Every chart below renders as Mermaid (GitHub, VS Code preview, most Markdown viewers).
> **Stack:** Next.js 14 (App Router) · React 18 · TypeScript · Tailwind · Supabase (Postgres + Auth + Realtime + Storage + Vault + Edge Functions) · Vercel.

---

## 1. System overview — 4 actors, 1 database

There is **no custom API server**. Next.js on Vercel talks **directly to Supabase Postgres**; all security and business logic live in the database (RLS + `SECURITY DEFINER` RPCs + Vault + triggers).

```mermaid
graph TD
    subgraph Clients["ACTORS"]
        C["📱 Customer<br/>anonymous · scans QR"]
        O["💻 Owner / Manager<br/>Supabase Auth user"]
        S["🧑‍🍳 Staff<br/>waiter/chef/cashier · NOT an auth user"]
        SA["🛡️ Super Admin<br/>platform staff"]
    end

    subgraph Vercel["Next.js 14 (App Router) on Vercel"]
        PUB["/menu/[slug]<br/>force-static + ISR 60s"]
        DASH["/dashboard/*<br/>SSR · auth-gated"]
        STAFFP["/staff/[hotelSlug]/*<br/>token portal"]
        SUP["/superadmin/*<br/>super_admin role"]
        ACT["actions/hotel.ts<br/>'use server'"]
    end

    subgraph Supabase["SUPABASE — the real backend"]
        PG[("Postgres<br/>RLS · RPCs · triggers")]
        AUTH["Auth (JWT)"]
        RT["Realtime"]
        ST["Storage buckets"]
        V["Vault (encryption key)"]
    end

    C --> PUB
    O --> DASH
    S --> STAFFP
    SA --> SUP
    DASH --> ACT

    PUB -->|anon key| PG
    DASH -->|authenticated| PG
    STAFFP -->|anon key + session-token RPC| PG
    SUP -->|authenticated| PG
    ACT -->|authenticated| PG

    PG --- AUTH
    PG --- RT
    PG --- ST
    PG --- V
```

---

## 2. The three Supabase clients

The client you use is dictated by the rendering context — the single most important integration rule.

```mermaid
graph TD
    C["client.ts<br/>createBrowserClient (singleton)"] -->|"'use client' components<br/>public-menu · orders-live · menu-manager · staff portal"| U1["Anon key · 1 Realtime socket/tab · authed via cookie"]
    S["server.ts<br/>createServerClient (cookies)"] -->|"Server Components & Server Actions<br/>dashboard/layout · actions/hotel"| U2["Reads cookies → authenticated user · getUser() validates JWT"]
    ST["static.ts<br/>createClient (no cookies)"] -->|"force-static pages<br/>menu/[slug]/page.tsx"| U3["Anon key · cookieless → keeps the page static/ISR"]
```

---

## 3. Entity-relationship (data model)

```mermaid
erDiagram
    auth_users ||--o| hotels : owns
    auth_users ||--o| super_admins : "is (optional)"
    hotels ||--|| hotel_settings : has
    hotels ||--o| hotel_payment_secrets : "encrypted UPI"
    hotels ||--o{ categories : has
    hotels ||--o{ menu_items : has
    hotels ||--o{ tables : "QR codes"
    hotels ||--o{ orders : receives
    hotels ||--o{ waiter_calls : receives
    hotels ||--o{ item_ratings : collects
    hotels ||--o{ staff : employs
    categories ||--o{ menu_items : groups
    menu_items ||--o{ item_ratings : rated
    staff ||--o{ staff_table_assignments : "covers tables"
    tables ||--o{ staff_table_assignments : "covered by"
    staff ||--o{ staff_sessions : "logs in via"
    staff ||--o{ orders : "assigned to"
    staff ||--o{ waiter_calls : "assigned to"
```

**Slug convention:** `hotel-t5-1234` = base hotel slug + table `5` + random suffix.

---

## 4. Customer ordering — the core loop

```mermaid
sequenceDiagram
    autonumber
    actor C as Customer
    participant CDN as Vercel CDN (ISR HTML)
    participant PM as public-menu (client, anon)
    participant DB as Postgres (RLS)
    participant RT as Realtime
    participant M as Manager / Staff

    C->>CDN: scan QR → GET /menu/hotel-t5-1234
    CDN-->>C: cached menu HTML (force-static, revalidate 60s)
    PM-->>RT: subscribe menu-{hotelId} (live admin edits)
    PM->>DB: load item_ratings (non-blocking)

    C->>PM: add items → "Place order"
    alt no open order on this table
        PM->>DB: INSERT orders (status=new, cancel_token)
        DB->>RT: INSERT event → 🔔 manager + staff
        PM->>PM: save {id, token} to localStorage
    else order already open (same table)
        PM->>DB: RPC append_to_order(id, token, items, total)
        DB->>RT: UPDATE event → order grows in place
    end

    opt within cancel window
        C->>PM: Cancel → RPC cancel_order(id, token)
    end

    M->>DB: UPDATE status new→preparing→done
    DB->>RT: UPDATE event → everyone syncs
```

> **Why RPCs for cancel/append:** an anonymous customer must only touch *their own* order. The `cancel_token` (in `localStorage`) is verified inside a `SECURITY DEFINER` function, which safely bypasses RLS *after* the token check.

---

## 5. Staff portal — capability-token auth (migration 0012)

Staff are **not** Supabase Auth users (the app has no service-role key). They log in with mobile + password via a DEFINER RPC that returns an opaque 30-day session token (the same pattern customers use for cancel/append).

```mermaid
sequenceDiagram
    autonumber
    actor MGR as Owner/Manager
    actor STF as Staff
    participant DB as Postgres (DEFINER RPCs)
    participant RT as Realtime

    MGR->>DB: manager_create_staff(...) [owner-checked]
    Note over DB: password bcrypt-hashed via pgcrypto crypt()/gen_salt('bf')
    MGR->>DB: assign tables (staff_table_assignments)

    STF->>DB: staff_login(hotel_id, mobile, password)
    DB-->>STF: { token, staff } → token saved in localStorage
    STF->>DB: staff_menu / staff_active_orders / staff_waiter_calls (token-gated)

    Note over DB,RT: customer INSERT order/waiter_call fires<br/>tg_staff_broadcast() → realtime.send('staff:{hotelId}')
    RT-->>STF: 🔔 beep + vibrate + toast "Table X is calling"
    STF->>DB: staff_create_order / staff_update_order_status (new→preparing→done)
    STF->>DB: staff_ack_waiter(call_id)
```

Auto-assignment: `tg_assign_staff_by_table()` stamps the covering waiter onto new orders/calls. The broadcast trigger is fully guarded — if Realtime is unavailable it silently no-ops and **never breaks the customer's order insert**.

---

## 6. Encrypted payments (UPI/GPay — migration 0007)

```mermaid
sequenceDiagram
    autonumber
    actor O as Owner
    participant SA as Server Action (actions/hotel.ts)
    participant DB as Postgres
    participant TG as encrypt trigger
    participant V as Supabase Vault

    O->>SA: saveHotelPayment({hotelId, upiId, merchantName})
    SA->>SA: getUser() + verify owns hotel
    SA->>DB: upsert hotel_payment_secrets (plaintext upi_id)
    DB->>TG: BEFORE INSERT/UPDATE
    TG->>V: read symmetric key (hotel_upi_key)
    TG->>DB: store upi_id_encrypted (bytea); set upi_id = NULL
    Note over DB: plaintext NEVER persists to disk

    O->>SA: getHotelPayment(hotelId)
    SA->>DB: rpc get_hotel_payment(hotelId)  [DEFINER, owner-checked]
    DB->>V: read key → pgp_sym_decrypt
    DB-->>SA: { upiId, merchantName }
```

`anon` is fully revoked from `hotel_payment_secrets`; the Vault key is read only inside DEFINER functions.

---

## 7. Billing / GST (migration 0011)

```mermaid
graph LR
    DONE["order.status = done"] --> BM["bill-modal.tsx"]
    SET["hotel_settings<br/>gst_enabled · gst_percent · gst_number"] --> CB["computeBill() (lib/billing.ts)"]
    BM --> CB
    CB --> SUB["subtotal = Σ price×qty"]
    CB --> GST["+ GST% (applied on top)"]
    CB --> TOTAL["grand total"]
    TOTAL --> OUT1["buildBillHtml() → print window"]
    TOTAL --> OUT2["buildBillText() → WhatsApp / share"]
```

The stored `order.total` is the **pre-tax subtotal** (the customer menu never adds GST); GST is layered on at bill time only when the owner enables it.

---

## 8. Security model (enforced in the DB)

```mermaid
graph TB
    ANON["anon key (public menu)"] --> P1["SELECT available menu / categories"]
    ANON --> P2["INSERT orders / waiter_calls / item_ratings"]
    ANON --> P3["staff_* RPCs via session token"]
    AUTHED["authenticated (owner)"] --> P4["full CRUD on OWN hotel rows"]
    AUTHED -.->|revoked| PX["hotel_payment_secrets ❌ · staff_sessions ❌"]
    SUPER["super_admin"] --> P5["superadmin_full_access — additive ALL tables"]

    P2 --> RPC1["cancel_order / append_to_order<br/>(token-gated DEFINER)"]
    P3 --> RPC2["staff_login → bcrypt verify → opaque token"]
    P4 --> ENC["UPI encrypt trigger + get_hotel_payment<br/>(Vault key, owner-checked)"]
```

**Principles**

- RLS on every table; owner policies key off `hotel_id IN (select id from hotels where owner_id = auth.uid())`.
- Anonymous customers can insert but never read other hotels' data; cancel/append gated by a secret token.
- Staff authenticate via DEFINER RPC → opaque token (bcrypt passwords); `staff_sessions` revoked from all clients.
- Secrets (UPI) encrypted at rest with a Vault key; never decrypted client-side.
- Super admins can't self-promote (bootstrapped manually in SQL).
- Auth uses `getUser()` (server-validated JWT), not spoofable `getSession()`.

### Secret-exposure boundary

```mermaid
graph LR
    subgraph Browser["SHIPPED TO BROWSER (public)"]
        B1["NEXT_PUBLIC_* (URL, anon key, site URL)"]
        B2["owner's Gemini key (localStorage)"]
        B3["own order's cancel_token · staff token"]
    end
    subgraph Server["SERVER-ONLY (never shipped)"]
        S1["SUPABASE_SERVICE_ROLE_KEY<br/>(only the optional edge fn)"]
    end
    subgraph DBOnly["DATABASE-ONLY (never leaves)"]
        D1["Vault hotel_upi_key"]
        D2["encrypted UPI bytea"]
        D3["staff password hashes"]
        D4["Auth JWT signing key"]
    end
```

---

## 9. Route map

```mermaid
graph LR
    R["/"] --> L["/login"] & SU2["/signup"]
    L --> DH["/dashboard"]
    SU2 --> DH
    DH --> DM["/dashboard/menu (+OCR import)"]
    DH --> DO["/dashboard/orders (live + bill/GST)"]
    DH --> DQ["/dashboard/qr"]
    DH --> DBR["/dashboard/branding"]
    DH --> DP["/dashboard/payments (encrypted UPI)"]
    DH --> DST["/dashboard/settings"]
    DH --> DSTF["/dashboard/staff (manage staff)"]
    DH -.super_admin.-> SADM["/superadmin"]
    SADML["/superadmin/login"] --> SADM
    QR["Table QR"] --> PM["/menu/[slug] (public ISR)"]
    SLOG["/staff/[hotelSlug]/login"] --> SPORT["/staff/[hotelSlug] (portal)"]
```

Public menu has **three layouts** (`classic` · `modern` · `premium`) selected by `hotel_settings.menu_layout`.

---

## 10. Realtime channels

```mermaid
graph LR
    subgraph Sources
        O1["Customer INSERT order"]
        O2["Customer/Staff UPDATE order status"]
        W1["Customer INSERT waiter_call"]
        ME["Owner edits menu_items"]
    end
    O1 & O2 --> PUBR["postgres_changes<br/>orders / waiter_calls / menu_items<br/>(supabase_realtime publication)"]
    W1 --> PUBR
    ME --> PUBR

    PUBR --> DASHL["Dashboard orders-live.tsx<br/>filter hotel_id=eq.X → beep + toast"]
    PUBR --> CUST["public-menu.tsx<br/>menu-{hotelId} → live menu sync"]

    O1 & W1 -.trigger.-> BC["tg_staff_broadcast()<br/>realtime.send('staff:{hotelId}')"]
    BC --> STAFFCH["Staff portal<br/>broadcast channel → beep + vibrate"]
```

---

## 11. Migration timeline

```mermaid
timeline
    title supabase/migrations (run in order in the SQL editor)
    Baseline : README SQL block (hotels, settings, categories, menu_items, tables, orders, waiter_calls)
    0002 : OCR features + item_ratings + badge + slug index
    0003 : Secure public columns (tighten anon SELECT grants)
    0004 : is_special + Specials carousel
    0005 : Enable Realtime publication
    0006 : Order cancellation (cancel_token + cancel_order RPC + order_cancel_minutes)
    0007 : Secure UPI (Vault key + encrypt trigger + get_hotel_payment RPC)
    0008 : Super admins (is_super_admin + additive policies)
    0009 : Anon order INSERT policy + append_to_order RPC
    0010 : menu_layout (classic / modern / premium)
    0011 : Billing + GST (gst_* settings + orders.customer_mobile)
    0012 : Staff portal (staff, sessions, assignments, 12+ RPCs, broadcast triggers, staff-photos bucket)
    0013 : pgcrypto schema fix (extensions.* qualify)
    0014 : staff_menu returns ALL categories
    0015 : Speciality category + default Water item + special-nudge settings
```
