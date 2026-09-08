-- Harvest Local — Texas lets a seller keep their home address off the listing. We were publishing it.
--
-- Tex. Health & Safety Code § 437.0194, read 2026-09-07 at
-- tcss.legis.texas.gov/resources/HS/htm/HS.437.htm:
--
--   (b) A cottage food production operation may sell a food ... through the Internet only if:
--       ... (2) SUBJECT TO SUBSECTION (c), before the operator accepts payment for the food, the
--       operator provides all labeling information required by Section 437.0193(e) and department
--       rules to the consumer by posting a legible statement on the operation's Internet website.
--
--   (c) The operator ... that sells a food in this state in the manner described by Subsection (b):
--       (1) IS NOT REQUIRED TO INCLUDE THE ADDRESS of the operation in the labeling information
--       required under Subsection (b)(2) BEFORE the operator accepts payment for the food; and
--       (2) shall provide the address or unique identification number of the operation on the label
--       of the food in the manner required by Section 437.0193(b) or (b-1) AFTER the operator
--       accepts payment.
--
-- `product_label_disclosure()` is `anon`-callable and has always returned `producer_address`
-- unconditionally. Texas is a predisclosure state, so that address is rendered on the storefront
-- listing — to anyone, before any purchase. The legislature wrote a provision to prevent exactly
-- that and we overrode it.
--
-- =========================================================================
-- THIS IS A DIFFERENT SHAPE FROM producer_id_number
-- =========================================================================
-- 20260907100000 added `producer_id_number` for the states that let a seller SUBSTITUTE a
-- registration number for their address. Texas has that too, at § 437.0193(b-1), and it is already
-- modelled as an alternatives group.
--
-- § 437.0194(c) is not a substitution. It is a TIMING rule: the address is still required, on the
-- physical label, after payment — the seller simply need not publish it to browsers. So it cannot
-- be expressed by swapping one element for another. It needs the disclosure and the label to
-- disagree, deliberately, about the same element.
--
-- Hence a flag on the rule rather than a change to the element vocabulary:
--
--   * the BUYER-FACING function stops returning the address for these states;
--   * the SELLER'S LABEL PAGE is untouched — § 437.0193(b) still requires it on the jar, and
--     `getLabelContext` reads the profile directly rather than through this function;
--   * the publish gate stops counting the address as a missing predisclosure element, so a Texan is
--     not blocked from listing over a field their own statute excuses;
--   * `DisclosureGapNotice` stops nagging them to fix it.
--
-- Only Texas is flagged, because Texas is the only state whose text this pass found saying it. The
-- column exists so the next one can be added without another schema change.

set search_path = public;

alter table public.state_label_rules
  add column if not exists address_withheld_until_payment boolean not null default false;

comment on column public.state_label_rules.address_withheld_until_payment is
  'The state expressly permits the producer''s address to be omitted from the PRE-PAYMENT '
  'disclosure while still requiring it on the physical label afterwards (Tex. Health & Safety Code '
  '437.0194(c)). Not a substitution — producer_id_number covers that case — but a timing rule, so '
  'the buyer-facing disclosure and the printed label deliberately disagree about the same element.';

update public.state_label_rules set
  address_withheld_until_payment = true,
  notes = notes ||
    ' ADDRESS WITHHELD BEFORE PAYMENT (20260907230000): § 437.0194(c)(1) says the operator "is not '
    'required to include the address of the operation in the labeling information required under '
    'Subsection (b)(2) before the operator accepts payment", and (c)(2) then requires the address '
    'or the § 437.0193(b-1) identification number ON THE LABEL after payment. So the storefront '
    'listing no longer shows a Texan seller''s address and the printed label still carries it. '
    'product_label_disclosure() had been returning it to anonymous browsers regardless, which '
    'published a home address the legislature had expressly excused.'
where program_id in (select id from public.state_food_programs where state_code = 'TX' and ordinal = 1)
  and notes not like '%20260907230000%';

-- ---------------------------------------------------------------------------
-- The disclosure function: withhold the address, and say that it is withheld.
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
      lr.required_elements,
      lr.optional_elements,
      lr.element_alternatives,
      lr.regulator_website_url,
      lr.disclaimer_text,
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
  )
  select
    asks.home_state,
    asks.title,
    asks.business_name,
    -- Withheld entirely where the state says it need not be shown before payment. The seller's own
    -- label page reads the profile directly and still prints it, which is what 437.0193(b) requires.
    case
      when asks.address_withheld or asks.address_id is null then null
      else concat_ws(', ', concat_ws(' ', asks.line1, nullif(asks.line2, '')), asks.city,
                     concat_ws(' ', asks.state, asks.postal_code))
    end,
    case when 'mailing_address' = any(coalesce(asks.named_elements, '{}'::text[]))
         then asks.mailing_address else null end,
    -- The town is a coarser fact than the street address and is separately required in CA and CO,
    -- but where the address itself is withheld it goes too: naming the town of a home kitchen
    -- alongside a producer's name is next to naming the kitchen.
    case when asks.address_withheld then null else asks.city end,
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
    coalesce(asks.predisclosure_required, false),
    asks.address_withheld
  from asks;
$$;

comment on function public.product_label_disclosure(uuid) is
  'The label information a buyer must be shown before paying, where the state requires it. Returns '
  'the producer''s telephone number, account email, mailing address and state identification number '
  'only where the state''s own rule names them, and WITHHOLDS the producer address and town entirely '
  'where the state permits it to be held back until after payment (Tex. Health & Safety Code '
  '437.0194(c)). The `address_withheld` flag tells the caller which happened, so a seller is not '
  'asked to fix a field their own statute excuses.';

revoke all on function public.product_label_disclosure(uuid) from public;
grant execute on function public.product_label_disclosure(uuid) to anon, authenticated, service_role;
