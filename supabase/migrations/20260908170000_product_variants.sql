-- Harvest Local — one listing, several sizes or scents.
--
-- A soap maker has six scents and a baker has half and whole loaves. Today each is a separate
-- `products` row, which duplicates the ingredients, the allergens and the net weight six times over
-- — so this is a compliance fix before it is a merchandising one. Every duplicate is another place
-- for the label to go stale, and `products_guard_label_fields` can only check that each copy is
-- filled in, not that they agree.
--
-- A variant is a child of the listing, so the label data that must not vary — ingredients,
-- allergens, handling instructions — lives once on the product. The things that genuinely differ
-- per variant are price, stock and net weight, and only those.
--
-- =========================================================================
-- VARIANTS ARE OPTIONAL, AND AUTHORITATIVE WHEN PRESENT
-- =========================================================================
-- `products.price` and `products.quantity_available` are not moved. Moving money for every existing
-- listing to satisfy a feature most of them will never use is a large migration on the one path
-- CLAUDE.md rule 3 says to keep boring, and a candle maker with one product should not have to
-- think about variants at all.
--
-- So: a product with no variants sells at its own price, exactly as now. A product WITH variants
-- sells only through them, and its own price column stops being consulted. The two paths meet in a
-- single resolver — `resolveSaleUnit` in src/lib/orders/pricing.ts — so there is still exactly one
-- place a price comes from, which is what rule 3 is actually protecting.

set search_path = public;

create table public.product_variants (
  id                 uuid primary key default gen_random_uuid(),
  product_id         uuid not null references public.products(id) on delete cascade,

  /** What the buyer picks between: "Lavender", "Half loaf", "12 oz". */
  name               text not null check (char_length(name) between 1 and 60),

  price              numeric(10,2) not null check (price >= 0),
  quantity_available int check (quantity_available is null or quantity_available >= 0),

  /** A half loaf weighs half as much; the label has to say which one is in the bag. */
  net_weight_value   numeric(10,3) check (net_weight_value is null or net_weight_value > 0),
  net_weight_unit    text check (
                       net_weight_unit is null
                       or net_weight_unit in ('oz', 'lb', 'g', 'kg', 'fl_oz', 'ml', 'count')
                     ),

  sku                text check (sku is null or char_length(sku) <= 60),
  sort_order         int not null default 0,
  is_active          boolean not null default true,

  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),

  -- Same pairing rule as the product: a number without a unit is not a net weight.
  constraint product_variants_net_weight_pair
    check (num_nulls(net_weight_value, net_weight_unit) <> 1)
);

-- Two variants with the same name are two ways to describe one thing.
create unique index product_variants_name_ux on public.product_variants (product_id, lower(name));
create index product_variants_product_ix on public.product_variants (product_id, sort_order);

create trigger product_variants_set_updated_at before update on public.product_variants
  for each row execute function public.set_updated_at();

comment on table public.product_variants is
  'Sizes/scents of one listing. Optional; when a product has any, they are the only thing sold and '
  'products.price is not consulted. Label data that must not vary stays on the product.';

-- ===========================================================================
-- The order's link back.
--
-- `variant_snapshot` freezes the name the buyer chose, the way `title_snapshot` freezes the
-- product's: an order has to stay readable after the seller renames "Lavender" to "French
-- Lavender" or deletes the variant entirely.
-- ===========================================================================
alter table public.order_items
  add column if not exists variant_id uuid
    references public.product_variants(id) on delete set null,
  add column if not exists variant_snapshot text
    constraint order_items_variant_snapshot_len check (
      variant_snapshot is null or char_length(variant_snapshot) <= 60
    );

-- ===========================================================================
-- Stock.
--
-- `decrement_product_quantity` is untouched — it is still right for a product with no variants.
-- This is its sibling, and `finalize_paid_order` picks between them per line.
-- ===========================================================================
create or replace function public.decrement_variant_quantity(p_variant_id uuid, p_qty int)
returns void
language sql
security definer
set search_path = public
as $$
  update public.product_variants
     set quantity_available = greatest(0, quantity_available - p_qty),
         updated_at = now()
   where id = p_variant_id and quantity_available is not null;
$$;

revoke all on function public.decrement_variant_quantity(uuid, int) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- finalize_paid_order: decrement whichever unit the line actually sold.
--
-- Re-declared in full, with the EXACT signature from 20260903120000 — five parameters, money as
-- decimal strings. Postgres overloads on argument types, so a version with different parameters
-- would not replace this function, it would sit beside it: the webhook would keep calling the old
-- one and variant stock would silently never move. The only change below is the loop.
--
-- Everything else is as it was: SECURITY DEFINER, guarded on `status = pending_payment` so a
-- Stripe redelivery is a clean no-op or a clean full redo (CLAUDE.md rule 2), and no float
-- arithmetic anywhere near the money.
-- ---------------------------------------------------------------------------
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

  -- The only change from 20260903120000: a line that sold an option decrements that option.
  for v_item in
    select product_id, variant_id, quantity from public.order_items where order_id = p_order_id
  loop
    if v_item.variant_id is not null then
      perform public.decrement_variant_quantity(v_item.variant_id, v_item.quantity);
    else
      perform public.decrement_product_quantity(v_item.product_id, v_item.quantity);
    end if;
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

-- ===========================================================================
-- RLS — same shape as `products`: the world reads what is for sale, the seller writes their own.
-- ===========================================================================
alter table public.product_variants enable row level security;

create policy "variants: public read active"
  on public.product_variants for select
  using (
    exists (
      select 1 from public.products p
      where p.id = product_variants.product_id
        and (
          (p.status = 'active' and product_variants.is_active)
          or p.seller_id in (
            select sp.id from public.seller_profiles sp
             where sp.profile_id = (select auth.uid())
          )
        )
    )
  );

create policy "variants: seller writes own"
  on public.product_variants for all
  using (
    product_id in (
      select p.id from public.products p
       join public.seller_profiles sp on sp.id = p.seller_id
      where sp.profile_id = (select auth.uid())
    )
  )
  with check (
    product_id in (
      select p.id from public.products p
       join public.seller_profiles sp on sp.id = p.seller_id
      where sp.profile_id = (select auth.uid())
    )
  );

-- ===========================================================================
-- A listing that sells through variants needs at least one that is buyable.
--
-- Deactivating the last active variant would leave an `active` product with nothing purchasable
-- behind it: the storefront would show it, the picker would be empty, and the buyer would be stuck
-- on a listing that cannot be added to a basket. Refused here rather than in a handler, since the
-- seller product form is not the only way rows get written.
-- ===========================================================================
create or replace function public.product_variants_guard_last_active()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_status text;
  v_remaining int;
begin
  select status into v_status from public.products where id = coalesce(old.product_id, new.product_id);
  if v_status is distinct from 'active' then
    return coalesce(new, old);
  end if;

  select count(*) into v_remaining
    from public.product_variants v
   where v.product_id = coalesce(old.product_id, new.product_id)
     and v.is_active
     and v.id <> old.id;

  if tg_op = 'UPDATE' and new.is_active then
    return new;
  end if;

  if v_remaining = 0 then
    raise exception 'a listed product needs at least one variant buyers can choose'
      using errcode = 'check_violation';
  end if;

  return coalesce(new, old);
end;
$$;

create trigger product_variants_guard_last_active
  before update or delete on public.product_variants
  for each row execute function public.product_variants_guard_last_active();
