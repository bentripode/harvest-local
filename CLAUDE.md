# CLAUDE.md — Harvest Local

> **Architecture and schema live in `ARCHITECTURE.md`. Treat it as the source of truth.**
> This file is the fast briefing; when they disagree, `ARCHITECTURE.md` wins and this file should be
> corrected.

---

## What this is

**Harvest Local** — a hyper-local, peer-to-peer marketplace: a "Zillow-style map" for farmers,
artisans, and makers. Buyers discover nearby sellers on a map/gallery, order goods, and pick up or
get local delivery. Sellers pay a **$20/mo subscription** (not a per-transaction cut) to run a
storefront. Transactions are **intentionally confined to a single US state** for legal (cottage-food)
reasons.

Revenue model: seller subscriptions. A referral engine rewards sellers with a free month when they
bring in 3 verified buyers per billing cycle.

### Build phases (see `ARCHITECTURE.md` §5)

1. **Phase 1 — Foundation & Seller Onboarding (current):** auth + roles, "Sellers Only" launch gate,
   Stripe Connect onboarding (Accounts v2) + Billing subscription with 90-day trial, product CRUD with
   categories/sub-categories/tags, the map/gallery. **We stop when seller onboarding + product
   listings work end-to-end in Stripe test mode.**
2. Phase 2 — buyer checkout (Connect destination charge + Stripe Tax), geofencing, revenue caps,
   license expiry, order status pipeline.
3. Phase 3 — referral engine, seller analytics, delivery/mileage fees, notifications.
4. Phase 4 — in-app messaging, reviews, reports.
5. Phase 5 — admin/dispute dashboard, public launch.

---

## Tech stack

| Concern | Choice |
|---|---|
| Framework / language | **Next.js 16 (App Router) + TypeScript (strict)**. Turbopack is the default for `dev` and `build`. |
| UI | **Tailwind CSS v4 + shadcn/ui** (`base-nova` style, `neutral` base color). Components in `src/components/ui`. |
| DB / Auth / Storage / Realtime | **Supabase** — Postgres + PostGIS, Supabase Auth (email OTP + social), Storage (private bucket for license/ID docs), Realtime (Phase 4 messaging). |
| Payments | **Stripe** — **Connect Accounts v2** (`/v2/core/accounts`, Express dashboard) for buyer→seller payments & payouts; connected accounts get the `recipient` + `merchant` configurations so the **seller is merchant of record** for sales tax (destination charges `on_behalf_of` in Phase 2). Billing for the $20/mo subscription + 90-day trial + 100%-off reward coupon. Tax for local sales tax (Phase 2). **Never use the deprecated `stripe.accounts.create({type:'express'})` v1 path or the `charges_enabled`/`payouts_enabled` fields — use v2 capability status.** |
| Validation | **Zod v4** — shared schemas at every trust boundary (client + server). |
| Client data fetching | TanStack Query (added when the order pipeline / messaging needs it; not in the Phase 1 checkpoint). |
| Maps | Mapbox GL JS + Geocoding + Directions/Matrix (mileage fees). Kept behind a routing interface so it's swappable. |
| Background jobs | Inngest — referral activation, revenue-cap checks, license-expiry scans, notification fan-out. Skeleton only in Phase 1. |
| Email / SMS | Resend (+ React Email) / Twilio. Phase 3. |
| Hosting | Vercel (app) + Supabase (managed Postgres). |

### Next.js 16 specifics (do not regress these)

- `cookies()`, `headers()`, `draftMode()`, and route `params` / `searchParams` are **async** — always `await` them.
- The old `middleware.ts` convention is **`proxy.ts`** with an exported `proxy` function (nodejs
  runtime, not edge). Supabase session refresh lives in `src/proxy.ts`.
- `next lint` is gone; use `npm run lint` (ESLint flat config in `eslint.config.mjs`).
- Read `node_modules/next/dist/docs/` before using an unfamiliar API — this Next is newer than most
  training data. `AGENTS.md` (which `CLAUDE.md` `@`-includes) carries this rule too.

---

## Critical rules — these are legal / financial guardrails, not preferences

### 1. No cross-state orders. Ever.

A buyer in state X may only transact with a seller whose authoritative selling state is X. Enforced in
**three layers**, all of which must stay:

- **Data layer:** the `orders.same_state_only` CHECK constraint (`buyer_state = seller_state`). Never
  drop or weaken it. `buyer_state` / `seller_state` are frozen snapshots on the order.
- **Server layer:** every checkout / order-creation path re-checks buyer state vs. seller state before
  writing.
- **Discovery layer:** the map/search hides out-of-state sellers for a given buyer by default.

Never write an order, or code a path that could write an order, that crosses state lines.

### 2. All Stripe state changes come from webhooks, and every handler is idempotent.

- **Never** mutate subscription, order, payment, payout, or referral state from a browser "success"
  redirect, a client callback, or an optimistic UI path. The redirect only navigates; the webhook is
  the source of truth.
- The webhook route (`src/app/api/webhooks/stripe/route.ts`) **must** verify the Stripe signature
  against `STRIPE_WEBHOOK_SECRET` before doing anything.
- Every handler must be **idempotent**: Stripe retries and re-delivers. Record every processed event
  id in `stripe_events` and no-op on repeats; make each mutation safe to run twice (upserts, guarded
  state transitions, `reward_granted` flags).
- Every Stripe **write** (creating a subscription, attaching a coupon, issuing a refund) uses an
  **idempotency key derived from a stable local id** (e.g. `seller_profile.id`, `cycle_id`).
- Stripe is the source of truth for money; our tables are a queryable **mirror** kept in sync by
  webhooks.

### 3. Money math is server-side only.

- The client never computes subtotals, discounts, delivery fees, tax, or totals — it displays numbers
  the server produced.
- All money is stored as `numeric` in Postgres and handled in **integer minor units (cents)** in
  application code (`src/lib/money.ts`). No floating-point arithmetic on money.
- Order money fields are **snapshots** captured at checkout (`unit_price`, `subtotal`,
  `discount_total`, `delivery_fee`, `tax_total`, `total`) — never recomputed from live product rows.
- The buyer referral discount is our own order math (admin-set % from `platform_settings`). The seller
  free-month reward is a Stripe 100%-off coupon. Don't mix the two mechanisms.

### 4. Reviews only from verified buyers of completed orders.

- A `reviews` row is insertable **only** when the reviewer is the `buyer_id` of an `orders` row with
  `status = 'completed'`, and there is **one review per order** (`reviews.order_id` is unique).
- Enforce in an RLS policy / `BEFORE INSERT` trigger — **not** application code alone.

---

## Conventions

- **TypeScript strict.** No `any` without a written reason. Validate external input with Zod at the
  boundary; infer types from the schema.
- **RLS on every table.** A new table is not done until it has row-level security policies. The
  service-role key (`src/lib/supabase/admin.ts`) bypasses RLS and is used **only** in webhook
  handlers and trusted server jobs, never in a request handler driven by user input without an
  explicit authz check first.
- **Server Functions / Actions** verify auth and authorization on every call (they are reachable by
  direct POST, not just via your UI). Use `requireUser()` / `requireRole()` from `src/lib/auth.ts`.
- **Migrations** live in `supabase/migrations/`, are additive, and small. One concern per migration.
  Never edit a migration that has been applied to a shared environment — add a new one.
- **Feature-folder structure** under `src/app` using route groups: `(auth)`, `(dashboard)`. Shared
  logic in `src/lib/<domain>`.
- **Env vars** are validated in `src/lib/env.ts` (Zod). Server-only secrets never get the
  `NEXT_PUBLIC_` prefix. Read `process.env` through `env` so a missing var fails loudly at startup.
- Keep the routing provider (Mapbox vs. Google) behind `src/lib/geo/` interfaces.

## Commands

| Command | What |
|---|---|
| `npm run dev` | Next dev server (Turbopack) on :3000 |
| `npm run build` / `npm start` | Production build / serve |
| `npm run lint` | ESLint |
| `npx supabase start` | Local Postgres + Auth + Storage (needs Docker) |
| `npx supabase db reset` | Drop, recreate, re-run all migrations + seed |
| `npx supabase migration new <name>` | New migration file |
| `npx supabase db diff -f <name>` | Generate a migration from schema changes |
| `npx supabase gen types typescript --local > src/lib/db/database.types.ts` | Regenerate DB types |
| `stripe listen --forward-to localhost:3000/api/webhooks/stripe` | Forward Stripe test webhooks locally |
| `stripe trigger <event>` | Fire a test webhook event |

## Where things are

```
ARCHITECTURE.md                        source of truth for schema + design decisions
supabase/migrations/                   Phase 1: core tables, RLS, seed · Phase 2: orders + pipeline
src/lib/env.ts                         Zod-validated environment
src/lib/supabase/{client,server,admin}.ts   browser / server / service-role clients
src/lib/stripe/{client,config,checkout}.ts  Stripe SDK · price/coupon constants · Checkout builder
src/lib/money.ts                       server-side money helpers (cents)
src/lib/geo/state.ts                   US states + the same-state geofence predicate
src/lib/orders/{pricing,status,queries}.ts   server re-pricing · status map · order reads
src/lib/auth.ts                        requireUser / requireRole / getProfile / getSellerContext
src/proxy.ts                           Supabase session refresh (was middleware.ts)
src/app/(auth)/                        login, signup, email confirm
src/app/(shop)/                        buyer: /shop, /s/[slug] storefront, /cart, /checkout, /orders
src/app/(dashboard)/seller/onboarding/ Connect Accounts v2 + Billing subscription
src/app/(dashboard)/seller/products/   product CRUD
src/app/(dashboard)/seller/orders/     seller order board (advance_order_status RPC)
src/app/api/webhooks/stripe/route.ts   the ONLY place Stripe state is applied
```

**Phase 2 (in progress):** buyer checkout is a Stripe **Checkout Session** →
destination charge with `on_behalf_of` the seller (seller = MoR) + `automatic_tax`
(`liability: { type: 'account' }`). Order starts `pending_payment`; the
`checkout.session.completed` / `async_payment_succeeded` webhook moves it to `new`,
finalises `tax_total`/`total` from the session, and decrements stock. Sellers advance the
pipeline only through `advance_order_status()` (SQL, SECURITY DEFINER); every transition is
logged to `order_status_history` by trigger. `npm run stripe:tax -- --account <acct> --state <XX>`
sets up test-mode Stripe Tax.
