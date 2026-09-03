-- Harvest Local — Phase 3 review fix (finding #6): keep "reward_granted = true" and "the Stripe
-- coupon is attached" in lockstep.
--
-- Before: activate_referral_for_order set referral_cycles.reward_granted = true the moment the
-- count crossed the threshold, in its own transaction. The FREE_MONTH_100 attach happened in a
-- separate Inngest step. If that step exhausted its retries (Stripe outage), the cycle was left
-- reward_granted = true with reward_stripe_coupon_id NULL — a free month the seller "earned" but
-- never received, with nothing re-driving it and no signal.
--
-- After: activate_referral_for_order only REPORTS the reward as earned (granted = true) — it no
-- longer touches reward_granted. referral-activate attaches the coupon, then set_referral_reward_
-- coupon() flips reward_granted together with reward_stripe_coupon_id in one statement. A failed
-- attach now leaves the cycle honestly un-granted; the next activation re-attempts, and
-- referral-activate's onFailure handler flags an admin if it never succeeds.

set search_path = public;

create or replace function public.activate_referral_for_order(p_order_id uuid)
returns table (
  granted               boolean,
  reward_cycle_id       uuid,
  reward_seller_id      uuid,
  reward_subscription   text,
  cycle_count           int,
  cycle_threshold       int
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ref public.referrals;
  v_threshold int := coalesce(
    (select (value ->> 'threshold')::int from public.platform_settings where key = 'seller_referral_reward'),
    3
  );
  v_target uuid;
  v_count int;
  v_already boolean;
  v_granted boolean := false;
  v_seller uuid := (select seller_id from public.orders where id = p_order_id);
  v_sub text;
begin
  select stripe_subscription_id into v_sub from public.subscriptions where seller_id = v_seller;

  select * into v_ref from public.referrals where order_id = p_order_id for update;
  if not found then
    return query select false, null::uuid, v_seller, v_sub, 0, v_threshold;
    return;
  end if;

  if v_ref.status <> 'pending' then
    select active_referral_count into v_count from public.referral_cycles where id = v_ref.cycle_id;
    return query select false, v_ref.cycle_id, v_ref.seller_id, v_sub, coalesce(v_count, 0), v_threshold;
    return;
  end if;

  -- Count toward the referral's cycle if it's still open, otherwise the currently-open one.
  if v_ref.cycle_id is not null
     and exists (select 1 from public.referral_cycles where id = v_ref.cycle_id and closed_at is null) then
    v_target := v_ref.cycle_id;
  else
    v_target := public.ensure_open_referral_cycle(v_ref.seller_id);
  end if;

  if v_target is null then
    return query select false, null::uuid, v_ref.seller_id, v_sub, 0, v_threshold;
    return;
  end if;

  update public.referrals
    set status = 'active', activated_at = now(), cycle_id = v_target
    where id = v_ref.id;

  update public.referral_cycles
    set active_referral_count = active_referral_count + 1
    where id = v_target
    returning active_referral_count, reward_granted into v_count, v_already;

  -- Only REPORT that the reward is earned. The caller (referral-activate) attaches the Stripe
  -- coupon and then set_referral_reward_coupon() marks reward_granted — so the flag and the coupon
  -- are always consistent. Concurrent activations that both cross the threshold both report
  -- granted; the Stripe write is idempotency-keyed on the cycle and the mark is idempotent.
  v_granted := (v_count >= v_threshold and not coalesce(v_already, false));

  return query select v_granted, v_target, v_ref.seller_id, v_sub, coalesce(v_count, 0), v_threshold;
end;
$$;

create or replace function public.set_referral_reward_coupon(p_cycle_id uuid, p_coupon_id text)
returns void
language sql
security definer
set search_path = public
as $$
  update public.referral_cycles
    set reward_stripe_coupon_id = p_coupon_id,
        reward_granted          = true
    where id = p_cycle_id;
$$;

do $$
begin
  execute 'revoke all on function public.activate_referral_for_order(uuid) from public, anon, authenticated';
  execute 'grant execute on function public.activate_referral_for_order(uuid) to service_role';
  execute 'revoke all on function public.set_referral_reward_coupon(uuid, text) from public, anon, authenticated';
  execute 'grant execute on function public.set_referral_reward_coupon(uuid, text) to service_role';
end $$;
