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
  `tax_total` / `total` are provisional until the payment webhook finalises them from the Stripe
  session (`finalize_paid_order`); everything else is frozen at checkout.
- The buyer referral **discount amount** is our own order math (admin-set % from `platform_settings`,
  computed in `validatePromoCode`, snapshotted into `discount_total` at checkout). A reusable
  `percent_off` Coupon rides the Checkout Session **only** as the transport so Stripe Tax applies to
  the discounted base; the webhook reconciles `discount_total` against the session's
  `amount_discount`. The seller free-month reward is a separate Stripe 100%-off Coupon on the
  subscription — don't conflate the two.

### 4. Reviews only from verified buyers of completed orders.

- A `reviews` row is insertable **only** when the reviewer is the `buyer_id` of an `orders` row with
  `status = 'completed'`, and there is **one review per order** (`reviews.order_id` is unique).
- Enforced at the data layer: the `reviews_verify_buyer` `BEFORE INSERT` trigger (fires for every
  insert, RLS bypass included) + the `order_id` unique constraint. RLS additionally scopes writes to
  `reviewer_id = auth.uid()`. `seller_profiles.avg_rating` is rolled up by a SECURITY DEFINER
  `AFTER INSERT/DELETE` trigger (`recompute_seller_rating`).

---

### 5. A storefront is only live with every required document verified.

- The required set is **Government ID + Tax ID**, plus a **Cottage Food Permit** for any seller
  listing food. Whether they list food is *derived* from their product categories
  (`categories.requires_food_permit` → `seller_sells_cottage_food()`), never self-declared — so a
  trigger on `products` re-runs the gate whenever the catalogue changes.
- `seller_profiles.is_paused` is the single lever — checkout, the storefront page and `/shop` all
  already gate on it, so the guardrail lives entirely in
  **`sync_seller_license_pause()`** (`20260904110000_license_gate.sql`), not in request handlers.
- The gate predicate is `seller_has_required_documents()`: every required type has a
  `verification_status = 'verified'` row that is not past `expiration_date` (a tax ID has no expiry,
  and no issuing state — both columns are nullable for that type alone, enforced by CHECK).
- `src/lib/licenses/requirements.ts` is the seller-facing half of the same rules (the upload
  checklist). Keep the two in step: it decides what the seller is *asked* for, the SQL function
  decides whether the storefront may *open*.
- **The tax ID is encrypted and unreadable from any browser session.** `tax_id_encrypted` is
  AES-256-GCM (`src/lib/crypto/secret-box.ts`, key in `TAX_ID_ENCRYPTION_KEY` — the app holds it,
  Postgres never does), and SELECT is granted to `anon`/`authenticated` **column by column** with
  that column left off the list, so even the owning seller and an admin get a permission error —
  and `select *` on `seller_licenses` fails for those roles by design. Only `service_role` reads it,
  and **nothing in the app decrypts today**: every screen renders `tax_id_last4`. `license_number`
  is for non-sensitive document numbers only. Storing a tax ID writes a `tax_id_audit` row, and the
  `tax-id-retention` cron destroys numbers and documents 4 years past a seller's last sale. Anything
  that ever decrypts must write a `decrypted` audit row.
- **Rotation:** `TAX_ID_ENCRYPTION_KEYS` is a keyring of `id:key` entries and the **highest id is
  active**, so rotating is only "add a higher-numbered key" — there is no second variable to fall out
  of sync. Ciphertext is `v2.<keyId>.<payload>` (`v1.<payload>` is pre-keyring history, read as key
  1) and `seller_licenses.tax_id_key_id` mirrors that id so progress is countable without
  decrypting. `tax-id-rekey` (nightly, or on `harvest/taxid.rekey.requested`) sweeps stale rows;
  **an old key must stay in the list until /admin/settings shows nothing left on it**, or those rows
  become unreadable.
- **Precedence matters.** Pausing never renames an existing pause (`coalesce(pause_reason,
  'license_unverified')`), and unpausing lifts **only** `license_unverified` / `license_expired`,
  and only when Connect + a trialing/active subscription still hold. `revenue_cap` and `admin` are
  lifted by an admin or the yearly reset alone; `onboarding_incomplete` belongs to the webhook's
  `reconcileActivation`, which now also requires a valid license before it will set a seller live.
- Called from `reviewLicenseAction` (an admin verifying or withdrawing) and `reconcileActivation`.
- The gate is deliberately **not** keyed on `state_cottage_food_rules.requires_license`: those rows
  are seeded `false` as placeholders, so gating on them would enforce nothing. Revisit when real
  per-state rules are entered.

---

### 6. A seller may not list food where their state bans online food sales.

- **Delaware, Michigan, Mississippi, Nevada and Washington** prohibit online cottage-food orders
  under **every** program they run; five more ban it under one program and allow it under another.
  The predicate is `state_allows_online_food_sales(state)`, derived from `state_food_programs` —
  never a hardcoded state list, so correcting a program in the admin surface moves the gate with it.
- **That list was seeded wrong in both directions**, and every ban has now been checked against
  primary text (`20260906030000_verify_online_bans.sql`). Washington was seeded as *allowed* while
  RCW 69.22.020(4) says cottage food "may not be sold by internet, mail order, or for retail sale
  outside the state" — the seed would have permitted an unlawful listing. Hawaii was seeded as
  *banned* on nothing: Haw. Admin. Rules 11-50-3(c) attaches four conditions to a homemade-food
  operation and not one of them concerns selling channel, so Hawaii sellers were blocked for no
  reason, and is now `unclear`.
- **Kentucky's microprocessor row is the cautionary one.** `20260906030000` moved it to `unclear`
  too, on the strength of 902 KAR 45:090's silence — but the venue list is in the *statute*:
  KRS 217.137(2) permits sale "only ... by farmers markets, certified roadside stands, or on the
  processor's farm". `20260906290000` puts it back to `banned`. What settles it is the contrast
  inside the chapter: for the sibling home-based *processor* route, KRS 217.136(5) uses an open list
  and names the internet in it. **A ban recorded against a regulation is not disproved by that
  regulation's silence when the enabling statute carries the venue list.**
- **A third shape: a ban on the EXEMPTION rather than on selling.** SD and NH both grant a licence
  exemption that an internet sale falls outside — S.D. Codified Laws 34-18-38(2) requires the food be
  "sold in the seller's physical presence", RSA 143-A:12 III makes online selling the trigger for
  licensure. Neither forbids selling online; both mean you leave the programme by doing it, so the
  ban sits on the exempt row. A licensed operation in either state is outside the modelled route.
- **A ban can be express or by exhaustive enumeration**, and the notes say which. DE (cottage food),
  MI, MS, NV and WA name the internet; DE (on-farm), KY (microprocessor), ME, RI and WI instead
  permit an exhaustive list of venues the internet is not on. New Hampshire is a third shape: selling online is what *triggers*
  licensure (RSA 143-A:12 III), so the ban sits on the exempt row and the licensed row allows it.
- Enforced by the `products_guard_online_food_sales` BEFORE INSERT/UPDATE trigger
  (`20260904180000_online_food_sales_gate.sql`): a product in a `requires_food_permit` category
  cannot reach `active` or `sold_out` for a seller in a banned state. `draft` is allowed through on
  purpose — it keeps the seller's work and gives the migration's backfill somewhere to park existing
  listings without destroying them.
- **This is not a storefront pause.** Pausing would take down the legal candle listings alongside
  the illegal bread. The food listing is what's prohibited, so the food listing is what's blocked;
  non-food selling continues untouched.
- `describeFoodSalesBlock()` in the product actions is the friendly half — the seller reads a
  sentence, not a constraint violation. `FoodSalesNotice` says the same thing up front on
  `/seller/products` and `/seller/compliance`.

---

### 7. A listing must be in a food category the seller's state permits.

- `categories.food_axes` (`text[]`) maps our shopping taxonomy onto the six regulatory axes
  `state_food_programs` grades. `state_permits_food_axis(state, axis)` is true unless **every**
  program in the state bans it, and `products_guard_food_categories` refuses to publish a listing
  whose axis is banned (`20260904200000_category_food_axes.sql`). Drafts pass, as with rule 6.
- **An online restriction can land on an AXIS instead of on the state.** Tennessee is the case:
  § 53-1-118(b)(1) expressly permits internet selling, but (b)(3)(C) — added by 2025 Pub. Ch. 431 —
  lets a TCS item be sold only "by ... the producer to the consumer, in person" or by an agent in
  person at a farm stand on the property. So `online_orders` stays `allowed` and `cat_refrigerated`
  is `banned`: the shelf-stable listings keep selling and the TCS one is what's blocked. The
  counter-argument (a pickup order is arguably sold when the buyer collects) is recorded in that
  row's `category_note` rather than settled silently.
- **The alphabetical verification pass is COMPLETE.** All 51 jurisdictions and every one of the
  programme and label rows have now been read against primary text — statute or rule, from the
  state's own site, never a compilation. `verified_at` is still null on essentially all of them:
  the corrections are ours, the sign-off is an admin's, and `/admin/programs` counts what is left.
  Four recurring failure modes are worth carrying forward, because each was found more than once:
  **a tidied disclaimer** (a dash added in VA, a full stop in NV, sentence-casing in WY, an
  abbreviation in NH — `disclaimer_text` is quoted law printed onto food, so punctuation is
  substance); **an inherited disclaimer** (WV was carrying Tennessee's statutory sentence, WI's
  baking route was carrying its own canning statute's, and licensed routes in VT, VA and MD were
  carrying "not inspected" statements that were simply false); **a threshold in the cap column**
  (VT's $30,000 and VA's $9,000 both sat in `state_cottage_food_rules.revenue_cap`, which *pauses
  storefronts*); and **a summary's category list mistaken for a statutory one** (WV had five of six
  axes banned where the statute bans only meat).
- **Check the rule's effective date, not just its number.** Vermont's four rows cited "VT Admin.
  Code 12-5-52 §§ 6.1.1 and 6.2.1"; that rule was replaced by the **Manufactured Food Rule effective
  2026-01-15**, which *also* has a 6.1.1 and a 6.2.1. The labelling list at 6.2.1 survived almost
  unchanged — but 6.1.1 went from a home-bakery "$125.00 per week" exemption to a cottage-food
  "$30,000 or less" one, so the citation still resolved and the content underneath it had changed.
- **A licensed route must not inherit an exempt route's disclaimer.** "Made in a home kitchen not
  inspected by the Vermont Department of Health" comes from a section headed *Labeling Requirements
  for License Exempt Food Manufacturing Establishments*; Vermont's home bakery and home caterer are
  licensed and inspected, so it was removed from those two rows. Same reasoning as Maryland's
  on-farm row.
- **`unclear` is a legitimate correction downwards.** All three Utah programmes were seeded
  `online_orders = allowed`; none of the three bodies of law (Utah Code § 4-5-501 + R70-560, Title 4
  Ch. 5a, § 26B-7-416) mentions internet selling in either direction, so all three are now `unclear`.
  Nothing is blocked by the change — only `banned` blocks — and the row stops asserting an answer the
  state never gave.
- **For an amendment, read the ENROLLED PUBLIC CHAPTER, not the bill as filed.** Tennessee's HB 130
  as introduced would have permitted internet sale of dairy, meat and poultry items; the chapter the
  governor signed does the opposite. Legislature sites serve the introduced draft under the bill
  number — the acts archive serves the law.
- **Only an outright ban blocks.** `conditional` (Colorado: meat under 1,000 personally-raised
  poultry), `list_only` and `limited` are qualifications — the listing goes through and the seller
  is shown the qualification. `unclear` is missing data and must not stop a seller trading.
- **An empty `food_axes` means no rule is known, not that the category is unregulated.** Fresh
  produce is not one of the six axes at all, and "Juice & Cider" could be acidified, refrigerated or
  neither. Those are left unmapped rather than guessed — a wrong mapping either blocks legal trade
  or permits illegal trade — and `/admin/programs` counts them so the gap is visible.
- **The seller's chosen program decides it when they have one.** `seller_permits_food_axis()` /
  `seller_allows_online_food_sales()` read `seller_profiles.food_program_id` and check that program
  alone; with no choice recorded they fall back to "does any program in the state permit it", so
  nothing regresses for a seller mid-onboarding. California is the sharp case: Class A bans meat,
  MEHKO allows it, and the same listing is legal or not depending on which one the seller is on.

---

## Conventions

- **TypeScript strict.** No `any` without a written reason. Validate external input with Zod at the
  boundary; infer types from the schema.
- **RLS on every table.** A new table is not done until it has row-level security policies. The
  service-role key (`src/lib/supabase/admin.ts`) bypasses RLS and is used **only** in webhook
  handlers and trusted server jobs, never in a request handler driven by user input without an
  explicit authz check first.
- **Authorization inside a SECURITY DEFINER function: never use `current_user`.** RLS is bypassed in
  a SECURITY DEFINER body *and* `current_user` is the function **owner** (`postgres`), not the
  caller — so `is_platform_context()` is always true there and is useless as a guard. This shipped a
  real bypass in `advance_order_status` (any authenticated user could advance any order); see
  `20260904090000_fix_advance_order_status_authz.sql`. Use **`auth.uid()`** for ownership and
  **`is_service_role()`** for the trusted-caller escape hatch — both read the request JWT claims,
  which are transaction-local and survive correctly. `is_platform_context()` stays as-is and is
  **only** valid in SECURITY INVOKER guard *triggers* (`profiles_guard_role`,
  `seller_profiles_guard_columns`, …), which rely on it returning true for `postgres` so SECURITY
  DEFINER jobs can write protected columns. Any new function granted to `authenticated`/`anon` needs
  a case in `test/integration/functions-authz.test.ts`.
- **Server Functions / Actions** verify auth and authorization on every call (they are reachable by
  direct POST, not just via your UI). Use `requireUser()` / `requireRole()` from `src/lib/auth.ts`.
  Public write paths (checkout, cart re-price, promo attempts, messaging, reports) also call
  `tryRateLimit()` from `src/lib/rate-limit.ts` right after the auth check, keyed per user.
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
| `npm test` | Vitest unit pass (pure logic; `test/integration/**` excluded) |
| `npm run test:integration` | DB pass — SECURITY DEFINER fns, triggers, RLS against a real Postgres. Skips unless `INTEGRATION_SUPABASE_URL` / `_ANON_KEY` / `_SERVICE_ROLE_KEY` are set. See `test/integration/README.md` |
| `npx supabase start` | Local Postgres + Auth + Storage (needs Docker) |
| `npx supabase db reset` | Drop, recreate, re-run all migrations + seed |
| `npx supabase migration new <name>` | New migration file |
| `node scripts/verify-disclaimers.mjs` | Check all 55 quoted-law strings against the documents they cite. Fetches; run by hand |
| `node scripts/pdftext.mjs <file.pdf> "<regex>"` | Read a statute PDF (pdf.js). Handles hex strings, CID fonts and object streams — the hand-rolled version did not, and left AR and CO unverified |
| `npx supabase db diff -f <name>` | Generate a migration from schema changes |
| `npx supabase gen types typescript --local > src/lib/db/database.types.ts` | Regenerate DB types |
| `stripe listen --forward-to localhost:3000/api/webhooks/stripe` | Forward Stripe test webhooks locally |
| `stripe trigger <event>` | Fire a test webhook event |

## Where things are

```
ARCHITECTURE.md                        source of truth for schema + design decisions
LAUNCH.md                              production go-live checklist (env, Stripe live, Inngest Cloud, Resend, admin, hardening)
test/                                  Vitest units (pure logic) · test/integration/ = the DB pass (see its README)
supabase/migrations/                   Phase 1: core tables, RLS, seed · Phase 2: orders+pipeline, compliance · Phase 3: referrals, finalize_paid_order
src/lib/env.ts                         Zod-validated environment
src/lib/supabase/{client,server,admin}.ts   browser / server / service-role clients
src/lib/stripe/{client,config,checkout}.ts  Stripe SDK · price/coupon constants · Checkout builder
src/lib/money.ts                       server-side money helpers (cents)
src/lib/geo/{state,address,geocode,routing}.ts   geofence predicate · address schema/format · Mapbox geocoding · routing interface
src/lib/geo/density.ts                 reachability bands + the honest headline for a thin state (pure)
src/lib/orders/{pricing,status,queries,delivery}.ts   server re-pricing · status map · order reads · delivery-fee quote
src/lib/orders/{drops,drop-queries}.ts   pre-order batches: state + copy + the sell-by-batch gate (pure) · reads
src/lib/events/{schedule,queries}.ts   wall-clock event arithmetic (pure) · state / market / seller reads
src/lib/compliance.ts                  revenue-status / license / notification reads
src/lib/licenses/{queries,labels,requirements}.ts   admin queue reads · type labels · the required document set + checklist
src/lib/crypto/secret-box.ts           AES-256-GCM keyring for the tax ID · rotation (no in-app decrypt path)
src/lib/compliance/{programs,food-sales,categories,onboarding}.ts   programs · online-sales gate · category gate · program choice + the publish-time requirement
src/lib/compliance/{blocks,publication,delivery}.ts   ComplianceBlock (message + citation + source) · the predisclosure publish gate · delivery-by-programme
src/lib/compliance/{obligations,obligation-queries}.ts   recurring-deadline arithmetic (pure) · what this seller owes and when
src/lib/products/labeling.ts           ingredients / allergens / net weight for the label
src/lib/products/{card,quick-view}.ts   what a listing says about itself (pure) · the quick-view read
src/lib/ai/{claims,prompt,response,generate}.ts   the claim screen (pure) · grounded prompt · unwrapping · the API call
src/lib/labels/{render,queries}.ts     label composition (pure) · loading the rule + product + seller · describeListingGaps
src/lib/admin/state-rules.ts           per-state cottage-food rules for the admin editor
src/lib/analytics/queries.ts           seller dashboard stats (revenue/AOV/fulfillment/top products from orders)
src/lib/payouts/{format,queries}.ts    payout status + copy (pure) · the mirror read · Stripe read-through
src/lib/stories/{select,queries}.ts    daily rotation + excerpt (pure) · home / storefront reads
src/lib/launch/{checklist,templates,queries}.ts   derived launch steps · copy that passes the claim screen · the counts
src/lib/reviews/queries.ts             seller reviews + rating summary reads
src/lib/messages/queries.ts            conversation list / thread / unread-count reads
src/app/messages/                      buyer↔seller inbox + thread (own layout, both roles)
src/lib/referrals/{codes,settings,validate,queries}.ts   promo-code rules · config · checkout validation · dashboard reads
src/lib/stripe/coupons.ts              ensureBuyerDiscountCoupon (reusable percent-off)
src/lib/inngest/                       Inngest client + functions (revenue-cap, license-expiry, obligation-reminders, referral-activate/-invalidate, notification-dispatch, tax-id-retention, tax-id-rekey, program-review-scan)
src/lib/notifications/                  queue (channel fan-out + email opt-out / SMS opt-in) · categories (template→category, prefs, smsEnabled) · copy (in-app lines) · templates (email) · send (Resend) · sms (Twilio)
src/lib/auth.ts                        requireUser / requireRole / getProfile / getSellerContext
src/lib/rate-limit.ts                  tryRateLimit + RATE_LIMITS · check_rate_limit() Postgres fixed-window, fails open
src/proxy.ts                           Supabase session refresh (was middleware.ts)
src/instrumentation*.ts                 Sentry init (server/edge/client) · onRequestError · inert without SENTRY_DSN
src/app/(auth)/                        login, signup, email confirm
src/app/(shop)/                        buyer: /shop, /s/[slug] storefront, /cart, /checkout, /orders, /account (address book + email/SMS prefs)
src/app/(dashboard)/seller/onboarding/ Connect Accounts v2 + Billing subscription · /program = state rules wizard
src/app/(dashboard)/seller/products/   product CRUD
src/app/(dashboard)/seller/orders/     seller order board (advance_order_status RPC) + /export CSV
src/app/(dashboard)/seller/referrals/  promo codes + Referral Progress widget
src/app/(dashboard)/seller/compliance/ revenue-vs-cap, licenses, notifications
src/app/(dashboard)/seller/settings/   pickup address + local-delivery config + notification-email opt-outs
src/app/admin/licenses/                license review queue + [id]/document signed-URL redirect
src/app/admin/states/                  per-state cap / licence-required editor
src/app/admin/programs/                cottage-food programs · [id] = the review + verify form
src/app/api/webhooks/stripe/route.ts   the ONLY place Stripe state is applied
src/app/api/inngest/route.ts           Inngest serve endpoint
```

**Phase 2 — buyer checkout:** a Stripe **Checkout Session** → destination charge with
`on_behalf_of` the seller (seller = MoR) + `automatic_tax` (`liability: { type: 'account' }`).
Order starts `pending_payment`; the `checkout.session.completed` / `async_payment_succeeded`
webhook calls **`finalize_paid_order()`** — one guarded, atomic SQL function that moves the order to
`new`, finalises `discount_total`/`tax_total`/`total` from the session, decrements stock, and (for a
promo order) logs the pending referral. Guarded on `status = 'pending_payment'`, so a Stripe
redelivery — even after a partially-completed prior attempt — is a clean no-op or a clean full redo.
`charge.refunded` (full only) / `charge.dispute.created` move the order to `cancelled` / `disputed`
and emit `harvest/order.refunded`. Sellers advance the pipeline only through `advance_order_status()`
(SQL, SECURITY DEFINER); every transition is logged to `order_status_history` by trigger.
`npm run stripe:tax -- --account <acct> --state <XX>` sets up test-mode Stripe Tax.

**Phase 2 — compliance guardrails (Inngest).** `advanceOrderStatusAction` emits
`harvest/order.completed` (and `harvest/order.cancelled`). `revenue-cap-check` calls
`record_order_revenue()` which tallies `seller_revenue_tracking` and, if the yearly goods total
crosses `state_cottage_food_rules.revenue_cap`, sets `is_paused = true, pause_reason =
'revenue_cap'` **atomically in SQL** (guardrail lives at the data layer). `license-expiry-scan`
(daily cron) sends T-30/7/1 reminders and calls `expire_seller_license()` at expiry (→
`pause_reason = 'license_expired'`). A compliance pause is never lifted by the Stripe webhook's
`reconcileActivation` — only by an admin or the yearly reset. Local dev: `npm run inngest:dev`
(no keys).

**Phase 3 — notification delivery.** Producers call `queueNotification()` /
`queueNotificationForEach()` (`src/lib/notifications/queue.ts`), which fans a template out to one
`notifications` row per channel (default `in_app` + `email`) and nudges `harvest/notification.queued`.
`notification-dispatch` (Inngest — that event + a `*/2` cron backstop) sends the non-`in_app` rows:
`email` → resolve address (`auth.admin.getUserById`) + render (`templates.ts`) + Resend
(`send.ts` — logs when `RESEND_API_KEY` unset), keyed on `notification.id`; `sms` → `profiles.phone`
+ the `copy.ts` one-liner + Twilio (`sms.ts`, a keyless `fetch` to the Messages REST endpoint — logs
when any `TWILIO_*` var is unset). Marks `sent` / bumps `attempt_count` / `failed` past 5; optimistic
`attempt_count` claim guards concurrent runs (Twilio has no idempotency key, so a crash mid-send can
re-text). Every `advance_order_status` transition emits `harvest/order.status_changed` →
`order-status-notify` (Inngest) queues `order_status_changed` on `["email", "sms"]` to the buyer (no
buyer in-app panel; `sms` dropped unless opted in). `sendMessageAction` emits `harvest/message.sent`
→ `message-notify` emails the recipient a `new_message` **only when it's their sole unread message in
the thread** (deduped on `message_id`).

Per-user **email opt-outs**: `queueNotification` reads `profiles.notification_prefs` (jsonb,
`{category: false}` = opted out) and drops the `email` channel for a suppressed category before
inserting — `in_app` is never filtered. `src/lib/notifications/categories.ts` owns the template →
category map and `emailEnabled()`; `payments` (refund) + `compliance` (license-expired / revenue-cap)
are **not** suppressible and skip the profile read entirely. Sellers/admins toggle theirs on
`/seller/settings` (`saveNotificationPrefsAction`); buyers on `/account`; the `messages` category
(`audience: "all"`) shows on both.

**SMS is opt-IN** — `notification_prefs["sms:<category>"] = true` (only `order_updates` is
SMS-eligible, `SMS_CATEGORIES`). `queueNotification` drops the `sms` channel unless `smsEnabled()`.
Buyers add a US number + toggle "text me order updates" on `/account` (`saveSmsPrefsAction` →
`profiles.phone` E.164 + the pref). No phone verification yet.

**Phase 3 — referral engine.** Seller makes a `promo_codes` code; buyer enters it at checkout →
`validatePromoCode` (validates the code shape with `promoCodeSchema`, then an `.eq` lookup — never a
LIKE on raw input; our DB owns attribution). The discount amount is our own math and is snapshotted
into `discount_total` at checkout; a reusable `buyer-referral-pct-<n>` Coupon
(`ensureBuyerDiscountCoupon`) goes on the Checkout Session purely so Stripe Tax hits the discounted
base. `finalize_paid_order()` (see Phase 2) logs the `pending` referral via
`create_referral_for_order()`. Order → `completed` fires `harvest/order.completed` →
`referral-activate`: `activate_referral_for_order()` sets the referral `active` and
`referral_cycles.active_referral_count += 1` atomically, and **reports** whether the cycle just hit
the threshold — it does **not** touch `reward_granted`. The function then attaches the reward Coupon
(id from `platform_settings.seller_referral_reward.coupon` via `getReferralConfig`, `idempotencyKey =
reward:<cycle_id>`) and only then does `set_referral_reward_coupon()` flip `reward_granted` +
`reward_stripe_coupon_id` **together** — so `reward_granted` always implies the coupon is really
attached. A permanently failed attach leaves the cycle honestly un-granted and re-attempts on the
next activation; `onFailure` flags admins. Cycles rotate via `open_referral_cycle()` from
`handleSubscription` / `invoice.paid` (which reads
`invoice.parent.subscription_details.subscription`) **only on a strictly-later `period_start`** — an
equal/earlier boundary keeps the in-progress cycle and its count; `reward_granted` is preserved on a
closed cycle. `harvest/order.cancelled` (seller board — referral still `pending`) or
`harvest/order.refunded` (`charge.refunded` / `charge.dispute.created` — referral may be `active`) →
`referral-invalidate` (decrement, never revoke an issued coupon — flag admins if a granted reward
drops below threshold). Anti-abuse: self-referral block, one non-invalidated referral per
buyer+seller+cycle (app check + partial unique index), `referral_min_order`. Config in
`platform_settings` (`buyer_referral_discount`, `seller_referral_reward` = `{threshold, coupon}`,
`referral_min_order`); `npm run stripe:setup` creates the coupons.

**Phase 3 — local delivery + mileage fees.** Seller sets a pickup address + `delivery_enabled` /
radius / `delivery_base_fee` / `delivery_per_mile_fee` on `/seller/settings`
(`saveDeliverySettingsAction` geocodes via Mapbox → `upsert_address()` RPC, the only way to write a
PostGIS point through PostgREST; a trigger blocks `delivery_enabled` without a pickup address).
Checkout: the buyer picks pickup or delivery + an address; `repriceCartAction` / `startCheckoutAction`
call `resolveDelivery()` → `geocodeAddress()` + `quoteDelivery()`. `quoteDelivery` runs
`delivery_route_inputs()` (SECURITY DEFINER, service-role — PostGIS straight-line radius check +
returns the seller's pickup coords) then the Mapbox driving distance; `fee = base + per_mile *
ceil(miles)`, min 1 mi, all cents. The fee is **snapshotted** into `orders.delivery_fee` (our math,
like `discount_total`), the address frozen into `orders.delivery_address_text`, and it rides the
Stripe session as a `shipping_options` fixed rate so Stripe Tax handles delivery tax and the seller
(MoR) receives it. For delivery, `orders.buyer_state` = the delivery address state (still ==
seller state; the `orders_same_state_only` CHECK + guard hold). Needs `MAPBOX_TOKEN` (Geocoding +
Directions); with none set, delivery is unavailable and pickup is unaffected. `src/lib/geo/routing.ts`
keeps the provider swappable. Buyers save reusable addresses on `/account` (`addresses` table +
`upsert_address` RPC + "addresses: owner all" RLS — no schema change) and pick one from a dropdown
in the checkout delivery form (`getMyDeliveryAddressesAction` → populates the fields; the fee is
still quoted server-side from the submitted text).

**Delivery time windows.** A delivery-enabled seller lists free-text window labels
(`seller_profiles.delivery_windows` jsonb; parsed by `parseWindows` in `src/lib/orders/delivery-windows.ts`
— one per line, deduped, ≤12, ≤80 chars) in the `/seller/settings` form. If a seller has windows,
the buyer **must** pick one at checkout (`startCheckoutAction` re-checks the choice is in the list)
and it's frozen into `orders.delivery_window`, shown on the buyer order page + both seller order
views. Windows don't touch pricing or the Stripe session — pure fulfilment metadata.

**Phase 3 — seller analytics.** `/seller` overview renders `SellerStatsPanel` from
`getSellerDashboardStats(sellerId, windowDays)` — RLS-scoped reads of `orders` / `order_items`
aggregated in JS. The window is **30 / 90 / 365 days** (`?range=` on `/seller`, `parseWindowDays`);
every figure is compared against the equally-long period before it. Revenue (`sum(total)` of
`completed` orders) with a vs-prior trend, completed-order count, AOV, pickup/delivery split,
delivery fees + referral discounts, a dependency-free SVG revenue chart (daily ≤90d, weekly for a
year), and top 5 products. **Storefront views + conversion rate** (completed orders ÷ views): the
storefront page fires `record_storefront_view` (SECURITY DEFINER RPC, `anon`-callable) from
`TrackStorefrontView` once per browser session — not for the owner's own visits — into the per-day
`seller_view_counts` rollup. Advisory (seller-only, no money effect), so the RPC is unthrottled.
The `record_storefront_view` beacon also passes the ids of the products shown → per-product
impression rollup (`product_view_counts`, RLS = seller reads own) → a "Most viewed" list on the
dashboard. `GET /seller/orders/export` streams the seller's orders as CSV (`src/lib/orders/csv.ts`,
pure). Not built: chart CSV.

**Phase 4 — reviews.** ARCHITECTURE §2.7. `reviews` (one per order, `order_id` unique). Verified-
buyer rule (rule 4) at the data layer: `reviews_verify_buyer` BEFORE INSERT (fires for every insert)
requires a `completed` order by that buyer for that seller; RLS scopes writes to
`reviewer_id = auth.uid()`, reads public, reviewer deletes own. `seller_profiles.avg_rating` rolled
up by a SECURITY DEFINER AFTER INSERT/DELETE trigger. Surfaced on the buyer order page, storefront
(header + list), shop listing, seller overview. A seller posts one public **reply** per review
(`reviews.response` / `responded_at`): `respondToReviewAction`, gated by the "reviews: seller
responds" UPDATE policy (owner of `seller_id`) + the `reviews_guard_columns` BEFORE UPDATE trigger
that freezes every column but the two response ones. Edit form on the seller overview
(`ReviewList respondable`); read-only on the storefront + buyer order page.

**Phase 4 — in-app messaging.** ARCHITECTURE §2.6. `conversations` (one per buyer+seller+order;
`order_id` NULL = general) + `messages`. Clients never write `conversations` (`get_or_create_
conversation` RPC) or update `messages` (`mark_conversation_read` RPC). RLS = "participant"
(`buyer_id = auth.uid()` OR `seller_id ∈ my seller_profiles`), via the SECURITY DEFINER
`is_conversation_participant`. `/messages` (own layout, both roles) — inbox + thread. `MessageThread`
uses Supabase Realtime (Postgres Changes) **plus a 4s visible-tab poll**; the poll is the reliable
path — **Postgres Changes must be enabled for `messages` in the Supabase dashboard** for the instant
path to work (`messages` is in `supabase_realtime` with `replica identity full`, but the hosted
project wasn't streaming it). Unread badge in both nav headers. A new message emails the recipient
(see the notification-delivery section — `message-notify`). Not built: typing/presence, attachments.

**Phase 4 — reports / flagging.** ARCHITECTURE §2.7 (the `refunds` table + Stripe refunds are
Phase 5). `reports` (one per order per reporter, `unique(order_id, reporter_id)`; `reason` enum,
`status` open→investigating→resolved/refunded). `reports_verify_reporter` BEFORE INSERT: the
reporter must be the order's buyer or own its seller_profile, and the order must be past
`pending_payment`. RLS: reporter reads own OR `is_admin()`; reporter files own; only `is_admin()`
updates. `submitReportAction` (`src/app/reports/actions.ts`, shared by both order pages) inserts +
`queueNotificationForEach` a `report_filed` to admins. Read-only-ish admin queue at `/admin`
(`requireRole("admin")`, own layout; "Admin" nav link shows only for `role = 'admin'`) — status +
resolution-note updates.

**Phase 5 — admin refunds.** `refunds` table (§2.7; party-or-admin read, no client write). An order
can be refunded across **several partial refunds** — one row per Stripe `Refund`, keyed on
`unique(stripe_refund_id)` (the `unique(order_id)` was dropped). `issueRefundAction` (admin): sums
existing `refunds`, validates the new `amount` (dollars → cents) ≤ the **remaining** balance,
`stripe.refunds.create({ payment_intent, reverse_transfer: true, amount? })` (omit `amount` = "the
rest"; pulls back from the seller/MoR proportionally), `idempotencyKey:
refund:<order_id>:<already-refunded-cents>` (advances as refunds accumulate → dedupes a double
submit), records the row (`onConflict: stripe_refund_id`) + resolves the report. **Never touches
order state.** The `charge.refunded` webhook: `fetchOrderForCharge`, take the triggering refund
(`charge.refunds.data[0]`), mirror it if `stripe_refund_id` is new, link+resolve the oldest open
report, and queue `refund_issued` (payload carries `refund_id` + this refund's `amount` + a
`cancelled` flag; deduped per refund by `notifications_refund_issued_ux` + `tolerateDuplicate`).
When the **cumulative** `charge.amount_refunded` reaches the charge total → `unwindOrder(→ cancelled)`
+ referral-invalidate. `charge.dispute.created` → `unwindOrder(→ disputed)`. Order pages sum the
refunds → "Refunded − $X" / "Partially refunded (N) − $X".

**Phase 5 — license review.** Sellers upload cottage-food permits / IDs to the private `seller-docs`
bucket; `/admin/licenses` is where an admin verifies or rejects them. `verification_status` and the
review trail (`reviewed_at` / `reviewed_by` / `review_note`) are platform-only at the data layer
(`seller_licenses_guard_status`), and `is_platform_context()` reads `current_user` — an admin over
PostgREST is `authenticated`, so the "licenses: admin all" RLS policy is **not** enough to write
them: `reviewLicenseAction` goes through the service-role client behind `requireRole("admin")`.
Verifying is what arms `license-expiry-scan` (it scans `verified` rows only), so the action refuses
to verify an already-lapsed document. A rejection must carry a note — the seller sees it on
`/seller/compliance` — and either outcome queues a `license_verified` / `license_rejected`
notification (category `compliance`, so not suppressible). **A licence cannot be verified with no
document attached** — `seller_licenses_guard_verification` blocks the transition and
`reviewLicenseAction` says so in a sentence. `seller_licenses_document_required` already covers the
three required types on new writes; the trigger covers the other types and rows that predate it.
Rejecting a documentless licence stays allowed, so the seller learns why. Every decision then runs
`sync_seller_license_pause()` (rule 5), so verifying a document is what reopens the storefront and
withdrawing a verification is what closes it; `license_required` tells a seller paused this way what
to do. The document itself is reached only via
`GET /admin/licenses/<id>/document`, which mints a 60-second signed URL with the service-role client;
route handlers don't run the `/admin` layout, so that handler carries its own admin check.

**Phase 5 — platform analytics.** `/admin/analytics` — `getPlatformStats()`
(`src/lib/admin/analytics.ts`) reads all orders / refunds / seller_profiles / profiles /
subscriptions via the **service-role client** (allowed: it's behind the `/admin` layout's
`requireRole("admin")`), aggregated in JS. GMV (Σ `total` of completed orders) all-time + 30d, AOV,
refund total, MRR (`active` subs × $20 — trialing = $0), paying/trialing seller counts, total/live/
active-30d sellers, total/ordered buyers, 30d signups. Admin sub-nav: Reports · Licenses · Analytics · States · Programs · Settings.

**Phase 5 — state rules editor.** `/admin/states` edits `state_cottage_food_rules` (cap,
`requires_license`, notes) through the request client — RLS ("cottage rules: admin write") is the
gate and there is no guard trigger, so no service role. **Saving is the verification act**: it
stamps `verified_at` / `verified_by` (`20260904120000_state_rules_verification.sql`), which is what
separates a real figure from the seeded placeholder. All 51 rows shipped with the same invented
$50,000 cap and `requires_license = false`, and `record_order_revenue` pauses a storefront the
moment its yearly gross crosses whatever is in that column — so an unverified row is a guardrail
firing on a number nobody checked. The page says so, and `/seller/compliance` only calls the cap a
placeholder when `verified_at` is null (`getRevenueStatus().capVerified`).


**Phase 5 — state food programs (compliance reference data).** `state_food_programs`
(`20260904170000_state_food_programs.sql`) holds **69 programs across 51 jurisdictions**, seeded
from the Institute for Justice state pages read 2026-09-04. The shape matters: a seller operates in
a **program within a state**, not in a state — CA/OR/UT/VT run three each and ten more run two, with
different caps, permitted foods and online rules. Key columns: `online_orders`
(`allowed|banned|unclear` — **DE, HI, MI, MS, NV ban it under every program**, so sellers there may
list non-food only), `mail_delivery` + `mail_note`, `direct_delivery` (defaults `unclear` —
whether delivering to a buyer's door counts as a permitted venue is a legal question the source
does not answer), `cap_basis` (`annual_total|per_product|per_category` — CO caps per *product*, VA
caps only acidified), `license_threshold` (VT 6,500 / VT 10,000 — triggers licensing
rather than stopping sales; the MN 7,665 once listed here is a registration-*fee* line, see below), and the six category axes. Public read, admin write, and **every row
lands unverified**: IJ is a summary, not statute, and its own pages say so. `state_label_rules` is
created **empty on purpose** — disclaimer text is quoted statute that gets printed onto food, so it
needs a complete verbatim capture. `/admin/programs` lists the data and how much is unchecked; `/admin/programs/[id]` is the review
form. **`verified_at` is set by an admin saving that form and by nothing else** — no seed, no
backfill, no job — and it records that a person checked the row against the STATE's rules, not
against our copy of them, which is why the page puts the source link in front of them. Saving also
refreshes `source_checked_at`.


**Phase 5 — product label fields.** `products` gains `ingredients` (jsonb string array),
`net_weight_value` + `net_weight_unit`, and `allergens` (`text[]`)
(`20260904190000_product_label_fields.sql`) — the three things nearly every state requires on a
homemade-food label that a product row could not previously express. **Ingredient order is
meaningful** (states require descending order of predominance by weight, so the seller's order is
the label's order — never re-sort it). The allergen vocabulary is the federal nine and is enforced
by a CHECK: a misspelling that reaches a printed label is worse than one refused at write time.
`src/lib/products/labeling.ts` is the pure half — `parseIngredients`, `parseAllergens`,
`formatAllergens`, and `formatNetWeight`, which derives the metric equivalent NC/TN/CT require
rather than asking the seller for it. Fields are optional until the label generator can require them
in exchange for something. Net weight and allergens also show on the storefront: a buyer-safety fact
belongs on the shelf, not only on the label. Production date and lot code are deliberately absent —
they are per-batch, so label printing will ask.


**Phase 5 — food program onboarding.** `/seller/onboarding/program` is step 4 of onboarding and the
place the law gets taught by asking questions. The seller's state comes from their storefront
details, so the page opens by saying outright if that state bans online food sales; otherwise it
asks **what they want to make** (marketplace categories, mapped to axes through
`categories.food_axes`) and shows which of their state's programs cover it, with the trade-offs in
their terms — cap, licence, inspection, training — and links to the actual application and training
course where the seed has them. Programs that don't fit stay visible and are marked rather than
disappearing. The choice writes `seller_profiles.food_program_id`
(`20260904210000_seller_food_program.sql`), guarded so a program from another state is refused and
so moving state clears the choice rather than blocking the move. That column is what makes rules 6
and 7 precise. `src/lib/compliance/onboarding.ts` holds the reads and the plain-language
`programRequirements()` / `programSummary()`.


**Phase 5 — label and placard generator.** `state_label_rules` is now seeded for all **69 programs**
(`20260904220000_state_label_rules_seed.sql`) from a complete verbatim re-read of the source. Rules
are per PROGRAM because two states differ internally: New Hampshire's licensed and unlicensed
programs carry different disclaimers, and Iowa asks less of a Cottage Food Operation than of a Home
Food Processing Establishment. **`disclaimer_text` is quoted statute — stored verbatim, printed
as-is at `disclaimer_min_pt`, never paraphrased or regenerated.** `required_elements` is a fixed
vocabulary with a CHECK, since a typo silently drops a required field off a label.
`/seller/products/[id]/label` renders it: `renderLabel()` (`src/lib/labels/render.ts`, pure) merges
product + seller + verified permit into the state's element list, derives the metric equivalent
where required (CT/NC), and emits a **`missing` list instead of a label** when the state requires
something the seller hasn't filled in — naming each field and where to fix it. Printing is disabled
until it's complete, and refused outright when the state's rule is unrecorded (MT, PA and
Maryland's on-farm route; **UT left once R70-560-6, 4-5a-104(3) and 26B-7-416(8)(h) were read** —
its three routes had all three label rules empty because § 4-5-501(4)(c) delegates the label to a
rule and the other two put it in different titles). Louisiana and Massachusetts left that list once
40:4.9 and 105 CMR 590.001(A) were read; **Maryland's on-farm row joined it deliberately**, because the label it held
was a copy of the cottage-food one and would have printed "Made by a cottage food business" on a
licensed processor's jar — refusing to print beats printing something false.
Production date, lot code and use-by are asked for at print time, being per-batch. Eleven states (CO,
ID, IL, MN, ND, NE, NJ, NM, OK, TN, WI) also get a point-of-sale placard — the list has churned entirely on
reading the statutes: CO, IL, ND, NJ, NM, TN and WI joined, Alaska and Missouri left (Missouri's placard
text turned out to be an invented paraphrase and § 196.298.4 prescribes no sign at all), and in CO, IL
and WI **the placard text is deliberately NOT the label disclaimer** — Wis. Stat. 97.29(2)(b)2.d wants
"These canned goods are homemade and not subject to state inspection." on the sign while 2.e puts a
different sentence on the jar.

`required_elements` alone could not express three things states actually ask for, so
`20260906150000_label_element_vocabulary.sql` added them rather than leaving a note asking a human
to finish the label by hand. **`optional_elements`** is the "if applicable" case (AS 17.20.332 wants
a business licence number only from producers who have one) — printed when a value exists, never a
blocker. **`element_alternatives`** (jsonb array of arrays, shape-checked by a strict-jsonpath CHECK)
holds either/or groups: Colo. Rev. Stat. 25-4-1614(3)(a)(II) wants "telephone number **or**
electronic mail address", so a group is missing only when *every* member is empty, and every member
the seller does have gets printed. **`regulator_website_url` + the `regulator_website` element** is
an address the *state* supplies (AZ 36-932(A)(5), CO 25-4-1614(3)(a)(VI)) — it lives on the rule, not
the seller, and a rule naming the element with no URL recorded renders as **missing with
`fix: "admin"`**, because the label genuinely cannot print until an admin enters it. Not everything
fits: AZ 36-932(A)(4)'s developmental-disability-facility disclosure is conditional on a fact nothing
models, so it stays in the rule's notes. **`municipality_state`** is a fourth: 16 Del. Admin. Code
4458A 8.2.1 asks for `"town/city, Delaware"` as one phrase, so printing the bare town is a
non-compliant label — it renders "Wilmington, Delaware" from `LabelSource.stateName` and is missing
unless both halves are known. It does **not** replace `municipality`, which CA and CO want as a bare
county. `product_label_disclosure()` returns all three (plus
`municipality`, which it had never returned — California's 114365.3(f) requires the county of
approval in the *advertisement*, so it was silently dropping off every Californian listing).
Two more elements came out of the alphabetical pass. **`municipality_state`** prints the town and
the state as one phrase, which 16 Del. Admin. Code 4458A 8.2.1 requires (`"town/city, Delaware"`) —
it does not replace `municipality`, which CA and CO want as a bare county. **`expiration_date`** is
a third per-batch value alongside `production_date` and `lot_code`, asked for on the print form and
never stored on the product; Iowa Code 137D.2(7)(e) wants one on refrigerated TCS food, and it sits
in `optional_elements` because nothing here records whether a given product is one.
**`handling_instructions`** is the per-PRODUCT counterpart: Idaho Code 37-205(4)(b) wants safe
storage and preparation instructions on perishable food and N.D. Cent. Code 23-09.5-02(7) on
anything needing refrigeration, so it lives on `products.handling_instructions` — a cheesecake and a
jar of dried herbs need different words. Optional in both rules, since neither schema nor statute
says which products are perishable.
**`seller_statement`** is the odd one out. La. Rev. Stat. 40:4.9(D)(1)(a) requires "a label which
clearly indicates that the food was not produced in a licensed or regulated facility" — a fact to
convey, with no wording prescribed. Composing a sentence and storing it in `disclaimer_text` would
put our prose in the one column that exists to hold **quoted law printed onto food without review**,
so instead **the seller writes it**, prompted by `state_label_rules.seller_statement_prompt` (the
state's own words, CHECK-enforced to be present whenever the element is used). The label will not
print until they do, which is what Louisiana requires.

**Utah needs two of them, in two different programmes.** § 4-5a-104(3)(b) wants "a disclosure
statement indicating that the product is: (i) not for resale; and (ii) processed and prepared
without state or local inspection", plus (3)(c)'s shared-kitchen allergen statement; § 26B-7-416(8)(h)
wants a microenterprise operator to notify the buyer that "while a permit has been issued by the
local health department, the kitchen may not meet all of the requirements of a commercial retail food
establishment". Both prescribe substance and leave the wording, so both are `seller_statement`.
Utah's *cottage food* route is the opposite case — R70-560-6(2)(h) prescribes the exact words
("Home Produced", bold, 12pt, principal display panel), so that one is `disclaimer_text`. Same state,
same pass, both columns, and which column a rule lands in is decided by whether the state wrote the
sentence.

**Four states need it** — LA, MO (§ 196.298.4), MT (§ 50-49-203(3)) and NE (§ 81-2,280(5)(a)) — so it
lives on `seller_profiles.homemade_food_statement`, not on the print run: it is one sentence about
the producer, identical on every label they will ever print. **Nebraska is what forced that**:
§ 81-2,280(5)(c) requires the notification, for a pickup or delivery sale, "on the producer's
website", and a value typed into a print form and never stored cannot reach a storefront listing.
`product_label_disclosure()` returns it, `/seller/settings` collects it (the card appears only where
the state asks for one), and the print form pre-fills from it while still allowing a one-off
override. Its `fix` is `profile`, so an empty one shows up in `DisclosureGapNotice`.

**`producer_email` is the seller's account email, and `product_label_disclosure()` returns it only
where the state's own rule asks for one.** N.M. Stat. 25-12-3(C)(1) requires the processor's email on
the label and (B)(4) requires it on the listing, so a New Mexico buyer is entitled to it before
buying; CO and HI accept it as one of two contact options. The function is `anon`-callable, so
returning it unconditionally would publish every seller's address in 44 jurisdictions to satisfy one
— the CASE reads the resolved rule's required elements, optional elements and alternatives groups,
and returns null otherwise. The label page reads the seller's own session email instead, since it is
only ever the seller looking at their own product.

**`mailing_address`** is the other seller-level element: S.D. Codified Laws 34-18-37 lists "(3)
Physical address of production" and "(4) Mailing address of the producer" separately, so a South
Dakota label needs both. It lives on `seller_profiles.mailing_address` as plain text — printed
verbatim and never geocoded, unlike the pickup address, so it does not drag a label field into a
Mapbox dependency — and `product_label_disclosure()` gates it the same way as the email. The
`/seller/settings` cards for it and the homemade-food statement are driven by `getSellerLabelNeeds()`,
which resolves the programme exactly as `getLabelContext` does so the two cannot disagree.

**`contact_phone` is the third seller-level element, and it was a hole for a long time.**
`producer_phone` has been in the vocabulary since the generator was built while `LabelSource
.producerPhone` was hardcoded `null` — honest while nothing printed before a sale, and untenable
once Tennessee turned up: § 53-1-118(b)(4)(A) requires the producer's telephone number and
(b)(5)(A)(iv) puts it on the listing page. Required outright in **AK, AR, NH, NM, OK, OR, RI, SD,
TN, VA, WV**, one half of the phone-or-email either/or in **CO, DE, HI, IA, ID** — sixteen
jurisdictions, none of which could be satisfied. It lives on `seller_profiles.contact_phone` and is
**deliberately not `profiles.phone`**: that column is the E.164 mobile that receives order-update
SMS under its own opt-in, and printing it on a jar is a different act with different consent. Plain
text, printed verbatim — normalising "(615) 555-0134" would be us rewriting what the seller chose to
publish. `product_label_disclosure()` gates it exactly like the email and the mailing address, and
`getSellerLabelNeeds()` also reports `phoneRequired` so the settings card can say "required" or
"or your email" truthfully.


**Phase 5 — cap variants and the review cycle.** `record_order_revenue` now resolves the cap from
the seller's **chosen program** (falling back to `state_cottage_food_rules.revenue_cap` when there
isn't one) and counts it by `cap_basis`
(`20260904230000_cap_variants.sql`, `20260904240000_program_cap_category.sql`):
`annual_total` behaves as before; `per_product` and `per_category` tally into
`seller_revenue_buckets` (one row per product or per regulatory axis), with each bucket carrying its
own cap — **Virginia's $9,000 applies to `cap_category = 'acidified'` alone** while everything else
stays uncapped. **Colorado used to be the `per_product` example here and no longer is:** verifying
Colo. Rev. Stat. § 25-4-1614 against the statute (2026-09-05) found a single **$150,000 annual**
cap and no per-product figure anywhere in the current text, so that row is now `annual_total` and
Virginia is the only `per_category` row left. The machinery stays because Virginia still needs it —
but do not cite Colorado for it. **That Virginia row has now held three figures**, which is worth
knowing before changing it again: a seeded $3,000 acidified-only, a $9,000 annual-total "correction",
and finally the statute's own answer — Va. Code § 3.2-5130 as amended by 2026 c. 605 leaves
subdivision (C)(3) with *no* gross-sales limit and keeps $9,000 only in (C)(4), on "pickles and other
acidified vegetables". The seed had the right shape and the wrong number; the correction had the
right number and the wrong shape. Bucket amounts take a proportional share of the order's discounted total, so a bucket
never counts more than the seller was paid. `license_threshold` is **not** a cap: crossing it stamps
`seller_revenue_tracking.license_threshold_crossed_at` once and never pauses — Vermont's $10,000 /
$30,000 mean "get a licence", not "stop selling". (**Vermont's $6,500 was the wrong figure**: it was
the old home-bakery "$125.00 per week" exemption in VT Admin. Code 12-5-52, a rule superseded by the
Manufactured Food Rule effective 2026-01-15, whose 6.1.1 now lists only non-bakery ≤ $10,000 and a
cottage food operation ≤ $30,000.) **The distinction had teeth in Vermont**: $30,000 was also sitting
in `state_cottage_food_rules.revenue_cap`, the column `record_order_revenue` *pauses* on, so a
Vermont seller with no programme chosen would have had their storefront closed at $30,000.01 for
crossing a line that 18 V.S.A. 4358(b) says only removes "the obligation to obtain a license and the
associated licensure fees". **Where the figure sits is the whole distinction**: Washington's $35,000
and Wisconsin's $5,000 stay in `revenue_cap` because they sit on the *programme rows they bound* — a
seller who outgrows the exemption moves to a different programme — while Vermont's and Virginia's
were in the *state-wide fallback*, reaching sellers the figure had nothing to do with. Washington
also says it outright: RCW 69.22.050(2), above the cap the operation "must either obtain a food
processing plant license ... or cease operations". **Minnesota's $7,665 was the wrong example and has
been withdrawn**: reading Minn. Stat. 28A.152 showed it is the CPI-adjusted version of the $5,000
*registration-fee* exemption in subd. 4, not a licensing line — everyone registers, and crossing it
means paying $50 and taking the longer training. Minnesota's actual cap is the $78,000 in subd. 3. `seller_revenue_tracking`
keeps the annual total whatever the basis, because that is what `/seller/compliance` shows.
`program-review-scan` (Inngest, Mondays) counts programs never verified or verified over a year ago
and emails admins; the same figure shows on `/admin/programs`.


**Phase 5 — pre-checkout label disclosure.** Eleven jurisdictions reach the buyer *before* the sale,
by several different routes, and `state_label_rules.predisclosure_required` records it — currently
**CA, IL, IN, MN, NE, NM, OK, TN, TX, UT, WY**. **UT and WY** are the two that get there without a
disclosure rule at all, through the structure of the exemption itself: Utah Code § 4-5a-104(1)
exempts a producer only where the food is "sold directly to an
informed final consumer", and § 4-5a-102(7)(c) defines that person as one who "has been informed
that the product is not certified, licensed, regulated, or inspected by the state" — so **being told
is a precondition of the exemption**, and a buyer who reads it when the box arrives was not an
informed final consumer when they bought. Only Utah's Homemade Food Act route; its cottage food and
microenterprise routes are false. Wyoming is the same shape: Wyo. Stat. § 11-49-102(a)(v) defines the
"informed end consumer" as one "who has been informed that the product is not licensed, regulated or
inspected", and § 11-49-103(e) makes telling them the producer's duty. **TN** — Tenn. Code § 53-1-118(b)(5)(A)(iv), the whole of
the (b)(4) information "On the webpage on which the homemade food item is offered for sale": it
names the listing page, and it is the reason `contact_phone` exists. **TX** —
§437.0194(b)(2) permits an internet sale only if the labelling information reaches the buyer "before
the operator accepts payment"; the package arriving later is too late. **IN** — Ind. Code
16-42-5.3-5(b), "A home based vendor shall post the label of each food product on the vendor's
website": the whole label, per product, which is exactly what `product_label_disclosure()` returns.
**IL** — 410 ILCS 625/4(b)(10), "Online, notice shall be a message on the cottage food operation's
online sales interface at the point of sale", the only one that legislates the checkout page in
those words (and its notice is a *shorter* sentence than its label phrase — both are stored). **CA**
— Health & Saf. Code 114365.3(f) requires the county of approval, the permit number and the "Made in
a Home Kitchen" statement in any internet advertising, which a storefront listing is. **NE** — the
disclaimer in internet advertising, still from the summary rather than the statute. **False
elsewhere means nobody has checked, not that the state has no such rule.** The data spans tables a buyer cannot read — `addresses` is owner-only, `seller_licenses`
owner-or-admin — so `product_label_disclosure()` (SECURITY DEFINER, granted to `anon`) returns
exactly the fields required on the physical label and nothing else, and only for a product a buyer
can already see. `src/lib/labels/disclosure.ts` runs the result back through `renderLabel()`, so
what the buyer reads and what gets printed cannot drift apart. Rendered inline on the storefront
listing and above the pay button at checkout — a state asking for a "legible statement" is not
satisfied by a collapsed accordion.

**The pre-sale disclosure is NOT the label, and `predisclosure_required` alone cannot say so.**
`state_label_rules.predisclosure_elements` is null where the whole label is genuinely owed before
the sale — **IN** (16-42-5.3-5(b), "shall post the label of each food product on the vendor's
website"), **NM** (25-12-3(B)(4)), **OK** (5-4.3(B)(4)) and **TN** (53-1-118(b)(3) + (b)(4)(iv)) —
and holds the exact narrower set everywhere else: **CA** `{municipality, permit_number}` (114365.3(f)
names three items and the address is not one), **MN** and **IL** `{}` (a single sentence: 28A.152
subd. 2(d), 410 ILCS 625/4(b)(10)), **NE**, **UT** and **WY** `{seller_statement}` (81-2,280(5)(a),
4-5a-104(6), 11-49-102(a)(v)). Rendering the label everywhere published a seller's **home address**
in CA, MN, NE and UT to satisfy rules that never asked for one. The RPC gates every identifying
column — address, town, phone, email, id number, mailing address, permit number, seller statement —
on the resolved set, so narrowing holds for a caller who reads the columns directly and ignores
`required_elements`. **`predisclosure_disclaimer_text`** is Illinois alone: (b)(7)(E) puts one
sentence on the package and (b)(10) a shorter one on the online interface. Distinct from Texas's
`address_withheld_until_payment`, which is a *timing* rule over the full label rather than a
narrower set — the two compose.

**`element_substitutions` is "this INSTEAD OF those", and is not `element_alternatives`.** A group
means *at least one of these* and prints every member the seller has — right for Colorado's
phone-or-email, wrong where the producer paid a state fee precisely to keep the other values off the
label. Shape: `[{"substitute": "producer_id_number", "replaces": [...]}]`. Live only when the seller
actually holds the stand-in; then the replaced elements are neither required nor printed, and the
substitute prints in the position of the first of them. Configured for **OK** (`5-4.3(C)`, three for
one: name, phone and address), **OR** (`616.718(6)(b)`, the address alone — (A) requires the name and
phone separately) and **TX** (`437.0193(b-1)`, the address). Composes with Texas's
`address_withheld_until_payment`: one is a timing rule, the other a substitution. **Arkansas is the
row still owed one** — its number is issued "to protect the producer's safety" — and is deliberately
not converted, because Act 1040 of 2021 will not extract from either state host.

**Two states want a county, and they want different ones.** `county_of_approval` is California's —
the county of the agency that *issued* the registration — and lives on `seller_licenses
.issuing_county`, because 114365.3(e)(4) states the number and the county as one item and
114365(a)(4) makes a registration valid statewide. `county_of_preparation` is Colorado's — "the
county in which the food was prepared", 25-4-1614(3)(a)(II) as amended by **HB26-1033, signed
2026-06-04** — and lives on `seller_profiles.preparation_county`, because it is a fact about the
seller. A producer may be registered in one county and bake in another, so collapsing them would
print the wrong county; both used to resolve to the pickup-address **town**, which is neither.

**Quoted law is swept, not spot-checked.** `scripts/verify-disclaimers.mjs` fetches each rule's own
`source_url` and looks for the stored `disclaimer_text` / `placard_text` in it — 55 strings, currently
**42 exact**. Two further passes closed the rest: **50 of 52 exact**, and the two that remain (GA, DE) are verified by hand — their hosts refuse scripts, so the sweep will keep reporting them. It found full stops added to California's "Made in a Home Kitchen" (114365.3(e)(1)
quotes the words without one, and it was printing at 12pt), and two rows citing documents that *cannot*
contain their own disclaimer — Colorado's pointed at the amending bill, which reproduces only what it
amends, and Indiana's at a chapter index of headings. **A right citation and a wrong URL look identical
until something reads the document.** It also surfaced two things bigger than wording: **Nevada's
NRS 446.866 is repealed** (2025 Nev. Stat. ch. 420 and 512), and **Kentucky's 902 KAR 45:090 carries no
disclaimer at all** — it delegates to KRS 217.136(3), which the state's own site reports as superseded.
Neither is guessed at; both are recorded on the row. The follow-up added three more fault types: **an invented placard** (AS 17.20.332(d) wants "a sign
indicating that" — substance, no wording — and we stored an all-caps sentence found nowhere in it;
removing the row entirely, as an earlier pass did, confused *no sentence to print* with *no sign to
display*), **a borrowed statement** (KY's microprocessor row carried the processor route's sentence;
217.137 prescribes no label), and **three more citations that could not contain their own sentence**
(TN's amending chapter, IA's chapter index, KY's delegating regulation).

**The mistake worth keeping is New Hampshire.** I rewrote both disclaimers to match He-P 2300, an
administrative *rule*, because it was the document that contained a quotable string — and turned a
correct sentence into a wrong one. **RSA 143-A:12 V(c) prescribes both verbatim** and is the later
text (2022 amendment): "…licensing and inspection**.**" keeps its full stop, and the licensed route is
"a residential **food production area** licensed by the New Hampshire Department of Health and Human
Services." **A source that CONTAINS a sentence is not thereby the source OF it** — the checker rewards
whichever document holds a match, so follow the delegation upward before believing one.

**Nevada is closed, and it was two acts pointing opposite ways.** **SB 466** (ch. 512, Stats. Nev.
2025) repealed *all* of NRS ch. 446 **effective 2025-07-01** and rebuilt the scheme under the Dept of
Agriculture; **AB 352** (ch. 420) authorises internet selling but only **from 2027-07-01**. So the
online ban is still right and its citation was dead, the disclaimer survived unchanged, and the cap
went **$35,000 → $100,000** (CPI-adjusted annually) — a figure an admin had *verified* fourteen months
after it was superseded, in the column that pauses storefronts. `verified_at` was cleared with it.
**Nevada leaves the online-ban list on 2027-07-01 and nothing in the schema will remind anyone**;
`program-review-scan` flags rows nobody has checked lately, which is not a diary date.

**Reading statutes: `node scripts/pdftext.mjs`.** The old hand-rolled extractor understood only
Flate streams drawn with `(literal) Tj`, so hex strings, Type0/CID fonts and object streams came
back as title pages — which is the *only* reason Arkansas and Colorado sat unverified. Both are now
closed: AR § 20-57-505 (the identification number replaces name+address+phone, and **(b)(3) makes
Arkansas a predisclosure state**, which we had recorded as false) and CO (the locality limb is real
but is a county; `permit_number` could never resolve and became `producer_id_number`; and the stored
disclaimer said "may also *contain common food allergies*" where the statute says "may also
**process common food allergens**"). **A PDF that downloads is not a PDF you have read.**

**A required element the seller hasn't supplied is a compliance gap, not a blank line.** `renderLabel`
drops it into `missing`, and `ProductDisclosure` now carries that through instead of discarding it —
a Californian listing with no recorded permit number was rendering an advertisement short of the
number 114365.3(f)(2) requires and looking complete. The buyer still sees what we have (a partial
label is not a misleading one), but `DisclosureGapNotice` on `/seller/products` names each gap and
where to close it. Per-batch elements (`fix: "print"`) are filtered out — no listing can carry a
production date, so warning about it would be noise; Indiana is where that bites, and it's recorded
in that rule's notes.


**Phase 6 — seller compliance ergonomics.** Seven changes that came out of reading all 51
jurisdictions, in the order they bite a seller.

**Every refusal carries its citation.** `ComplianceBlock` (`src/lib/compliance/blocks.ts`) is what
`describeFoodSalesBlock`, `describeCategoryBlock`, `describeProgramChoiceBlock`,
`describePredisclosureBlock` and `getDeliveryPermission` all return: the sentence, the `venue_note`
or `category_note` it rests on (quoted statute after the pass), the programme, the `source_url`, the
date we last read it, whether an admin has signed the row off, and an optional `fixPath`.
`ComplianceBlockNotice` renders it and says outright when nobody has checked. **This is the
error-correction path for unverified data** — the pass found seeded rows wrong in both directions (WA
permitting an unlawful listing, HI blocking a lawful one), and the seller has the strongest incentive
to look. `ComplianceCautionNotice` is the amber sibling for `unclear` rather than `banned`.

**A programme choice is required before a food listing goes live.** Without one the axis predicates
fall back to "does ANY programme in this state permit it" — the most permissive answer, and flatly
wrong in CA (Class A bans meat, MEHKO allows it), UT (three routes, three regulators) and VT (four).
Drafts and non-food listings are unaffected.

**Publication is held where the listing IS the disclosure.** In the eleven `predisclosure_required`
jurisdictions `describePredisclosureBlock` refuses to publish a food listing short of the state's
required elements, naming each and where it is fixed. Everywhere else `DisclosureGapNotice` stays
advisory — there the label travels with the package. `describeListingGaps()` in `render.ts` is the
pure half.

**Delivery is gated by programme.** `getDeliveryPermission` reads `direct_delivery`: `banned` stops
it being switched on and refuses it at checkout, `unclear` — 29 seeded programmes — shows the caution
and blocks nothing. `mail_delivery` is deliberately ungated because we have no carrier integration,
which is how Tex. 437.0194(b)(1)'s personal-delivery requirement is satisfied. **Anyone adding
shipping has to revisit that.**

**`seller_profiles.producer_id_number`** is the registration number TX 437.0193(b-1), OR and AR issue
so a producer need not publish their home address; VA accepts a PO box instead, expressed as an
alternatives group against `mailing_address` — **the one state where that column REPLACES the
production address** rather than accompanying it, as SD wants. Not a licence: no expiry, no review
queue, nobody verifies it. It replaced `permit_number` in the TX and OR alternatives groups, where it
could never be satisfied because a cottage food operation has no licence.

**`label_print_runs`** logs what went on the jars — product, lot code, production date, copies, and
the rendered lines as a **snapshot**, because the rule changes underneath sellers and VT's whole rule
set was replaced mid-pass. Written on print, never blocks printing, and has **no UPDATE policy**: a
log that can be edited after the fact is not a log. NH requires a lot code "to support a recall",
which is unanswerable if the only copy is on the jar.

**Approach warnings.** `record_order_revenue` now also reports the highest newly-passed milestone
(50/75/90) for the cap and for `license_threshold`, and whether the threshold was crossed;
`cap_notice_level` / `license_notice_level` make each fire once even when refunds move the total.
`license_threshold_crossed_at` had been stamped and read by **nothing** — a Vermont seller passed
$10,000, needed a licence, and found out never.

**`program_obligations`** covers recurring duties with no document behind them, which
`license-expiry-scan` cannot see: VT's annual exemption filing (15 Jan) and annual training, WA's
biennial permit, UT's annual microenterprise permit. Two shapes — `fixed_date` and `interval` —
with reminders at 30/10/1 days via `obligation-reminders`, deduped by `seller_obligation_notices`.
**Seeded only for the four programmes whose text was read**: an invented deadline is worse than none,
because a seller who trusts it stops looking. Completion is self-reported; the state is who checks.


**Phase 5 — launch toggle.** `/admin/settings` → `setAccessModeAction` flips
`platform_settings.access_mode` `sellers_only` ↔ `public` (RLS already allows admin writes),
`revalidatePath("/", "layout")`. `public` removes the home-page early-access notice and swaps the
logged-out CTA to "Sign up to shop" / "Sell on Harvest Local" (`sellers_only` → "Start selling" /
"Sign in"). `access_mode` is presentational only — nothing hard-gates buyers from `/shop`.


**Phase 6 — pre-orders and limited batches ("drops").** A cottage baker's core problem is baking to
demand rather than to guess, and `quantity_available` is an open-ended shelf, not a batch with a
deadline. `product_drops` (`20260908340000`) is one bake of one listing: an order window
(`opens_at`/`closes_at`, timestamptz), a collection date (`fulfillment_date`, a DATE), and a hard
`unit_cap`.

**The governing rule is that it must UNDER-sell, never over-sell.** The cap is not a stock level, it
is a physical fact — a seller handed a twenty-first order for a twenty-loaf bake cannot solve it at
6am on Saturday, while one who sold nineteen can take the twentieth by hand. Everything is arranged
so a failure strands units (recoverable) rather than selling them twice (not):

- `units_claimed` is a counter with `product_drops_within_cap` (`units_claimed <= unit_cap`) against
  it, incremented by **`claim_drop_units`** under a `select ... for update` row lock. Two buyers
  racing for the last loaf serialise and the loser is refused by the constraint, not by a count read
  a moment before the winner committed. Counting live order rows instead would be prettier and would
  lose that race, because the order rows are written in a later statement than the count.
- The claim is taken **before** the order is written, so a Stripe failure cannot leave a claimed unit
  with no order. `claim_drop_units` **raises** rather than returning false, so a caller that forgets
  to check still cannot oversell.
- Two releases, and using the wrong one oversells. **`release_drop_units_for_order`** is keyed on an
  ORDER and made idempotent by clearing `drop_id` off the items as it goes — that is the one for the
  Stripe webhook's `unwindOrder` and for a seller cancelling, both of which run twice (rule 2).
  **`release_drop_units(drop, units)`** (`20260908350000`) is the compensating path for a checkout
  whose write failed after the claim, when there is no order to key on; it is deliberately **not**
  idempotent and must never be the webhook's.

**A listing with a batch sells ONLY through it, and goes quiet between batches** (`gateByDrops`).
Falling back to ordinary open-ended selling once a window shuts is the oversell the whole feature
exists to prevent: the baker caps Saturday at twenty, the window closes Thursday night, and on Friday
someone buys five more with no batch and no collection date attached. Cancelling every batch is what
takes a listing back out of batch mode. The cost — a listing that goes quiet until the next batch is
scheduled — is the direction to fail in, and `DropsManager` says so in as many words.

**One live window per listing**, enforced by a GiST exclusion constraint
(`product_drops_no_overlap`, `product_id` + `tstzrange(opens_at, closes_at)`, `where cancelled_at is
null`) rather than by convention: two overlapping windows have no answer to "which batch is this
order for", and that ambiguity reaches the buyer as a wrong collection date.

**`units_claimed` is frozen against the seller** (`product_drops_guard_claims`, alongside
`product_id` and `seller_id`). An UPDATE policy wide enough to let a seller rename a batch is wide
enough to let them zero the counter. The **cap itself stays editable** — a seller who decides to bake
five more should be able to say so — and `product_drops_within_cap` is what stops them setting it
below what buyers have already ordered.

**Timezone discipline, and it cuts both ways in one table.** `fulfillment_date` is a DATE — a
wall-clock day at the seller's place — so `formatFulfillment` renders "Saturday 14 December"
anywhere. `opens_at`/`closes_at` are instants, and the server runs UTC, so naming their day would
print "orders open Tuesday 15 December" for a Texas window that opens at 6pm on the Monday. Those are
rendered as **durations** (`closesIn` / `opensIn`, both rounding DOWN so a buyer is never told they
have more time than they do). Same trap as `markets/schedule.ts`.

`src/lib/orders/drops.ts` is the pure half (state, `unitsLeft`, `describeDrop`, `gateByDrops`,
`stockWithDrops`, `dropSnapshot`) and `drop-queries.ts` the reads. `priceCart` refuses a shut batch
and caps the line at whichever is smaller, the batch or the shelf; the collection date is frozen onto
`order_items.drop_snapshot` at checkout so editing or cancelling the batch cannot move a date a buyer
was promised. Seller UI: `DropsManager` on the listing page, and `/seller/drops` — the bake list,
ordered by collection date rather than by listing, because the oven works by date.


**Phase 6 — product cards and quick view.** `src/lib/products/card.ts` (`describeCard`) is the one
answer to what a listing says about itself — price, net weight, what's left, allergens, and the batch
line — and `/shop`, the storefront row and the quick view all read it.

**It exists because the gallery was advertising a price nobody maintained.** `/shop` rendered
`formatUsd(toCents(p.price))` on every card including listings that sell through variants;
`products.price` is the column `resolveSaleUnit` explicitly refuses to fall back to once options
exist, so a buyer could click a $8.50 card and land on a $6.00–$11.00 listing. `describeCard` prices
from the active options, and says **"from $X" only where the buyer has a real choice** — a single
option, or several at the same price, quote an exact figure, because "from" implies a decision that
changes what you pay. `listingStock` totals the buyable options (any one of them unlimited makes the
listing unlimited); a card cannot know which option the buyer will pick, so a single option's count
would be a number about something not yet chosen. Net weight on a card drops the metric equivalent —
that is a LABEL requirement (CT, NC, TN) carried by `renderLabel` and the pre-sale disclosure, and on
a browse card it is a second number competing with the price.

**The quick view is a pre-sale surface, so it carries the pre-sale disclosure.** `ProductQuickView`
adds a second place to reach a basket, and in the eleven `predisclosure_required` jurisdictions the
listing IS the disclosure (Tex. §437.0194(b)(2) — before payment; 410 ILCS 625/4(b)(10) — at the
point of sale). So `getQuickView` **fails closed**: `canAddToBasket` is false whenever a disclosure
is required and could not be built — a load error, a missing rule, an empty result — and the modal
offers the storefront link instead of a button. `LabelDisclosure` renders inline above the button,
never behind a toggle, the same rule the storefront follows.

Detail is loaded **on open** rather than with the gallery: the disclosure is one SECURITY DEFINER
call per product and `/shop` shows six per seller, so paying for all of them to serve one open would
be slow for everyone. It also means the disclosure is fetched when the buyer reads it. The modal is a
native `<dialog>` — focus trapping, Escape, inert background and `::backdrop` with no dependency —
and its `AddToCart` gets `stockWithDrops`, the same batch-capped figure the storefront passes, so its
quantity stepper cannot build a cart `priceCart` will refuse. The quick view is also where a buyer
finally sees **ingredients and handling instructions**, which were collected for the label and shown
to buyers nowhere.


**Phase 6 — events: where to find a seller in person.** `events` (`20260909100000`) is one seller
appearance — a date, a wall-clock time, and usually a market. Markets, pickup locations and drops all
answer "where and when" for an ORDER; none of them answered the question a buyer asks first, which is
what is on near me this weekend. A market page can say "open Saturdays 9–3" and still not tell you
the baker you follow is only there on the second Saturday.

**Wall clock, not instants — the third time this decision has come up and the same answer.**
`event_date` is a DATE and `starts_at`/`ends_at` are TIMEs, exactly like `market_hours`, because 9am
at a stall in Denton is 9am in Denton. A timestamptz would force a time zone per market that we do
not have. The consequence is that "is this today?" cannot be answered on a UTC server, so every
function in `src/lib/events/schedule.ts` that compares against now **takes the reference day as an
argument** and the caller supplies it: `EventList` and `EventStrip` are client components calling
`localToday()`, the same reason `MarketNextOpen` is one. Dates move through the module as
`"YYYY-MM-DD"` strings rather than `Date`s — a `Date` is an instant, and the moment one enters
somebody compares it to another instant and the bug is back. Strings in that format sort correctly
with `<`, which is the whole trick.

**The SQL window starts a day early, on purpose.** `events/queries.ts` filters `event_date >=`
yesterday-in-UTC and lets the pure module do the real filtering against the reader's date. At 8pm
Pacific, UTC has already turned over, so `>= current_date` would hide a market that is still running.
Showing one stale day is a row someone scrolls past; hiding today's market is the buyer missing it.

**`state` is derived, never supplied.** `events_set_state` (BEFORE INSERT OR UPDATE) takes it from
the storefront and refuses a market in another state — the same shape as
`pickup_locations_guard_market_state`, and the same reason: the calendar is the discovery layer of
rule 1, and advertising an out-of-state seller at a local market invites an order the data layer will
then refuse. A tampered form field cannot put an event on another state's calendar, and it re-derives
on update so a market cannot be swapped across a border afterwards.

**A cancelled event stays on the calendar until its date passes**, marked off and carrying the
seller's reason (`cancelled_note`, which the form requires). Someone rearranged their Saturday around
it; deleting the row tells them nothing.

**`seller_id` is NOT NULL on purpose.** A market's own programme — opening day, a harvest festival —
is a real thing this table could carry, but markets are imported and admin-owned and no surface
creates events for them, so a nullable owner would be a shape nothing ever fills: the same mistake as
seeding a deadline nobody checked. `market_id` IS optional, because a farm open day has no market.
Surfaces: `/events` (state calendar), a "What's on" section on each market page, a "Where to find us"
strip on the storefront, and `/seller/events` to manage.


**Phase 6 — the listing-copy assistant, and why the screen is the feature.** `/seller/products/[id]`
can draft a product description or a social post from what the seller has entered
(`ANTHROPIC_API_KEY`, optional — unset, the assistant says so and offers nothing rather than
degrading to a template dressed as generated copy).

**Everything else in this codebase is arranged so a seller cannot accidentally say something untrue
about food**, and handing a language model the listing copy runs directly at all of it: allergens are
a CHECK-enforced federal-nine vocabulary, disclaimers are quoted statute stored verbatim, and a label
refuses to print rather than print a blank. The failure mode of a fluent model is a plausible
sentence nobody entered. Four kinds are the problem and only the first is obvious:

- an **absence** claim ("gluten-free", "nut-free", "vegan") — a home kitchen has no cross-contact
  controls and no testing, and a model writes this cheerfully from an ingredient list that merely
  lacks wheat. This is the one that can hurt somebody;
- a **health** claim ("boosts immunity", "aids digestion") — FDA/FTC territory, and a cottage-food
  producer is the least equipped party in the country to defend one;
- a **regulatory-status** claim ("organic", "certified", "inspected") — rules 5–7 exist to stop a
  listing implying inspection, and in most states the label on the jar says the literal opposite;
- a **fabricated fact** ("award-winning", "shelf stable for a year") — plausible, unverifiable, and
  the seller may not notice it is wrong in their own listing.

So `src/lib/ai/claims.ts` (`screenCopy`, pure and tested from both ends) is the guardrail and the
model is the convenience. A `block` finding disables the apply button; `warn` (puffery, "all-natural")
informs without blocking. **False positives are treated as a real cost**, because a screen that cries
wolf gets clicked past and then protects nobody: "cured bacon" is not a medical claim, "a lovely
treat" is not a course of treatment, "free delivery" is about postage — each has a test. The
medical-verb pattern carries a negative lookahead for prepositions so "treats for cold winter
mornings" stays a plate of biscuits.

**Three properties matter more than the copy quality.** (1) Nothing here writes to a product — the
action reads and returns, and applying a draft is the ordinary product form the seller submits.
(2) Every draft is screened before the seller sees it and the findings travel with it, including for
a blocked draft: "here is what it wrote and here is what's wrong with it" teaches, where a silent
retry does not — and editing re-screens on every keystroke, so deleting "gluten-free" makes the
warning go away. (3) `CLAIM_INSTRUCTIONS` is derived from the same rule array the screen uses, so
what the model is told and what its answer is checked against cannot drift.

`prompt.ts` grounds it: only the seller's entered facts, in the ingredient order they typed (never
re-sorted), with their bio and existing description passed in as **voice to match rather than text to
replace**. `hasEnoughToGenerate` refuses on a bare title — a model given only "Sourdough loaf" writes
a 48-hour cold ferment and a heritage starter because that is what sourdough copy sounds like.
Rate-limited at `copyAssistant` (12 / 5 min), tighter than everything else because it is the one path
that costs money per call rather than per month. `stripWrapping` lives in `ai/response.ts` rather than
`ai/generate.ts` so it can be unit-tested — `generate.ts` imports `@/lib/env`, which vitest cannot load.


**Phase 6 — the payout ledger.** `/seller/payouts` shows what Stripe has actually sent to the
seller's bank. Deliberately a different page from `/seller` revenue, and the copy keeps them apart:
**revenue is what buyers paid, a payout is what Stripe sent**, and the gap is processing fees,
refunds and timing. Sellers ask about that gap constantly and the honest answer is to show both
numbers under their real names, not to reconcile them with arithmetic of ours.

**`payouts` (`20260909110000`) is a MIRROR and holds nothing we worked out.** Every column is a field
of a Stripe `Payout`, written by the Connect webhook and by nothing else. There is deliberately no
`net`, no `fees`, no `expected_total` — the moment the table carries a figure we derived, a seller
has two numbers for the same thing and no way to know which is real. `status` is Stripe's own string
stored verbatim rather than mapped onto a vocabulary of ours, which would need updating whenever
Stripe adds a state and would be wrong in between; `payoutStatus` maps it for display and shows an
unfamiliar status **as itself**.

**There is no `payout_items` table, on purpose.** What is *inside* a payout is a list of balance
transactions Stripe already owns; copying it would buy nothing (we never query it) and cost a second
version of the truth that can drift. `getPayoutBreakdown` reads it through to Stripe when the seller
opens one, matching lines back to our orders by `stripe_payment_intent_id` where it can and showing
Stripe's own description where it can't. Refunds, adjustments and Stripe's fees are shown as what
they are rather than folded away — a breakdown that quietly drops rows is one that doesn't add up.
**Mirror what you must query; ask for the rest.**

Handling: one handler for `payout.created|updated|paid|failed|canceled`. A Payout is a full snapshot,
so the latest delivery wins and an out-of-order or repeated one upserts the same row (rule 2). These
are **Connect** events — they arrive with `event.account` set and verify against
`STRIPE_CONNECT_WEBHOOK_SECRET`; **with that secret unset no payout event verifies and the table
stays empty**, which is the honest failure: an empty ledger rather than a wrong one. A payout with no
`event.account` is the platform's own balance moving and is not mirrored. RLS has **no INSERT or
UPDATE policy at all** — a payout row a seller could edit would be a record that disagrees with the
bank while looking authoritative. `splitPayouts` puts failed and cancelled payouts in HISTORY, never
in "on the way", because Stripe leaves `arrival_date` populated on a failure and repeating it would
have a seller waiting on money that is not coming.

**Money arrives as a NUMBER, not a string.** `MoneyFixed` in `src/lib/db/types.ts` corrects every
money column to `string` on the stated grounds that "Postgres numeric crosses the wire as text".
Against this PostgREST it does not: `payouts.amount`, `orders.total` and `refunds.amount` all come
back as JS numbers. Nothing is broken by it — every money read goes through `toCents`, which takes
`string | number` — but the declared type is wrong, and code trusting it would compile and then fail.
Pinned by an assertion in `test/integration/payouts.test.ts` so a change in the wire format is
reported rather than silently making the types right by accident.


**Phase 6 — seller stories.** `seller_profiles.story` + `story_on_home` (`20260909120000`) and a
"Makers in <state>" section on the home page. The front page can argue the marketplace is worth
using; what it could not do is show that it is made of people, which is the whole proposition of
buying from a neighbour. Three sellers with no faces reads as empty; the same three with their
stories reads as early.

**One story per seller, so it lives on `seller_profiles`** rather than in a table of its own. "Who I
am and why I make this" is one piece of writing; the thing a seller has many of already exists —
`seller_posts`, their running feed. `bio` stays the one-liner under the storefront name.

**The home page is opt-in** (`story_on_home` defaults false). A story is written for the seller's own
storefront; putting somebody's words on the marketplace front page is a different act and they
should choose it. The cost is a slower start, which is the very problem this solves — but publishing
a person's writing without asking to solve it faster is not a trade to make. Clearing the story
clears the flag, so an empty card can never reach the rotation.

**A daily rotation, not "most recent."** Newest-first pays a seller to keep touching their story, and
the ones who play that game push out the ones who wrote something once and got on with baking. So
`pickDailyStories` is a stable shuffle on `hash(dayKey + sellerId)`: everyone comes up as often as
everyone else, nobody can move themselves up, and it changes on its own. Two details were bugs first
and are worth keeping: **the day key is hashed FIRST**, because FNV mixes bytes into an accumulator
and whatever goes in last barely moves the result — with the day appended the rotation did not
rotate at all; and there is a **final avalanche**, because raw FNV correlates enough on short similar
ids that over 28 days only 7 of 12 sellers ever reached the front page. Both are asserted as
properties (`changes from one day to the next`, `gives everyone a turn`), not as fixed outputs.
The day key is UTC on purpose — unlike every other date in this codebase, nothing here is a claim
about time; it only has to change once a day and be the same for everybody.

**`worthShowing` needs two.** One story under "Meet a few makers" reads as a marketplace with one
seller — better to show nothing, since the rest of the page already works.

**No photograph on the cards, and no story-image columns.** `20260909120000` added
`story_image_path` / `story_image_url`; `20260909130000` removed them the same day, because there is
no image uploader in the seller UI to fill them — `seller_posts` has carried the identical pair
unwritten since `20260908290000`. A column no code path fills is the same mistake as a nullable owner
or a seeded deadline. Illustrating the card with the seller's newest *product* image was tried and
dropped too: a product shot is a picture of a jar rather than of a person, and with only some sellers
having one the cards came out at different heights with a grey box where a face should be. The words
are the point; the storefront has the pictures. When there is an uploader, a story photo is a
migration and a form together.

`StoryEditor` shows the home-page excerpt live, through the same `storyExcerpt` the home page calls,
so a seller who buries the good sentence in paragraph three sees it happening while they write.


**Phase 6 — the launch playbook.** `/seller/launch` — what to do next, and the awkward messages
written for you.

**Every step is OBSERVED, not self-reported.** There are no checkboxes and no table behind the
checklist: a step is done because the thing is true (a listing exists, a collection point exists,
somebody has viewed the storefront) and undone because it isn't. That removes the two ways a launch
checklist usually goes wrong — ticking something you never did, and being nagged about something you
finished a month ago. `getLaunchFacts` is all `count(*)` with `head: true`, so nothing is remembered
and nothing can go stale; a seller who deletes their last listing correctly goes back to "put up your
first listing".

**It also rules out the step this feature obviously wants: *tell your friends*.** We cannot see it,
and a checkbox for it would be a lie whichever way it was ticked. What we *can* see is whether anyone
has looked — `seller_view_counts` — which is the same question asked honestly, and the templates are
where the help for it lives. `listingsWithGaps` is left at 0 for the same reason: the real answer
needs the state's rule and the whole product row (`describeListingGaps`), `/seller/products` already
renders it, and a wrong count here would send a seller hunting a problem that isn't there.

**A step that genuinely can't be done yet is `blocked`, not `todo`** — "ask your first buyer for a
review" before any order exists has nowhere to link to, and `launchProgress` doesn't count it against
them, because a bar that is unreachable on day one is worst on the day it matters most. The gate step
comes first and says *why* the storefront is shut, which is the single most useful line on the page.
The programme step is skipped entirely for a seller who lists no food.

**The templates are ours, so they pass the same screen the AI does.** `test/launch-templates.test.ts`
runs every template through `screenCopy` — it would be an odd marketplace that refuses a seller
"gluten-free" and then hands them a template saying it. The harder discipline is that a template must
not put words in a seller's mouth about facts we don't have: none of them says what the seller makes
or that it is any good. They do the structural part — the opening line, the ask, the link — and leave
`[a sentence about what you make]` as a visible blank rather than a plausible invention, because a
cheerful made-up description is a sentence about their business that nobody at their business wrote,
and some sellers would send it unread. The referral template appears only when there is a real code
AND a real percentage to quote.


**Phase 6 — density degradation.** `src/lib/geo/density.ts` decides what `/shop` says about itself
before it lists anything.

**The failure this fixes is a page that still "works".** `/shop` sorts by distance, which is right in
a dense state. In a thin one the nearest storefront is 84 miles away, the page ranks it first, and
"84 mi" reads as a result rather than as the answer "not really". Nothing errors and nothing is
empty, so the buyer is quietly misled about whether the marketplace is any use to them. A marketplace
with three sellers should say it has three sellers.

**Distance is not reach.** A seller 40 miles off who delivers within 50 can get bread to your door; a
seller 12 miles off who only trades from a Saturday market may never be any use. So `nearby_sellers`
now returns `delivery_enabled` + `delivery_radius_miles` (`20260909140000`) and `classify` bands on
**reachability**: `local` (≤25 mi), `delivers` (outside pickup range but inside their stated radius),
`regional` (≤75 mi), `distant`, `unknown` (no origin, so no claim either way). A seller with delivery
on and **no radius recorded is not assumed to reach anyone** — that means they have not said how far,
and guessing would walk a buyer through checkout to be refused by `quoteDelivery`, which does know.

**Widening never crosses a state line.** The obvious way to fill an empty page is to show the sellers
over the border; that is exactly what rule 1 forbids at the discovery layer, and every one of them
would be a dead end we had advertised. Degrading gracefully here means being straight about the state
you are in, not quietly leaving it — asserted by a test.

`distant` sellers are kept, under their own heading, never ranked into the main list: someone
deciding whether to come back next month is better served by "there are four here, all a long way
off" than by a page that looks empty, and a seller who just opened deserves to appear somewhere.

**That migration is a DROP and CREATE, not `create or replace`** — Postgres will not let a replace
change a return type, and this adds two columns to the returns-table. It fails outright, which is
better than the sibling trap that bit `finalize_paid_order`, where changing the ARGUMENTS silently
creates a second overload and leaves the old one being called forever. Grants have to be reapplied
because they go with the dropped function.


**Phase 6 — the taxonomy rethink, and the two holes it found.** The shopping taxonomy was carrying
two jobs on one flag and enforcing only half of the two levels it has.

**1. `requires_food_permit` conflated "is food" with "is COTTAGE food", and produce is where they
diverge** (`20260909150000`). It was seeded true for every food top-level including **Produce**, by a
migration whose own comment admitted "Not a legal determination — an admin should confirm it". Nobody
did, and it is the load-bearing flag for **five** gates. A grower listing tomatoes therefore had to
hold a verified **cottage food permit** before their storefront would open, choose a cottage food
**programme**, supply an **ingredients list** and a **net weight** for a tomato, answer the
**allergen** question, and in **DE, MI, MS, NV and WA** could not list at all — because the
online-sales gate keys on the same flag. RCW 69.22 is Washington's *Cottage Food Operations* act; it
governs food prepared in a home kitchen and has nothing to say about a farmer selling what they grew.
Every state's cottage food law is defined by that **act** of preparing, so a raw agricultural
commodity is outside it. Corrected to false, with `sync_seller_license_pause` re-run for anyone the
old rule had wrongly paused — a category edit fires no trigger, so fixing the rule without fixing the
sellers it caught would be half a fix. The boundary now lives in the **names**: "Herbs" became
**"Fresh Herbs"**, because a jar of dried oregano is a shelf-stable cottage food product and must not
find a home under Produce.

**2. The axis gate read only the top level, so every subcategory axis was dead data**
(`20260909170000`). `products_guard_food_categories` resolved `food_axes` from `new.category_id`
alone. **Pickles & Ferments** carries `{acidified, fermented}`; its parent **Pantry & Preserves**
carries `{shelf_stable}`. The gate saw shelf-stable, asked the seller's programme about shelf-stable,
got yes, and published the jar — in **13 states that ban acidified or fermented food under every
programme they run** (CA, CO, CT, DE, HI, LA, MD, MO, NE, NJ, NY, OH, WA). The same silence hid the
opposite case: **Juice & Cider** is deliberately unmapped and the parent's `shelf_stable` was
answering for it anyway. Now the axes of category and subcategory are **unioned** — a jar of pickles
is shelf-stable *and* acidified, and a state banning either must block it — which is the shape the
label and allergen guards already used (`bool_or` across both). The trigger's column list gained
`subcategory_id`, without which a seller could publish under a permitted subcategory and then switch
to a banned one unchallenged.

`test/integration/category-taxonomy.test.ts` pins the invariants, because the alternative is reading
a tree by eye — and `20260909150000` renamed a category by matching `slug = 'herbs'` when the row is
`produce-herbs`, so the UPDATE hit nothing and **reported success**. Subcategory slugs are namespaced
under the parent's *first segment* (`crafts-artisan-goods` parents `crafts-candles`), which is also
asserted. The suite proves the fix blocks an acidified listing in Connecticut while letting the
shelf-stable jam beside it through — Washington was the first choice for that test and is unusable,
because its outright online ban means the control never reaches the axis check.


**Phase 6 — account deletion was impossible, and the test harness hid it.** `pickup_locations`
(`20260908230000`) declared `address_id ... on delete set null` alongside
`check (market_id is not null or address_id is not null)`. Each half is sensible; together they are
impossible. Deleting an address nulls the column, which leaves a row with neither a market nor an
address, which the CHECK refuses — so the DELETE fails and rolls back whatever contained it.

**That means deleting any profile that had ever set a pickup address failed**, because a profile
delete cascades to their `addresses`. Every account deletion, every admin removal, anything a
data-deletion request would need. `20260909180000` makes `address_id` **cascade**: a collection point
whose address is gone is not a place, and keeping the row by nulling the column is what manufactured
the forbidden state. The market FK stays `set null` on purpose — a market row disappearing is a
directory edit, not the venue ceasing to exist.

**It surfaced as test pollution, which is the part worth remembering.** Six `IT Storefront` fixtures
had accumulated in the live project across a day of runs. `cleanupAll` ended
`auth.admin.deleteUser(id).catch(() => {})`; every delete was failing with a generic "Database error
deleting user" and **that one expression swallowed all of it**. A cleanup that cannot clean up has to
be loud — it now reports each failure and a count, and logs rather than throws so a teardown never
masks the test failure that caused it.

A second, simpler leak came out with it: 24 market fixtures, because markets hang off no user and
so cascade from nothing — every suite deletes its own in `afterAll`, and a suite that throws in
`beforeAll` never gets there. `cleanupAll` now sweeps `slug like 'it-%' AND source = 'admin'`. Both
conditions matter: a bare prefix match is unsafe on a real database ("It's A Market" slugs to
`it-s-a-market`), and `admin` is the default that only fixtures use — imports are `usda` and no admin
market surface exists. **If an admin market editor is ever built, that sweep needs a real registry.**

`test/integration/account-deletion.test.ts` pins the whole path, including that deleting a seller
does not take the market they had a booth at with them.
