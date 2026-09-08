-- Harvest Local — closing Arkansas and Colorado, both of which were open only because a PDF would
-- not extract.
--
-- The extractor understood Flate content streams whose text was drawn with `(literal) Tj`. Neither
-- of these documents is that shape, so both came back as front matter and both rows were left with
-- a note saying the text had not been read. Reading them with a real PDF parser answered four
-- questions and turned up two errors nobody was looking for.
--
-- =========================================================================
-- 1. ARKANSAS — the substitution, and a pre-sale duty we did not know about
-- =========================================================================
-- Act 1040 of 2021 (SB248), read 2026-09-08 from the enrolled act at webftp.blr.arkansas.gov. It
-- creates Ark. Code § 20-57-501 et seq., and the labelling provision is § 20-57-505:
--
--   (a) The following information shall be provided to the informed end consumer as described in
--       subsection (b) of this section:
--       (1) The date that the homemade food or drink product was manufactured, produced, or
--           processed;
--       (2) THE NAME, ADDRESS, AND TELEPHONE NUMBER of the producer of the homemade food or drink
--           product, OR AN IDENTIFICATION NUMBER provided by the Department of Agriculture IF
--           REQUESTED BY THE PRODUCER TO PROTECT THE PRODUCER'S SAFETY;
--       (3) The common or usual name of the homemade food or drink product;
--       (4) The ingredients of the homemade food or drink product in descending order of
--           predominance; and
--       (5) The following statement: "This product was produced in a private residence that is
--           exempt from state licensing and inspection. This product may contain allergens."
--
--   (b) The information required under subsection (a) of this section shall be provided on:
--       (1) A label affixed to the [package or container] ...;
--       (2) A placard displayed at the point of sale ...; or
--       (3) THE WEBSITE ON WHICH THE HOMEMADE FOOD OR DRINK PRODUCT IS OFFERED FOR SALE IF THE
--           PRODUCT IS OFFERED FOR SALE ONLINE.
--
-- THE SUBSTITUTION IS CONFIRMED AND IS A SINGLE ITEM. (a)(2) is one paragraph: the name, address and
-- telephone number, "or an identification number". The number replaces all three, exactly as
-- 20260908100000 built the mechanism for and deliberately did not apply here without the text.
--
-- ARKANSAS IS ALSO A PREDISCLOSURE STATE AND WE HAD IT AS FALSE. (b)(3) names the listing page in
-- the same words Oklahoma and Tennessee use, and it carries the WHOLE of (a) — so
-- predisclosure_elements stays null. That was not visible from the compilation this row was on;
-- `predisclosure_required = false` means "nobody has checked", and this is what checking found.
--
-- The three two-member alternatives groups go: they said "at least one of these" and printed every
-- value the seller had, which published the home address of a producer who asked the Department for
-- a number to protect their physical safety. The name, address and telephone number become plain
-- requirements from (a)(2) and the number lifts all three.
--
-- The disclaimer already matched (a)(5) verbatim and is unchanged.
--
-- =========================================================================
-- 2. COLORADO — the element was justified, the VALUE was wrong, and so was the disclaimer
-- =========================================================================
-- 20260907250000 left `municipality` in place on the reasoning that (3)(a)(I) and (III) were
-- unaccounted for and a locality might be in one of them. Reading Colo. Rev. Stat. 25-4-1614(3)(a)
-- in the 2024 code volume at leg.colorado.gov settles it:
--
--   (I)   Identification of the product;
--   (II)  The producer's name, THE ADDRESS AT WHICH THE FOOD WAS PREPARED, and the producer's
--         current telephone number or electronic mail address;
--   (III) The date on which the food was produced;
--   (IV)  A complete list of ingredients; and
--   (V)   The following disclaimer: ...
--
-- So there IS a locality limb, in (II) — and it is not a town. Leaving the element in was right;
-- what it resolved to never was.
--
-- THEN HOUSE BILL 26-1033 CHANGED IT. The "Tamale Act", signed 2026-06-04 and in force, amends
-- (3)(a)(II) to read (capitals are the bill's own marking of new text, struck words are removed):
--
--   (II) The producer's name, DEPARTMENT-ISSUED REGISTRATION NUMBER, the [address at] COUNTY IN
--        which the food was prepared, and the producer's current telephone number or electronic
--        mail address;
--
-- and adds (VI), the department website address this row already carries. Two consequences:
--
--   * THE LOCALITY IS NOW A COUNTY — "the county in which the food was prepared". That is a fact
--     about the producer's kitchen, and it is NOT California's county_of_approval, which is the
--     county of the agency that issued a registration. Different question, different column, so a
--     new element rather than a reuse: `county_of_preparation`, on the seller profile.
--   * A DEPARTMENT-ISSUED REGISTRATION NUMBER IS NOW REQUIRED, and this row asked for it as
--     `permit_number`. That element resolves only from an admin-verified `seller_licenses` row, and
--     a Colorado cottage food producer registers with the department rather than holding a licence
--     we review — so the limb could never be satisfied and every Colorado label was unprintable.
--     The identical fault was found in Texas in 20260907100000. It becomes `producer_id_number`.
--
-- THE DISCLAIMER WAS MISQUOTED, which is the more serious of the two. We stored:
--
--     "... and that may also CONTAIN COMMON FOOD ALLERGIES such as tree nuts ..."
--
-- and (3)(a)(V) says:
--
--     "... and that may also PROCESS COMMON FOOD ALLERGENS such as tree nuts ..."
--
-- `disclaimer_text` is quoted law printed onto food without review. "Contain common food allergies"
-- is not a paraphrase of "process common food allergens"; it is a different claim and not an English
-- one. The placard at (3)(c) was already exact and is unchanged.

set search_path = public;

-- ---------------------------------------------------------------------------
-- The county a producer's kitchen is in.
-- ---------------------------------------------------------------------------
-- On the profile, not the licence: Colorado wants where the food WAS PREPARED, which is a fact about
-- the seller. California's county_of_approval is a fact about a registration and lives on the
-- licence beside the number it is stated with. Plain text and printed verbatim, like
-- mailing_address and contact_phone — a label field must not drag in a geocoder.
alter table public.seller_profiles
  add column if not exists preparation_county text;

alter table public.seller_profiles
  drop constraint if exists seller_profiles_preparation_county_len;
alter table public.seller_profiles
  add constraint seller_profiles_preparation_county_len
    check (preparation_county is null or char_length(btrim(preparation_county)) between 1 and 120);

comment on column public.seller_profiles.preparation_county is
  'The county in which the seller prepares their food. Colo. Rev. Stat. 25-4-1614(3)(a)(II), as '
  'amended by HB26-1033 (signed 2026-06-04), requires "the county in which the food was prepared" '
  'on the label, replacing the address that subparagraph asked for before. NOT the same fact as '
  'seller_licenses.issuing_county, which is California''s county of approval — the county of the '
  'agency that issued a registration.';

-- ---------------------------------------------------------------------------
-- Vocabulary.
-- ---------------------------------------------------------------------------
alter table public.state_label_rules
  drop constraint if exists state_label_rules_elements_known;

alter table public.state_label_rules
  add constraint state_label_rules_elements_known
    check (
      required_elements <@ array[
        'product_name', 'producer_name', 'business_name', 'producer_address', 'mailing_address',
        'producer_phone', 'producer_email', 'producer_id_number', 'permit_number', 'municipality',
        'municipality_state', 'county_of_approval', 'county_of_preparation',
        'ingredients_desc_by_weight', 'net_weight', 'allergens', 'production_date', 'lot_code',
        'expiration_date', 'handling_instructions', 'nutrition_if_claimed', 'regulator_website',
        'seller_statement'
      ]::text[]
      and optional_elements <@ array[
        'product_name', 'producer_name', 'business_name', 'producer_address', 'mailing_address',
        'producer_phone', 'producer_email', 'producer_id_number', 'permit_number', 'municipality',
        'municipality_state', 'county_of_approval', 'county_of_preparation',
        'ingredients_desc_by_weight', 'net_weight', 'allergens', 'production_date', 'lot_code',
        'expiration_date', 'handling_instructions', 'nutrition_if_claimed', 'regulator_website',
        'seller_statement'
      ]::text[]
      and (
        predisclosure_elements is null
        or predisclosure_elements <@ array[
          'product_name', 'producer_name', 'business_name', 'producer_address', 'mailing_address',
          'producer_phone', 'producer_email', 'producer_id_number', 'permit_number', 'municipality',
          'municipality_state', 'county_of_approval', 'county_of_preparation',
          'ingredients_desc_by_weight', 'net_weight', 'allergens', 'production_date', 'lot_code',
          'expiration_date', 'handling_instructions', 'nutrition_if_claimed', 'regulator_website',
          'seller_statement'
        ]::text[]
      )
    );

-- ---------------------------------------------------------------------------
-- Arkansas.
-- ---------------------------------------------------------------------------
update public.state_label_rules set
  required_elements = array[
    'production_date', 'producer_name', 'producer_address', 'producer_phone', 'product_name',
    'ingredients_desc_by_weight'
  ],
  element_alternatives = '[]'::jsonb,
  element_substitutions =
    '[{"substitute": "producer_id_number",
       "replaces": ["producer_name", "producer_address", "producer_phone"]}]'::jsonb,
  predisclosure_required = true,
  source_url = 'https://webftp.blr.arkansas.gov/Home/FTPDocument?path=ACTS/2021R/Public/Searchable/ACT1040.pdf',
  source_etag = null,
  source_last_modified = null,
  source_content_hash = null,
  source_signal = null,
  source_fetched_at = null,
  source_changed_at = null,
  notes = notes ||
    ' CLOSED (20260908110000): Act 1040 of 2021 (SB248) was read from the enrolled act at '
    'webftp.blr.arkansas.gov on 2026-09-08, once the PDF extractor could handle it. The provision '
    'is Ark. Code § 20-57-505, created by the act. (a)(2) is ONE paragraph — "The name, address, '
    'and telephone number of the producer ... or an identification number provided by the '
    'Department of Agriculture if requested by the producer to protect the producer''s safety" — so '
    'the number replaces all three, and the three two-member alternatives groups that could not say '
    'so are replaced by an element_substitutions entry. Those groups meant "at least one of these" '
    'and printed every value the seller had, which published the home address of a producer who '
    'asked the Department for a number to protect their physical safety. '
    'PREDISCLOSURE WAS FALSE AND IS NOW TRUE: (b)(3) requires the (a) information on "the website '
    'on which the homemade food or drink product is offered for sale if the product is offered for '
    'sale online", which names the listing page in the same words Oklahoma and Tennessee use. It '
    'carries the whole of (a), so predisclosure_elements stays null. The disclaimer already matched '
    '(a)(5) verbatim. Source moved off codes.findlaw.com onto the state''s own copy of the act.'
where program_id in (select id from public.state_food_programs where state_code = 'AR' and ordinal = 1)
  and notes not like '%20260908110000%';

-- ---------------------------------------------------------------------------
-- Colorado.
-- ---------------------------------------------------------------------------
update public.state_label_rules set
  required_elements = array[
    'product_name', 'producer_name', 'producer_id_number', 'county_of_preparation',
    'production_date', 'ingredients_desc_by_weight', 'regulator_website'
  ],
  disclaimer_text =
    'This product was produced in a home kitchen that is not subject to state licensure or '
    'inspection and that may also process common food allergens such as tree nuts, peanuts, eggs, '
    'soy, wheat, milk, fish, and crustacean shellfish. This product is not intended for resale.',
  source_url = 'https://leg.colorado.gov/bill_files/116492/download',
  source_etag = null,
  source_last_modified = null,
  source_content_hash = null,
  source_signal = null,
  source_fetched_at = null,
  source_changed_at = null,
  notes = notes ||
    ' CLOSED (20260908110000): 25-4-1614(3)(a) was read in the 2024 code volume at leg.colorado.gov '
    'and against HB26-1033, the "Tamale Act", signed 2026-06-04 and in force. '
    'THE LOCALITY LIMB EXISTS, IN (3)(a)(II), so leaving the element in place was right — and what '
    'it resolved to never was. The codified text asks for "the address at which the food was '
    'prepared"; HB26-1033 amends it to "the county in which the food was prepared" and adds a '
    'DEPARTMENT-ISSUED REGISTRATION NUMBER to the same subparagraph. Our municipality element '
    'resolved to the seller''s pickup-address TOWN, which was neither. It is now '
    'county_of_preparation, from seller_profiles.preparation_county — deliberately NOT California''s '
    'county_of_approval, which is the county of the agency that issued a registration rather than '
    'the county the food was made in. '
    'permit_number BECOMES producer_id_number: (3)(a)(II) as amended wants the department-issued '
    'registration number, and permit_number resolves only from an admin-verified seller_licenses '
    'row. A Colorado producer registers with the department and holds no licence we review, so that '
    'limb could never be satisfied and every Colorado label was unprintable — the same fault found '
    'in Texas in 20260907100000. '
    'THE DISCLAIMER WAS MISQUOTED and is corrected. We stored "may also contain common food '
    'allergies"; (3)(a)(V) says "may also PROCESS common food ALLERGENS". disclaimer_text is quoted '
    'law printed onto food without review, and that was a different claim rather than a tidier '
    'wording. The (3)(c) placard was already exact and is unchanged. Source moved off '
    'codes.findlaw.com onto the enrolled act.'
where program_id in (select id from public.state_food_programs where state_code = 'CO' and ordinal = 1)
  and notes not like '%20260908110000%';

-- ---------------------------------------------------------------------------
-- The disclosure function: return the county of preparation.
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
  county_of_preparation  text,
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
  with base as (
    select
      p.id as product_id,
      sp.id as seller_id,
      sp.home_state,
      sp.business_name,
      sp.mailing_address,
      sp.contact_phone,
      sp.producer_id_number,
      sp.preparation_county,
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
      coalesce(lr.predisclosure_elements, lr.required_elements, '{}'::text[]) as req,
      case when lr.predisclosure_elements is not null then '{}'::text[]
           else coalesce(lr.optional_elements, '{}'::text[]) end as opt,
      case when lr.predisclosure_elements is not null then '[]'::jsonb
           else coalesce(lr.element_alternatives, '[]'::jsonb) end as alts,
      coalesce(lr.element_substitutions, '[]'::jsonb) as subs,
      lr.regulator_website_url,
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
  live as (
    select s->>'substitute' as substitute, r.value as replaced
    from base,
         jsonb_array_elements(base.subs) s,
         jsonb_array_elements_text(s->'replaces') r
    where case s->>'substitute'
            when 'producer_id_number'
              then nullif(btrim(coalesce(base.producer_id_number, '')), '') is not null
            else false
          end
  ),
  resolved as (
    select
      base.*,
      (select coalesce(array_agg(el order by ord), '{}'::text[])
         from (
           select distinct on (el) el, ord
             from (
               select coalesce(l.substitute, x.el) as el, x.ord as ord
                 from unnest(base.req) with ordinality x(el, ord)
                 left join live l on l.replaced = x.el
             ) mapped
            order by el, ord
         ) deduped
      ) as req_resolved,
      (select coalesce(array_agg(e), '{}'::text[])
         from unnest(base.opt) e
        where e not in (select replaced from live)
      ) as opt_resolved,
      (select coalesce(array_agg(replaced), '{}'::text[]) from live) as replaced_all
    from base
  ),
  asks as (
    select
      resolved.*,
      (select array_agg(e)
         from (
           select unnest(resolved.req_resolved) as e
           union all
           select unnest(resolved.opt_resolved)
           union all
           select jsonb_array_elements_text(g)
             from jsonb_array_elements(resolved.alts) g
         ) named
        where e <> all(resolved.replaced_all)
      ) as named_elements
    from resolved
  ),
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
    case
      when asks.address_withheld or asks.address_id is null then null
      when not ('producer_address' = any(coalesce(asks.named_elements, '{}'::text[]))) then null
      else concat_ws(', ', concat_ws(' ', asks.line1, nullif(asks.line2, '')), asks.city,
                     concat_ws(' ', asks.state, asks.postal_code))
    end,
    case when 'mailing_address' = any(coalesce(asks.named_elements, '{}'::text[]))
         then asks.mailing_address else null end,
    case
      when asks.address_withheld then null
      when not (coalesce(asks.named_elements, '{}'::text[]) && array['municipality', 'municipality_state']) then null
      else asks.city
    end,
    -- California: the county of the agency that issued the registration, off the licence.
    case when 'county_of_approval' = any(coalesce(asks.named_elements, '{}'::text[]))
         then (select licence.issuing_county from licence) else null end,
    -- Colorado: the county the food was made in, off the profile. A different question.
    case when 'county_of_preparation' = any(coalesce(asks.named_elements, '{}'::text[]))
         then asks.preparation_county else null end,
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
    asks.req_resolved,
    asks.opt_resolved,
    asks.alts,
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
  'What a buyer must be shown before paying, where the state requires it. Resolves '
  'predisclosure_elements then element_substitutions, and returns each identifying column only '
  'where the resolved set names it. TWO DIFFERENT COUNTIES: county_of_approval is the county of the '
  'agency that issued a registration (Cal. Health & Saf. Code 114365.3(e)(4)) and comes off the '
  'licence; county_of_preparation is the county the food was made in (Colo. Rev. Stat. '
  '25-4-1614(3)(a)(II) as amended by HB26-1033) and comes off the profile.';

revoke all on function public.product_label_disclosure(uuid) from public;
grant execute on function public.product_label_disclosure(uuid) to anon, authenticated, service_role;
