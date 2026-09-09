-- Harvest Local — a tomato is not a cottage food product.
--
-- ===========================================================================
-- THE BUG
-- ===========================================================================
-- `categories.requires_food_permit` was seeded true for every food top-level including **Produce**,
-- with its own comment admitting "Not a legal determination - an admin should confirm it against
-- their state rules" (20260904130000). Nobody ever did, and it is the load-bearing flag for five
-- separate gates. A grower listing tomatoes today must:
--
--   * hold a verified **Cottage Food Permit** before their storefront will open at all
--     (`seller_sells_cottage_food` → rule 5),
--   * choose a cottage food **programme** before the listing can go live (20260904210000),
--   * supply an **ingredients list** and a **net weight** for a tomato (20260905110000),
--   * answer the **allergen** question for a tomato (20260905120000),
--   * and in **DE, MI, MS, NV and WA** they may not list it online at all, because the
--     online-sales gate keys on this same flag (20260904180000).
--
-- That last one is the sharpest. RCW 69.22 is Washington's **Cottage Food Operations** act: it
-- governs food prepared in a home kitchen. It has nothing to say about a farmer selling the
-- vegetables they grew, and we were using it to stop them.
--
-- ===========================================================================
-- WHY THIS IS A CORRECTION AND NOT A JUDGEMENT CALL
-- ===========================================================================
-- Every state's cottage food law is defined by an ACT — preparing, processing, canning, baking food
-- in a domestic kitchen. A raw agricultural commodity sold by the person who grew it is not that
-- act. It may be regulated by other things (produce-safety rules, market by-laws, weights and
-- measures) but it is not regulated by the cottage food statute, and this flag gates on holding a
-- **cottage food permit** specifically.
--
-- The precedent is Hawaii (CLAUDE.md rule 6): a row seeded to block on no authority, blocking
-- lawful trade, corrected once somebody read it. Blocking legal trade and permitting illegal trade
-- are not symmetrical errors, but neither is acceptable, and this one blocks the audience the
-- product names first — "a local map for FARMERS, artisans and makers".
--
-- ===========================================================================
-- WHERE THE LINE IS, AND HOW IT IS ENFORCED
-- ===========================================================================
-- The moment produce is processed it becomes cottage food and belongs elsewhere in the catalogue:
-- jam is Pantry & Preserves, juice is Beverages, a dried herb blend is Sauces & Spices — all of
-- which keep the flag. The boundary is therefore carried by the CATEGORY NAMES rather than by a
-- comment nobody reads, which is why "Herbs" becomes "Fresh Herbs" below: a seller with a jar of
-- dried oregano should not find a home for it under Produce.
--
-- `food_axes` stays empty for Produce, and now consistently so: fresh produce is not one of the six
-- axes `state_food_programs` grades, because those axes are about processed food too.

set search_path = public;

update public.categories c
   set requires_food_permit = false
 where c.slug = 'produce'
    or c.parent_id = (select id from public.categories where slug = 'produce');

-- The boundary, in the name. "Herbs" is ambiguous exactly where it matters: a bunch of cut basil is
-- produce, a jar of dried oregano is a shelf-stable cottage food product that needs a label.
update public.categories
   set name = 'Fresh Herbs'
 where slug = 'herbs'
   and parent_id = (select id from public.categories where slug = 'produce');

comment on column public.categories.requires_food_permit is
  'Listing in this category requires a verified COTTAGE FOOD permit — i.e. the food is prepared in '
  'a home kitchen. False for flowers, crafts and for raw produce, which is an agricultural product '
  'rather than a cottage food one (see 20260909150000). It is the single flag behind the licence '
  'gate, the programme requirement, the label and allergen guards and the online-sales ban, so '
  'changing it changes five things at once.';

-- ---------------------------------------------------------------------------
-- Re-run the licence gate for anyone this frees.
--
-- `sync_seller_license_pause` is normally re-run by a trigger on `products` when a seller's
-- catalogue changes. Editing a CATEGORY fires nothing, so a grower currently paused for a
-- cottage-food permit they never needed would stay paused until they happened to touch a listing.
-- Fixing the rule without fixing the sellers it wrongly caught is half a fix.
-- ---------------------------------------------------------------------------
do $$
declare
  v_seller uuid;
begin
  for v_seller in
    select distinct sp.id
      from public.seller_profiles sp
     where sp.is_paused
       and sp.pause_reason in ('license_unverified', 'license_expired')
  loop
    perform public.sync_seller_license_pause(v_seller);
  end loop;
end;
$$;
