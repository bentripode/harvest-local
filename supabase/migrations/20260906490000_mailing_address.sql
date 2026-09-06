-- Harvest Local — a second address on the label, because South Dakota asks for two.
--
-- S.D. Codified Laws 34-18-37 lists them separately: "(3) Physical address of production; (4)
-- Mailing address of the producer". Our single `producer_address` element is filled from the
-- seller's pickup address, which is the production location — so a South Dakota seller whose post
-- goes somewhere else had no way to put the second one on the label.
--
-- WHY A PLAIN TEXT COLUMN AND NOT AN `addresses` ROW. The pickup address is structured and geocoded
-- because delivery distance is computed from it: `saveDeliverySettingsAction` runs it through Mapbox
-- and `upsert_address()` to get a PostGIS point. A mailing address needs none of that — it is typed
-- by the seller and printed verbatim. Reusing the address machinery would make a label field depend
-- on a geocoding token, and a seller without MAPBOX_TOKEN configured could not satisfy South Dakota.
--
-- IT IS RETURNED BY `product_label_disclosure()` ONLY WHERE THE STATE'S RULE ASKS FOR IT, the same
-- gate `producer_email` got in 20260906420000. That function is `anon`-callable, and a producer's
-- postal address is exactly the kind of thing not to publish in the fifty jurisdictions that do not
-- require it. Note this is a stricter standard than `producer_address` itself, which the function
-- has always returned unconditionally — that is existing behaviour on an element the states which
-- ask for it put on the package anyway, and it is left alone rather than changed as a side effect of
-- this migration.

set search_path = public;

alter table public.seller_profiles
  add column if not exists mailing_address text;

comment on column public.seller_profiles.mailing_address is
  'The producer''s mailing address, where a state requires it on the label ALONGSIDE the physical '
  'address of production (S.D. Codified Laws 34-18-37(3) and (4)). Plain text because it is printed '
  'verbatim and needs no geocoding, unlike the pickup address. Collected on /seller/settings, and '
  'only shown there where the seller''s own state asks for it.';

-- ---------------------------------------------------------------------------
-- The vocabulary.
-- ---------------------------------------------------------------------------
alter table public.state_label_rules
  drop constraint if exists state_label_rules_elements_known;

alter table public.state_label_rules
  add constraint state_label_rules_elements_known
    check (
      required_elements <@ array[
        'product_name', 'producer_name', 'business_name', 'producer_address', 'mailing_address',
        'producer_phone', 'producer_email', 'permit_number', 'municipality', 'municipality_state',
        'ingredients_desc_by_weight', 'net_weight', 'allergens', 'production_date', 'lot_code',
        'expiration_date', 'handling_instructions', 'nutrition_if_claimed', 'regulator_website',
        'seller_statement'
      ]::text[]
      and optional_elements <@ array[
        'product_name', 'producer_name', 'business_name', 'producer_address', 'mailing_address',
        'producer_phone', 'producer_email', 'permit_number', 'municipality', 'municipality_state',
        'ingredients_desc_by_weight', 'net_weight', 'allergens', 'production_date', 'lot_code',
        'expiration_date', 'handling_instructions', 'nutrition_if_claimed', 'regulator_website',
        'seller_statement'
      ]::text[]
    );

-- ---------------------------------------------------------------------------
-- South Dakota, the state that needs it.
-- ---------------------------------------------------------------------------
update public.state_label_rules set
  required_elements = array[
    'product_name', 'producer_name', 'producer_address', 'mailing_address', 'producer_phone',
    'production_date', 'ingredients_desc_by_weight'
  ],
  notes = notes ||
    ' UPDATE (20260906490000): the two-address gap recorded above is now closed. '
    '`seller_profiles.mailing_address` holds the producer''s mailing address and the '
    '`mailing_address` element prints it beside the physical address of production, so (3) and (4) '
    'are satisfied separately as the statute writes them. It is REQUIRED here, not optional, '
    'because 34-18-37 asks for it on every label rather than only for some products — a South '
    'Dakota seller who has not set one will see it reported as missing, with the fix pointing at '
    'their settings page.'
where program_id in (select id from public.state_food_programs where state_code = 'SD' and ordinal = 1)
  and verified_at is null
  and notes not like '%20260906490000%';

-- ---------------------------------------------------------------------------
-- The disclosure function, with the same per-state gate the email got.
-- ---------------------------------------------------------------------------
drop function if exists public.product_label_disclosure(uuid);

create function public.product_label_disclosure(p_product_id uuid)
returns table (
  state_code             char(2),
  product_name           text,
  business_name          text,
  producer_address       text,
  mailing_address        text,
  municipality           text,
  producer_email         text,
  permit_number          text,
  seller_statement       text,
  handling_instructions  text,
  ingredients            jsonb,
  net_weight_value       numeric,
  net_weight_unit        text,
  allergens              text[],
  required_elements      text[],
  optional_elements      text[],
  element_alternatives   jsonb,
  regulator_website_url  text,
  disclaimer_text        text,
  disclaimer_min_pt      int,
  disclaimer_all_caps    boolean,
  metric_required        boolean,
  predisclosure_required boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select
    sp.home_state,
    p.title,
    sp.business_name,
    case when a.id is null then null
         else concat_ws(', ', concat_ws(' ', a.line1, nullif(a.line2, '')), a.city,
                        concat_ws(' ', a.state, a.postal_code))
    end,
    -- Only where this state's rule asks for a separate mailing address.
    case
      when 'mailing_address' = any(coalesce(lr.required_elements, '{}'::text[]))
        or 'mailing_address' = any(coalesce(lr.optional_elements, '{}'::text[]))
        or exists (
             select 1
             from jsonb_array_elements(coalesce(lr.element_alternatives, '[]'::jsonb)) g
             where jsonb_exists(g, 'mailing_address')
           )
      then sp.mailing_address
      else null
    end,
    a.city,
    -- Only where this state's rule actually asks for an email.
    case
      when 'producer_email' = any(coalesce(lr.required_elements, '{}'::text[]))
        or 'producer_email' = any(coalesce(lr.optional_elements, '{}'::text[]))
        or exists (
             select 1
             from jsonb_array_elements(coalesce(lr.element_alternatives, '[]'::jsonb)) g
             where jsonb_exists(g, 'producer_email')
           )
      then (select au.email from auth.users au where au.id = pr.id)
      else null
    end,
    (select sl.license_number
       from public.seller_licenses sl
       where sl.seller_id = sp.id
         and sl.verification_status = 'verified'
         and sl.license_number is not null
       order by sl.created_at
       limit 1),
    sp.homemade_food_statement,
    p.handling_instructions,
    p.ingredients,
    p.net_weight_value,
    p.net_weight_unit,
    p.allergens,
    coalesce(lr.required_elements, '{}'),
    coalesce(lr.optional_elements, '{}'),
    coalesce(lr.element_alternatives, '[]'::jsonb),
    lr.regulator_website_url,
    lr.disclaimer_text,
    lr.disclaimer_min_pt,
    coalesce(lr.disclaimer_all_caps, false),
    coalesce(lr.metric_required, false),
    coalesce(lr.predisclosure_required, false)
  from public.products p
  join public.seller_profiles sp on sp.id = p.seller_id
  join public.profiles pr on pr.id = sp.profile_id
  left join public.addresses a on a.id = sp.pickup_address_id
  -- The seller's chosen program decides the rule; without one, the state's first program.
  left join public.state_food_programs fp
    on fp.id = coalesce(
         sp.food_program_id,
         (select fp2.id from public.state_food_programs fp2
           where fp2.state_code = sp.home_state order by fp2.ordinal limit 1)
       )
  left join public.state_label_rules lr on lr.program_id = fp.id
  where p.id = p_product_id
    -- Only for a product a buyer can actually see; a draft discloses nothing.
    and p.status in ('active', 'sold_out');
$$;

comment on function public.product_label_disclosure(uuid) is
  'The label information a buyer must be shown before paying, where the state requires it. Exposes '
  'the producer address, town, permit number, homemade-food statement and handling instructions, '
  'plus — ONLY where the state''s own label rule asks for them — the producer''s account email and '
  'mailing address, because each is required on the physical label or in the listing and is '
  'therefore not private in that state.';

revoke all on function public.product_label_disclosure(uuid) from public;
grant execute on function public.product_label_disclosure(uuid) to anon, authenticated, service_role;
