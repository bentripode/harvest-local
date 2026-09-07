-- Harvest Local — the identification number four states offer so a seller need not publish their home.
--
-- A home-based seller's label carries their home address, and in eleven predisclosure jurisdictions
-- the storefront listing carries it too — to anyone, not just to buyers. Four states have already
-- thought about that and provide a way out, and we could not express any of them:
--
--   * TEX. HEALTH & SAFETY CODE 437.0193(b-1): an operation "is not required to include on a food
--     label the address of the operation if the operation registers with the department ... and
--     includes on the label a unique identification number provided by the department".
--   * OREGON: a unique identification number from the Department may stand in for the address.
--   * ARKANSAS: an identification number provided by the Department of Agriculture "if requested by
--     the producer to protect the producer's safety", standing in for name, address and phone.
--   * VIRGINIA, Va. Code 3.2-5130(C)(3)(v) and (C)(4)(iv): "the name, PHYSICAL ADDRESS OR POST
--     OFFICE BOX NUMBER, and telephone number of the person preparing the food product".
--
-- Three of those four rows say so in their own notes. Arkansas's reads "which this row cannot
-- express — a seller relying on it should not use the generated label as-is", and Virginia's
-- "our producer_address element is filled from the pickup address and cannot express that choice".
-- This closes it.
--
-- =========================================================================
-- AND IT FIXES AN ALTERNATIVE THAT COULD NEVER BE SATISFIED
-- =========================================================================
-- Texas and Oregon Home Baking currently express the either/or as
-- `[["producer_address", "permit_number"]]`. `permit_number` resolves from `seller_licenses`, and
-- only from a row an admin has marked `verified`. A TEXAS COTTAGE FOOD OPERATION HAS NO LICENCE —
-- that is the entire point of the exemption — so the second limb was unreachable and the group
-- collapsed to "you must publish your address". The seller was being offered a choice that could
-- not be taken.
--
-- `producer_id_number` is its own column because it is its own thing: a registration number the
-- department hands out precisely so an address need not be published. It is not a licence, it does
-- not expire, and no admin verifies it — the state issued it to the seller, and a wrong one is the
-- seller's problem to fix with their own regulator, not ours to adjudicate.
--
-- Returned by `product_label_disclosure()` ONLY where the state's rule names it, the same gate
-- `producer_phone`, `producer_email` and `mailing_address` got.

set search_path = public;

alter table public.seller_profiles
  add column if not exists producer_id_number text;

comment on column public.seller_profiles.producer_id_number is
  'A registration or identification number issued by the seller''s own state so that a producer '
  'need not publish their home address on a label (Tex. Health & Safety Code 437.0193(b-1), and '
  'the equivalents in AR and OR). Not a licence and not verified by us: the state issued it. '
  'Printed only where that state''s label rule names it as an alternative to the address.';

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
        'producer_phone', 'producer_email', 'producer_id_number', 'permit_number', 'municipality',
        'municipality_state', 'ingredients_desc_by_weight', 'net_weight', 'allergens',
        'production_date', 'lot_code', 'expiration_date', 'handling_instructions',
        'nutrition_if_claimed', 'regulator_website', 'seller_statement'
      ]::text[]
      and optional_elements <@ array[
        'product_name', 'producer_name', 'business_name', 'producer_address', 'mailing_address',
        'producer_phone', 'producer_email', 'producer_id_number', 'permit_number', 'municipality',
        'municipality_state', 'ingredients_desc_by_weight', 'net_weight', 'allergens',
        'production_date', 'lot_code', 'expiration_date', 'handling_instructions',
        'nutrition_if_claimed', 'regulator_website', 'seller_statement'
      ]::text[]
    );

-- ---------------------------------------------------------------------------
-- Texas and Oregon: replace the unreachable limb.
-- ---------------------------------------------------------------------------
update public.state_label_rules set
  element_alternatives = '[["producer_address", "producer_id_number"]]'::jsonb,
  notes = notes ||
    ' CORRECTION (20260907100000): the either/or was recorded as producer_address OR permit_number, '
    'and permit_number resolves only from an admin-verified seller_licenses row. A cottage food '
    'operation has no licence, so the second limb could never be satisfied and the group collapsed '
    'to "publish your address" — the opposite of what 437.0193(b-1) offers. It now points at '
    'producer_id_number, the department-issued registration number the subsection actually '
    'describes, which the seller enters on their settings page.'
where program_id in (select id from public.state_food_programs where state_code = 'TX' and ordinal = 1)
  and notes not like '%20260907100000%';

update public.state_label_rules set
  element_alternatives = '[["producer_address", "producer_id_number"]]'::jsonb,
  notes = notes ||
    ' CORRECTION (20260907100000): as with Texas, this row offered producer_address OR '
    'permit_number, and permit_number needs an admin-verified licence a home baker does not have. '
    'The Department''s unique identification number is now its own element.'
where program_id in (select id from public.state_food_programs where state_code = 'OR' and ordinal = 1)
  and notes not like '%20260907100000%';

-- ---------------------------------------------------------------------------
-- Arkansas: name, address and phone all fall away behind the number.
-- ---------------------------------------------------------------------------
update public.state_label_rules set
  required_elements = array_remove(
    array_remove(array_remove(required_elements, 'producer_address'), 'producer_phone'),
    'producer_name'
  ),
  element_alternatives =
    '[["producer_name", "producer_id_number"], ["producer_address", "producer_id_number"], ["producer_phone", "producer_id_number"]]'::jsonb,
  notes = notes ||
    ' UPDATE (20260907100000): the gap this note recorded — "a seller relying on it should not use '
    'the generated label as-is" — is closed. The Department of Agriculture''s identification number, '
    'issued "if requested by the producer to protect the producer''s safety", stands in for the '
    'name, the address and the telephone number, so all three are now either/or groups against '
    'producer_id_number rather than flat requirements. A seller with a number prints it and nothing '
    'else; a seller without one prints all three, as before.'
where program_id in (select id from public.state_food_programs where state_code = 'AR' and ordinal = 1)
  and notes not like '%20260907100000%';

-- ---------------------------------------------------------------------------
-- Virginia: a post office box, which is a mailing address rather than a number.
-- ---------------------------------------------------------------------------
update public.state_label_rules set
  required_elements = array_remove(required_elements, 'producer_address'),
  element_alternatives = '[["producer_address", "mailing_address"]]'::jsonb,
  notes = notes ||
    ' UPDATE (20260907100000): the "POST OFFICE BOX SATISFIES THE ADDRESS" note above is now '
    'expressed rather than described. Va. Code 3.2-5130(C)(3)(v) asks for "the name, physical '
    'address or post office box number, and telephone number", so the address is an either/or '
    'against mailing_address — the plain-text field a seller already fills in on their settings '
    'page. Virginia is the one state where that column is an ALTERNATIVE to the production address '
    'rather than, as in South Dakota, an addition to it.'
where program_id in (select id from public.state_food_programs where state_code = 'VA' and ordinal = 1)
  and notes not like '%20260907100000%';

-- ---------------------------------------------------------------------------
-- The disclosure function, with the same per-state gate.
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
  producer_phone         text,
  producer_email         text,
  producer_id_number     text,
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
  with rule as (
    select
      p.id as product_id,
      sp.id as seller_id,
      sp.home_state,
      sp.business_name,
      sp.mailing_address,
      sp.contact_phone,
      sp.producer_id_number,
      sp.homemade_food_statement,
      pr.id as profile_id,
      p.title,
      p.ingredients,
      p.net_weight_value,
      p.net_weight_unit,
      p.allergens,
      p.handling_instructions,
      a.id as address_id,
      a.line1, a.line2, a.city, a.state, a.postal_code,
      lr.required_elements,
      lr.optional_elements,
      lr.element_alternatives,
      lr.regulator_website_url,
      lr.disclaimer_text,
      lr.disclaimer_min_pt,
      lr.disclaimer_all_caps,
      lr.metric_required,
      lr.predisclosure_required
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
      and p.status in ('active', 'sold_out')
  ),
  asks as (
    select
      rule.*,
      -- One place that decides whether this state's rule names an element at all, so the four
      -- gated fields below cannot drift apart from each other.
      (select array_agg(e) from (
         select unnest(coalesce(rule.required_elements, '{}'::text[])) as e
         union all
         select unnest(coalesce(rule.optional_elements, '{}'::text[]))
         union all
         select jsonb_array_elements_text(g)
         from jsonb_array_elements(coalesce(rule.element_alternatives, '[]'::jsonb)) g
       ) named) as named_elements
    from rule
  )
  select
    asks.home_state,
    asks.title,
    asks.business_name,
    case when asks.address_id is null then null
         else concat_ws(', ', concat_ws(' ', asks.line1, nullif(asks.line2, '')), asks.city,
                        concat_ws(' ', asks.state, asks.postal_code))
    end,
    case when 'mailing_address' = any(coalesce(asks.named_elements, '{}'::text[]))
         then asks.mailing_address else null end,
    asks.city,
    case when 'producer_phone' = any(coalesce(asks.named_elements, '{}'::text[]))
         then asks.contact_phone else null end,
    case when 'producer_email' = any(coalesce(asks.named_elements, '{}'::text[]))
         then (select au.email from auth.users au where au.id = asks.profile_id) else null end,
    case when 'producer_id_number' = any(coalesce(asks.named_elements, '{}'::text[]))
         then asks.producer_id_number else null end,
    (select sl.license_number
       from public.seller_licenses sl
       where sl.seller_id = asks.seller_id
         and sl.verification_status = 'verified'
         and sl.license_number is not null
       order by sl.created_at
       limit 1),
    asks.homemade_food_statement,
    asks.handling_instructions,
    asks.ingredients,
    asks.net_weight_value,
    asks.net_weight_unit,
    asks.allergens,
    coalesce(asks.required_elements, '{}'),
    coalesce(asks.optional_elements, '{}'),
    coalesce(asks.element_alternatives, '[]'::jsonb),
    asks.regulator_website_url,
    asks.disclaimer_text,
    asks.disclaimer_min_pt,
    coalesce(asks.disclaimer_all_caps, false),
    coalesce(asks.metric_required, false),
    coalesce(asks.predisclosure_required, false)
  from asks;
$$;

comment on function public.product_label_disclosure(uuid) is
  'The label information a buyer must be shown before paying, where the state requires it. Exposes '
  'the producer address, town, permit number, homemade-food statement and handling instructions, '
  'plus — ONLY where the state''s own label rule names them — the producer''s telephone number, '
  'account email, mailing address and state-issued identification number, because each is required '
  'on the physical label or in the listing and is therefore not private in that state.';

revoke all on function public.product_label_disclosure(uuid) from public;
grant execute on function public.product_label_disclosure(uuid) to anon, authenticated, service_role;
