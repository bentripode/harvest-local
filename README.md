# Harvest Local

A hyper-local, peer-to-peer marketplace — a "Zillow-style map" for farmers, artisans, and makers.
Buyers discover nearby sellers on a map/gallery, order goods, and pick up or get local delivery.
Sellers pay a **$20/mo subscription** (not a per-transaction cut) to run a storefront, and the
seller is merchant of record for sales tax. Transactions are **intentionally confined to a single
US state** for cottage-food legal reasons. A referral engine rewards a seller with a free month
when they bring in 3 verified buyers in a billing cycle.

> **`ARCHITECTURE.md` is the source of truth** for schema and design decisions. `CLAUDE.md` is the
> fast briefing and carries the legal/financial guardrails. `SETUP.md` gets it running locally;
> `LAUNCH.md` is the go-live checklist.

## Status

All five build phases (`ARCHITECTURE.md` §5) are code-complete and verified in Stripe **test** mode:

1. **Foundation & seller onboarding** — auth + roles, "Sellers Only" launch gate, Stripe Connect
   Accounts v2 onboarding + Billing subscription with a 90-day trial, product CRUD, the map/gallery.
2. **Buyer checkout** — Connect destination charge with `on_behalf_of` the seller + Stripe Tax,
   geofencing, revenue caps, license expiry, the order-status pipeline.
3. **Referral engine** — seller promo codes, buyer discount, seller free-month reward coupon,
   seller analytics, local delivery / mileage fees, email notifications.
4. **Reviews, in-app messaging, order reports.**
5. **Admin** — dispute/report queue with 1-click refunds, platform analytics, the public-launch toggle.

## Tech stack

| Concern | Choice |
|---|---|
| Framework / language | Next.js 16 (App Router) + TypeScript (strict), Turbopack |
| UI | Tailwind CSS v4 + shadcn/ui (`base-nova`, `neutral`) |
| DB / Auth / Storage / Realtime | Supabase — Postgres + PostGIS, Supabase Auth, private Storage bucket, Realtime |
| Payments | Stripe — Connect Accounts v2 (seller = merchant of record), Billing, Tax |
| Validation | Zod v4 — shared schemas at every trust boundary |
| Maps | Mapbox GL JS + Geocoding + Directions (mileage fees), behind a routing interface |
| Background jobs | Inngest — referral activation, revenue-cap checks, license-expiry scans, notification dispatch |
| Email / SMS | Resend (+ React Email) / Twilio (SMS branch stubbed) |
| Hosting | Vercel (app) + Supabase (managed Postgres) |

## Getting started

See **`SETUP.md`** for the full walkthrough (accounts, keys, `.env.local`, hosted Supabase, Stripe
test mode). Short version:

```bash
npm install
cp .env.example .env.local        # then fill it in per SETUP.md
npx supabase link --project-ref <ref>
npx supabase db push
npm run db:types
npm run dev:all                   # Next (:3000) + stripe listen + Inngest dev server (:8288)
```

## Commands

| Command | What |
|---|---|
| `npm run dev:all` | Next dev server + `stripe listen` + Inngest dev server |
| `npm run dev` | Next dev server only (:3000) |
| `npm run build` / `npm start` | Production build / serve |
| `npm run lint` / `npm run typecheck` | ESLint / `tsc --noEmit` |
| `npm run db:push` | Apply Supabase migrations to the linked project |
| `npm run db:types` | Regenerate `src/lib/db/database.types.ts` |
| `npm run stripe:setup` | Create the subscription Price + referral coupons (idempotent) |
| `npm run stripe:listen` | Forward Stripe test webhooks to `localhost` |
| `npm run inngest:dev` | Inngest Dev Server (no keys) |
| `npx supabase migration new <name>` | New migration file |

## Where things are

`CLAUDE.md` has the annotated file map. The load-bearing paths:

- `src/app/api/webhooks/stripe/route.ts` — the **only** place Stripe state is applied
- `supabase/migrations/` — schema, RLS, column-guard triggers, SECURITY DEFINER functions
- `src/lib/{auth,env,money}.ts` · `src/lib/db/types.ts` (friendly aliases + numeric→string money fix)
- `src/lib/stripe/`, `src/lib/orders/`, `src/lib/referrals/`, `src/lib/geo/`, `src/lib/inngest/`
