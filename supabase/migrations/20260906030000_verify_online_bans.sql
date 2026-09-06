-- Harvest Local — check every `online_orders = 'banned'` row against primary text.
--
-- This is the field with teeth. A wrong `banned` blocks a lawful seller from listing food at all; a
-- wrong `allowed` lets an unlawful listing through, which is what Washington was. Twelve rows
-- carried a ban, and only Washington had been checked. The other eleven were seeded from a summary,
-- and several `venue_note`s still read like summary prose rather than quoted law.
--
-- Nine hold. Two do not.
--
-- HOLD — express prohibition:
--   DE #1  3 Del. Admin. Code (cottage food): "3.1.3.2 Online sales are not permitted. Online
--          advertising and marketing are permitted."
--   MI     "to the consumer only, and not by internet or mail order."
--   MS     "may not sell cottage food products over the Internet, by mail order, or at wholesale"
--   NV     sales must be "by means of an in-person transaction that does not involve selling the
--          food item by telephone or via the Internet"
--   WA     RCW 69.22.020(4) (already verified)
--
-- HOLD — exclusive venue enumeration, which excludes the internet by leaving it out of an
-- exhaustive list rather than by naming it:
--   DE #2  on-farm products "may only be offered for sale by farmers markets, roadside produce
--          stands, or the processors farm"
--   ME #2  the Food Sovereignty Act reaches only a "direct producer-to-consumer transaction",
--          defined as an exchange "on the property or premises owned, leased or rented by the food
--          producer; at roadside stands, fundraisers, farmers' markets and community" events
--   RI #2  "the department of health shall permit farm home food manufacture and the sale of the
--          products ... at farmers markets, farmstands, and other markets and stores operated by
--          farmers"
--   WI #2  Wis. Stat. 97.29(2) exempts the canning route only "at a community or social event or a
--          farmers' market in this state"
--
-- HOLD — conditional, and correctly recorded on the EXEMPT row only:
--   NH #1  RSA 143-A:12 III — an operation that wishes to sell "over the Internet, by mail order"
--          "shall be licensed under RSA 143-A:4". Online selling is the trigger for licensure, so
--          it is unavailable on the exempt route by definition.
--
-- DO NOT HOLD:
--   HI     Haw. Admin. Rules 11-50-3(c) exempts a homemade-food operation subject to four special
--          conditions: food safety certification, a handwashing sink, labelling under 11-50-35(c),
--          and "Distribute food products only directly to the consumer." There is no venue list, no
--          channel restriction, and no mention of internet or mail anywhere in the cited rules.
--          "Directly to the consumer" is the same structure Minnesota uses while expressly ALLOWING
--          online sales with direct delivery, so it cannot carry a prohibition on its own.
--   KY #2  902 KAR 45:090 bars a home-based microprocessor's products from "a retail food
--          establishment or through interstate commerce" and is otherwise silent on channel. The
--          sibling route is express the other way — KRS 217.136(5) permits sale "from the home-based
--          processor's home, whether by pick-up or delivery, at a market, roadside stand, community
--          event, or online", and the regulation adds that a processor "may advertise and accept
--          orders and payments in person, electronically, or via the internet or phone."
--
-- Both become `unclear`, not `allowed`: the primary text does not prohibit online selling, and it
-- does not authorise it either. After `20260906010000` an unclear rule no longer blocks a seller,
-- which is the right outcome for a gap in our reference data — but it is recorded as the gap it is.
--
-- Consequence worth noting: Hawaii leaves the set of states banning online food sales under EVERY
-- programme, and Washington joins it. Still five states, a different five.

set search_path = public;

-- ---------------------------------------------------------------------------
-- The two that do not hold.
-- ---------------------------------------------------------------------------
update public.state_food_programs set
  online_orders = 'unclear',
  venue_note =
    'No channel or venue restriction in the cited rules. Haw. Admin. Rules 11-50-3(c) exempts an '
    'operation producing only homemade food products in a home kitchen subject to four special '
    'conditions: food safety certification under 11-50-20(c), a handwashing sink, labelling under '
    '11-50-35(c), and "Distribute food products only directly to the consumer." Internet, mail and '
    'sale venues are not mentioned anywhere. Recorded as unclear rather than banned: the previous '
    'ban was not supported by primary text. Note that Minnesota uses the same direct-to-consumer '
    'structure while expressly permitting online sales, so that phrase alone is not a prohibition.'
where state_code = 'HI' and ordinal = 1 and verified_at is null;

update public.state_food_programs set
  online_orders = 'unclear',
  venue_note =
    '902 KAR 45:090 prohibits a home-based microprocessor''s products from being "used or offered '
    'for consumption in a retail food establishment or through interstate commerce" and is silent '
    'on selling channel. The sibling home-based processor route is express the other way: KRS '
    '217.136(5) allows sale "directly to consumers within this state, including from the home-based '
    'processor''s home, whether by pick-up or delivery, at a market, roadside stand, community '
    'event, or online". Recorded as unclear rather than banned: nothing in the primary text bars '
    'the microprocessor from selling online.'
where state_code = 'KY' and ordinal = 2 and verified_at is null;

-- ---------------------------------------------------------------------------
-- The nine that hold — replacing summary prose with the words that carry the rule.
-- ---------------------------------------------------------------------------
update public.state_food_programs set
  venue_note =
    'Express prohibition. 3 Del. Admin. Code (cottage food establishments), 3.1.3: "3.1.3.1 CFE are '
    'only permitted to engage in direct sales with consumers in the State of Delaware. 3.1.3.2 '
    'Online sales are not permitted. Online advertising and marketing are permitted. 3.1.3.3 '
    'Wholesale or other sales to resellers or food establishments are not permitted by a CFE."'
where state_code = 'DE' and ordinal = 1 and verified_at is null;

update public.state_food_programs set
  venue_note =
    'Exclusive venue list. 3 Del. Admin. Code 101 (on-farm home processing): products produced, '
    'processed and labelled under the regulation "may only be offered for sale by farmers markets, '
    'roadside produce stands, or the processors farm." The internet is excluded by omission from an '
    'exhaustive list rather than named.'
where state_code = 'DE' and ordinal = 2 and verified_at is null;

update public.state_food_programs set
  venue_note =
    'Express prohibition. Michigan Food Law cottage food provisions: sales are "to the consumer '
    'only, and not by internet or mail order. Sales by consignment or at wholesale are prohibited."'
where state_code = 'MI' and ordinal = 1 and verified_at is null;

update public.state_food_programs set
  venue_note =
    'Express prohibition: "A cottage food operation may not sell cottage food products over the '
    'Internet, by mail order, or at wholesale or to a retail establishment; however, this does not '
    'prohibit the advertising of cottage food products over the Internet, including through social '
    'media." Advertising online is therefore fine; selling is not.'
where state_code = 'MS' and ordinal = 1 and verified_at is null;

update public.state_food_programs set
  venue_note =
    'Express prohibition. Nev. Rev. Stat. 446.866 / 587.6945: a food item must be sold "by means of '
    'an in-person transaction that does not involve selling the food item by telephone or via the '
    'Internet."'
where state_code = 'NV' and ordinal = 1 and verified_at is null;

update public.state_food_programs set
  venue_note =
    'Exclusive venue definition. The Maine Food Sovereignty Act reaches only a "direct '
    'producer-to-consumer transaction", defined at 7 M.R.S. 282(1) as an exchange "directly between '
    'a food producer and a consumer by barter, trade or purchase on the property or premises owned, '
    'leased or rented by the food producer; at roadside stands, fundraisers, farmers'' markets and '
    'community" events. An internet sale is not within that definition, so it falls outside the '
    'exemption rather than being prohibited by name — a seller wanting to sell online is on the '
    'licensed Home Food Manufacturing route instead.'
where state_code = 'ME' and ordinal = 2 and verified_at is null;

update public.state_food_programs set
  venue_note =
    'Conditional, and it is the exempt route that is constrained. N.H. Rev. Stat. 143-A:12 II '
    'exempts homestead food operations selling "from the homestead residence, at the owner''s own '
    'farm stand, at farmers'' markets, or at retail food stores", while III provides that operations '
    'wishing to sell "over the Internet, by mail order, or to wholesalers, brokers, or other food '
    'distributors who will resell the homestead product shall be licensed under RSA 143-A:4." '
    'Selling online is itself the trigger for licensure, so it is unavailable on this exempt route '
    'by definition — the licensed route permits it.'
where state_code = 'NH' and ordinal = 1 and verified_at is null;

update public.state_food_programs set
  venue_note =
    'Exclusive venue list. R.I. Gen. Laws 21-27-6.1: "the department of health shall permit farm '
    'home food manufacture and the sale of the products of farm home food manufacture at farmers '
    'markets, farmstands, and other markets and stores operated by farmers for the purpose of the '
    'retail sale of the products of Rhode Island farms". The permission is granted for those '
    'venues; the internet is not among them. The kitchen must also be on the premises of a farm.'
where state_code = 'RI' and ordinal = 2 and verified_at is null;

update public.state_food_programs set
  venue_note =
    'Exclusive venue list. Wis. Stat. 97.29(2) exempts the home canning route from the food '
    'processing plant licence only for "pickles or other processed vegetables or fruits with an '
    'equilibrium pH value of 4.6 or lower", only where the seller "receives less than $5,000 per '
    'year from the sale of the food products", and only "at a community or social event or a '
    'farmers'' market in this state". An internet sale is outside that list. Wisconsin''s other home '
    'route — baked goods — rests on a 2017 Lafayette County Circuit Court injunction rather than a '
    'statute, and carries no such venue restriction.'
where state_code = 'WI' and ordinal = 2 and verified_at is null;
