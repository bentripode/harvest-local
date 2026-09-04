# Harvest Local — Production launch checklist

All five build phases (`ARCHITECTURE.md` §5) are code-complete and verified in Stripe **test** mode
against a **hosted** Supabase project. This is the operational path from there to a live marketplace.
Work top to bottom; nothing here is a code change.

Legend: ☐ not done · the marketplace is currently **`sellers_only`** (early access).

---

## 1. Environment / secrets

Set these in the Vercel project (and keep `.env.local` for local dev). `src/lib/env.ts` validates
every one at boot, so a missing/malformed value fails the deploy loudly.

| Var | Prod value |
|---|---|
| `NEXT_PUBLIC_SITE_URL` | `https://<your-domain>` (drives Stripe redirect URLs + email CTAs) |
| `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY` | same hosted project (or a fresh prod project — then re-run §3) |
| `STRIPE_SECRET_KEY` / `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | **live** keys (`sk_live_…` / `pk_live_…`) |
| `STRIPE_WEBHOOK_SECRET` | from the live **account** webhook endpoint (§2) |
| `STRIPE_CONNECT_WEBHOOK_SECRET` | from the live **Connect** webhook endpoint (§2) |
| `STRIPE_SUBSCRIPTION_PRICE_ID` | live `price_…` from `npm run stripe:setup` run against the live key |
| `STRIPE_SELLER_TRIAL_DAYS` | `90` (or your call) |
| `INNGEST_EVENT_KEY` / `INNGEST_SIGNING_KEY` | from Inngest Cloud (§4) |
| `RESEND_API_KEY` | live `re_…` (§5) |
| `EMAIL_FROM` | `Harvest Local <notifications@your-verified-domain>` (§5) |
| `TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN` / `TWILIO_FROM_NUMBER` | optional — buyer order-update SMS. Unset ⇒ texts are logged, not sent |
| `MAPBOX_TOKEN` | a **secret, URL-unrestricted** token with Geocoding + Directions scopes (server-side delivery quoting) |
| `NEXT_PUBLIC_MAPBOX_TOKEN` | a **public** token (URL-restricted to your domain) for the browser map |
| `SENTRY_DSN` / `NEXT_PUBLIC_SENTRY_DSN` | the project DSN from sentry.io (same value both). Unset ⇒ Sentry inert (§7) |
| `SENTRY_ORG` / `SENTRY_PROJECT` / `SENTRY_AUTH_TOKEN` | **build-time only**, for source-map upload — set on Vercel, not needed at runtime |

☐ No test/seed rows in prod: the E2E test data (Ben's Baked Bread, Tex Buyer, sample orders/reviews/
messages/reports/refund) is in the hosted DB used for development. Launch against a clean project, or
delete it.

---

## 2. Stripe (live mode)

☐ Toggle **Test mode OFF**. Re-do the Connect setup from `SETUP.md` §2.B in live mode:
Connect → enable, acknowledge loss-liability, verify your platform business details.

☐ `npm run stripe:setup` with the **live** `STRIPE_SECRET_KEY` — creates the live `$20/mo` Price,
`FREE_MONTH_100`, and `buyer-referral-pct-10`. Paste the printed price id into
`STRIPE_SUBSCRIPTION_PRICE_ID`.

☐ Create the **live webhook endpoints** pointing at `https://<domain>/api/webhooks/stripe`. Event
lists (keep in sync with the `switch` in `src/app/api/webhooks/stripe/route.ts` — see also
`ARCHITECTURE.md` §6.2):

- **Account endpoint** → `STRIPE_WEBHOOK_SECRET`:
  `checkout.session.completed`, `checkout.session.async_payment_succeeded`,
  `checkout.session.async_payment_failed`, `checkout.session.expired`,
  `charge.refunded`, `charge.dispute.created`,
  `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`,
  `customer.subscription.paused`, `customer.subscription.resumed`,
  `invoice.paid`
- **Connect endpoint** ("Listen to events on Connected accounts") → `STRIPE_CONNECT_WEBHOOK_SECRET`:
  `account.updated`

☐ `npm run stripe:tax -- --account <acct> --state <XX>` per seller state, or configure Stripe Tax
registrations for the states you operate in.

---

## 3. Supabase

☐ Migrations applied: `npx supabase db push` (31 migrations as of launch). Regenerate types after any
change: `npm run db:types`.

☐ **Realtime → enable Postgres Changes for `public.messages`** (Database → Replication). The table is
already in the `supabase_realtime` publication with `replica identity full`, but the hosted project
wasn't streaming it — until this is on, in-app messaging falls back to a 4-second poll.

☐ **Auth → URL Configuration**: add `https://<domain>/**` to Redirect URLs; set Site URL.

☐ **Auth → Email**: decide on "Confirm email" (on = users verify before first session).

☐ **Create the first admin.** Role can't be set through the app (`profiles_guard_role`). Directly:
```sql
update public.profiles set role = 'admin' where id = '<the admin user's auth id>';
```
Then `/admin`, `/admin/analytics`, `/admin/settings` become reachable and the "Admin" nav link shows.

---

## 4. Inngest Cloud

☐ Create the app at inngest.com, copy the **Event Key** + **Signing Key** into env.

☐ **Sync the endpoint**: point Inngest at `https://<domain>/api/inngest`. This registers all
functions — critically the **cron jobs**, which do NOT run without Inngest Cloud:
- `license-expiry-scan` — daily `0 8 * * *` (T-30/7/1 reminders + auto-expire)
- `notification-dispatch` — `*/2 * * * *` backstop for email delivery

---

## 5. Resend

☐ Verify a sending domain (Resend → Domains → add DNS records). Until then `EMAIL_FROM` can only be
`onboarding@resend.dev`, which only delivers to the Resend account owner's address.

☐ Set `EMAIL_FROM` to `Harvest Local <notifications@your-domain>`.

☐ Send a test: file a report / earn a referral reward on staging and confirm the email arrives.

---

## 6. Flip the switch

☐ `/admin/settings` → **"Open to the public"** — sets `platform_settings.access_mode` to `public`.
The home page drops the early-access notice and the logged-out CTA becomes "Sign up to shop".
(`access_mode` is presentational; buyers can already reach `/shop` — this is front-door messaging +
the buyer signup path.)

---

## 7. Hardening (do before real volume)

✅ Rate-limiting on the public write paths — `src/lib/rate-limit.ts` (`tryRateLimit` +
`RATE_LIMITS`) backed by the `check_rate_limit()` Postgres function (fixed window, fails open).
Wired into checkout, cart re-price, promo-code attempts, messaging, and order reports, keyed per
user. Tune `RATE_LIMITS` for production traffic; the map/discovery reads are still unthrottled
(public, cacheable — revisit if scraped).

✅ Error tracking wired — `@sentry/nextjs` via `src/instrumentation*.ts` + `withSentryConfig` in
`next.config.ts`, `onRequestError` for server errors, `global-error.tsx` for the root boundary, an
explicit `captureException` in the Stripe webhook's catch (it returns 500 rather than throwing).
**To activate:** create a project at sentry.io, set `SENTRY_DSN` / `NEXT_PUBLIC_SENTRY_DSN` (and the
build-time `SENTRY_ORG` / `SENTRY_PROJECT` / `SENTRY_AUTH_TOKEN` on Vercel for readable stack traces).
Then add Sentry alert rules for `area:stripe-webhook` and errors on `/api/inngest`.

☐ Uptime/health monitoring (Better Stack, Pingdom, or similar) — Sentry catches thrown errors, not
"the deployment is down / webhooks are 500ing in bulk". The app exposes **`GET /api/health`**
(unauthenticated, side-effect free: one timed `platform_settings` read → `200 {status:"ok"}` or
`503 {status:"degraded"}`). Point the monitor at `https://<domain>/api/health` and alert on any
non-200.

☐ Extend the test suite (`npm test`) beyond the guardrail units it covers today — an integration
pass against a throwaway Supabase branch for the SECURITY DEFINER functions and RLS policies.

☐ Load-test the map/discovery queries once there are hundreds of sellers; add a search engine
(Typesense/Algolia, synced via Inngest) only if faceted search becomes the bottleneck.

☐ Review Supabase connection pooling (PgBouncer) settings for the expected concurrency.

✅ Storage: license / ID documents live in the **`seller-docs`** bucket (not `license-docs`).
`20260901221902_phase1_storage_and_seed.sql` creates it `public = false` with an owner-folder-scoped
`storage.objects` policy (`(storage.foldername(name))[1] = seller_profiles.id`), and
`20260904010000_seller_docs_bucket_hardening.sql` re-asserts `public = false` + the size/MIME limits
idempotently (covers a bucket that pre-existed in the dashboard). After `db push`, spot-check in
Storage → Settings that `seller-docs` shows **Private**. Admin doc viewing (server-minted signed
URLs) is not built yet.

---

## Feature follow-ups (not launch-blocking)

Tracked across the phase commits:

- ✅ **Buyer order-status emails** — every `advance_order_status` transition emits `harvest/order.status_changed` → `order-status-notify` queues an `order_status_changed` email to the buyer.
- ✅ **Message → email** — `sendMessageAction` emits `harvest/message.sent` → `message-notify` emails the recipient a `new_message` when it's their only unread in the thread (deduped on `message_id`).
- ✅ **SMS via Twilio** — `notification-dispatch` texts via `src/lib/notifications/sms.ts` (keyless `fetch` to the Messages REST API; logs when `TWILIO_*` unset). Buyers opt in on `/account` (phone + toggle); only `order_status_changed` is SMS-eligible. Set `TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN` / `TWILIO_FROM_NUMBER` to go live. No phone verification; SMS→email/other categories not wired.
- ✅ **`notification_prefs`** — per-category email opt-out on `profiles.notification_prefs`, enforced in `queueNotification`; sellers/admins toggle on `/seller/settings`, buyers on `/account`.
- ✅ **Seller responses to reviews** — one public reply per review (`reviews.response`), edit form on the seller overview, read-only on the storefront + buyer order page.
- ✅ **Storefront + per-product view tracking** → conversion rate on the seller dashboard (`seller_view_counts`) plus a "Most viewed" product list (`product_view_counts`), both fed by the per-session storefront beacon.
- ✅ **Analytics date range** — the seller dashboard has a 30 / 90 / 365-day selector (`?range=`); every stat compares against the prior equal period.
- ✅ **Seller order CSV** — `GET /seller/orders/export` streams an RLS-scoped CSV; "Export CSV" link on the order board.
- ✅ **Saved address book** for buyers — `/account` manages saved addresses; the checkout delivery form has a dropdown to pick one.
- ✅ **Delivery time windows** — seller lists free-text window labels on `/seller/settings` (`seller_profiles.delivery_windows`); buyer picks one at checkout (required if the seller has any), frozen into `orders.delivery_window` and shown on the order views.
- **Realtime for messaging** takes over automatically once §3's Postgres Changes toggle is on.
- ✅ **`refunds.report_id` backfill** — the `charge.refunded` webhook now links the oldest open report on the order into the mirror row and resolves it, for refunds issued straight from the Stripe dashboard.
- ✅ **Partial refunds** — `issueRefundAction` takes an amount; an order can be refunded across several partials (up to the total). A partial mirrors the refund + emails both parties; the order is cancelled + the referral invalidated only once the cumulative refund reaches the total. `refunds` keyed on `stripe_refund_id`.
