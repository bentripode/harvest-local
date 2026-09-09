-- Harvest Local — sync_seller_license_pause was calling a function that no longer exists.
--
-- 20260908280000 added the seller's own "closed for the season" switch, and re-declared
-- `sync_seller_license_pause` so the whole precedence could be read in one piece. It rebuilt the
-- body from the version in 20260904110000 — which calls `seller_has_valid_license`.
--
-- That function was DROPPED in 20260904130000 and replaced by `seller_has_required_documents`
-- (`drop function if exists public.seller_has_valid_license(uuid)`, line 164). So the re-declared
-- function referenced a name that had not existed for four days.
--
-- plpgsql resolves function calls at RUN time, not at CREATE time, so the migration applied
-- perfectly and the breakage only appeared when something called it:
--
--     Error: createProduct: function public.seller_has_valid_license(uuid) does not exist
--
-- Which is everything that matters. `products_sync_license_gate` fires on every product insert and
-- update, so a food seller could not save a listing at all; `reviewLicenseAction` could not verify
-- or withdraw a document; `reconcileActivation` could not set a seller live. The integration pass
-- found it — 46 failures in license-gate alone, and 17 fixtures that could not create a product.
--
-- THE LESSON, which is the same one the finalize_paid_order signature taught two days earlier:
-- re-declaring a function by copying an old migration's body reintroduces whatever that migration
-- knew. Copy from the LATEST definition, not the first one, and check what has been dropped since.
--
-- This is the 20260904130000 body — the real current one — with the two vacation changes from
-- 20260908280000 layered back on, and nothing else altered.

set search_path = public;

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

  -- `seller_has_required_documents`, not the dropped `seller_has_valid_license`.
  if not public.seller_has_required_documents(p_seller_id) then
    -- Pause, and never rename a more specific existing pause — onboarding_incomplete, revenue_cap,
    -- license_expired and admin all outrank "no verified document on file". `vacation` does not:
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
