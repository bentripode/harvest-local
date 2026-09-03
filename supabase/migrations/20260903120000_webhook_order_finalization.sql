-- Harvest Local — Phase 3 follow-up: atomic, fully retry-safe paid-order finalization.
--
-- The Stripe webhook (`checkout.session.completed` / `async_payment_succeeded`) previously did the
-- status flip, the inventory decrement loop, and the referral row as separate statements, and only
-- ran the last two when *this* delivery performed the `pending_payment -> new` transition. A Stripe
-- redelivery after a partial first attempt (transition committed, loop not finished, no 2xx sent)
-- skipped the rest — the order kept stale stock and, for a promo order, never got its `referrals`
-- row, silently losing the seller's reward progress. See CLAUDE.md rule 2.
--
-- This one SECURITY DEFINER function, guarded on `status = 'pending_payment'` and running in a
-- single transaction, does all of it: either everything commits or nothing does and the retry
-- redoes it cleanly. Money guardrail stays at the data layer (CLAUDE.md rule 3).

set search_path = public;

-- Money params are decimal strings (the app's convention, src/lib/money.ts) — assigned straight
-- into the numeric(10,2) columns, no float arithmetic anywhere.
create or replace function public.finalize_paid_order(
  p_order_id          uuid,
  p_payment_intent_id text,
  p_discount_total    text,
  p_tax_total         text,
  p_total             text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders;
  v_item  record;
begin
  select * into v_order from public.orders where id = p_order_id for update;
  if not found or v_order.status <> 'pending_payment' then
    return false;  -- unknown order, or already finalised / cancelled — idempotent no-op
  end if;

  update public.orders set
    status                   = 'new',
    stripe_payment_intent_id = coalesce(nullif(p_payment_intent_id, ''), stripe_payment_intent_id),
    discount_total           = p_discount_total::numeric,
    tax_total                = p_tax_total::numeric,
    total                    = p_total::numeric
  where id = p_order_id;

  for v_item in
    select product_id, quantity from public.order_items where order_id = p_order_id
  loop
    perform public.decrement_product_quantity(v_item.product_id, v_item.quantity);
  end loop;

  -- Promo order: log the pending referral (create_referral_for_order is itself idempotent and
  -- now sees status = 'new', so its own pending_payment guard passes).
  if v_order.promo_code_id is not null then
    perform public.create_referral_for_order(p_order_id);
  end if;

  return true;
end;
$$;

do $$
begin
  execute 'revoke all on function public.finalize_paid_order(uuid, text, text, text, text) from public, anon, authenticated';
  execute 'grant execute on function public.finalize_paid_order(uuid, text, text, text, text) to service_role';
end $$;
