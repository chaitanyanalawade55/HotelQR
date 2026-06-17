# MenuQR

A SaaS platform where hotels and restaurants replace printed menus with a branded digital menu that customers access by scanning a QR code.

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 14 (App Router) |
| Styling | Tailwind CSS |
| Backend / DB | Supabase (Postgres + Storage + Auth + Realtime) |
| Language | TypeScript |
| Forms | React Hook Form + Zod |
| Notifications | Sonner |
| QR Generation | qrcode (dynamically imported) |
| OCR | Tesseract.js (offline) or Google Vision (optional) |
| Drag & drop | dnd-kit |

## Features

- **Auth** — Sign up / log in with Supabase Auth
- **Menu Management** — Categories and items (name, price, description, image, veg/non-veg, optional badge), in-page search, bulk availability toggle, and drag-to-reorder
- **Scan menu card (OCR)** — Photograph an existing printed menu and bulk-import the dishes. Uses Tesseract.js offline by default; add a Google Vision API key in **Settings** for higher accuracy
- **Image compression** — Photos are downscaled to WebP in the browser before upload (a 4MB photo becomes ~120KB)
- **Branding** — Upload logo, pick theme color, set currency, live preview
- **QR Codes** — Download PNG/SVG QR codes for the main menu and per-table, plus a one-tap WhatsApp share link
- **Live Orders** — Realtime order tracking with Supabase Realtime (new/preparing/done) + sound alert
- **Public Menu** — Statically generated (ISR), customer-facing menu at `/menu/[slug]` with instant in-memory search/filters, item badges, star ratings (long-press to rate), cart, and waiter call button

## Performance

- The public menu is **statically pre-rendered** (`generateStaticParams` + `revalidate = 60`) so a QR scan loads cached HTML.
- All images use `next/image` (AVIF/WebP, lazy loading, blur placeholder).
- Search/filtering runs entirely client-side in `useMemo` — zero network calls after load.
- Server queries run in parallel (`Promise.all`) and select only the columns rendered.
- Heavy libraries (`tesseract.js`, `qrcode`) are dynamically imported and kept out of the main bundle.
- Optimistic UI on availability toggles and item saves.

## Prerequisites

- Node.js 18+ (Node 20+ recommended)
- [Yarn](https://classic.yarnpkg.com/) (`npm install -g yarn`)
- A [Supabase](https://supabase.com) project

## Getting Started

### 1. Clone the repo

```bash
git clone https://github.com/chaitanyanalawade55/HotelQR.git
cd HotelQR
```

### 2. Install dependencies

```bash
yarn install --ignore-engines
```

### 3. Set up environment variables

Create a `.env.local` file in the project root:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

You can find these values in your Supabase project under **Settings → API**.

### 4. Set up Supabase tables

Run the following SQL in your Supabase **SQL Editor**:

```sql
-- Hotels
create table hotels (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users(id) on delete cascade,
  name text not null,
  slug text unique not null,
  owner_email text not null,
  phone text,
  address text,
  status text default 'trial',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Hotel Settings
create table hotel_settings (
  id uuid primary key default gen_random_uuid(),
  hotel_id uuid unique references hotels(id) on delete cascade,
  logo_url text,
  theme_color text default '#F97316',
  accent_color text default '#F97316',
  currency text default 'INR',
  default_language text default 'en',
  subscription_tier text default 'basic'
);

-- Categories
create table categories (
  id uuid primary key default gen_random_uuid(),
  hotel_id uuid references hotels(id) on delete cascade,
  name text not null,
  sort_order int default 0,
  is_active boolean default true,
  created_at timestamptz default now()
);

-- Menu Items
create table menu_items (
  id uuid primary key default gen_random_uuid(),
  hotel_id uuid references hotels(id) on delete cascade,
  category_id uuid references categories(id) on delete set null,
  name text not null,
  description text,
  price numeric default 0,
  image_url text,
  food_type text default 'veg',
  is_available boolean default true,
  sort_order int default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Tables (for per-table QR codes)
create table tables (
  id uuid primary key default gen_random_uuid(),
  hotel_id uuid references hotels(id) on delete cascade,
  table_number text not null,
  qr_slug text unique not null,
  created_at timestamptz default now()
);

-- Orders
create table orders (
  id uuid primary key default gen_random_uuid(),
  hotel_id uuid references hotels(id) on delete cascade,
  table_slug text,
  table_number text,
  items jsonb default '[]',
  total numeric default 0,
  status text default 'new',
  created_at timestamptz default now()
);

-- Waiter Calls
create table waiter_calls (
  id uuid primary key default gen_random_uuid(),
  hotel_id uuid references hotels(id) on delete cascade,
  table_slug text,
  table_number text,
  status text default 'pending',
  created_at timestamptz default now()
);
```

> **Row Level Security:** after creating the tables, also run the RLS policies (owners manage their own hotel's data; the public can read menus and insert orders/waiter calls/ratings). See the policies in `supabase/migrations/` and your Supabase dashboard.

### 4b. Run the upgrade migration

Run [`supabase/migrations/0002_upgrade_ocr_features.sql`](supabase/migrations/0002_upgrade_ocr_features.sql) in the **SQL Editor**. It adds the `badge` column to `menu_items`, the `item_ratings` table (with RLS), and a slug index. It is safe to re-run.

### 5. Set up Supabase Storage

In your Supabase project go to **Storage** and create two public buckets:

- `menu-images` — for dish photos
- `hotel-logos` — for restaurant logos

### 6. Enable Realtime

In Supabase go to **Database → Replication** and enable Realtime for the `orders` and `waiter_calls` tables.

### 7. Run the development server

```bash
yarn dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Project Structure

```
src/
├── app/
│   ├── (auth)/
│   │   ├── layout.tsx          # Dark background for auth screens
│   │   ├── login/page.tsx
│   │   └── signup/page.tsx
│   ├── dashboard/
│   │   ├── layout.tsx          # Auth check + hotel fetch
│   │   ├── shell.tsx           # Sidebar + mobile bottom nav
│   │   ├── loading.tsx         # Skeleton screen
│   │   ├── page.tsx            # Home / stats
│   │   ├── menu/               # Menu CRUD + OCR scanner (ocr-scanner.tsx)
│   │   ├── branding/           # Logo, theme color, currency
│   │   ├── qr/                 # QR code generation + WhatsApp share
│   │   ├── orders/             # Live orders (Realtime)
│   │   └── settings/           # Google Vision API key
│   ├── menu/[slug]/            # Public menu (SSG) + loading + not-found
│   ├── layout.tsx              # Root layout, viewport, font preload
│   └── globals.css
├── components/ui/              # Button, Input, Card, Toggle, Badge, etc.
├── lib/
│   ├── supabase/               # Browser, server, and static (cookie-less) clients
│   └── compressImage.ts        # Client-side image → WebP compression
├── middleware.ts               # Session refresh + route protection
└── types/database.ts           # TypeScript types for all tables

supabase/
├── functions/get-menu/         # Optional edge function (not used by default)
└── migrations/                 # SQL migrations
```

## Environment Variables Reference

| Variable | Description |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Your Supabase anon/public key |
| `NEXT_PUBLIC_SITE_URL` | The base URL of your app (used in QR links — e.g. `http://localhost:3000`) |

> The optional Google Vision API key is **not** an env var — it's entered in the dashboard under **Settings** and stored in the browser.

## Deployment

This app uses server-side rendering (SSR auth, middleware, ISR), so it needs a Node host such as **Vercel** — `import` the repo, set the three environment variables above (with `NEXT_PUBLIC_SITE_URL` set to your production URL), and deploy.

> Note: static hosting (e.g. GitHub Pages / `next export`) is **not** compatible with this build because of the authenticated dashboard, middleware, and ISR.

## Analyzing the bundle

```bash
ANALYZE=true yarn build
```

## License

MIT
