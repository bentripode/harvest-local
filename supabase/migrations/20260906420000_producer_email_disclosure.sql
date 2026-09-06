-- Harvest Local — put the producer's email on the label and the listing, where a state asks for it.
--
-- New Mexico is the first state in this pass to require one outright. N.M. Stat. 25-12-3(C)(1)
-- requires "the name, home address, telephone number AND email address of the processor of the food
-- item" — four things, not a choice — and (B)(4) requires that same set "on a webpage on which the
-- homemade food item is offered for sale". Until now `producer_email` was hard-coded null on both
-- read paths, so a New Mexico seller could not print a label at all and their listing could not
-- carry what the statute demands.
--
-- The value is the seller's account email. That is a decision with a privacy dimension, so the shape
-- of it matters:
--
--   IT IS RETURNED ONLY WHERE THE STATE'S OWN RULE ASKS FOR IT. `product_label_disclosure()` is
--   callable by `anon`, so returning the address unconditionally would publish every seller's email
--   in all fifty-one jurisdictions to satisfy one. The CASE below reads the resolved label rule and
--   returns null unless `producer_email` is among its required elements, its optional elements, or a
--   member of one of its alternatives groups. In New Mexico it is required; in Colorado and Hawaii
--   it is one of two ways to satisfy a contact requirement, so it is returned there too and the
--   renderer prints it only if the seller has no phone number. Everywhere else the column is null.
--
--   IT IS NOT PRIVATE WHERE IT IS RETURNED. That is the whole basis for exposing it: New Mexico puts
--   it on the package and on the webpage, so a buyer is entitled to it before they buy. The same
--   reasoning already governs `producer_address` and `permit_number` on this function.
--
-- The label page reads the seller's own session email instead and needs nothing from here.

set search_path = public;

drop function if exists public.product_label_disclosure(uuid);

create function public.product_label_disclosure(p_product_id uuid)
returns table (
  state_code             char(2),
  product_name           text,
  business_name          text,
  producer_address       text,
  municipality           text,
  producer_email         text,
  permit_number          text,
  seller_statement       text,
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
    -- Only where this state's rule actually asks for an email. See the header comment.
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
  'the producer address, town, permit number, homemade-food statement and — ONLY where the state''s '
  'own label rule asks for it — the producer''s account email, because each is required on the '
  'physical label or in the listing and is therefore not private in that state.';

revoke all on function public.product_label_disclosure(uuid) from public;
grant execute on function public.product_label_disclosure(uuid) to anon, authenticated, service_role;
