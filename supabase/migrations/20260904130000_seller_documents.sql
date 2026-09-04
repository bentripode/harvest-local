-- Harvest Local — the seller document set: Government ID + Tax ID, plus a Cottage Food Permit for
-- anyone listing food.
--
-- The upload existed (an optional file field on the generic "add a license" form) but nothing said
-- which documents were actually required, and the storefront gate (20260904110000) was satisfied by
-- any single verified license — so a seller with only a verified ID could sell cottage food with no
-- permit on file. This defines the required set and makes the gate mean it.
--
-- Whether a seller needs the permit is DERIVED from the categories they list in, so it follows the
-- catalogue instead of a self-declaration that can drift. That means the gate has to re-evaluate
-- when the catalogue changes — hence the trigger on `products` at the bottom.

set search_path = public;

-- ---------------------------------------------------------------------------
-- 1. Which categories are food, and so require the permit.
-- ---------------------------------------------------------------------------
alter table public.categories
  add column if not exists requires_food_permit boolean not null default false;

comment on column public.categories.requires_food_permit is
  'Listing in this category requires a verified cottage-food permit. Seeded true for the food '
  'top-levels and their children; flowers and crafts are false. Not a legal determination - an '
  'admin should confirm it against their state rules, the same caveat as state_cottage_food_rules.';

update public.categories c
  set requires_food_permit = true
  where c.slug in ('produce', 'baked-goods', 'dairy-eggs', 'meat-seafood', 'pantry-preserves', 'beverages')
     or c.parent_id in (
       select p.id from public.categories p
       where p.slug in ('produce', 'baked-goods', 'dairy-eggs', 'meat-seafood', 'pantry-preserves', 'beverages')
     );

-- ---------------------------------------------------------------------------
-- 2. Tax ID is a document type, and it does not expire.
-- ---------------------------------------------------------------------------
alter table public.seller_licenses
  drop constraint if exists seller_licenses_license_type_check;

alter table public.seller_licenses
  add constraint seller_licenses_license_type_check
    check (license_type in ('cottage_food', 'food_handler', 'business_license', 'id', 'tax_id', 'other'));

-- An SSN or EIN has no expiry date and no issuing state we care about; everything else needs both.
alter table public.seller_licenses alter column expiration_date drop not null;
alter table public.seller_licenses alter column issuing_state drop not null;

alter table public.seller_licenses
  add constraint seller_licenses_expiry_required
    check (license_type = 'tax_id' or expiration_date is not null) not valid;

alter table public.seller_licenses
  add constraint seller_licenses_state_required
    check (license_type = 'tax_id' or issuing_state is not null) not valid;

-- The three required types exist to be looked at, so the document is not optional for them.
-- NOT VALID: any row uploaded before this migration keeps whatever it has; new writes must comply.
alter table public.seller_licenses
  add constraint seller_licenses_document_required
    check (license_type not in ('id', 'tax_id', 'cottage_food') or document_path is not null) not valid;

comment on column public.seller_licenses.license_number is
  'The identifying number on the document. For license_type = tax_id this is an SSN or EIN - '
  'sensitive personal data. Readable only by the owning seller (RLS) and admins, and rendered '
  'masked to the last 4 everywhere in the UI; never put it in an export, a log, or a notification.';

-- ---------------------------------------------------------------------------
-- 3. The required set, derived from the catalogue.
-- ---------------------------------------------------------------------------
create or replace function public.seller_sells_cottage_food(p_seller_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.products p
    join public.categories c on c.id = p.category_id
    where p.seller_id = p_seller_id
      and p.status <> 'archived'          -- a draft can go live at any moment; archived cannot
      and c.requires_food_permit
  );
$$;

comment on function public.seller_sells_cottage_food(uuid) is
  'True when the seller lists any non-archived product in a food category. Drives whether the '
  'cottage-food permit is part of their required document set.';

create or replace function public.seller_has_required_documents(p_seller_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select not exists (
    select 1
    from unnest(
      case
        when public.seller_sells_cottage_food(p_seller_id) then array['id', 'tax_id', 'cottage_food']
        else array['id', 'tax_id']
      end
    ) as required(license_type)
    where not exists (
      select 1
      from public.seller_licenses l
      where l.seller_id = p_seller_id
        and l.license_type = required.license_type
        and l.verification_status = 'verified'
        and (l.expiration_date is null or l.expiration_date >= current_date)
    )
  );
$$;

comment on function public.seller_has_required_documents(uuid) is
  'Every required document verified and unexpired. Replaces seller_has_valid_license, which was '
  'satisfied by any one verified license.';

revoke all on function public.seller_sells_cottage_food(uuid) from public, anon, authenticated;
revoke all on function public.seller_has_required_documents(uuid) from public, anon, authenticated;
grant execute on function public.seller_sells_cottage_food(uuid) to service_role;
grant execute on function public.seller_has_required_documents(uuid) to service_role;

-- ---------------------------------------------------------------------------
-- 4. The gate now means the whole set.
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
  if not public.seller_has_required_documents(p_seller_id) then
    update public.seller_profiles
      set is_paused = true,
          pause_reason = coalesce(pause_reason, 'license_unverified')
      where id = p_seller_id
      returning pause_reason into v_reason;
    return v_reason;
  end if;

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

drop function if exists public.seller_has_valid_license(uuid);

-- ---------------------------------------------------------------------------
-- 5. Deriving from the catalogue means the catalogue can change the answer.
--
-- Listing a first food product must pause a seller who has no permit, and archiving their last one
-- must let them back. Without this the gate would only be right until the seller edited a product.
-- ---------------------------------------------------------------------------
create or replace function public.products_sync_license_pause()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.sync_seller_license_pause(coalesce(new.seller_id, old.seller_id));
  return coalesce(new, old);
end;
$$;

create trigger products_sync_license_pause
  after insert or delete or update of category_id, status, seller_id on public.products
  for each row execute function public.products_sync_license_pause();
