-- Harvest Local — DC, PA, TN and WI, from sources the earlier compilation did not cover.
--
-- `20260905140000` seeded 46 states from the National Agricultural Law Center compilation and left
-- five behind because that source could not answer them: it has no entry for DC, NC or TN, and its
-- Pennsylvania and Wisconsin entries reproduce the wrong statute (retail food facility supply and
-- retail food establishment licensing respectively, rather than the direct-to-consumer routes).
--
-- Four of the five are settled here from their own primary sources. Two were not what the earlier
-- reading would have produced:
--
--   * TENNESSEE's cottage food section, Tenn. Code 53-8-117, was REPEALED. It was replaced from
--     1 July 2022 by the Tennessee Food Freedom Act at 53-1-118. Verifying against 53-8-117 - which
--     is what a compilation keyed to the old citation would have offered - would have recorded
--     repealed law as current.
--   * WISCONSIN's baked-goods position does not rest on a statute at all. It rests on a 2017
--     Lafayette County Circuit Court injunction, clarified in 2021. The only statutory home route,
--     Wis. Stat. 97.29(2), is the canning exemption and it is both capped and venue-limited.
--
-- NORTH CAROLINA is still not here. It appears to have no cottage food statute: home processors are
-- inspected by the NCDA&CS Food and Drug Protection Division and, on the material available, no
-- permit is issued at all. The only sources reachable were NC State Extension pages, which are a
-- step below the department's own rules, so the row keeps its placeholder rather than taking a
-- figure from a summary.
--
-- As before, `verified_at` is not set - the figure and the citation are seeded, the attestation is
-- not - and every statement is guarded on `verified_at is null`.

set search_path = public;

-- District of Columbia — D.C. Code 7-742.01 et seq.
update public.state_cottage_food_rules set
  revenue_cap = null,
  requires_license = true,
  notes = 'Verified against D.C. Code 7-742.01 et seq. at code.dccouncil.gov, read 2026-09-05. No sales cap: the section sets none, the earlier $25,000 limit having been removed by the Cottage Food Expansion Amendment Act of 2019 (D.C. Law 23-61). Registration IS required, and in two places: a cottage food business must hold "a home occupancy permit from the Department of Consumer and Regulatory Affairs" and a "Cottage food business identification number and certificate" from the Cottage Food Business Registry within the Department of Health. Operating detail sits in DCMR Title 25-K, which is not reproduced here.'
where state_code = 'DC' and verified_at is null;

-- Pennsylvania — 3 Pa.C.S. 5734 and 7 Pa. Code 46.212.
update public.state_cottage_food_rules set
  revenue_cap = null,
  requires_license = true,
  notes = 'Verified against 3 Pa.C.S. 5734 (Food Safety Act, registration of food establishments) and 7 Pa. Code 46.212, read 2026-09-05. No sales cap. Registration IS required and there is no small-operator escape: 5734(a) requires "Every person operating a food establishment within this Commonwealth" to register with the secretary, the fee is "$35 per food establishment per year", and the only relevant exemption is for a farm-based establishment where 100% of the regulated products are produced or processed on that farm. 7 Pa. Code 46.212(b) confirms the same route for a private home supplying a retail food facility - it must be "registered with the Department as a food establishment under the Food Safety Act". NOTE: the earlier compilation reproduced only 46.212, which governs supplying retail food facilities rather than direct-to-consumer sales, which is why this state was held back from the first pass.'
where state_code = 'PA' and verified_at is null;

-- Tennessee — Tenn. Code 53-1-118, the Act that REPLACED the repealed 53-8-117.
update public.state_cottage_food_rules set
  revenue_cap = null,
  requires_license = false,
  notes = 'Verified against Tenn. Code 53-1-118 (Tennessee Food Freedom Act), read 2026-09-05 via codes.findlaw.com. IMPORTANT: this Act replaced Tenn. Code 53-8-117 with effect from 1 July 2022, and 53-8-117 - the section most cottage-food compilations still cite for Tennessee - is repealed. No cap: the Act sets none. No licence: "the production and sale of homemade food items under this chapter are exempt from all licensing, permitting, inspecting, packaging, and labeling laws". Online selling is expressly contemplated, with a disclosure obligation attached: where "The homemade food item is offered only for sale on the internet", the disclosure must appear on the webpage. Delivery may be by the producer, an agent of the producer, a third-party vendor or a third-party carrier. Prohibited in time/temperature-control items: unpasteurized milk, alcoholic beverages, fish, shellfish, meat and meat byproducts, with limited poultry exceptions.'
where state_code = 'TN' and verified_at is null;

-- Wisconsin — Wis. Stat. 97.29(2), plus a court injunction that is not a statute.
update public.state_cottage_food_rules set
  revenue_cap = null,
  requires_license = false,
  notes = 'Verified against Wis. Stat. 97.29(2) at docs.legis.wisconsin.gov, read 2026-09-05. Wisconsin runs two home routes and they are unlike each other. (1) BAKED GOODS: no licence and no cap - but this rests on a 2017 Lafayette County Circuit Court injunction striking down the ban on selling home-baked goods, clarified in 2021 to cover anything baked in an oven that is not potentially hazardous. That is a court order, not a statute, and it is worth treating as less durable than one. (2) CANNED GOODS, Wis. Stat. 97.29(2): exempt from the food processing plant licence only for "pickles or other processed vegetables or fruits with an equilibrium pH value of 4.6 or lower", only where the seller "receives less than $5,000 per year from the sale of the food products", and only "at a community or social event or a farmers market in this state" - a venue list that does not include internet sales. This row records the baked-goods route: no cap, no licence. A Wisconsin seller doing canned goods is on the second route and is both capped at $5,000 and barred from selling them online. NOTE: the earlier compilation reproduced Wis. Stat. 97.30 on retail food establishment licensing, which is neither of these, which is why this state was held back from the first pass.'
where state_code = 'WI' and verified_at is null;
