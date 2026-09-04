-- Harvest Local — per-state cottage-food PROGRAMS, the data the compliance engine runs on.
--
-- `state_cottage_food_rules` holds one row per state, which cannot express how these laws actually
-- work: California, Oregon, Utah and Vermont each run THREE separate programs, and nine more states
-- run two, with different sales caps, different permitted foods, and — critically — different
-- answers on whether online orders are allowed at all. A seller does not operate "in a state", they
-- operate in a program within a state.
--
-- Seeded from the Institute for Justice "Selling Homemade Food" state pages, read 2026-09-04. Every
-- row carries its source URL and read date, and every row lands UNVERIFIED: IJ is a serious source
-- and its own pages state that they are not legal advice and that statutes change. The verified_at
-- gate is the same human sign-off the state rules editor already uses.
--
-- Known gaps, deliberately left NULL rather than guessed:
--   * Program names for single-program states are generic ("Cottage Food") — IJ does not name them.
--   * Labeling rules are NOT seeded here. `state_label_rules` is created empty: label text is quoted
--     statute that gets printed onto food, and a partial capture is worse than none. It needs its
--     own complete pass.
--   * Washington's mail entry still reads "temporarily allowed during the pandemic" in the source,
--     which is why mail_note exists and why nothing here should be trusted before review.

set search_path = public;

-- ---------------------------------------------------------------------------
-- Programs
-- ---------------------------------------------------------------------------
create table public.state_food_programs (
  id                  uuid primary key default gen_random_uuid(),
  state_code          char(2) not null references public.state_cottage_food_rules(state_code) on delete cascade,
  ordinal             smallint not null,          -- display order within the state
  name                text not null,

  -- Can this program transact through the marketplace at all?
  online_orders       text not null default 'unclear'
                        check (online_orders in ('allowed', 'banned', 'unclear')),
  mail_delivery       text not null default 'unclear'
                        check (mail_delivery in ('allowed', 'banned', 'restricted', 'unclear')),
  mail_note           text,
  -- Whether delivering to a buyer's address counts as a permitted venue is NOT answered by the
  -- source for states that enumerate venues. Defaults to unclear so the app can be conservative.
  direct_delivery     text not null default 'unclear'
                        check (direct_delivery in ('allowed', 'banned', 'unclear')),
  venue_note          text,
  retail_allowed      boolean,

  -- Caps. The basis matters as much as the number: Colorado caps per PRODUCT, Virginia caps only
  -- acidified foods, and Minnesota/Vermont use thresholds that trigger licensing rather than
  -- stopping sales.
  revenue_cap         numeric(12,2),
  cap_basis           text not null default 'none'
                        check (cap_basis in ('none', 'annual_total', 'per_product', 'per_category')),
  cap_note            text,
  license_threshold   numeric(12,2),

  -- The six category axes the source grades. 'list_only' = a state-approved list, usually with an
  -- application process to add a product; 'limited' = a short enumerated list; 'conditional' =
  -- allowed with a qualification recorded in category_note.
  cat_shelf_stable    text not null default 'unclear'
                        check (cat_shelf_stable in ('unrestricted', 'list_only', 'limited', 'conditional', 'banned', 'unclear')),
  cat_refrigerated    text not null default 'unclear'
                        check (cat_refrigerated in ('allowed', 'banned', 'conditional', 'unclear')),
  cat_meat            text not null default 'unclear'
                        check (cat_meat in ('allowed', 'banned', 'conditional', 'unclear')),
  cat_acidified       text not null default 'unclear'
                        check (cat_acidified in ('allowed', 'banned', 'conditional', 'unclear')),
  cat_low_acid_canned text not null default 'unclear'
                        check (cat_low_acid_canned in ('allowed', 'banned', 'conditional', 'unclear')),
  cat_fermented       text not null default 'unclear'
                        check (cat_fermented in ('allowed', 'banned', 'conditional', 'unclear')),
  category_note       text,

  -- Gates
  license_required    text not null default 'unclear'
                        check (license_required in ('yes', 'no', 'conditional', 'unclear')),
  license_note        text,
  inspection_required boolean,
  recipe_approval     text not null default 'unclear'
                        check (recipe_approval in ('yes', 'no', 'conditional', 'unclear')),
  recipe_note         text,
  training_required   text not null default 'unclear'
                        check (training_required in ('yes', 'no', 'conditional', 'unclear')),
  training_note       text,
  training_url        text,
  application_url     text,
  -- False => city or county rules may add requirements on top of the state's.
  local_preemption    boolean,

  -- Provenance. Laws change; this is the honest part.
  source_url          text not null,
  source_checked_at   date not null,
  verified_at         timestamptz,
  verified_by         uuid references public.profiles(id) on delete set null,

  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),

  unique (state_code, ordinal)
);

create index state_food_programs_state_ix on public.state_food_programs (state_code, ordinal);
create index state_food_programs_verified_ix on public.state_food_programs (verified_at);

create trigger state_food_programs_set_updated_at before update on public.state_food_programs
  for each row execute function public.set_updated_at();

comment on table public.state_food_programs is
  'One row per (state, cottage-food program). Seeded from ij.org 2026-09-04, all unverified. '
  'Supersedes state_cottage_food_rules.revenue_cap for enforcement once the gates move over.';

comment on column public.state_food_programs.online_orders is
  'Whether the program permits taking orders online at all. ''banned'' means a seller on this '
  'program cannot list food on the marketplace — five states ban it outright.';

comment on column public.state_food_programs.direct_delivery is
  'Whether delivering to a buyer''s address is a permitted venue. Defaults to ''unclear'': states '
  'that enumerate venues (farmers markets, roadside stands, from home) do not say, and reading it '
  'either way is a legal judgement rather than a data-entry one.';

alter table public.state_food_programs enable row level security;

-- Same shape as the state rules they hang off: world-readable reference data, admin-writable.
create policy "food programs: public read"
  on public.state_food_programs for select using (true);

create policy "food programs: admin write"
  on public.state_food_programs for all
  using (public.is_admin())
  with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- Label rules — created empty on purpose. See the header note.
-- ---------------------------------------------------------------------------
create table public.state_label_rules (
  program_id           uuid primary key references public.state_food_programs(id) on delete cascade,
  -- product_name, producer_name, producer_address, permit_number, ingredients_desc_by_weight,
  -- net_weight, allergens, production_date, lot_code, nutrition_if_claimed
  required_elements    text[] not null default '{}',
  -- Verbatim quoted statute. Never paraphrased, never regenerated.
  disclaimer_text      text,
  disclaimer_min_pt    int,
  disclaimer_all_caps  boolean not null default false,
  disclaimer_font_note text,                  -- GA names Times New Roman or Arial
  metric_required      boolean not null default false,  -- NC, TN, CT want both units
  placard_required     boolean not null default false,  -- MN, MO, ID, AK want a sign, not a label
  placard_text         text,
  notes                text,
  source_url           text not null,
  source_checked_at    date not null,
  verified_at          timestamptz,
  verified_by          uuid references public.profiles(id) on delete set null,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create trigger state_label_rules_set_updated_at before update on public.state_label_rules
  for each row execute function public.set_updated_at();

comment on table public.state_label_rules is
  'Label requirements per program. Intentionally unseeded: disclaimer_text is quoted statute that '
  'gets printed onto food, so it needs a complete verbatim capture rather than a partial one.';

alter table public.state_label_rules enable row level security;

create policy "label rules: public read"
  on public.state_label_rules for select using (true);

create policy "label rules: admin write"
  on public.state_label_rules for all
  using (public.is_admin())
  with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- Seed: 69 programs across 51 jurisdictions.
--
-- Columns, in order:
--   state, ordinal, name,
--   online_orders, mail_delivery, mail_note,
--   revenue_cap, cap_basis, cap_note, license_threshold,
--   shelf_stable, refrigerated, meat, acidified, low_acid_canned, fermented, category_note,
--   license_required, license_note, inspection_required,
--   recipe_approval, recipe_note, training_required, training_note,
--   local_preemption, venue_note, retail_allowed
-- ---------------------------------------------------------------------------
insert into public.state_food_programs (
  state_code, ordinal, name,
  online_orders, mail_delivery, mail_note,
  revenue_cap, cap_basis, cap_note, license_threshold,
  cat_shelf_stable, cat_refrigerated, cat_meat, cat_acidified, cat_low_acid_canned, cat_fermented, category_note,
  license_required, license_note, inspection_required,
  recipe_approval, recipe_note, training_required, training_note,
  local_preemption, venue_note, retail_allowed,
  source_url, source_checked_at
)
select
  v.state_code, v.ordinal, v.name,
  v.online_orders, v.mail_delivery, v.mail_note,
  v.revenue_cap, v.cap_basis, v.cap_note, v.license_threshold,
  v.shelf, v.refrig, v.meat, v.acid, v.lowacid, v.ferment, v.category_note,
  v.license_required, v.license_note, v.inspection_required,
  v.recipe_approval, v.recipe_note, v.training_required, v.training_note,
  v.local_preemption, v.venue_note, v.retail_allowed,
  'https://ij.org/issues/economic-liberty/homemade-food-seller/' || v.slug,
  date '2026-09-04'
from (values
  ('AL',1,'Cottage Food','alabama','allowed','allowed',null,null,'none',null,null,'unrestricted','banned','banned','banned','banned','allowed',null,'no',null,false,'no',null,'yes',null,true,'No restrictions',false),
  ('AK',1,'Cottage Food','alaska','allowed','restricted','In-state delivery only',null,'none',null,null,'unrestricted','conditional','allowed','allowed','allowed','allowed','Refrigerated baked goods must be sold direct to the consumer; meat and poultry allowed','no',null,false,'no',null,'no',null,false,'No restrictions',true),
  ('AZ',1,'Cottage Food Program','arizona','allowed','allowed',null,null,'none',null,null,'unrestricted','allowed','allowed','allowed','allowed','allowed',null,'yes',null,false,'no',null,'yes',null,true,'No restrictions',true),
  ('AR',1,'Cottage Food','arkansas','allowed','allowed',null,null,'none',null,null,'unrestricted','banned','banned','allowed','banned','banned',null,'no',null,false,'conditional','Acidified or pickled foods only','no',null,true,'No restrictions',true),
  ('CA',1,'Cottage Food Class A','california','allowed','allowed',null,75000,'annual_total',null,null,'list_only','banned','banned','banned','banned','banned','CDPH approved list; application process to add products','yes',null,false,'no',null,'yes',null,false,'No restrictions',false),
  ('CA',2,'Cottage Food Class B','california','allowed','allowed',null,150000,'annual_total',null,null,'list_only','banned','banned','banned','banned','banned','CDPH approved list; application process to add products','yes',null,true,'no',null,'yes',null,false,'No restrictions',true),
  ('CA',3,'Microenterprise Home Kitchen Operations','california','allowed','banned',null,100000,'annual_total',null,null,'conditional','conditional','allowed','banned','banned','banned','Food must be sold the same day it is made; meat allowed in meals','yes',null,true,'yes',null,'yes',null,false,'Only from home, as take-out or dine-in. Cities and counties must opt in.',false),
  ('CO',1,'Cottage Foods Act','colorado','allowed','allowed',null,10000,'per_product','$10,000 per product per year, not an overall total',null,'unrestricted','banned','conditional','allowed','banned','banned','Under 1,000 personally-raised poultry','no',null,false,'no',null,'yes',null,false,'No restrictions',false),
  ('CT',1,'Cottage Food','connecticut','allowed','banned',null,50000,'annual_total',null,null,'list_only','banned','banned','banned','banned','banned','Department of Consumer Protection list; application process to add products','yes',null,true,'no',null,'yes',null,false,'Farmers markets, roadside stands, special events, and from home',false),
  ('DE',1,'Delaware Cottage Food','delaware','banned','banned',null,null,'none',null,null,'limited','banned','banned','banned','banned','banned','Baked goods, candies, jams and jellies','yes',null,true,'conditional','For certain products determined by the Division of Public Health','yes',null,false,'Farmers markets, craft fairs and special events',false),
  ('DE',2,'Delaware On-Farm Home Processing','delaware','banned','banned',null,50000,'annual_total',null,null,'list_only','banned','banned','banned','banned','banned','Department of Agriculture list','yes',null,true,'no',null,'yes',null,false,'Farmers markets, roadside stands and from the farm',false),
  ('DC',1,'Cottage Food','washington-dc','allowed','allowed',null,null,'none',null,null,'list_only','banned','banned','banned','banned','banned','Department of Public Health approved list','yes',null,true,'conditional','Only to add products not currently approved','no',null,null,'Only at farmers markets and public events',false),
  ('FL',1,'Cottage Food','florida','allowed','allowed',null,250000,'annual_total',null,null,'unrestricted','banned','banned','banned','banned','banned',null,'no',null,false,'no',null,'no',null,true,'No restrictions',false),
  ('GA',1,'Cottage Food','georgia','allowed','allowed',null,null,'none',null,null,'unrestricted','banned','banned','banned','banned','banned',null,'yes',null,false,'no',null,'yes',null,false,'No restrictions',true),
  ('HI',1,'Cottage Food','hawaii','banned','banned',null,null,'none',null,null,'unrestricted','banned','banned','banned','banned','banned',null,'no',null,false,'no',null,'yes',null,false,'No restrictions',false),
  ('ID',1,'Cottage Food','idaho','allowed','allowed',null,null,'none',null,null,'unrestricted','banned','banned','banned','banned','banned',null,'no',null,false,'no',null,'no',null,false,'No restrictions',false),
  ('IL',1,'Cottage Food','illinois','allowed','allowed',null,null,'none',null,null,'unrestricted','banned','banned','allowed','banned','allowed',null,'yes',null,false,'conditional','Acidified and fermented foods, and baked goods made with cheese','yes',null,true,'No restrictions',false),
  ('IN',1,'Home Based Vendor','indiana','allowed','allowed',null,null,'none',null,null,'unrestricted','allowed','conditional','banned','banned','allowed','Personally-raised poultry and rabbit','no',null,false,'no',null,'yes',null,true,'No restrictions',false),
  ('IA',1,'Iowa Cottage Food','iowa','allowed','allowed',null,null,'none',null,null,'unrestricted','banned','banned','allowed','banned','banned',null,'no',null,false,'no',null,'no',null,true,'Farmers markets, roadside stands, events and from home',false),
  ('IA',2,'Iowa Home Food Processing Establishment','iowa','allowed','allowed',null,50000,'annual_total',null,null,'unrestricted','allowed','conditional','banned','banned','allowed','Meat must come from an inspected source','yes',null,true,'no',null,'no',null,true,'Farmers markets, roadside stands, events and from home',true),
  ('KS',1,'Cottage Food','kansas','allowed','allowed',null,null,'none',null,null,'unrestricted','banned','conditional','banned','banned','banned','Fish, seafood, under 1,000 personally-raised poultry and 250 rabbits','no',null,false,'conditional','Canned foods only','no',null,false,'No restrictions',false),
  ('KY',1,'Kentucky Home-Based Processor','kentucky','allowed','banned',null,60000,'annual_total',null,null,'list_only','banned','banned','banned','banned','banned','Department for Public Health approved list','yes',null,false,'no',null,'no',null,false,'No restrictions',false),
  ('KY',2,'Kentucky Home-Based Microprocessor','kentucky','banned','banned',null,60000,'annual_total',null,null,'conditional','banned','banned','allowed','allowed','banned','Producer must grow the primary ingredient used in their products','yes',null,true,'yes',null,'yes',null,false,'Farmers markets, roadside stands and from home; event sales are not allowed',false),
  ('LA',1,'Cottage Food','louisiana','allowed','allowed',null,30000,'annual_total',null,null,'limited','allowed','banned','allowed','banned','banned','Baked goods, candies, cane syrup, dried mixes, jams, jellies, sauces, syrups and spices','no',null,false,'no',null,'no',null,false,'No restrictions',true),
  ('ME',1,'Maine Home Food Manufacturing','maine','allowed','allowed',null,null,'none',null,null,'unrestricted','banned','banned','allowed','banned','banned',null,'yes',null,true,'conditional','Acidified or pickled foods only','no',null,false,'No restrictions',true),
  ('ME',2,'Maine Food Sovereignty','maine','banned','banned',null,null,'none',null,null,'unrestricted','allowed','conditional','allowed','allowed','allowed','Fish and seafood','no',null,false,'no',null,'no',null,false,'Only at farmers markets, events and from home',false),
  ('MD',1,'Maryland Cottage Food','maryland','allowed','allowed',null,50000,'annual_total',null,null,'unrestricted','banned','banned','banned','banned','banned',null,'no',null,false,'no',null,'conditional','Only for retail sales',false,'Farmers markets, events and from home',true),
  ('MD',2,'Maryland On-Farm Home Processing','maryland','allowed','allowed',null,40000,'annual_total',null,null,'limited','banned','banned','allowed','banned','banned','Baked goods, fruit pies, canned goods, honey, dried fruits and vegetables, herb mixtures','yes',null,true,'conditional','Acidified foods only','yes',null,false,'Farmers markets, events and from home',true),
  ('MA',1,'Cottage Food','massachusetts','allowed','allowed',null,null,'none',null,null,'unrestricted','banned','banned','banned','banned','banned',null,'yes',null,true,'no',null,'no',null,false,'No restrictions',true),
  ('MI',1,'Cottage Food','michigan','banned','banned',null,25000,'annual_total',null,null,'unrestricted','banned','banned','banned','banned','banned',null,'no',null,false,'no',null,'no',null,false,'No restrictions',false),
  ('MN',1,'Cottage Food','minnesota','allowed','restricted','Pet food only',78000,'annual_total',null,7665,'unrestricted','banned','banned','allowed','banned','banned',null,'conditional','Sales under $7,665 are exempt from registration',false,'no',null,'yes',null,false,'Farmers markets, community events and from home',false),
  ('MS',1,'Cottage Food','mississippi','banned','banned',null,35000,'annual_total',null,null,'list_only','banned','banned','allowed','banned','banned','Department of Health select list','no',null,false,'no',null,'no',null,false,'No restrictions',false),
  ('MO',1,'Cottage Food','missouri','allowed','banned',null,null,'none',null,null,'limited','banned','banned','banned','banned','banned','Baked goods, jams, jellies, dried herbs or herb mixes','no',null,false,'no',null,'no',null,true,'No restrictions',false),
  ('MT',1,'Local Food Choice Act','montana','allowed','allowed',null,null,'none',null,null,'unrestricted','allowed','conditional','allowed','allowed','allowed','Under 1,000 personally-raised poultry','no',null,false,'no',null,'no',null,true,'No restrictions',false),
  ('NE',1,'Cottage Food','nebraska','allowed','allowed',null,null,'none',null,null,'unrestricted','allowed','banned','banned','banned','banned',null,'conditional','Not required for sales at farmers markets',false,'no',null,'yes',null,true,'No restrictions',false),
  ('NV',1,'Cottage Food','nevada','banned','banned',null,35000,'annual_total',null,null,'list_only','banned','banned','conditional','banned','banned','List set by state law; acidified foods need a craft food registration','yes',null,false,'conditional','Acidified food only','conditional','Acidified food only',true,'No restrictions',false),
  ('NH',1,'New Hampshire Exempt Home Food Operations','new-hampshire','banned','banned',null,null,'none',null,null,'unrestricted','banned','banned','banned','banned','banned',null,'no',null,false,'no',null,'no',null,false,'Farmers markets, farm stands and from home',true),
  ('NH',2,'New Hampshire Homestead','new-hampshire','allowed','allowed',null,null,'none',null,null,'unrestricted','banned','banned','allowed','banned','banned',null,'yes',null,false,'conditional','Jarred foods only','no',null,false,'No restrictions',true),
  ('NJ',1,'Cottage Food','new-jersey','allowed','banned',null,50000,'annual_total',null,null,'conditional','banned','banned','banned','banned','banned','Producers must apply to expand the list of approved foods','yes',null,false,'no',null,'yes',null,false,'No restrictions',false),
  ('NM',1,'Cottage Food','new-mexico','allowed','allowed',null,null,'none',null,null,'unrestricted','banned','banned','banned','banned','banned',null,'conditional','No state licence, but home-rule municipalities may require their own permits',false,'no',null,'yes',null,true,'No restrictions',false),
  ('NY',1,'Home Processor','new-york','allowed','allowed',null,null,'none',null,null,'list_only','banned','banned','banned','banned','banned','Department of Agriculture and Markets approved list','yes',null,false,'no',null,'no',null,false,'No restrictions',true),
  ('NC',1,'Home Processing','north-carolina','allowed','allowed',null,null,'none',null,null,'unrestricted','banned','banned','allowed','banned','banned',null,'no',null,true,'conditional','Acidified or pickled food, dressings, sauces, and moist cakes and breads','no',null,false,'No restrictions',true),
  ('ND',1,'Cottage Food','north-dakota','allowed','allowed',null,null,'none',null,null,'unrestricted','allowed','conditional','allowed','allowed','allowed','Under 1,000 personally-raised poultry','no',null,false,'no',null,'no',null,true,'Farmers markets, roadside stands, festivals and from home',false),
  ('OH',1,'Ohio Cottage Food','ohio','allowed','allowed',null,null,'none',null,null,'list_only','banned','banned','banned','banned','banned','Department of Agriculture approved list','no',null,false,'no',null,'no',null,false,'Only at farmers markets, events and from home',true),
  ('OH',2,'Ohio Home Bakery','ohio','allowed','allowed',null,null,'none',null,null,'limited','allowed','banned','banned','banned','banned','Baked goods only; other pantry goods are banned','yes',null,true,'no',null,'no',null,false,'No restrictions',true),
  ('OK',1,'Homemade Food Act','oklahoma','allowed','restricted','Shelf-stable foods only',75000,'annual_total',null,null,'unrestricted','allowed','banned','allowed','allowed','allowed',null,'no',null,false,'no',null,'conditional','Only for time and temperature-controlled-for-safety food',true,'No restrictions',true),
  ('OR',1,'Oregon Home Baking','oregon','allowed','allowed',null,50000,'annual_total',null,null,'limited','banned','conditional','banned','banned','banned','Baked goods and confectionery only; under 1,000 personally-raised poultry','no',null,false,'no',null,'yes',null,false,'No restrictions',true),
  ('OR',2,'Oregon Farm Direct','oregon','allowed','allowed',null,20000,'annual_total',null,null,'limited','banned','conditional','allowed','banned','allowed','Canned fruit, chutney, flour, nuts, jams, jellies, popcorn, preserves and syrups','no',null,false,'yes',null,'yes',null,false,'No restrictions',false),
  ('OR',3,'Oregon Domestic Kitchen','oregon','allowed','allowed',null,null,'none',null,null,'unrestricted','allowed','conditional','allowed','banned','allowed','Under 1,000 personally-raised poultry','yes',null,true,'conditional','Acidified food only','yes',null,false,'No restrictions',true),
  ('PA',1,'Limited Food Establishment','pennsylvania','allowed','allowed',null,null,'none',null,null,'unrestricted','banned','conditional','allowed','banned','allowed','Jerky','yes',null,true,'conditional','Acidified and fermented food','no',null,false,'No restrictions',true),
  ('RI',1,'Rhode Island Non-Farmers','rhode-island','allowed','allowed',null,50000,'annual_total',null,null,'unrestricted','banned','banned','banned','banned','banned',null,'yes',null,false,'no',null,'yes',null,false,'Farmers markets, roadside stands, events and from home. Inspectors may inspect home kitchens at any time.',false),
  ('RI',2,'Rhode Island Farm Home Food Manufacture','rhode-island','banned','banned',null,null,'none',null,null,'unrestricted','banned','banned','allowed','banned','banned',null,'yes',null,false,'yes',null,'no',null,false,'Farmers markets, farm stands, events and from home',true),
  ('SC',1,'Home-Based Food Production','south-carolina','allowed','allowed',null,null,'none',null,null,'unrestricted','banned','banned','banned','banned','banned',null,'no',null,false,'no',null,'no',null,false,'Farmers markets, roadside stands, events and from home',true),
  ('SD',1,'Cottage Food','south-dakota','allowed','banned',null,null,'none',null,null,'unrestricted','allowed','banned','allowed','banned','allowed',null,'no',null,false,'conditional','Canned goods only','conditional','Canned goods only',false,'No restrictions',false),
  ('TN',1,'Cottage Food','tennessee','allowed','allowed',null,null,'none',null,null,'unrestricted','banned','conditional','banned','banned','banned','Poultry only','no',null,false,'no',null,'no',null,true,'No restrictions',true),
  ('TX',1,'Cottage Food','texas','allowed','banned','Not through the mail or third-party carriers',150000,'annual_total',null,null,'unrestricted','allowed','banned','allowed','banned','allowed',null,'no',null,false,'conditional','Acidified, fermented and pickled canned foods','yes',null,true,'No restrictions',true),
  ('UT',1,'Utah Cottage Food','utah','allowed','allowed',null,null,'none',null,null,'list_only','banned','banned','allowed','banned','banned','Approved by the Department of Agriculture and Food','yes',null,true,'yes',null,'yes',null,true,'No restrictions',true),
  ('UT',2,'Utah Homemade Food','utah','allowed','allowed',null,null,'none',null,null,'unrestricted','allowed','conditional','allowed','allowed','allowed','Rabbit and fewer than 1,000 personally-raised poultry','no',null,false,'no',null,'no',null,true,'Generally no restrictions, but food sold is for home consumption only',false),
  ('UT',3,'Utah Microenterprise Home Kitchens','utah','allowed','allowed',null,null,'none',null,null,'conditional','conditional','allowed','banned','banned','banned','Food must be sold the same day it is made','yes',null,true,'yes',null,'yes',null,true,'Meals sold cannot be eaten at the kitchen',false),
  ('VT',1,'Vermont Home Baker','vermont','allowed','allowed',null,null,'none',null,6500,'limited','banned','banned','banned','banned','banned','Breads, cakes, muffins, cookies and other baked goods that need no refrigeration','conditional','No licence, inspection or training below $6,500 annual gross and no third-party sales; above that a licence, $100 fee and home inspection apply',false,'no',null,'no',null,false,'Farmers markets, roadside stands, special events, online with mail order, home delivery and pickup',false),
  ('VT',2,'Vermont Home Food Processor','vermont','allowed','allowed',null,null,'none',null,10000,'limited','banned','banned','allowed','banned','banned','Jams, jellies, candies, chocolates, salsas, sauces and salad dressings','conditional','No licence, inspection or training below $10,000 annual gross and no third-party sales',false,'no',null,'no',null,false,'Farmers markets, roadside stands, special events, online with mail order, home delivery and pickup',false),
  ('VT',3,'Vermont Home Caterer','vermont','allowed','banned',null,null,'none',null,null,'unrestricted','allowed','allowed','allowed','allowed','allowed','Prepared meals and foods containing meat or other products of animal origin','yes','Licence plus a $155 annual fee and a home inspection',true,'no',null,'no',null,false,'Must sell directly to consumers',false),
  ('VA',1,'Home Kitchen Exemptions','virginia','banned','banned',null,3000,'per_category','No general cap; $3,000 applies to acidified or pickled foods only',null,'unrestricted','banned','banned','allowed','banned','banned',null,'no',null,false,'no',null,'no',null,false,'Only at farmers markets and at home',false),
  ('VA',2,'Home Food Processing Operations','virginia','allowed','allowed',null,null,'none',null,null,'unrestricted','allowed','banned','allowed','banned','banned',null,'yes',null,true,'yes',null,'yes',null,false,'No restrictions',true),
  ('WA',1,'Cottage Food','washington','allowed','restricted','Source records mail as temporarily allowed during the pandemic; current status unconfirmed',35000,'annual_total',null,null,'list_only','banned','banned','banned','banned','banned','Department of Agriculture approved list','yes',null,true,'yes',null,'yes',null,false,'No restrictions',false),
  ('WV',1,'Cottage Food','west-virginia','allowed','allowed',null,null,'none',null,null,'unrestricted','banned','banned','banned','banned','banned',null,'no',null,false,'no',null,'no',null,true,'No restrictions',true),
  ('WI',1,'Wisconsin Home Baking','wisconsin','allowed','allowed',null,null,'none',null,null,'unrestricted','banned','conditional','banned','banned','banned','Under 1,000 personally-raised poultry and under 3,000 rabbits','no',null,false,'no',null,'no',null,false,'No restrictions',false),
  ('WI',2,'Wisconsin Home Canning','wisconsin','banned','banned',null,5000,'annual_total',null,null,'limited','banned','conditional','allowed','allowed','allowed','Acidified, fermented and pickled foods including applesauce, chutney, jams and jellies','no',null,false,'no',null,'no',null,false,'Only at farmers markets and events; selling from home is not allowed',false),
  ('WY',1,'Food Freedom Act','wyoming','allowed','allowed',null,250000,'annual_total',null,null,'unrestricted','allowed','allowed','allowed','allowed','allowed',null,'no',null,false,'no',null,'no',null,false,'No restrictions',true)
) as v(
  state_code, ordinal, name, slug,
  online_orders, mail_delivery, mail_note,
  revenue_cap, cap_basis, cap_note, license_threshold,
  shelf, refrig, meat, acid, lowacid, ferment, category_note,
  license_required, license_note, inspection_required,
  recipe_approval, recipe_note, training_required, training_note,
  local_preemption, venue_note, retail_allowed
);
