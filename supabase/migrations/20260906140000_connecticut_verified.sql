-- Harvest Local — Connecticut, from Conn. Gen. Stat. 21a-62b to 21a-62h.
--
-- The closest to correct so far. The disclaimer was already verbatim and already carried the right
-- minimum size. One element had to go.
--
-- NET WEIGHT IS NOT REQUIRED. 21a-62g lists the label contents exhaustively: "(1) The name and
-- address of the cottage food operation; (2) The common or usual name of the cottage food product;
-- (3) The ingredients of the cottage food product, in descending order of predominance by weight or
-- volume; (4) Allergen information, as specified by federal labeling requirements ...; and (5) The
-- following statement printed in at least ten-point type in a clear and conspicuous manner that
-- provides contrast to the background label: Made in a Cottage Food Operation that is not Subject
-- to Routine Government Food Safety Inspection."
--
-- Net weight appears nowhere in it. Requiring it made `renderLabel()` refuse to print until a
-- Connecticut seller filled in a field their state does not ask for — and since
-- `products_guard_label_fields` also demands a net weight before a food listing may be published,
-- the effect reached further than the label generator.
--
-- Note the ordering rule is looser than most: "by weight OR VOLUME", which our single
-- `ingredients_desc_by_weight` element cannot distinguish. It does not matter in practice — a list
-- in descending order by weight satisfies the statute — but it is recorded so nobody reads the
-- element name as the whole rule.
--
-- Also confirmed against 21a-62f(b), which bans "Potentially hazardous food items" and "Food items
-- that present a food safety risk, such as acidified foods, low acid canned foods, garlic in oil,
-- fresh fruit or vegetable juices and beverages" — so the acidified, low-acid-canned and
-- refrigerated axes were already right to be banned.
--
-- The label section applies to PREPACKAGED products: "If a cottage food operation sells cottage
-- food products that are prepackaged, such packaging shall include an affixed label". Connecticut
-- says nothing here about unpackaged sales, unlike Arkansas which routes the same disclosures to a
-- placard or a website.
--
-- `verified_at` stays null.

set search_path = public;

update public.state_label_rules set
  required_elements = array[
    'business_name', 'producer_address', 'product_name',
    'ingredients_desc_by_weight', 'allergens'
  ],
  disclaimer_font_note =
    'At least ten-point type, "in a clear and conspicuous manner that provides contrast to the '
    'background label" (Conn. Gen. Stat. 21a-62g(5)).',
  notes =
    'Conn. Gen. Stat. 21a-62g, read 2026-09-06. NET WEIGHT REMOVED — it is not in the statutory '
    'list, and requiring it blocked both the label generator and, through '
    'products_guard_label_fields, the publishing of a Connecticut food listing. The five items the '
    'statute does require are the operation''s name and address, the common or usual name of the '
    'product, the ingredients in descending order, allergen information per federal requirements, '
    'and the quoted statement. The section governs PREPACKAGED products only; Connecticut does not '
    'say here what an unpackaged sale must carry. The ordering rule is "by weight or volume", '
    'slightly looser than the element name suggests.',
  source_url = 'https://nationalaglawcenter.org/wp-content/uploads/assets/cottagefood/Connecticut.pdf',
  source_checked_at = '2026-09-06'
where program_id in (
  select id from public.state_food_programs where state_code = 'CT' and ordinal = 1
)
and verified_at is null;

update public.state_food_programs set
  category_note =
    'Conn. Gen. Stat. 21a-62f: "(a) A cottage food operation may produce food items that are not '
    'potentially hazardous food. (b) A cottage food operation shall not produce: (1) Potentially '
    'hazardous food items; and (2) Food items that present a food safety risk, such as acidified '
    'foods, low acid canned foods, garlic in oil, fresh fruit or vegetable juices and beverages." '
    'The juice and beverage exclusion has no axis here and is not otherwise recorded.',
  license_note =
    '21a-62c(a): "All cottage food operations shall be licensed annually by the Commissioner of '
    'Consumer Protection", fee capped at $100, with the premises examined before licensing, potable-'
    'water testing where the supply is private, and a completed food safety training programme. '
    '21a-62d(a) caps annual gross sales at $50,000, above which the operation "shall either obtain '
    'a food manufacturing establishment license or cease operations."',
  source_url = 'https://nationalaglawcenter.org/wp-content/uploads/assets/cottagefood/Connecticut.pdf'
where state_code = 'CT' and ordinal = 1 and verified_at is null;
