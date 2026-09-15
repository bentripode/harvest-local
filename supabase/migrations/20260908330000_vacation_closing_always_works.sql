-- Harvest Local — closing your own storefront should always work.
--
-- 20260908280000 put the seller's switch behind the same `v_onboarded` gate as everything else, so
-- `sync_seller_license_pause` would only act on `on_vacation` when Connect and a live subscription
-- held. That is right for LIFTING a pause and wrong for applying one.
--
-- The integration pass found it as a fixture problem — a test seller with no subscription could set
-- `on_vacation` and stay open — but the behaviour is wrong for a real seller too. Someone whose
-- subscription lapsed, or whose Connect account needs re-verifying, is exactly the person who might
-- want to put "closed for now" on their storefront, and the old logic silently ignored them. A
-- request to close can only ever make a seller LESS available, so it needs no permission.
--
-- Lifting stays gated, and the precedence is unchanged: a compliance pause still outranks a
-- holiday, and clearing `on_vacation` still cannot lift one.

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

  if not public.seller_has_required_documents(p_seller_id) then
    -- Never rename a more specific existing pause. `vacation` is the one exception: a compliance
    -- problem outranks a holiday and takes the row from it.
    update public.seller_profiles
       set is_paused = true,
           pause_reason = coalesce(nullif(pause_reason, 'vacation'), 'license_unverified')
     where id = p_seller_id
     returning pause_reason into v_reason;
    return v_reason;
  end if;

  if v_sp.on_vacation then
    -- Closing needs no permission: it can only reduce availability. And it still does not rename a
    -- pause that outranks it — a seller closing while paused for a revenue cap stays paused for the
    -- revenue cap, so ending the holiday cannot lift it later.
    update public.seller_profiles
       set is_paused = true,
           pause_reason = coalesce(nullif(pause_reason, 'vacation'), 'vacation')
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

  -- Only the pauses this function owns — never revenue_cap, admin or onboarding_incomplete.
  if v_onboarded
     and v_sp.pause_reason in ('license_unverified', 'license_expired', 'vacation')
  then
    update public.seller_profiles
       set is_paused = false,
           pause_reason = null
     where id = p_seller_id;
  end if;

  select pause_reason into v_reason from public.seller_profiles where id = p_seller_id;
  return v_reason;
end;
$$;
