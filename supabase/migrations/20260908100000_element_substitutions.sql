-- Harvest Local — a registration number that replaces three elements, which "at least one of these"
-- cannot express.
--
-- Okla. Stat. tit. 2 § 5-4.3(C), read 2026-09-07:
--
--   A homemade food product producer may obtain a registration number upon the payment of an annual
--   fee of Fifteen Dollars ($15.00) to the Oklahoma Department of Agriculture, Food, and Forestry
--   that is good for one (1) year from the date of its issue. THE ASSIGNED REGISTRATION NUMBER MAY
--   BE USED ON PRODUCT LABELS INSTEAD OF THE PRODUCER'S NAME, PHONE NUMBER, AND THE PHYSICAL ADDRESS
--   of the location where the homemade food product was produced.
--
-- An Oklahoman pays $15 a year for exactly one thing: to keep their name, telephone number and home
-- address off the label. We took the money's worth away — § 5-4.3(B)(4) puts the (A)(6) information
-- on the webpage the product is offered from, so the address went onto the listing regardless.
--
-- =========================================================================
-- WHY element_alternatives COULD NOT DO IT
-- =========================================================================
-- An alternatives group means "at least one of these": it is missing only when EVERY member is
-- empty, and every member the seller does have is printed, on the reasoning that "the state asked
-- for one, more is not a defect".
--
-- That reasoning is exactly wrong for a substitution. Here the state asked for one INSTEAD OF the
-- others, and printing the others anyway defeats the only purpose the number has. Arkansas makes it
-- starkest — its number is issued "if requested by the producer to protect the producer's safety" —
-- but the shape is the same in all four states that offer one.
--
-- So `element_substitutions` is a different relation, not a variant of the same one:
--
--     [{"substitute": "producer_id_number",
--       "replaces": ["producer_name", "producer_phone", "producer_address"]}]
--
--   * when the seller HAS the substitute, the replaced elements are neither required nor printed,
--     and the substitute is printed where the first of them would have been;
--   * when the seller does NOT, nothing changes and the replaced elements are required as usual.
--
-- =========================================================================
-- WHICH STATES, AND WHY THESE THREE
-- =========================================================================
-- Every conversion below rests on text read in full on 2026-09-07 or 2026-09-08.
--
--   OK  § 5-4.3(C), quoted above. Three-for-one. `required_elements` is unchanged; the substitution
--       does the work.
--
--   TX  § 437.0193(b-1), read at tcss.legis.texas.gov: "Notwithstanding Subsection (b)(1), a cottage
--       food production operation IS NOT REQUIRED TO INCLUDE on a food label the address of the
--       operation IF the operation registers with the department ... and includes on the label a
--       unique identification number provided by the department." One-for-one, and phrased as an
--       excusal rather than a choice.
--
--   OR  ORS 616.718(6)(b), read at oregonlegislature.gov: "(A) The name and phone number for the
--       food establishment; (B) THE ADDRESS of the food establishment OR THE UNIQUE IDENTIFICATION
--       NUMBER for the food establishment provided under subsection (7) of this section". One-for-
--       one, and the name and phone are required separately — so unlike Oklahoma and Arkansas, an
--       Oregon number replaces the address alone.
--
-- TX and OR also need `producer_address` moved INTO `required_elements`. It was only ever a member
-- of the alternatives group, which is why the group could not simply be deleted: the address is
-- required by 437.0193(b)(1) and 616.718(6)(b)(B), and the substitution is what lifts it.
--
-- =========================================================================
-- ARKANSAS IS THE ONE ROW LEFT, AND IT IS NOT CONVERTED HERE
-- =========================================================================
-- Its rule already carries the note "a producer may substitute a department-issued identification
-- number for their name, address and phone, WHICH THIS ROW CANNOT EXPRESS — a seller relying on it
-- should not use the generated label as-is." The mechanism it wanted now exists.
--
-- It is not converted because the Arkansas text could not be read today. Act 1040 of 2021 (SB248)
-- fetches successfully as a PDF from both webftp.blr.arkansas.gov and arkleg.state.ar.us, and both
-- yield nothing but front matter through our extractor — the same encoding that defeated the
-- Colorado statutes. Converting it on the strength of our own summary is the failure this project
-- keeps correcting, and Arkansas is the state where getting it wrong matters most, because the
-- number exists for the producer's physical safety rather than their privacy. Its three
-- two-member alternatives groups stay as they are: they never block, and they publish more than the
-- statute requires, which is the lesser of the two errors while the text is unread.

set search_path = public;

-- ---------------------------------------------------------------------------
-- 1. The column.
-- ---------------------------------------------------------------------------
alter table public.state_label_rules
  add column if not exists element_substitutions jsonb not null default '[]'::jsonb;

comment on column public.state_label_rules.element_substitutions is
  'Where the state lets ONE value stand in for others: [{"substitute": "producer_id_number", '
  '"replaces": ["producer_name", "producer_phone", "producer_address"]}]. Distinct from '
  'element_alternatives, which means "at least one of these" and prints every member the seller '
  'has — correct for a choice, wrong for a substitution, because a producer who paid for a '
  'registration number did so to keep the replaced values off the label (Okla. Stat. tit. 2 '
  '5-4.3(C); Ark. Code, "to protect the producer''s safety").';

-- Shape-checked with strict jsonpath, as element_alternatives is: a CHECK may not contain a
-- subquery, and jsonb_path_exists is immutable. Strict mode matters — lax unwraps arrays and would
-- not tell an object from a list of them.
alter table public.state_label_rules
  drop constraint if exists state_label_rules_substitutions_shape;
alter table public.state_label_rules
  add constraint state_label_rules_substitutions_shape
    check (
      jsonb_typeof(element_substitutions) = 'array'
      and not (element_substitutions @? 'strict $[*] ? (@.type() != "object")')
      and not (element_substitutions @? 'strict $[*].substitute ? (@.type() != "string")')
      and not (element_substitutions @? 'strict $[*].replaces ? (@.type() != "array")')
      and not (element_substitutions @? 'strict $[*].replaces[*] ? (@.type() != "string")')
    );

-- ---------------------------------------------------------------------------
-- 2. Oklahoma — three for one.
-- ---------------------------------------------------------------------------
update public.state_label_rules set
  element_substitutions =
    '[{"substitute": "producer_id_number",
       "replaces": ["producer_name", "producer_phone", "producer_address"]}]'::jsonb,
  notes = notes ||
    ' SUBSTITUTION EXPRESSED (20260908100000): § 5-4.3(C) lets a producer paying $15 a year use the '
    'registration number "instead of the producer''s name, phone number, and the physical address '
    'of the location where the homemade food product was produced". This row recorded that '
    'element_alternatives could not say so, and it could not: a group means "at least one of these" '
    'and prints every member the seller has, so an Oklahoman who bought the number still had all '
    'three published — including on the listing, because (B)(4) puts the (A)(6) information on the '
    'webpage. element_substitutions now carries it, and the three elements come off the label and '
    'out of the pre-sale disclosure the moment a number is recorded.'
where program_id in (select id from public.state_food_programs where state_code = 'OK' and ordinal = 1)
  and notes not like '%20260908100000%';

-- ---------------------------------------------------------------------------
-- 3. Texas — one for one, phrased as an excusal.
-- ---------------------------------------------------------------------------
-- The address moves into required_elements because that is where 437.0193(b)(1) puts it; the group
-- existed only to express the (b-1) escape, which is now a substitution.
update public.state_label_rules set
  required_elements = array['business_name', 'producer_address', 'product_name', 'allergens'],
  element_alternatives = '[]'::jsonb,
  element_substitutions =
    '[{"substitute": "producer_id_number", "replaces": ["producer_address"]}]'::jsonb,
  notes = notes ||
    ' SUBSTITUTION EXPRESSED (20260908100000): § 437.0193(b-1) read again at '
    'tcss.legis.texas.gov on 2026-09-08 — "a cottage food production operation is not required to '
    'include on a food label the address of the operation IF the operation registers with the '
    'department ... and includes on the label a unique identification number provided by the '
    'department." That is an excusal, not a choice, so the either/or group printed the address '
    'alongside the number for any seller who had both. The address is now a plain requirement from '
    '(b)(1) and the number lifts it. Unchanged: § 437.0194(c)(1) still withholds the address from '
    'the PRE-PAYMENT disclosure whether or not a number exists — that is a timing rule and this is '
    'a substitution, and they compose.'
where program_id in (select id from public.state_food_programs where state_code = 'TX' and ordinal = 1)
  and notes not like '%20260908100000%';

-- ---------------------------------------------------------------------------
-- 4. Oregon — one for one, and the name and phone stay required.
-- ---------------------------------------------------------------------------
update public.state_label_rules set
  required_elements = array[
    'producer_name', 'producer_phone', 'producer_address', 'product_name',
    'ingredients_desc_by_weight', 'net_weight', 'allergens'
  ],
  element_alternatives = '[]'::jsonb,
  element_substitutions =
    '[{"substitute": "producer_id_number", "replaces": ["producer_address"]}]'::jsonb,
  notes = notes ||
    ' SUBSTITUTION EXPRESSED (20260908100000): ORS 616.718(6)(b) read at oregonlegislature.gov on '
    '2026-09-08 — "(A) The name and phone number for the food establishment; (B) The address of the '
    'food establishment or the unique identification number for the food establishment provided '
    'under subsection (7) of this section". The number replaces the ADDRESS ALONE here, unlike '
    'Oklahoma and Arkansas where it also replaces the name and telephone number, because (A) '
    'requires those separately. The address moves into required_elements and the substitution lifts '
    'it, so a seller who asked the Department for a number under (7) stops publishing the address '
    'they asked for it to avoid.'
where program_id in (select id from public.state_food_programs where state_code = 'OR' and ordinal = 1)
  and notes not like '%20260908100000%';

-- ---------------------------------------------------------------------------
-- 5. Arkansas — the mechanism now exists; the text still has not been read.
-- ---------------------------------------------------------------------------
update public.state_label_rules set
  notes = notes ||
    ' MECHANISM NOW EXISTS (20260908100000): element_substitutions was added for exactly the shape '
    'this row describes and CANNOT express — a department-issued number standing in for the name, '
    'address and telephone number. It is deliberately NOT applied here yet. Act 1040 of 2021 '
    '(SB248) was fetched on 2026-09-08 from webftp.blr.arkansas.gov and from arkleg.state.ar.us; '
    'both return the PDF and both yield only front matter through our extractor, the same encoding '
    'that defeated the Colorado statutes. Arkansas is the state where guessing costs most — the '
    'number is issued "if requested by the producer to protect the producer''s safety", not merely '
    'for privacy — so the conversion waits on somebody reading the section and recording its '
    'number. Until then the three two-member groups stay: they never block a label, and they '
    'publish more than the statute requires, which is the lesser error while the text is unread.'
where program_id in (select id from public.state_food_programs where state_code = 'AR' and ordinal = 1)
  and notes not like '%20260908100000%';

-- ---------------------------------------------------------------------------
-- 6. The disclosure function: resolve substitutions before gating any column.
-- ---------------------------------------------------------------------------
-- The gating is the point. This function is granted to `anon`, so a caller reading the columns
-- directly must not receive an address the seller paid a state fee to keep off the label.
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
  with base as (
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
      coalesce(lr.predisclosure_elements, lr.required_elements, '{}'::text[]) as req,
      case when lr.predisclosure_elements is not null then '{}'::text[]
           else coalesce(lr.optional_elements, '{}'::text[]) end as opt,
      case when lr.predisclosure_elements is not null then '[]'::jsonb
           else coalesce(lr.element_alternatives, '[]'::jsonb) end as alts,
      coalesce(lr.element_substitutions, '[]'::jsonb) as subs,
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
  -- Which substitutions are LIVE for this seller: the stand-in has a value.
  --
  -- An unrecognised substitute name resolves to `false` rather than to an error, so a data mistake
  -- leaves the state's own elements required. That fails toward printing more than necessary, which
  -- is the safe direction for a compliance document even though it is the wrong one for privacy.
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
      -- The substitute takes the position of the first element it replaces, so a label keeps the
      -- order the statute lists things in rather than moving the number to the end.
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
  -- ONE registration, read once: 114365.3(e)(4) states the number and the county as a single item.
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
    -- Withheld where the state lets it wait until after payment (TX 437.0194(c)(1)), and otherwise
    -- returned only where the resolved pre-sale set still names it — which a live substitution
    -- removes (OK 5-4.3(C), OR 616.718(6)(b), TX 437.0193(b-1)).
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
  'predisclosure_elements (the pre-sale set, which is not always the label) and then '
  'element_substitutions (a state-issued number standing in for the name, telephone number and '
  'address it was bought to replace), and returns every identifying column only where the RESOLVED '
  'set still names it. The permit number and county of approval come from one verified licence row; '
  'the address is withheld entirely where the state lets it wait until after payment (Tex. Health & '
  'Safety Code 437.0194(c)).';

revoke all on function public.product_label_disclosure(uuid) from public;
grant execute on function public.product_label_disclosure(uuid) to anon, authenticated, service_role;
