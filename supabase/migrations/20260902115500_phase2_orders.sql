-- Harvest Local — Phase 2 schema: orders, order items, the status pipeline + its audit trail.
--
-- See ARCHITECTURE.md §2.5 (schema) and §4 (geofencing). Design rules that this migration
-- enforces at the data layer:
--
--  * Cross-state orders are IMPOSSIBLE here — the `orders_same_state_only` CHECK. Even a bug
--    in application code cannot write one. (Layer 1 of 3; server guard + discovery filter
--    are the other two.)
--  * Order money is a SNAPSHOT captured at checkout, never recomputed from live product rows.
--    `subtotal` / `discount_total` / `delivery_fee` are frozen by the checkout server action;
--    `tax_total` / `total` are finalised by the Stripe webhook from the Checkout Session
--    (Stripe Tax is the server-side tax computation).
--  * Users never write orders directly — there are no INSERT/UPDATE/DELETE policies. Writes
--    come from the service role (checkout action, webhook) or `advance_order_status()`.
--  * Every status change lands a row in `order_status_history` via trigger — seller-driven
--    and system/webhook alike.

set search_path = public;

-- ---------------------------------------------------------------------------
-- 2.5 Orders
-- ---------------------------------------------------------------------------

create table public.orders (
  id                        uuid primary key default gen_random_uuid(),
  buyer_id                  uuid not null references public.profiles(id) on delete restrict,
  seller_id                 uuid not null references public.seller_profiles(id) on delete restrict,
  status                    text not null default 'pending_payment'
                              check (status in ('pending_payment','new','preparing','ready',
                                                'out_for_delivery','completed','cancelled','disputed')),
  fulfillment_type          text not null default 'pickup'
                              check (fulfillment_type in ('pickup','delivery')),

  -- Money — all snapshots (see file header). numeric in the DB; the app works in integer
  -- cents (src/lib/money.ts) and writes decimal strings.
  subtotal                  numeric(10,2) not null check (subtotal >= 0),
  discount_total            numeric(10,2) not null default 0 check (discount_total >= 0),
  delivery_fee              numeric(10,2) not null default 0 check (delivery_fee >= 0),
  tax_total                 numeric(10,2) not null default 0 check (tax_total >= 0),
  total                     numeric(10,2) not null check (total >= 0),

  -- Compliance snapshots, frozen at order time (ARCHITECTURE.md §4).
  buyer_state               char(2) not null,
  seller_state              char(2) not null,

  -- Links
  promo_code_id             uuid,  -- FK to promo_codes added in Phase 3
  delivery_address_id       uuid references public.addresses(id) on delete set null,
  delivery_distance_miles   numeric(6,1),
  stripe_checkout_session_id text unique,
  stripe_payment_intent_id  text unique,

  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now(),

  -- Layer 1 geofence: cross-state transactions cannot exist in this table.
  constraint orders_same_state_only check (buyer_state = seller_state)
);
create index orders_seller_status_ix     on public.orders (seller_id, status);
create index orders_buyer_ix             on public.orders (buyer_id, created_at desc);
create index orders_checkout_session_ix  on public.orders (stripe_checkout_session_id);

create trigger orders_set_updated_at before update on public.orders
  for each row execute function public.set_updated_at();

comment on column public.orders.status is
  'pending_payment until the Stripe webhook confirms the charge, then new -> preparing -> '
  'ready -> (out_for_delivery ->) completed. cancelled from new/preparing or on payment '
  'failure/expiry. disputed is Phase 5.';

create table public.order_items (
  id                uuid primary key default gen_random_uuid(),
  order_id          uuid not null references public.orders(id) on delete cascade,
  product_id        uuid not null references public.products(id) on delete restrict,
  title_snapshot    text not null,
  quantity          int not null check (quantity > 0),
  unit_price        numeric(10,2) not null check (unit_price >= 0),   -- snapshot
  line_total        numeric(10,2) not null check (line_total >= 0),   -- snapshot
  category_snapshot text,
  tax_code          text
);
create index order_items_order_ix on public.order_items (order_id);

-- Audit trail + the trigger point for Phase 3 notifications.
create table public.order_status_history (
  id          uuid primary key default gen_random_uuid(),
  order_id    uuid not null references public.orders(id) on delete cascade,
  from_status text,
  to_status   text not null,
  changed_by  uuid references public.profiles(id) on delete set null,   -- null = system
  note        text,
  created_at  timestamptz not null default now()
);
create index order_status_history_order_ix on public.order_status_history (order_id, created_at);

-- ---------------------------------------------------------------------------
-- Status-change audit — fires for EVERY status transition, whoever made it.
-- The actor + note are read from transaction-local settings that the caller sets
-- (advance_order_status does; the webhook leaves them empty => changed_by NULL = system).
-- ---------------------------------------------------------------------------

create or replace function public.orders_log_status_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status is distinct from old.status then
    insert into public.order_status_history (order_id, from_status, to_status, changed_by, note)
    values (
      new.id,
      old.status,
      new.status,
      nullif(current_setting('app.actor_id', true), '')::uuid,
      nullif(current_setting('app.status_note', true), '')
    );
  end if;
  return new;
end;
$$;

create trigger orders_log_status_change
  after update on public.orders
  for each row execute function public.orders_log_status_change();

-- ---------------------------------------------------------------------------
-- advance_order_status — the ONLY way a seller moves an order along the pipeline.
-- SECURITY DEFINER: validates the caller owns the order's storefront and that the
-- transition is legal, then performs it (recording the actor for the audit trigger).
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

  if not public.is_platform_context()
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

-- ---------------------------------------------------------------------------
-- decrement_product_quantity — called by the webhook (service role) after a paid order.
-- ---------------------------------------------------------------------------

create or replace function public.decrement_product_quantity(p_product_id uuid, p_qty int)
returns void
language sql
security definer
set search_path = public
as $$
  update public.products
    set quantity_available = greatest(0, quantity_available - p_qty)
    where id = p_product_id and quantity_available is not null;
$$;

revoke all on function public.decrement_product_quantity(uuid, int) from public, anon, authenticated;
grant execute on function public.decrement_product_quantity(uuid, int) to service_role;

-- ---------------------------------------------------------------------------
-- RLS — buyers and sellers READ their own orders; nobody writes through the API.
-- ---------------------------------------------------------------------------

alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.order_status_history enable row level security;

create policy "orders: buyer or seller reads"
  on public.orders for select
  using (
    buyer_id = (select auth.uid())
    or seller_id in (
      select sp.id from public.seller_profiles sp where sp.profile_id = (select auth.uid())
    )
  );

create policy "order_items: buyer or seller reads"
  on public.order_items for select
  using (
    exists (
      select 1 from public.orders o
      where o.id = order_items.order_id
        and (
          o.buyer_id = (select auth.uid())
          or o.seller_id in (
            select sp.id from public.seller_profiles sp where sp.profile_id = (select auth.uid())
          )
        )
    )
  );

create policy "order_status_history: buyer or seller reads"
  on public.order_status_history for select
  using (
    exists (
      select 1 from public.orders o
      where o.id = order_status_history.order_id
        and (
          o.buyer_id = (select auth.uid())
          or o.seller_id in (
            select sp.id from public.seller_profiles sp where sp.profile_id = (select auth.uid())
          )
        )
    )
  );
