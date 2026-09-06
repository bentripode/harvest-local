-- Harvest Local — the telephone number eleven states put on the label.
--
-- `producer_phone` has been in the element vocabulary since the label generator was built, and
-- `LabelSource.producerPhone` has been hardcoded `null` the whole time with the comment "Not
-- collected today — surfaced as missing where a state asks for it". That was honest while nothing
-- printed a label before a sale. Tennessee changes it: § 53-1-118(b)(4)(A) requires "The name, home
-- address, and telephone number of the producer" and (b)(5)(A)(iv) puts that information on "the
-- webpage on which the homemade food item is offered for sale" — so a Tennessee listing is
-- incomplete without a number, and the seller had nowhere to enter one.
--
-- WHO ELSE ASKS FOR IT. Required outright: AK, AR, NH, NM, OK, OR, RI, SD, TN, VA, WV. One of an
-- either/or with the email address: CO, DE, HI, IA, ID. Sixteen jurisdictions, none of which could
-- be satisfied before this.
--
-- WHY NOT `profiles.phone`. That column is the seller's own mobile number, collected for order-update
-- texts under an explicit SMS opt-in. Printing it on a label and publishing it on a storefront
-- listing is a different act with different consent, and a seller may well want a business line on
-- the label and a personal one for texts. It also has to be E.164 for Twilio, whereas a label prints
-- whatever the seller writes — "(615) 555-0134" is what belongs on a jar. So this is its own column
-- on `seller_profiles`, alongside `mailing_address` and `homemade_food_statement`, and it is plain
-- text printed verbatim.
--
-- IT IS RETURNED BY `product_label_disclosure()` ONLY WHERE THE STATE'S RULE ASKS FOR IT — the same
-- gate `producer_email` got in 20260906420000 and `mailing_address` in 20260906490000. That function
-- is `anon`-callable, and a producer's phone number is not something to publish in the thirty-five
-- jurisdictions that do not require it.

set search_path = public;

alter table public.seller_profiles
  add column if not exists contact_phone text;

comment on column public.seller_profiles.contact_phone is
  'The producer''s telephone number as it should be PRINTED on a label and shown on a listing, where '
  'the state requires one (Tenn. Code 53-1-118(b)(4)(A) and fifteen others). Deliberately separate '
  'from profiles.phone, which is the E.164 mobile number used for order-update SMS under a separate '
  'opt-in. Plain text, printed verbatim. Collected on /seller/settings, and only shown there where '
  'the seller''s own state asks for it.';

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
    -- Only where this state's rule actually asks for a telephone number.
    case
      when 'producer_phone' = any(coalesce(lr.required_elements, '{}'::text[]))
        or 'producer_phone' = any(coalesce(lr.optional_elements, '{}'::text[]))
        or exists (
             select 1
             from jsonb_array_elements(coalesce(lr.element_alternatives, '[]'::jsonb)) g
             where jsonb_exists(g, 'producer_phone')
           )
      then sp.contact_phone
      else null
    end,
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
  'plus — ONLY where the state''s own label rule asks for them — the producer''s telephone number, '
  'account email and mailing address, because each is required on the physical label or in the '
  'listing and is therefore not private in that state.';

revoke all on function public.product_label_disclosure(uuid) from public;
grant execute on function public.product_label_disclosure(uuid) to anon, authenticated, service_role;
