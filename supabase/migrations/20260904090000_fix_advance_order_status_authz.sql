-- Harvest Local — SECURITY FIX: `advance_order_status` had no effective authorization check.
--
-- The ownership branch was gated on `not public.is_platform_context()`. That helper reads
-- `current_user` — but inside a SECURITY DEFINER body `current_user` is the function OWNER
-- (`postgres`), never the caller. So it returned TRUE for every caller and the ownership check was
-- never evaluated. Since the function is granted to `authenticated` and the anon key ships in the
-- browser bundle, ANY logged-in account could advance ANY order:
--   * -> completed  fires harvest/order.completed -> record_order_revenue (can force-pause a
--                   competitor's storefront at the cottage-food cap) + referral-activate
--   * -> cancelled  fires referral-invalidate
--   * a buyer could self-complete their own order, which is the gate `reviews_verify_buyer` uses.
-- Caught by test/integration/order-pipeline.test.ts.
--
-- `is_platform_context()` is deliberately NOT changed. Its five other callers are SECURITY INVOKER
-- guard TRIGGERS (profiles_guard_role, seller_profiles_guard_columns, seller_licenses_guard_status,
-- promo_codes_guard_columns, reviews_guard_columns) where `current_user` correctly reflects the
-- caller — and they RELY on it returning true for `postgres` so that SECURITY DEFINER jobs
-- (recompute_seller_rating, record_order_revenue, expire_seller_license) can write protected
-- columns. Narrowing it globally would break the rating rollup and the revenue-cap auto-pause.
--
-- Instead: read the CALLER's role from the request JWT claims. PostgREST sets those as
-- transaction-local state, so unlike `current_user` they survive correctly into a SECURITY DEFINER
-- body. Same reason `auth.uid()` already works there.

set search_path = public;

create or replace function public.is_service_role()
returns boolean
language sql
stable
as $$
  select coalesce(
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb) ->> 'role',
    ''
  ) = 'service_role';
$$;

comment on function public.is_service_role() is
  'True when the CALLER authenticated with the service-role key. Reads the request JWT claims '
  '(transaction-local), so it stays correct inside a SECURITY DEFINER body where current_user is '
  'the function owner. Use this — not is_platform_context() — for authorization inside a '
  'SECURITY DEFINER function.';

-- ---------------------------------------------------------------------------
-- advance_order_status, unchanged except for the authorization predicate.
-- ---------------------------------------------------------------------------
create or replace function public.advance_order_status(
  p_order_id  uuid,
  p_to_status text,
  p_note      text default null
)
returns public.orders
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order   public.orders;
  v_actor   uuid := auth.uid();
  v_allowed text[];
begin
  select * into v_order from public.orders where id = p_order_id for update;
  if not found then
    raise exception 'order not found' using errcode = 'no_data_found';
  end if;

  -- The caller must be the service role, or own the order's storefront.
  if not public.is_service_role()
     and not exists (
       select 1 from public.seller_profiles sp
       where sp.id = v_order.seller_id and sp.profile_id = v_actor
     ) then
    raise exception 'not authorized to change this order' using errcode = 'insufficient_privilege';
  end if;

  v_allowed := case v_order.status
    when 'new'              then array['preparing','cancelled']
    when 'preparing'        then array['ready','cancelled']
    when 'ready'            then case when v_order.fulfillment_type = 'delivery'
                                      then array['out_for_delivery']
                                      else array['completed'] end
    when 'out_for_delivery' then array['completed']
    else array[]::text[]
  end;

  if not (p_to_status = any(v_allowed)) then
    raise exception 'illegal order transition % -> %', v_order.status, p_to_status
      using errcode = 'check_violation';
  end if;

  perform set_config('app.actor_id', coalesce(v_actor::text, ''), true);
  perform set_config('app.status_note', coalesce(p_note, ''), true);

  update public.orders set status = p_to_status where id = p_order_id
    returning * into v_order;

  return v_order;
end;
$$;

revoke all on function public.advance_order_status(uuid, text, text) from public, anon;
grant execute on function public.advance_order_status(uuid, text, text) to authenticated, service_role;
