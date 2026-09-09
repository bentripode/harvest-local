-- Harvest Local — a seller can close for the winter without disappearing.
--
-- `is_paused` has been the single lever and every reason for it has belonged to the platform:
-- onboarding, a licence, a revenue cap, an admin. A seller who simply wants to stop for a season
-- had no way to say so, and a paused storefront vanishes entirely — taking its reviews, its shared
-- links and its search ranking with it. Coming back means starting from nothing.
--
-- =========================================================================
-- INTENT AND VERDICT ARE SEPARATE FACTS
-- =========================================================================
-- The obvious implementation — let the seller write `pause_reason = 'vacation'` — has a hole in it,
-- and it is worth naming because it is the kind that ships.
--
-- `sync_seller_license_pause` pauses with `coalesce(pause_reason, 'license_unverified')`, which
-- deliberately never renames a more specific existing pause. So a seller paused for `vacation` whose
-- licence then lapsed would KEEP the reason `vacation` — and ending their holiday would set them
-- live again with no valid licence on file. The guardrail would have been lifted by a button that
-- has nothing to do with licences.
--
-- So the seller's own switch is its own column. `on_vacation` is what the SELLER wants;
-- `is_paused` / `pause_reason` remain what the PLATFORM has decided, and one function derives the
-- second from the first plus every compliance condition. A seller can no more lift a licence pause
-- by ending a holiday than by asking nicely.
--
-- Precedence, unchanged where it matters: `vacation` is the WEAKEST reason. A compliance pause
-- overwrites it; it overwrites nothing.

set search_path = public;

alter table public.seller_profiles
  add column if not exists on_vacation boolean not null default false;

comment on column public.seller_profiles.on_vacation is
  'The seller''s own "I''m closed for now" switch. Their intent, not the platform''s verdict — '
  'is_paused/pause_reason stay derived by sync_seller_license_pause(), which a seller cannot move.';

-- ---------------------------------------------------------------------------
-- The column guard gains `on_vacation`.
--
-- Not decoration: written directly through PostgREST it would record the intent without
-- recomputing `is_paused`, leaving a seller who thinks they are closed still taking orders. The
-- only way in is `set_seller_vacation`, which recomputes.
-- ---------------------------------------------------------------------------
create or replace function public.seller_profiles_guard_columns()
returns trigger
language plpgsql
as $$
begin
  if not public.is_platform_context() then
    if new.is_paused              is distinct from old.is_paused
    or new.pause_reason           is distinct from old.pause_reason
    or new.on_vacation            is distinct from old.on_vacation
    or new.stripe_account_id      is distinct from old.stripe_account_id
    or new.connect_charges_enabled is distinct from old.connect_charges_enabled
    or new.connect_payouts_enabled is distinct from old.connect_payouts_enabled
    or new.connect_details_submitted is distinct from old.connect_details_submitted
    or new.avg_rating             is distinct from old.avg_rating
    or new.home_state             is distinct from old.home_state then
      raise exception 'protected seller_profiles columns may only be changed by the platform';
    end if;
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- sync_seller_license_pause — re-declared so the whole precedence reads in one piece.
--
-- Two changes from 20260904110000, both about `vacation` being the weakest reason:
--
--   * the pause branch OVERWRITES it (`nullif(pause_reason, 'vacation')`), because a licence
--     problem is more specific than a holiday and must own the row;
--   * the lift branch derives `is_paused` from `on_vacation` instead of clearing it outright, so
--     a seller whose licence just came good stays closed if that is what they asked for.
--
-- Everything else holds exactly as before: revenue_cap and admin are lifted by an admin or the
-- yearly reset alone, onboarding_incomplete belongs to reconcileActivation, and nothing lifts
-- anything unless Connect and a trialing/active subscription still stand.
-- ---------------------------------------------------------------------------
create or replace function public.sync_seller_license_pause(p_seller_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sp        public.seller_profiles;
  v_reason    text;
  v_onboarded boolean;
begin
  select * into v_sp from public.seller_profiles where id = p_seller_id;
  if not found then
    return null;
  end if;

  if not public.seller_has_valid_license(p_seller_id) then
    -- Pause, and never rename a more specific existing pause — onboarding_incomplete, revenue_cap,
    -- license_expired and admin all outrank "no verified license on file". `vacation` does not:
    -- it is the seller's own preference and a compliance problem takes the row from it.
    update public.seller_profiles
       set is_paused = true,
           pause_reason = coalesce(nullif(pause_reason, 'vacation'), 'license_unverified')
     where id = p_seller_id
     returning pause_reason into v_reason;
    return v_reason;
  end if;

  v_onboarded :=
    v_sp.connect_charges_enabled
    and v_sp.connect_details_submitted
    and exists (
      select 1 from public.subscriptions s
       where s.seller_id = p_seller_id and s.status in ('trialing', 'active')
    );

  -- Only the pauses this function owns, plus the seller's own — never revenue_cap, admin or
  -- onboarding_incomplete.
  if v_onboarded
     and (v_sp.pause_reason is null
          or v_sp.pause_reason in ('license_unverified', 'license_expired', 'vacation'))
  then
    update public.seller_profiles
       set is_paused = v_sp.on_vacation,
           pause_reason = case when v_sp.on_vacation then 'vacation' else null end
     where id = p_seller_id;
  end if;

  select pause_reason into v_reason from public.seller_profiles where id = p_seller_id;
  return v_reason;
end;
$$;

-- ---------------------------------------------------------------------------
-- set_seller_vacation — the seller's switch, and the only way to move `on_vacation`.
--
-- Records the intent and then hands the decision straight back to
-- `sync_seller_license_pause`, so there is one place that decides whether a storefront is open. The
-- seller cannot reach past it: ending a holiday re-runs every compliance check, and if a licence
-- lapsed in the meantime they simply stay closed for a different reason.
--
-- SECURITY DEFINER, guarded on `auth.uid()` and `is_service_role()` — never `current_user`, which
-- in a DEFINER body is the function owner and would let anybody close anybody's shop (CLAUDE.md).
-- ---------------------------------------------------------------------------
create or replace function public.set_seller_vacation(p_seller_id uuid, p_on boolean)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner uuid;
begin
  select profile_id into v_owner from public.seller_profiles where id = p_seller_id;
  if v_owner is null then
    raise exception 'no such storefront' using errcode = 'no_data_found';
  end if;

  if v_owner is distinct from (select auth.uid()) and not public.is_service_role() then
    raise exception 'not your storefront' using errcode = 'insufficient_privilege';
  end if;

  update public.seller_profiles set on_vacation = p_on where id = p_seller_id;

  return public.sync_seller_license_pause(p_seller_id);
end;
$$;

revoke all on function public.set_seller_vacation(uuid, boolean) from public, anon;
grant execute on function public.set_seller_vacation(uuid, boolean) to authenticated, service_role;

comment on function public.set_seller_vacation is
  'A seller opens or closes their own storefront. Records intent then re-derives is_paused through '
  'sync_seller_license_pause, so it can never lift a compliance pause.';

-- ===========================================================================
-- A storefront closed BY ITS SELLER stays readable.
--
-- That is the whole point: the reviews, the shared link and the search ranking survive a season
-- off. Every other pause keeps its current behaviour and the page 404s — a storefront closed
-- because a licence lapsed or a revenue cap was crossed is not one we keep showing to buyers, and
-- deciding otherwise is not a change to make in passing.
--
-- Nothing here makes a vacationing seller sellable: `startCheckoutAction` and the Stripe path both
-- gate on `is_paused`, which is still true.
-- ===========================================================================
drop policy if exists "seller_profiles: public read live" on public.seller_profiles;

create policy "seller_profiles: public read live"
  on public.seller_profiles for select
  using (
    is_paused = false
    or pause_reason = 'vacation'
    or profile_id = (select auth.uid())
  );
