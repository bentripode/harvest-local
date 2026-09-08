-- Harvest Local — the pre-sale disclosure is not the label, and in five rows we published as if it were.
--
-- 20260907230000 fixed Texas: § 437.0194(c)(1) excuses the producer's address from the disclosure
-- shown before payment, and we were publishing it to anonymous browsers anyway. This is the same
-- question asked of the other ten predisclosure jurisdictions, against primary text in every case.
--
-- IT IS NOT A TEXAS PROBLEM. `predisclosure_required` is a boolean, so the renderer had exactly one
-- behaviour: show the WHOLE LABEL on the listing. That is right in four states and wrong in five,
-- because what a state requires BEFORE the sale and what it requires ON THE JAR are different
-- documents with different contents. Where the pre-sale duty is narrower, the extra fields we
-- rendered were not a tidy surplus — they were a seller's home address, published to anyone
-- browsing, in California, Minnesota, Nebraska and Utah.
--
-- =========================================================================
-- WHAT EACH STATE ACTUALLY REQUIRES BEFORE THE SALE
-- =========================================================================
-- Read 2026-09-07, each from the jurisdiction's own text.
--
--   FULL LABEL — no change. The statute puts the whole information set on the page:
--
--     IN  Ind. Code 16-42-5.3-5(b): "A home based vendor shall post the label of each food product
--         on the vendor's website." The (a) label includes "(1) The name and address of the
--         producer". The address is genuinely owed.
--     NM  N.M. Stat. 25-12-3(B): the information required by subsection C "in the following manner:
--         ... (4) on a webpage on which the homemade food item is offered for sale". Subsection C is
--         name, home address, telephone number and email address of the processor.
--     OK  Okla. Stat. tit. 2 § 5-4.3(B): the paragraph 6 information "shall be provided ... 4.
--         Displayed on the webpage from which the homemade food product is offered for sale".
--     TN  Tenn. Code § 53-1-118(b)(3): "The following information must be provided to the consumer,
--         in the format required by subdivision (b)(4)", and (b)(4)(iv) is "On the webpage on which
--         the homemade food item is offered for sale".
--
--   NARROWER — five rows corrected here:
--
--     CA  Health & Saf. Code § 114365.3(f) — read at leginfo, chapter 11.5: an operation that
--         advertises "including through an internet website, social media platform, newspaper,
--         newsletter, or other public announcement, shall indicate the following on the
--         advertisement: (1) The county of approval. (2) The permit or registration number. (3) A
--         statement that the food prepared is 'Made in a Home Kitchen' or 'Repackaged in a Home
--         Kitchen,' as applicable."
--         THREE THINGS, and the producer's address is not among them — nor is it in the (e) label
--         list, where it comes only from federal 21 U.S.C. 343. We were publishing eight elements.
--     IL  410 ILCS 625/4(b)(10): "At the point of sale, notice must be provided in a prominent
--         location that states the following: [sentence]. At a physical display, notice shall be a
--         placard. Online, notice shall be a message on the cottage food operation's online sales
--         interface at the point of sale." A NOTICE, not a label — and a DIFFERENT SENTENCE from the
--         (b)(7)(E) label phrase, which carries a further "If you have safety concerns" line.
--     MN  Minn. Stat. 28A.152 subd. 2(d): "Food products exempt under subdivision 1 may be sold over
--         the Internet. The statement "These products are homemade and not subject to state
--         inspection." must be displayed on the website that offers the exempt foods for purchase."
--         The statement. Nothing else. We rendered the producer's name and, through the identity
--         alternatives group, their home address.
--     NE  Neb. Rev. Stat. 81-2,280(5)(c): "such notification shall be provided at the producer's
--         private home, on the producer's website, if such website exists, and in any print, radio,
--         television, or Internet advertisement". "Such notification" is (5)(a) — that the food was
--         prepared in an unregulated kitchen and may contain allergens. The name and address duty is
--         in (6) and is expressly "on the package or container label".
--     UT  Utah Code § 4-5a-104(6): "A producer selling homemade food or homemade food products
--         exempt under this section shall inform the final consumer that the food or food product is
--         not certified, licensed, regulated, or inspected by the state or any county or city."
--         ONE FACT. The name and address are in (3), which is the label.
--
--     WY  Wyo. Stat. 11-49-102(a)(v) / 11-49-103(e) — already only the statement; recorded
--         explicitly so a later change to the label list cannot widen the listing by accident.
--
-- =========================================================================
-- THE MECHANISM
-- =========================================================================
-- `predisclosure_elements` is NULL where the whole label is owed — the four states above keep
-- exactly the behaviour they have — and a (possibly empty) array where the state named a narrower
-- set. Empty is meaningful: Minnesota and Illinois owe the sentence and no fields at all.
--
-- This is deliberately NOT the same mechanism as `address_withheld_until_payment`. Texas owes the
-- full label MINUS one element, on a timing rule, with its either/or group collapsing too; the other
-- five owe a short enumerated set. One narrows a list, the other suspends an element. They compose,
-- and Texas keeps its flag.
--
-- `predisclosure_disclaimer_text` exists for Illinois alone: the state prescribes one sentence for
-- the jar and a shorter one for the online interface, and `disclaimer_text` is the column that holds
-- quoted law printed onto food. Storing the online notice there would print the wrong sentence on a
-- jar; storing the jar's sentence online shows a Illinoisan buyer text the statute did not prescribe
-- for that place.
--
-- =========================================================================
-- WHAT THIS MIGRATION DOES NOT FIX
-- =========================================================================
-- Two defects were found in the same reading and are NOT addressed here, because each needs a field
-- that does not exist and inventing one silently is how the last batch of errors got in:
--
--   CALIFORNIA'S `municipality` IS THE WRONG VALUE. § 114365.3(f)(1) wants "the county of approval"
--   — the county of the local enforcement agency that issued the registration. Our `municipality`
--   element resolves to the seller's PICKUP ADDRESS TOWN and is captioned "Town or municipality". A
--   seller registered in one county and living in a town of another publishes a false county. This
--   migration narrows California's disclosure to what (f) requires and therefore makes the wrong
--   value MORE prominent, not less: it is now one of two fields. It needs a county-of-approval field
--   on the licence, and until then California's disclosure is incomplete in substance.
--
--   OKLAHOMA'S REGISTRATION NUMBER REPLACES THREE ELEMENTS AT ONCE. § 5-4.3(C): a producer paying
--   $15 a year gets a number that "may be used on product labels instead of the producer's name,
--   phone number, and the physical address of the location where the homemade food product was
--   produced." `element_alternatives` groups are "at least one of these", which cannot express "if
--   this one is present, drop those three" — so an Oklahoman who bought the number still has their
--   home address published. Same shape as the Texas 437.0193(b-1) case fixed in 20260907100000, but
--   three-for-one, and it needs a new kind of group.

set search_path = public;

-- ---------------------------------------------------------------------------
-- Columns
-- ---------------------------------------------------------------------------
alter table public.state_label_rules
  add column if not exists predisclosure_elements text[],
  add column if not exists predisclosure_disclaimer_text text;

comment on column public.state_label_rules.predisclosure_elements is
  'Exactly what the state requires a buyer to be shown BEFORE the sale, where that is narrower than '
  'the physical label. NULL means the whole label is owed (IN, NM, OK and TN each put the full '
  'information set on the webpage). An empty array means the statement alone, with no fields — '
  'Minnesota 28A.152 subd. 2(d) and Illinois 410 ILCS 625/4(b)(10) both read that way.';

comment on column public.state_label_rules.predisclosure_disclaimer_text is
  'The state''s own words for the PRE-SALE notice, where they differ from the sentence prescribed '
  'for the label. Illinois is the case: 410 ILCS 625/4(b)(7)(E) puts one sentence on the package and '
  '(b)(10) a shorter one on the online sales interface. Verbatim quoted law, like disclaimer_text, '
  'and null everywhere the two are the same.';

-- A narrowed set only means anything where a pre-sale duty exists at all.
alter table public.state_label_rules
  drop constraint if exists state_label_rules_predisclosure_scope;
alter table public.state_label_rules
  add constraint state_label_rules_predisclosure_scope check (
    (predisclosure_elements is null and predisclosure_disclaimer_text is null)
    or predisclosure_required
  );

-- ---------------------------------------------------------------------------
-- California — § 114365.3(f): county of approval, permit number, the statement.
-- ---------------------------------------------------------------------------
update public.state_label_rules set
  predisclosure_elements = array['municipality', 'permit_number'],
  source_url = 'https://leginfo.legislature.ca.gov/faces/codes_displayText.xhtml?lawCode=HSC&division=104.&title=&part=7.&chapter=11.5.',
  source_etag = null,
  source_last_modified = null,
  source_content_hash = null,
  source_signal = null,
  source_fetched_at = null,
  source_changed_at = null,
  notes = notes ||
    ' PREDISCLOSURE NARROWED (20260907240000): § 114365.3(f) was read in full at leginfo, chapter '
    '11.5, on 2026-09-07 — the previous source was a National Agricultural Law Center compilation '
    'and this row is now on the state''s own text. (f) requires an operation advertising "through '
    'an internet website, social media platform, newspaper, newsletter, or other public '
    'announcement" to indicate THREE things: "(1) The county of approval. (2) The permit or '
    'registration number. (3) A statement that the food prepared is ''Made in a Home Kitchen'' or '
    '''Repackaged in a Home Kitchen,'' as applicable." The producer''s address is not one of them, '
    'and is not in the (e) label list either — it reaches the jar only through federal 21 U.S.C. '
    '343. We were publishing eight elements including that address on every Californian listing. '
    'KNOWN DEFECT REMAINING: (f)(1) wants the COUNTY OF APPROVAL and our municipality element '
    'resolves to the seller''s pickup-address town. Narrowing makes that wrong value one of two '
    'fields rather than one of eight. It needs a county field on the licence.'
where program_id in (select id from public.state_food_programs where state_code = 'CA' and ordinal in (1, 2))
  and notes not like '%20260907240000%';

-- ---------------------------------------------------------------------------
-- Illinois — a notice, and a different sentence from the label's.
-- ---------------------------------------------------------------------------
update public.state_label_rules set
  predisclosure_elements = array[]::text[],
  predisclosure_disclaimer_text =
    'This product was produced in a home kitchen not inspected by a health department that may also '
    'process common food allergens.',
  source_url = 'https://www.ilga.gov/Legislation/ILCS/FullText?DocName=041006250K4',
  source_etag = null,
  source_last_modified = null,
  source_content_hash = null,
  source_signal = null,
  source_fetched_at = null,
  source_changed_at = null,
  notes = notes ||
    ' PREDISCLOSURE NARROWED (20260907240000): 410 ILCS 625/4(b)(10) was re-read on 2026-09-07 at '
    'ilga.gov and requires a NOTICE, not a label — "Online, notice shall be a message on the cottage '
    'food operation''s online sales interface at the point of sale." The seven label elements this '
    'row carries belong to (b)(7) and go on the package. THE SENTENCE IS ALSO DIFFERENT: (b)(10) '
    'stops at "...may also process common food allergens." while the (b)(7)(E) label phrase '
    'continues "If you have safety concerns, contact your local health department." Both are quoted '
    'law and both are now stored in their own columns, so the listing shows the sentence the statute '
    'wrote for the listing. Source repointed from the compilation to ilga.gov.'
where program_id in (select id from public.state_food_programs where state_code = 'IL' and ordinal = 1)
  and notes not like '%20260907240000%';

-- ---------------------------------------------------------------------------
-- Minnesota — subd. 2(d) asks for the statement and nothing else.
-- ---------------------------------------------------------------------------
update public.state_label_rules set
  predisclosure_elements = array[]::text[],
  notes = notes ||
    ' PREDISCLOSURE NARROWED (20260907240000): Minn. Stat. 28A.152 subd. 2(d), read 2026-09-07 at '
    'revisor.mn.gov — "Food products exempt under subdivision 1 may be sold over the Internet. The '
    'statement "These products are homemade and not subject to state inspection." must be displayed '
    'on the website that offers the exempt foods for purchase." THE STATEMENT, AND NOTHING ELSE. '
    'The label elements on this row come from subd. 1(a)(1)(i) and go on the food. We had been '
    'rendering them on the listing, which meant a Minnesotan seller with no registration number had '
    'their HOME ADDRESS published through the identity alternatives group — to satisfy a subsection '
    'that asks only for one sentence.'
where program_id in (select id from public.state_food_programs where state_code = 'MN' and ordinal = 1)
  and notes not like '%20260907240000%';

-- ---------------------------------------------------------------------------
-- Nebraska — (5)(c) carries the (5)(a) notification; (6) is the package label.
-- ---------------------------------------------------------------------------
update public.state_label_rules set
  predisclosure_elements = array['seller_statement'],
  notes = notes ||
    ' PREDISCLOSURE NARROWED (20260907240000): Neb. Rev. Stat. 81-2,280 re-read 2026-09-07. (5)(c) '
    'requires "such notification" on the producer''s website, and "such notification" is (5)(a) — '
    'that the food "(i) Was prepared in a kitchen that is not subject to regulation and inspection '
    'by a regulatory authority; and (ii) May contain allergens." THE NAME AND ADDRESS DUTY IS A '
    'DIFFERENT SUBSECTION AND A DIFFERENT PLACE: (6) requires them "on the package or container '
    'label", and says nothing about a website. We were publishing the producer''s name and home '
    'address on the listing on the strength of (6). The warning this row already carried — that a '
    'Nebraska listing does not yet render the seller_statement (5)(c) actually requires — is now '
    'the whole of what is owed here, and homemade_food_statement supplies it.'
where program_id in (select id from public.state_food_programs where state_code = 'NE' and ordinal = 1)
  and notes not like '%20260907240000%';

-- ---------------------------------------------------------------------------
-- Utah — § 4-5a-104(6) is one fact about inspection, not the label.
-- ---------------------------------------------------------------------------
update public.state_label_rules set
  predisclosure_elements = array['seller_statement'],
  notes = notes ||
    ' PREDISCLOSURE NARROWED (20260907240000): Utah Code § 4-5a-104 read 2026-09-07 at le.utah.gov '
    '(version effective 5/6/2026). (6) is the pre-sale duty and it is ONE FACT: "A producer selling '
    'homemade food or homemade food products exempt under this section shall inform the final '
    'consumer that the food or food product is not certified, licensed, regulated, or inspected by '
    'the state or any county or city." The producer''s name and address are in (3), which is headed '
    'by "food or food products sold under this section shall be LABELED with" — the jar, not the '
    'listing. We were publishing a Utah seller''s home address to satisfy a subsection about being '
    'told one thing. The allergen statement in (3)(c) is likewise a label duty; allergens still '
    'reach the buyer through the storefront''s own product fields.'
where program_id in (select id from public.state_food_programs where state_code = 'UT' and ordinal = 2)
  and notes not like '%20260907240000%';

-- ---------------------------------------------------------------------------
-- Wyoming — already only the statement. Recorded so it cannot widen by accident.
-- ---------------------------------------------------------------------------
update public.state_label_rules set
  predisclosure_elements = array['seller_statement'],
  notes = notes ||
    ' PREDISCLOSURE RECORDED (20260907240000): Wyoming already required nothing but the statement, '
    'because 11-49-103(b) exempts homemade food from state packaging and labeling requirements '
    'outright, so required_elements happened to hold the right single value. Stating it explicitly '
    'means a later correction to the label list cannot silently widen what a Wyoming listing '
    'publishes.'
where program_id in (select id from public.state_food_programs where state_code = 'WY' and ordinal = 1)
  and notes not like '%20260907240000%';

-- ---------------------------------------------------------------------------
-- Oklahoma — the citation was wrong, and the reading that found it is recorded.
-- ---------------------------------------------------------------------------
-- This row cited "Okla. Stat. tit. 2 5-4.2" and pointed at Justia's § 2-5-4.2, which is DEFINITIONS.
-- The labelling provision — (A)(6), the four delivery contexts in (B), and the registration number
-- in (C) — is § 5-4.3. The scope is unchanged: (B)(4) genuinely puts the whole set on the webpage.
update public.state_label_rules set
  source_url = 'https://law.justia.com/codes/oklahoma/title-2/section-2-5-4-3/',
  notes = notes ||
    ' CITATION CORRECTED (20260907240000): this row cited § 5-4.2 and linked a page whose heading is '
    '"§2-5-4.2. Definitions." The labelling section is § 5-4.3 — it carries (A)(6), the four '
    'delivery contexts in (B), and the registration number in (C), all read 2026-09-07. Oklahoma''s '
    'own HB1032 enrolled act refers to a further "5-4.4, which relates to labeling", which is the '
    'pre-2017 numbering; Justia''s current § 2-5-4.4 is "Reported foodborne illness". THE SCOPE IS '
    'UNCHANGED AND CORRECT: (B) says the paragraph 6 information "shall be provided ... 4. Displayed '
    'on the webpage from which the homemade food product is offered for sale", so the full set '
    'including the physical address is genuinely owed before the sale and predisclosure_elements '
    'stays null. STILL UNEXPRESSED: (C) lets a producer paying $15 a year use a registration number '
    '"instead of the producer''s name, phone number, and the physical address" — a three-for-one '
    'substitution element_alternatives cannot state, so an Oklahoman who bought the number still '
    'publishes their home address.'
where program_id in (select id from public.state_food_programs where state_code = 'OK' and ordinal = 1)
  and notes not like '%20260907240000%';

-- ---------------------------------------------------------------------------
-- The disclosure function: narrow to what the state asks before the sale.
-- ---------------------------------------------------------------------------
-- Gating the RETURNED COLUMNS matters, not just the element list. The function is granted to `anon`
-- and is reachable directly over PostgREST, so a caller who ignores `required_elements` must still
-- not receive an address the state never asked to have published.
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
      -- The pre-sale set where the state named one, the whole label where it did not.
      coalesce(lr.predisclosure_elements, lr.required_elements) as required_elements,
      case when lr.predisclosure_elements is not null then '{}'::text[]
           else lr.optional_elements end as optional_elements,
      case when lr.predisclosure_elements is not null then '[]'::jsonb
           else lr.element_alternatives end as element_alternatives,
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
    -- Withheld where the state says it need not be shown before payment (TX 437.0194(c)(1)), and
    -- otherwise returned only where the pre-sale rule names it. The seller's own label page reads
    -- the profile directly and still prints it, which is what the label statutes require.
    case
      when asks.address_withheld or asks.address_id is null then null
      when not ('producer_address' = any(coalesce(asks.named_elements, '{}'::text[]))) then null
      else concat_ws(', ', concat_ws(' ', asks.line1, nullif(asks.line2, '')), asks.city,
                     concat_ws(' ', asks.state, asks.postal_code))
    end,
    case when 'mailing_address' = any(coalesce(asks.named_elements, '{}'::text[]))
         then asks.mailing_address else null end,
    -- The town travels with the address when Texas withholds it, and otherwise appears only where
    -- the pre-sale rule names it. California is the one state that needs it before a sale, and
    -- 114365.3(f)(1) actually wants the COUNTY OF APPROVAL — see this migration's header.
    case
      when asks.address_withheld then null
      when not ('municipality' = any(coalesce(asks.named_elements, '{}'::text[]))) then null
      else asks.city
    end,
    case when 'producer_phone' = any(coalesce(asks.named_elements, '{}'::text[]))
         then asks.contact_phone else null end,
    case when 'producer_email' = any(coalesce(asks.named_elements, '{}'::text[]))
         then (select au.email from auth.users au where au.id = asks.profile_id) else null end,
    case when 'producer_id_number' = any(coalesce(asks.named_elements, '{}'::text[]))
         then asks.producer_id_number else null end,
    case when 'permit_number' = any(coalesce(asks.named_elements, '{}'::text[]))
         then (select sl.license_number
                 from public.seller_licenses sl
                 where sl.seller_id = asks.seller_id
                   and sl.verification_status = 'verified'
                   and sl.license_number is not null
                 order by sl.created_at
                 limit 1)
         else null end,
    case when 'seller_statement' = any(coalesce(asks.named_elements, '{}'::text[]))
         then asks.homemade_food_statement else null end,
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
  'What a buyer must be shown before paying, where the state requires it — which is NOT always the '
  'physical label. Returns state_label_rules.predisclosure_elements where the state named a '
  'narrower pre-sale set (CA, IL, MN, NE, UT, WY) and the full label where it did not (IN, NM, OK, '
  'TN). Every identifying field — address, town, telephone, email, registration number, mailing '
  'address, permit number, seller statement — is returned ONLY where that resolved set names it, '
  'and the address is withheld entirely where the state permits it to wait until after payment '
  '(Tex. Health & Safety Code 437.0194(c)). Product facts are not gated: they are on the storefront '
  'already.';

revoke all on function public.product_label_disclosure(uuid) from public;
grant execute on function public.product_label_disclosure(uuid) to anon, authenticated, service_role;
