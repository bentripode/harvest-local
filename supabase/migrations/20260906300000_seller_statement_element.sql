-- Harvest Local — a statement whose SUBSTANCE the state prescribes and whose WORDING it does not.
--
-- La. Rev. Stat. 40:4.9(D)(1)(a): "any individual who prepares low-risk foods in the home for sale,
-- as authorized by this Section, shall affix to any such food offered for sale a label which clearly
-- indicates that the food was not produced in a licensed or regulated facility."
--
-- Every other disclaimer in this table is quoted statute — a sentence the legislature wrote, stored
-- verbatim and printed as-is. Louisiana wrote no sentence. It stated a fact the label must convey
-- and left the words to the producer.
--
-- That is why Louisiana has been one of the five states this generator refuses to print for. It was
-- recorded as "rule unknown", which was true when nobody had read 40:4.9 and is false now: the rule
-- is known, and it simply cannot be satisfied by a string we hold.
--
-- Writing a sentence ourselves and storing it in `disclaimer_text` would be the easy fix and the
-- wrong one. That column is quoted law, printed onto food without review, and the moment it contains
-- our prose the guarantee that makes it safe is gone — for every state, not just this one.
--
-- So: `seller_statement` is an element the SELLER supplies, at print time, like the production date
-- and the lot code. `seller_statement_prompt` carries the state's own words describing what the
-- statement must convey, so the print form can put the requirement in front of the person writing
-- it. Missing until they write one, which is correct — Louisiana requires the statement, and a label
-- without it is unlawful.

set search_path = public;

alter table public.state_label_rules
  add column if not exists seller_statement_prompt text;

comment on column public.state_label_rules.seller_statement_prompt is
  'What a seller-written statement must convey, in the state''s own words, where the state '
  'prescribes the substance but not the wording (La. Rev. Stat. 40:4.9(D)(1)(a)). Paired with the '
  '`seller_statement` element and shown on the print form. Never a sentence we composed: this is a '
  'description of a requirement, not label text.';

alter table public.state_label_rules
  drop constraint if exists state_label_rules_elements_known;

alter table public.state_label_rules
  add constraint state_label_rules_elements_known
    check (
      required_elements <@ array[
        'product_name', 'producer_name', 'business_name', 'producer_address', 'producer_phone',
        'producer_email', 'permit_number', 'municipality', 'municipality_state',
        'ingredients_desc_by_weight', 'net_weight', 'allergens', 'production_date', 'lot_code',
        'expiration_date', 'nutrition_if_claimed', 'regulator_website', 'seller_statement'
      ]::text[]
      and optional_elements <@ array[
        'product_name', 'producer_name', 'business_name', 'producer_address', 'producer_phone',
        'producer_email', 'permit_number', 'municipality', 'municipality_state',
        'ingredients_desc_by_weight', 'net_weight', 'allergens', 'production_date', 'lot_code',
        'expiration_date', 'nutrition_if_claimed', 'regulator_website', 'seller_statement'
      ]::text[]
    );

-- A rule that asks for the element must say what the statement has to convey, or the seller is
-- being asked to write something with no idea what.
alter table public.state_label_rules
  add constraint state_label_rules_seller_statement_prompted
    check (
      not ('seller_statement' = any(required_elements) or 'seller_statement' = any(optional_elements))
      or seller_statement_prompt is not null
    );
