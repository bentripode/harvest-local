-- Harvest Local — California asked for the county of approval and we printed the seller's town.
--
-- 20260907240000 narrowed the Californian pre-sale disclosure to the three items § 114365.3(f)
-- names, and recorded that one of them was the wrong value. This supplies the right one.
--
-- Cal. Health & Saf. Code § 114365.3, read 2026-09-07 at leginfo (chapter 11.5):
--
--   (e) ... the label shall include ... (4) The registration or permit number of the "Class A" or
--       "Class B" cottage food operation, respectively, which produced the cottage food product AND
--       THE NAME OF THE COUNTY OF THE LOCAL ENFORCEMENT AGENCY that issued the permit or
--       registration number.
--
--   (f) A cottage food operation that advertises to the public, including through an internet
--       website, social media platform, newspaper, newsletter, or other public announcement, shall
--       indicate the following on the advertisement: (1) THE COUNTY OF APPROVAL. (2) The permit or
--       registration number. (3) A statement that the food prepared is "Made in a Home Kitchen" ...
--
-- =========================================================================
-- WHY `municipality` COULD NEVER BE IT
-- =========================================================================
-- `municipality` resolves to the seller's PICKUP ADDRESS CITY and is captioned "Town or
-- municipality". Three things are wrong with that as an answer to (f)(1):
--
--   1. A town is not a county.
--   2. It is the wrong FACT. The county of approval is a property of the REGISTRATION — the county
--      whose local enforcement agency issued it — not of where the producer happens to live.
--   3. THE TWO ROUTINELY DIFFER, by design. § 114365(a)(4): "A registration or permit from one
--      county shall be sufficient for a cottage food operation to operate throughout the state." So
--      a producer may register in one county and live in a town of another, and California
--      deliberately permits it. The town was not an approximation of the county; it was a different
--      fact that happens to be a place name.
--
-- A buyer reading a false county of approval cannot check the registration against the right
-- agency, which is the entire point of (f)(1).
--
-- =========================================================================
-- WHERE IT LIVES
-- =========================================================================
-- On `seller_licenses`, beside the number, and NOT on the seller profile. (e)(4) states the two as
-- one item — "the registration or permit number ... and the name of the county of the local
-- enforcement agency that issued" it — so they must be read from the SAME row. A seller with two
-- registrations who had a single profile-level county could print one registration's number beside
-- another's county, which is a worse label than an incomplete one.
--
-- Nullable, and null for every row that exists today: nobody has been asked for it yet. That is the
-- correct outcome rather than a backfill — `renderLabel` reports the element missing with
-- `fix: "licence"`, `DisclosureGapNotice` names it, and the publish gate holds a Californian food
-- listing until the seller supplies it. California is a predisclosure state, so the listing IS the
-- advertisement (f) governs, and going live without the county is the violation this prevents.
--
-- THIS DOES NOT WIDEN WHAT A BUYER SEES. The county replaces the town in the same slot; it does not
-- add a field. And it is not personal data in the way the town was — a county of approval names a
-- government agency, not where somebody's kitchen is.
--
-- =========================================================================
-- ONLY CALIFORNIA
-- =========================================================================
-- Six rules use `municipality` or `municipality_state`, and the other four are right as they stand:
--
--   DE  16 Del. Admin. Code 4458A 8.2.1 asks for "town/city, Delaware" — the town, expressly.
--   NJ  the municipality "in which the cottage food operator prepares the cottage food product",
--       followed by "New Jersey" or "NJ" — the town, expressly, and tied to where they prepare.
--   IL  410 ILCS 625/4(b)(7)(A) wants "the unit of local government in which the cottage food
--       operation is located" — the town. See the note added to that row below: (B) separately
--       wants the municipality or county in which the REGISTRATION was filed, which is a second
--       locality this schema still does not express.
--   CO  no locality appears anywhere in this row's recorded reading of 25-4-1614(3), and its source
--       is a compilation rather than the statute. Flagged in that row's notes for a reader; NOT
--       changed here, because removing a required element on the strength of an absence in our own
--       summary is the mistake this project keeps finding in the other direction.
--
-- =========================================================================
-- AND A REGRESSION FROM 20260907240000, FIXED HERE
-- =========================================================================
-- That migration started gating the `municipality` column on the resolved element set, written as
--
--     when not ('municipality' = any(named_elements)) then null
--
-- which is wrong for the two states that ask for the town as part of a longer phrase. DE and NJ name
-- `municipality_state`, not `municipality`, and `municipality_state` renders from the SAME source
-- value — so the gate blanked it and the element reported itself missing for a seller who had in
-- fact supplied a pickup address. Neither state is a predisclosure jurisdiction, so no buyer was
-- shown anything wrong and the printed label was untouched (`getLabelContext` reads the profile
-- directly); the damage was a spurious gap in `DisclosureGapNotice` telling a Delaware seller to fix
-- a field that was already filled in. The gate is now an overlap against both names.

set search_path = public;

-- ---------------------------------------------------------------------------
-- 1. The column.
-- ---------------------------------------------------------------------------
alter table public.seller_licenses
  add column if not exists issuing_county text;

alter table public.seller_licenses
  drop constraint if exists seller_licenses_issuing_county_len;
alter table public.seller_licenses
  add constraint seller_licenses_issuing_county_len
    check (issuing_county is null or char_length(btrim(issuing_county)) between 1 and 120);

comment on column public.seller_licenses.issuing_county is
  'The county whose local enforcement agency issued this registration — Cal. Health & Saf. Code '
  '114365.3(e)(4) pairs it with the number as a single label item, and (f)(1) requires "the county '
  'of approval" in internet advertising. Deliberately on the licence and not the profile: a '
  'California registration is valid statewide (114365(a)(4)), so the issuing county is a property '
  'of the registration rather than of the seller, and a profile-level column could pair one '
  'registration''s number with another''s county.';

-- ---------------------------------------------------------------------------
-- 2. The element vocabulary.
-- ---------------------------------------------------------------------------
-- Extended to cover `predisclosure_elements` as well, which 20260907240000 added without bringing
-- it under the constraint — a typo there would silently drop an element from a pre-sale disclosure.
alter table public.state_label_rules
  drop constraint if exists state_label_rules_elements_known;

alter table public.state_label_rules
  add constraint state_label_rules_elements_known
    check (
      required_elements <@ array[
        'product_name', 'producer_name', 'business_name', 'producer_address', 'mailing_address',
        'producer_phone', 'producer_email', 'producer_id_number', 'permit_number', 'municipality',
        'municipality_state', 'county_of_approval', 'ingredients_desc_by_weight', 'net_weight',
        'allergens', 'production_date', 'lot_code', 'expiration_date', 'handling_instructions',
        'nutrition_if_claimed', 'regulator_website', 'seller_statement'
      ]::text[]
      and optional_elements <@ array[
        'product_name', 'producer_name', 'business_name', 'producer_address', 'mailing_address',
        'producer_phone', 'producer_email', 'producer_id_number', 'permit_number', 'municipality',
        'municipality_state', 'county_of_approval', 'ingredients_desc_by_weight', 'net_weight',
        'allergens', 'production_date', 'lot_code', 'expiration_date', 'handling_instructions',
        'nutrition_if_claimed', 'regulator_website', 'seller_statement'
      ]::text[]
      and (
        predisclosure_elements is null
        or predisclosure_elements <@ array[
          'product_name', 'producer_name', 'business_name', 'producer_address', 'mailing_address',
          'producer_phone', 'producer_email', 'producer_id_number', 'permit_number', 'municipality',
          'municipality_state', 'county_of_approval', 'ingredients_desc_by_weight', 'net_weight',
          'allergens', 'production_date', 'lot_code', 'expiration_date', 'handling_instructions',
          'nutrition_if_claimed', 'regulator_website', 'seller_statement'
        ]::text[]
      )
    );

-- ---------------------------------------------------------------------------
-- 3. California: the county of approval, on the label and on the advertisement.
-- ---------------------------------------------------------------------------
update public.state_label_rules set
  required_elements = array_replace(required_elements, 'municipality', 'county_of_approval'),
  predisclosure_elements = array_replace(predisclosure_elements, 'municipality', 'county_of_approval'),
  notes = notes ||
    ' COUNTY OF APPROVAL (20260907250000): the defect recorded in 20260907240000 is fixed. '
    '§ 114365.3(e)(4) requires the number "and the name of the county of the local enforcement '
    'agency that issued" it, and (f)(1) "The county of approval" — a property of the REGISTRATION, '
    'not of where the seller lives. Our municipality element resolved to the pickup-address town, '
    'and § 114365(a)(4) makes the two routinely different by design: "A registration or permit from '
    'one county shall be sufficient for a cottage food operation to operate throughout the state." '
    'It now reads seller_licenses.issuing_county off the same verified row the permit number comes '
    'from, because (e)(4) states the two as one item. Null on every existing row — no backfill, '
    'because nobody has been asked for it — so a Californian food listing is held until the seller '
    'supplies it, which is what (f) requires of an advertisement.'
where program_id in (select id from public.state_food_programs where state_code = 'CA' and ordinal in (1, 2))
  and notes not like '%20260907250000%';

-- ---------------------------------------------------------------------------
-- 4. Illinois and Colorado: recorded, not changed.
-- ---------------------------------------------------------------------------
update public.state_label_rules set
  notes = notes ||
    ' SECOND LOCALITY STILL UNEXPRESSED (20260907250000): 625/4(b)(7) names TWO different places and '
    'this row has one element for them. (A) is "the name of the cottage food operation and unit of '
    'local government in which the cottage food operation is LOCATED", which our municipality '
    'element satisfies from the pickup address. (B) is "the identifying registration number ... and '
    'the name of the municipality or county in which the REGISTRATION WAS FILED", which is a '
    'different fact and is not rendered at all. Illinois''s pre-sale duty is only the (b)(10) '
    'notice, so no listing is affected; the printed label is short of (B). The county_of_approval '
    'element added here is the California shape and does not fit — Illinois accepts a municipality '
    'OR a county — so expressing it needs its own element rather than a reuse.'
where program_id in (select id from public.state_food_programs where state_code = 'IL' and ordinal = 1)
  and notes not like '%20260907250000%';

update public.state_label_rules set
  notes = notes ||
    ' MUNICIPALITY ELEMENT UNSOURCED (20260907250000): this row requires `municipality` and the '
    'recorded reading of Colo. Rev. Stat. 25-4-1614(3) does not say where it came from. WHAT IS '
    'ACCOUNTED FOR: (3)(a)(II) the telephone number or email, (IV) the ingredient list, (V) the '
    'label disclaimer, (VI) the department website address. (3)(a)(I) and (III) ARE NOT, and the '
    'locality — if the statute asks for one at all — would be in one of them. So the element is '
    'plausible and unverified, not baseless. THE SOURCE IS ALSO A COMPILATION (codes.findlaw.com) '
    'rather than the statute. Attempts to reach primary text on 2026-09-07 failed twice: the 7.4MB '
    'CRS title 25 PDF at leg.colorado.gov and the HB26-1033 bill PDF both use an encoding our '
    'extractor returns nothing from. That bill is worth knowing about regardless — it amends '
    '(3)(a)(II) and (3)(a)(IV) and ADDS (3)(a)(VI), which is the website element this row already '
    'carries, so the row reflects the amended text. THE ELEMENT IS LEFT IN PLACE: dropping a '
    'required one because our own summary is silent is the failure mode this project keeps hitting '
    'in the other direction, and a Colorado label short of a required item is worse than one '
    'carrying a town it did not need. An admin should read (3)(a)(I) and (III) and either cite the '
    'locality limb or remove the element.'
where program_id in (select id from public.state_food_programs where state_code = 'CO' and ordinal = 1)
  and notes not like '%20260907250000%';

-- ---------------------------------------------------------------------------
-- 5. The disclosure function: return the county, from the same row as the number.
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
  county_of_approval     text,
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
  predisclosure_required boolean,
  address_withheld       boolean
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
      -- The pre-sale set where the state named one, the whole label where it did not.
      coalesce(lr.predisclosure_elements, lr.required_elements) as required_elements,
      case when lr.predisclosure_elements is not null then '{}'::text[]
           else lr.optional_elements end as optional_elements,
      case when lr.predisclosure_elements is not null then '[]'::jsonb
           else lr.element_alternatives end as element_alternatives,
      lr.regulator_website_url,
      -- Illinois prescribes a shorter sentence for the online interface than for the package.
      coalesce(lr.predisclosure_disclaimer_text, lr.disclaimer_text) as disclaimer_text,
      lr.disclaimer_min_pt,
      lr.disclaimer_all_caps,
      lr.metric_required,
      lr.predisclosure_required,
      coalesce(lr.address_withheld_until_payment, false) as address_withheld
    from public.products p
    join public.seller_profiles sp on sp.id = p.seller_id
    join public.profiles pr on pr.id = sp.profile_id
    left join public.addresses a on a.id = sp.pickup_address_id
    left join public.state_food_programs fp
      on fp.id = coalesce(
           sp.food_program_id,
           (select fp2.id from public.state_food_programs fp2
             where fp2.state_code = sp.home_state order by fp2.ordinal limit 1)
         )
    left join public.state_label_rules lr on lr.program_id = fp.id
    where p.id = p_product_id
      and p.status in ('active', 'sold_out')
  ),
  asks as (
    select
      rule.*,
      (select array_agg(e) from (
         select unnest(coalesce(rule.required_elements, '{}'::text[])) as e
         union all
         select unnest(coalesce(rule.optional_elements, '{}'::text[]))
         union all
         select jsonb_array_elements_text(g)
         from jsonb_array_elements(coalesce(rule.element_alternatives, '[]'::jsonb)) g
       ) named) as named_elements
    from rule
  ),
  -- ONE registration, read once. 114365.3(e)(4) states the number and the county as a single item,
  -- so taking them from separate subqueries could pair one registration's number with another's
  -- county — a label that looks complete and points a buyer at the wrong enforcement agency.
  licence as (
    select sl.license_number, sl.issuing_county
    from public.seller_licenses sl, asks
    where sl.seller_id = asks.seller_id
      and sl.verification_status = 'verified'
      and sl.license_number is not null
    order by sl.created_at
    limit 1
  )
  select
    asks.home_state,
    asks.title,
    asks.business_name,
    -- Withheld where the state says it need not be shown before payment (TX 437.0194(c)(1)), and
    -- otherwise returned only where the pre-sale rule names it.
    case
      when asks.address_withheld or asks.address_id is null then null
      when not ('producer_address' = any(coalesce(asks.named_elements, '{}'::text[]))) then null
      else concat_ws(', ', concat_ws(' ', asks.line1, nullif(asks.line2, '')), asks.city,
                     concat_ws(' ', asks.state, asks.postal_code))
    end,
    case when 'mailing_address' = any(coalesce(asks.named_elements, '{}'::text[]))
         then asks.mailing_address else null end,
    -- The town, for the states that want the town: DE ("town/city, Delaware"), NJ (where the
    -- operator prepares), IL (the unit of local government where the operation is located).
    case
      when asks.address_withheld then null
      when not (coalesce(asks.named_elements, '{}'::text[]) && array['municipality', 'municipality_state']) then null
      else asks.city
    end,
    -- The county that ISSUED the registration. Never the seller's town: a California registration
    -- is valid statewide (114365(a)(4)), so the two are routinely different places.
    case when 'county_of_approval' = any(coalesce(asks.named_elements, '{}'::text[]))
         then (select licence.issuing_county from licence) else null end,
    case when 'producer_phone' = any(coalesce(asks.named_elements, '{}'::text[]))
         then asks.contact_phone else null end,
    case when 'producer_email' = any(coalesce(asks.named_elements, '{}'::text[]))
         then (select au.email from auth.users au where au.id = asks.profile_id) else null end,
    case when 'producer_id_number' = any(coalesce(asks.named_elements, '{}'::text[]))
         then asks.producer_id_number else null end,
    case when 'permit_number' = any(coalesce(asks.named_elements, '{}'::text[]))
         then (select licence.license_number from licence) else null end,
    case when 'seller_statement' = any(coalesce(asks.named_elements, '{}'::text[]))
         then asks.homemade_food_statement else null end,
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
    coalesce(asks.predisclosure_required, false),
    asks.address_withheld
  from asks;
$$;

comment on function public.product_label_disclosure(uuid) is
  'What a buyer must be shown before paying, where the state requires it — which is NOT always the '
  'physical label. Resolves state_label_rules.predisclosure_elements where the state named a '
  'narrower pre-sale set and the full label where it did not, and returns every identifying field '
  'only where that resolved set names it. The permit number and the county of approval come from '
  'ONE verified licence row, because Cal. Health & Saf. Code 114365.3(e)(4) states them as a single '
  'item. The address is withheld entirely where the state permits it to wait until after payment '
  '(Tex. Health & Safety Code 437.0194(c)).';

revoke all on function public.product_label_disclosure(uuid) from public;
grant execute on function public.product_label_disclosure(uuid) to anon, authenticated, service_role;
