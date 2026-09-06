-- Harvest Local — make `state_label_rules` able to express what states actually require.
--
-- Eight states into the verification pass, four of them hit requirements the schema could not hold,
-- and the workaround each time was a note asking a human to finish the label by hand. That does not
-- scale to 51 and it silently produces non-compliant labels in the meantime. Three gaps, three
-- fixes.
--
-- 1. A STATE-SUPPLIED URL. Ariz. Rev. Stat. 36-932(A)(5) requires the label to carry "a website
--    address provided by the department" with foodborne-illness reporting and registration
--    verification; Colo. Rev. Stat. 25-4-1614(3)(a)(VI) requires the same thing. This is not a
--    seller field — the state hands you the address — so it belongs on the RULE, not on the
--    product or the profile. `regulator_website_url` holds it and the new `regulator_website`
--    element puts it on the label.
--
--    Deliberately, a rule that names the element but has no URL recorded renders as MISSING rather
--    than printing without it. The label genuinely cannot be produced until an admin enters the
--    state's address, and saying so is better than quietly dropping a required item.
--
-- 2. "IF APPLICABLE". AS 17.20.332 wants the producer's business licence number "if applicable".
--    Putting it in `required_elements` stops the label printing for every producer who has none;
--    leaving it out under-labels the ones who do. `optional_elements` renders a value when it
--    exists and never blocks.
--
-- 3. "EITHER/OR". Colo. Rev. Stat. 25-4-1614(3)(a)(II) wants "the producer's current telephone
--    number OR electronic mail address". Requiring both blocks a producer with one;
--    requiring one silently drops the other. `element_alternatives` holds groups where at least one
--    member must be present — missing only when every member of the group is empty.
--
-- What is NOT added, and why. Arizona also requires disclosure where a product "was made in a
-- facility for individuals with developmental disabilities" (36-932(A)(4)). That is conditional on
-- a fact about the seller that nothing in this system models, so an element for it could never be
-- populated and would either block every Arizona label or sit permanently empty. It stays in the
-- rule's notes as a seller responsibility until there is somewhere real to record the fact.

set search_path = public;

-- ---------------------------------------------------------------------------
-- 1. The new vocabulary, applied to both element columns.
-- ---------------------------------------------------------------------------
alter table public.state_label_rules
  drop constraint if exists state_label_rules_elements_known;

alter table public.state_label_rules
  add column if not exists optional_elements text[] not null default '{}',
  add column if not exists element_alternatives jsonb not null default '[]'::jsonb,
  add column if not exists regulator_website_url text;

comment on column public.state_label_rules.optional_elements is
  'Elements printed when a value exists and never blocking when it does not — the "if applicable" '
  'case, e.g. Alaska''s business licence number.';

comment on column public.state_label_rules.element_alternatives is
  'Groups of elements where at least one member is required, as a JSON array of arrays. Colorado '
  'wants a telephone number OR an email address; requiring both would block a producer with one.';

comment on column public.state_label_rules.regulator_website_url is
  'The address a state hands the producer to print, where the state prescribes one (AZ, CO). Paired '
  'with the `regulator_website` element. Null while unrecorded, which makes the label render as '
  'missing rather than printing without a required item.';

alter table public.state_label_rules
  add constraint state_label_rules_elements_known
    check (
      required_elements <@ array[
        'product_name', 'producer_name', 'business_name', 'producer_address', 'producer_phone',
        'producer_email', 'permit_number', 'municipality', 'ingredients_desc_by_weight',
        'net_weight', 'allergens', 'production_date', 'lot_code', 'nutrition_if_claimed',
        'regulator_website'
      ]::text[]
      and optional_elements <@ array[
        'product_name', 'producer_name', 'business_name', 'producer_address', 'producer_phone',
        'producer_email', 'permit_number', 'municipality', 'ingredients_desc_by_weight',
        'net_weight', 'allergens', 'production_date', 'lot_code', 'nutrition_if_claimed',
        'regulator_website'
      ]::text[]
    );

-- An alternatives entry must be an array of arrays of strings, so the renderer can trust its shape.
-- Written as jsonpath rather than the obvious `not exists (select ...)`: a CHECK constraint may not
-- contain a subquery, and `@?` / jsonb_path_exists is immutable, so it is allowed here. The paths
-- are STRICT: lax mode unwraps nested arrays, which is exactly the structure being checked, so a
-- lax path cannot tell `[["a","b"]]` from `["a","b"]`.
alter table public.state_label_rules
  add constraint state_label_rules_alternatives_shape
    check (
      jsonb_typeof(element_alternatives) = 'array'
      and not (element_alternatives @? 'strict $[*] ? (@.type() != "array")')
      and not (element_alternatives @? 'strict $[*][*] ? (@.type() != "string")')
    );

-- ---------------------------------------------------------------------------
-- 2. Put the three states that needed them onto the new machinery.
-- ---------------------------------------------------------------------------

-- Arizona: the department website becomes a real label element rather than a note.
update public.state_label_rules set
  required_elements = array[
    'producer_name', 'permit_number', 'ingredients_desc_by_weight', 'production_date',
    'regulator_website'
  ],
  notes =
    'A.R.S. 36-932(A), read 2026-09-06; disclaimer stored verbatim. (A)(5) requires "a website '
    'address provided by the department" carrying contact information for reporting foodborne '
    'illness and a way to verify the preparer''s active registration — now the `regulator_website` '
    'element, which renders as MISSING until an admin records the address in '
    'regulator_website_url, because the label cannot lawfully print without it. ONE REQUIREMENT '
    'REMAINS INEXPRESSIBLE: (A)(4) obliges disclosure where the product "was made in a facility for '
    'individuals with developmental disabilities", which is conditional on a fact this system does '
    'not model — the seller must add it. Arizona does NOT require ingredients in descending order; '
    '(A)(2) asks only that the label "Lists all the ingredients", so the element used overstates '
    'the duty harmlessly. Ariz. Admin. Code R9-8-110 carries an older form of the disclaimer; the '
    'statute is later and higher authority.'
where program_id in (select id from public.state_food_programs where state_code = 'AZ' and ordinal = 1)
  and verified_at is null;

-- Colorado: department website required, and phone-or-email as a real alternative.
update public.state_label_rules set
  required_elements = array[
    'product_name', 'producer_name', 'permit_number', 'municipality',
    'production_date', 'ingredients_desc_by_weight', 'regulator_website'
  ],
  element_alternatives = '[["producer_phone", "producer_email"]]'::jsonb,
  notes =
    'Colo. Rev. Stat. 25-4-1614(3), read 2026-09-06. The placard and the label carry DIFFERENT '
    'text: (3)(c) requires a placard at the point of sale with the shorter sentence, while the '
    'label disclaimer at (3)(a)(V) additionally names the nine allergens. Do not substitute one for '
    'the other. (3)(a)(II) asks for "the producer''s current telephone number or electronic mail '
    'address" — now an alternatives group, so either satisfies it and neither alone blocks. '
    '(3)(a)(VI) requires "A website address provided by the department", now the '
    '`regulator_website` element, which renders as missing until an admin records the address. '
    'Colorado asks for no street address and no net weight, and (IV) wants "A complete list of '
    'ingredients" without prescribing descending order.'
where program_id in (select id from public.state_food_programs where state_code = 'CO' and ordinal = 1)
  and verified_at is null;

-- Alaska: the business licence number is genuinely optional.
update public.state_label_rules set
  required_elements = array['producer_name', 'producer_address', 'producer_phone'],
  optional_elements = array['permit_number'],
  notes =
    'AS 17.20.332, read 2026-09-06. A packaged item must carry "the producer''s name, current '
    'address, telephone number, and, if applicable, the producer''s business license number" plus '
    'the quoted statement. The business licence number is now an OPTIONAL element: Alaska asks for '
    'it only "if applicable", so it prints for a producer who has one and blocks nobody who does '
    'not. Note the element is named permit_number, which is the closest the vocabulary comes — '
    'Alaska issues no food permit at all, and this is a general business licence. Unpackaged food '
    'is not exempt from the substance: the seller must tell the buyer the same information '
    'verbally. Alaska asks for no net weight and no ingredient list.'
where program_id in (select id from public.state_food_programs where state_code = 'AK' and ordinal = 1)
  and verified_at is null;

-- ---------------------------------------------------------------------------
-- 3. Keep the buyer-facing disclosure in step with the printed label.
-- ---------------------------------------------------------------------------
-- `product_label_disclosure()` feeds the same `renderLabel()` composer, so an element it cannot
-- return is an element that silently vanishes from what the buyer is shown before paying. Three of
-- the four fields below are new vocabulary. The fourth is a plain bug that this pass exposed:
--
--   MUNICIPALITY. Cal. Health & Saf. Code 114365.3(f) requires an internet advertisement to carry
--   "(1) The county of approval. (2) The permit or registration number. (3) A statement that the
--   food prepared is Made in a Home Kitchen" — and California's predisclosure flag was set true in
--   20260906120000. The function never returned a municipality, so the county quietly dropped off
--   the disclosure for every Californian listing. It is not a privacy widening: the city is already
--   inside `producer_address`, which this function has always returned, because the state puts the
--   producer's address on the package.
--
-- The return type gains columns, which `create or replace` cannot do, so the function is dropped
-- and rebuilt. Nothing in SQL depends on it — the only caller is the app.
drop function if exists public.product_label_disclosure(uuid);

create function public.product_label_disclosure(p_product_id uuid)
returns table (
  state_code             char(2),
  product_name           text,
  business_name          text,
  producer_address       text,
  municipality           text,
  permit_number          text,
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
    a.city,
    (select sl.license_number
       from public.seller_licenses sl
       where sl.seller_id = sp.id
         and sl.verification_status = 'verified'
         and sl.license_number is not null
       order by sl.created_at
       limit 1),
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
  'the producer address, town and permit number, which RLS otherwise hides from buyers, because all '
  'three are required on the physical label and are therefore not private.';

revoke all on function public.product_label_disclosure(uuid) from public;
grant execute on function public.product_label_disclosure(uuid) to anon, authenticated, service_role;
