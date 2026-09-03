-- Harvest Local — Phase 3 review fix (finding #7): only rotate a referral cycle when the billing
-- period genuinely ADVANCES.
--
-- `open_referral_cycle` previously closed the open cycle and opened a fresh one (count 0) on ANY
-- `period_start` that differed from the open cycle's — so a `customer.subscription.updated` whose
-- `current_period_start` shifted from proration, a billing-anchor change, a plan change mid-period,
-- or even event reordering would silently wipe the seller's in-progress referral progress.
--
-- Now: an equal-or-earlier period boundary keeps the in-progress cycle (its window is extended if
-- the new period_end is later); only a strictly-later period_start rotates.

set search_path = public;

create or replace function public.open_referral_cycle(
  p_seller_id     uuid,
  p_period_start  timestamptz,
  p_period_end    timestamptz
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_open   public.referral_cycles;
  v_sub_id uuid;
  v_new_id uuid;
begin
  perform pg_advisory_xact_lock(hashtext('referral_cycle:' || p_seller_id::text));

  select * into v_open
    from public.referral_cycles
    where seller_id = p_seller_id and closed_at is null;

  if found then
    -- Same period, or a backwards/proration/anchor blip: keep the in-progress cycle and its
    -- accrued count. Extend the window if this event carries a later period_end.
    if p_period_start <= v_open.period_start then
      if p_period_end > v_open.period_end then
        update public.referral_cycles set period_end = p_period_end where id = v_open.id;
      end if;
      return v_open.id;
    end if;
    -- else: period_start moved strictly forward — a real renewal. Fall through and rotate.
  end if;

  select id into v_sub_id from public.subscriptions where seller_id = p_seller_id;
  if v_sub_id is null then
    return null;
  end if;

  update public.referral_cycles
    set closed_at = now()
    where seller_id = p_seller_id and closed_at is null;

  insert into public.referral_cycles (seller_id, subscription_id, period_start, period_end)
  values (p_seller_id, v_sub_id, p_period_start, p_period_end)
  returning id into v_new_id;

  return v_new_id;
end;
$$;

do $$
begin
  execute 'revoke all on function public.open_referral_cycle(uuid, timestamptz, timestamptz) from public, anon, authenticated';
  execute 'grant execute on function public.open_referral_cycle(uuid, timestamptz, timestamptz) to service_role';
end $$;
