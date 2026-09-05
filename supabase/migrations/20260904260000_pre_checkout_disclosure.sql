-- Harvest Local — show the buyer the label before they pay.
--
-- Texas §437.0194(b)(2): an internet sale is permitted only if, "before the operator accepts
-- payment for the food, the operator provides all labeling information required by Section
-- 437.0193(e) and department rules to the consumer by posting a legible statement". The label
-- information has to reach the buyer on the way to checkout, not only on the package that turns up
-- afterwards. Found while checking Texas against the statute; Nebraska says something similar in
-- its own terms — the disclaimer must appear in "any print, radio, television or Internet
-- advertising", which a storefront listing plainly is.
--
-- The label data is spread across tables a BUYER cannot read: `addresses` is owner-only and
-- `seller_licenses` is owner-or-admin. Rather than widen either policy, one SECURITY DEFINER
-- function returns exactly the fields that legally have to be public anyway — the same set that is
-- printed on the package — and nothing else.

set search_path = public;

alter table public.state_label_rules
  add column if not exists predisclosure_required boolean not null default false;

comment on column public.state_label_rules.predisclosure_required is
  'The label information must be shown to the buyer BEFORE payment is taken, not only on the '
  'package. Texas requires it by statute (§437.0194(b)(2)); Nebraska requires the disclaimer in any '
  'internet advertising. Every other state is false pending its own review — absence here means '
  'nobody has checked, not that the state has no such rule.';

-- Texas: verified against the statute.
update public.state_label_rules lr
  set predisclosure_required = true
  from public.state_food_programs fp
  where fp.id = lr.program_id and fp.state_code = 'TX';

-- Nebraska: from the source summary rather than the statute, hence the note on the column.
update public.state_label_rules lr
  set predisclosure_required = true
  from public.state_food_programs fp
  where fp.id = lr.program_id and fp.state_code = 'NE';

-- ---------------------------------------------------------------------------
-- What the buyer is shown. Deliberately narrow: the producer's address and permit number are
-- otherwise invisible to a buyer, and they are exposed here ONLY because the same two things are
-- required on the physical label.
-- ---------------------------------------------------------------------------
create or replace function public.product_label_disclosure(p_product_id uuid)
returns table (
  state_code             char(2),
  product_name           text,
  business_name          text,
  producer_address       text,
  permit_number          text,
  ingredients            jsonb,
  net_weight_value       numeric,
  net_weight_unit        text,
  allergens              text[],
  required_elements      text[],
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
  'the producer address and permit number, which RLS otherwise hides from buyers, because both are '
  'required on the physical label and are therefore not private.';

revoke all on function public.product_label_disclosure(uuid) from public;
grant execute on function public.product_label_disclosure(uuid) to anon, authenticated, service_role;
