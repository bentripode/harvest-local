-- Harvest Local — per-user notification preferences.
--
-- Until now every `email` notification went out unconditionally (LAUNCH.md follow-up). This adds a
-- per-user, per-category email opt-out stored as a small jsonb map on `profiles`:
--
--   {}                          -- default: opted in to everything
--   { "referrals": false }      -- opted out of referral-reward emails
--
-- Only opt-OUTs need to be stored; an absent key means "send". `queueNotification` reads this and
-- drops the `email` channel for a suppressed category (`in_app` rows are unaffected). Two categories
-- are NOT suppressible and ignore this map entirely — `payments` (refund issued) and `compliance`
-- (license expired / revenue cap: the storefront is paused, the seller has to know). See
-- `src/lib/notifications/categories.ts` for the template → category map.
--
-- No new RLS: `profiles` already has "update own", and `profiles_guard_role` only guards `role`.

alter table public.profiles
  add column if not exists notification_prefs jsonb not null default '{}'::jsonb;

alter table public.profiles
  add constraint profiles_notification_prefs_is_object
  check (jsonb_typeof(notification_prefs) = 'object');

comment on column public.profiles.notification_prefs is
  'Per-category email opt-outs, e.g. {"referrals": false}. Absent key = opted in. Read by queueNotification; not all categories are suppressible (see src/lib/notifications/categories.ts).';
