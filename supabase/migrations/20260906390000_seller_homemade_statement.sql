-- Harvest Local — give the seller-written statement a permanent home.
--
-- `seller_statement` was added for Louisiana (20260906300000) as a print-time value, alongside the
-- production date and the lot code. That was right for Louisiana and is wrong now that four states
-- need it, because it is not a per-batch fact at all: it is one sentence about the producer's
-- regulatory status that is identical on every label they will ever print.
--
--   LA Rev. Stat. 40:4.9(D)(1)(a) — "a label which clearly indicates that the food was not produced
--   in a licensed or regulated facility"
--   Mo. Rev. Stat. 196.298.4 — "a statement that the food is not inspected by the department or
--   local health department"
--   Mont. Code Ann. 50-49-203(3) — the producer "shall inform an end consumer that any homemade
--   food ... has not been licensed, permitted, certified, packaged, labeled, or inspected per any
--   official regulations"
--   Neb. Rev. Stat. 81-2,280(5)(a) — "a clearly visible notification that the food: (i) Was prepared
--   in a kitchen that is not subject to regulation and inspection by a regulatory authority; and
--   (ii) May contain allergens"
--
-- Nebraska is what forces the change. 81-2,280(5)(c) requires the notification, for a pickup or
-- delivery sale, "at the producer's private home, ON THE PRODUCER'S WEBSITE, if such website exists,
-- and in any print, radio, television, or Internet advertisement for such sales". A value typed into
-- a print form and never stored cannot appear on a storefront listing, so a Nebraska seller could
-- not comply through this platform however carefully they filled the form in.
--
-- So the statement moves onto the seller profile, where the label generator and the pre-checkout
-- disclosure can both read it. The print form still shows it and still lets a seller override it for
-- a particular run — some states word it differently for different products — but it now has a
-- default that follows them everywhere.

set search_path = public;

alter table public.seller_profiles
  add column if not exists homemade_food_statement text;

comment on column public.seller_profiles.homemade_food_statement is
  'The seller''s own wording for a disclosure their state prescribes by substance rather than by '
  'text (LA, MO, MT, NE). Read by the label generator and by product_label_disclosure(); the print '
  'form pre-fills from it and allows a one-off override. Never composed by us — see '
  'state_label_rules.seller_statement_prompt for what each state requires it to convey.';

-- ---------------------------------------------------------------------------
-- The buyer-facing disclosure has to be able to read it, or Nebraska 81-2,280(5)(c) stays unmet.
-- Adding a column to a `returns table` needs a drop; nothing in SQL depends on this function.
-- ---------------------------------------------------------------------------
drop function if exists public.product_label_disclosure(uuid);

create function public.product_label_disclosure(p_product_id uuid)
returns table (
  state_code             char(2),
  product_name           text,
  business_name          text,
  producer_address       text,
  municipality           text,
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
  'the producer address, town, permit number and homemade-food statement, which RLS otherwise hides '
  'from buyers, because all four are required on the physical label or in the listing and are '
  'therefore not private.';

revoke all on function public.product_label_disclosure(uuid) from public;
grant execute on function public.product_label_disclosure(uuid) to anon, authenticated, service_role;
