-- Harvest Local — safe handling instructions on the label, because two states require them.
--
-- Idaho was the first to need this and it was recorded as a gap in its rule's notes. North Dakota is
-- the second, so it stops being a note and becomes a field.
--
--   Idaho Code 37-205(4)(b): "Perishable food products shall include information on handling
--   instructions sufficient to inform the consumer of safe storage and preparation practices."
--   N.D. Cent. Code 23-09.5-02(7): a cottage food operator "shall label all cottage food products
--   that require refrigeration, such as baked goods containing cream, custard, meringue, cheesecake,
--   pumpkin pie, and cream cheese, with safe handling instructions and a product disclosure
--   statement indicating the product was transported and maintained frozen."
--
-- UNLIKE THE SELLER STATEMENT, THIS IS PER-PRODUCT. `homemade_food_statement` is one sentence about
-- the producer, identical on everything they make, so it lives on the profile. Handling instructions
-- are about the food: a cheesecake and a jar of dried herbs need different words, and a seller with
-- both would be wrong to reuse one for the other. It goes on `products`.
--
-- IT IS OPTIONAL IN BOTH STATES' ROWS, not required, and that is deliberate. Idaho asks for it only
-- for "perishable food products" and North Dakota only for products "that require refrigeration" —
-- facts about the item that nothing in this schema records. Required, the element would block every
-- shelf-stable label in both states, which is the same reasoning that put Iowa's expiration date and
-- Alaska's business licence number in `optional_elements`. The product form says when it is needed
-- and each rule's notes say what that state expects it to cover.

set search_path = public;

alter table public.products
  add column if not exists handling_instructions text;

comment on column public.products.handling_instructions is
  'Safe storage and preparation instructions for this product, where the state requires them on the '
  'label (Idaho Code 37-205(4)(b) for perishable food; N.D. Cent. Code 23-09.5-02(7) for food '
  'requiring refrigeration). Per-product prose written by the seller — a cheesecake and a jar of '
  'dried herbs need different words.';

-- ---------------------------------------------------------------------------
-- The vocabulary.
-- ---------------------------------------------------------------------------
alter table public.state_label_rules
  drop constraint if exists state_label_rules_elements_known;

alter table public.state_label_rules
  add constraint state_label_rules_elements_known
    check (
      required_elements <@ array[
        'product_name', 'producer_name', 'business_name', 'producer_address', 'producer_phone',
        'producer_email', 'permit_number', 'municipality', 'municipality_state',
        'ingredients_desc_by_weight', 'net_weight', 'allergens', 'production_date', 'lot_code',
        'expiration_date', 'handling_instructions', 'nutrition_if_claimed', 'regulator_website',
        'seller_statement'
      ]::text[]
      and optional_elements <@ array[
        'product_name', 'producer_name', 'business_name', 'producer_address', 'producer_phone',
        'producer_email', 'permit_number', 'municipality', 'municipality_state',
        'ingredients_desc_by_weight', 'net_weight', 'allergens', 'production_date', 'lot_code',
        'expiration_date', 'handling_instructions', 'nutrition_if_claimed', 'regulator_website',
        'seller_statement'
      ]::text[]
    );

-- ---------------------------------------------------------------------------
-- The two states that need it. The notes are APPENDED rather than rewritten: matching the existing
-- prose exactly to replace it is brittle, and a note that says "this was inexpressible, and here is
-- when it stopped being" is more use to the next reader than one that pretends it never was.
-- ---------------------------------------------------------------------------
update public.state_label_rules set
  optional_elements = array['handling_instructions'],
  notes = notes ||
    ' UPDATE (20260906450000): the handling-instructions gap recorded above is now closed. '
    '`products.handling_instructions` holds the prose and the handling_instructions element prints '
    'it. It sits in optional_elements, not required_elements, because 37-205(4)(b) reaches only '
    '"perishable food products" and nothing in this schema records whether a given product is one — '
    'required, it would block every shelf-stable Idaho label.'
where program_id in (select id from public.state_food_programs where state_code = 'ID' and ordinal = 1)
  and verified_at is null
  and notes not like '%20260906450000%';

update public.state_label_rules set
  optional_elements = array['handling_instructions'],
  notes = notes ||
    ' UPDATE (20260906450000): the handling-instructions gap recorded above is now closed. '
    '`products.handling_instructions` holds the prose and the handling_instructions element prints '
    'it. It sits in optional_elements because 23-09.5-02(7) reaches only products "that require '
    'refrigeration", which nothing here identifies. NOTE WHAT NORTH DAKOTA ASKS FOR ON TOP: (7) '
    'wants the handling instructions AND "a product disclosure statement indicating the product was '
    'transported and maintained frozen", so a North Dakota seller of a refrigerated item should put '
    'both into this field.'
where program_id in (select id from public.state_food_programs where state_code = 'ND' and ordinal = 1)
  and verified_at is null
  and notes not like '%20260906450000%';

-- ---------------------------------------------------------------------------
-- The buyer-facing disclosure reads the same composer, so it needs the column too. Neither Idaho nor
-- North Dakota is a predisclosure state today, but a rule that asks for handling instructions and a
-- function that cannot return them would drift the moment one becomes.
-- ---------------------------------------------------------------------------
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
    a.city,
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
  'the producer address, town, permit number, homemade-food statement, handling instructions and — '
  'ONLY where the state''s own label rule asks for it — the producer''s account email, because each '
  'is required on the physical label or in the listing and is therefore not private in that state.';

revoke all on function public.product_label_disclosure(uuid) from public;
grant execute on function public.product_label_disclosure(uuid) to anon, authenticated, service_role;
