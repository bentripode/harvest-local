-- Harvest Local — Phase 5: a storefront may only be live with a verified, unexpired license.
--
-- `/admin/licenses` (20260904100000) gave the platform a way to verify a document, but the decision
-- had no consequences: nothing outside `license-expiry-scan` ever read `verification_status`, so a
-- seller could list and sell cottage-food goods with a pending permit, a rejected one, or none at
-- all. This makes verification the gate.
--
-- The gate is deliberately unconditional rather than keyed on
-- `state_cottage_food_rules.requires_license`: those 51 rows are seeded `false` as placeholders
-- ("not legal advice — replace with the verified rules for this state"), so gating on that column
-- would enforce nothing at all. Revisit once real per-state rules are entered.
--
-- Pausing is the single lever, as with the revenue cap: checkout (`startCheckoutAction`), the
-- storefront page and `/shop` all already gate on `seller_profiles.is_paused`.

set search_path = public;

comment on column public.seller_profiles.pause_reason is
  'Why the storefront is paused: onboarding_incomplete | license_unverified | revenue_cap | '
  'license_expired | admin. A compliance pause is never lifted by the Stripe webhook reconcile. '
  'sync_seller_license_pause() lifts license_unverified / license_expired when a verified, '
  'unexpired license exists and onboarding is otherwise complete; revenue_cap and admin are lifted '
  'only by an admin or the next-year revenue reset.';

-- ---------------------------------------------------------------------------
-- seller_has_valid_license — the gate predicate, in one place.
-- ---------------------------------------------------------------------------
create or replace function public.seller_has_valid_license(p_seller_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.seller_licenses
    where seller_id = p_seller_id
      and verification_status = 'verified'
      and expiration_date >= current_date
  );
$$;

revoke all on function public.seller_has_valid_license(uuid) from public, anon, authenticated;
grant execute on function public.seller_has_valid_license(uuid) to service_role;

-- ---------------------------------------------------------------------------
-- sync_seller_license_pause — recompute the license gate for one seller.
--
-- Returns the resulting `pause_reason` (null = live), so the caller can tell the seller what
-- happened. Called after an admin review decision and from the Stripe webhook's activation
-- reconcile.
-- ---------------------------------------------------------------------------
create or replace function public.sync_seller_license_pause(p_seller_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_reason text;
begin
  if not public.seller_has_valid_license(p_seller_id) then
    -- Pause, but never rename an existing pause: onboarding_incomplete, revenue_cap,
    -- license_expired and admin are all more specific than "no verified license on file".
    update public.seller_profiles
      set is_paused = true,
          pause_reason = coalesce(pause_reason, 'license_unverified')
      where id = p_seller_id
      returning pause_reason into v_reason;
    return v_reason;
  end if;

  -- A verified license exists. Lift the two license pauses — and only those — provided the rest of
  -- onboarding still holds. revenue_cap and admin stay; onboarding_incomplete is the onboarding
  -- reconcile's to clear.
  update public.seller_profiles sp
    set is_paused = false,
        pause_reason = null
    where sp.id = p_seller_id
      and sp.pause_reason in ('license_unverified', 'license_expired')
      and sp.connect_charges_enabled
      and sp.connect_details_submitted
      and exists (
        select 1 from public.subscriptions s
        where s.seller_id = sp.id and s.status in ('trialing', 'active')
      );

  select pause_reason into v_reason from public.seller_profiles where id = p_seller_id;
  return v_reason;
end;
$$;

revoke all on function public.sync_seller_license_pause(uuid) from public, anon, authenticated;
grant execute on function public.sync_seller_license_pause(uuid) to service_role;

-- ---------------------------------------------------------------------------
-- Backfill: pause the storefronts that are live today without a verified license.
--
-- Scoped to `pause_reason is null` on purpose — it must never re-pause a storefront an admin
-- deliberately reinstated, so re-running this file is a no-op for anything already reasoned.
-- The only way back out is: seller uploads a document -> an admin verifies it. The notification
-- below is what tells them that; without it a seller just finds themselves dark.
-- ---------------------------------------------------------------------------
with newly_paused as (
  update public.seller_profiles
    set is_paused = true, pause_reason = 'license_unverified'
    where is_paused = false
      and pause_reason is null
      and not public.seller_has_valid_license(id)
    returning profile_id
)
insert into public.notifications (user_id, channel, template, payload)
select np.profile_id, c.channel, 'license_required', '{}'::jsonb
from newly_paused np
cross join (values ('in_app'), ('email')) as c(channel);
