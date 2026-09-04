-- Harvest Local — mark which state cottage-food rules a human has actually verified.
--
-- `20260902140500_phase2_compliance.sql` seeded all 51 rows with a $50,000 cap,
-- `requires_license = false`, and a `PLACEHOLDER — not legal advice` note, so the app would run end
-- to end. None of that has been replaced, which means `record_order_revenue` has been auto-pausing
-- storefronts against an invented number, identically in every state, and the license gate had to
-- ignore `requires_license` entirely because it is false everywhere.
--
-- Detecting that by string-matching the note is fragile. This records it as state: a row is
-- verified when an admin has saved it through /admin/states, and unverified until then.

set search_path = public;

alter table public.state_cottage_food_rules
  add column if not exists verified_at timestamptz,
  add column if not exists verified_by uuid references public.profiles(id) on delete set null;

comment on column public.state_cottage_food_rules.verified_at is
  'When an admin last asserted these values are the state''s real cottage-food rules. NULL = still '
  'the seeded placeholder; the revenue cap should not be trusted (or enforced) until it is set.';

-- Pending states first in the admin queue, then alphabetically.
create index if not exists state_cottage_food_rules_verified_ix
  on public.state_cottage_food_rules (verified_at, state_code);
