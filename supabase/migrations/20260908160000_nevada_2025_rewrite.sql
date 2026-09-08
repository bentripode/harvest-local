-- Harvest Local — Nevada, whose cottage food law was repealed out from under three of our rows.
--
-- The disclaimer sweep found NRS 446.866 marked "[Repealed.]"; reading the chapter page showed every
-- section of NRS chapter 446 repealed, not just that one. This is what replaced it.
--
-- =========================================================================
-- WHAT ACTUALLY HAPPENED, AND WHEN
-- =========================================================================
-- TWO acts, and they do opposite things on different dates. Getting them the wrong way round would
-- have been easy and would have unblocked selling that is still unlawful.
--
--   SB 466 — ch. 512, Statutes of Nevada 2025, EFFECTIVE 2025-07-01, so in force now.
--   § 77 repeals NRS 446.0145 through 446.945 outright, the cottage food exemption at 446.866
--   among them, and §§ 2 to 44 rebuild the scheme under the State Department of Agriculture rather
--   than the Division of Public and Behavioral Health.
--
--   AB 352 — ch. 420, Statutes of Nevada 2025, EFFECTIVE 2027-07-01 for every substantive purpose
--   (§ 29(2)(b); only regulation-making is effective on passage). So it is NOT law yet.
--
-- =========================================================================
-- THE ONLINE BAN IS CORRECT, AND ITS CITATION WAS DEAD
-- =========================================================================
-- SB 466 § 22(1)(a) carries the restriction forward word for word: a food item must be "[s]old ...
-- directly to a consumer ... by means of an IN-PERSON TRANSACTION THAT DOES NOT INVOLVE SELLING THE
-- FOOD ITEM BY TELEPHONE OR VIA THE INTERNET."
--
-- So `online_orders = 'banned'` stays. What was wrong was the authority: this row cited a section
-- that has not existed since 2025-07-01. A right answer resting on a repealed provision is one
-- amendment away from being a wrong answer nobody notices.
--
-- AND IT IS ALREADY DUE TO REVERSE. AB 352 § 16 authorises a cottage food operation to sell "via a
-- transaction by telephone or via the Internet" and to fulfil "in person, by mail or through a food
-- delivery service platform" — from 2027-07-01. On that date Nevada stops being an online-ban state
-- and its sellers may list food here. Nothing in this schema expresses a dated future change, so it
-- is written into the note; `program-review-scan` flags rows nobody has checked lately, which is not
-- the same as a row with a diary date.
--
-- =========================================================================
-- THE CAP WAS WRONG BY $65,000, AND CARRIED A SIGNATURE
-- =========================================================================
-- SB 466 § 22 raises the gross-sales limit from $35,000 to $100,000 and requires the Department to
-- adjust it annually by the Consumer Price Index (All Items) from July 2025.
--
-- Both our rows said $35,000, and `state_cottage_food_rules` was ADMIN-VERIFIED on 2026-09-05 — a
-- person signed off a figure that had been superseded fourteen months earlier, because the reading
-- was done in a compilation rather than the session laws. `record_order_revenue` PAUSES A STOREFRONT
-- when the yearly total crosses that column, so this was a live guardrail set at less than half the
-- lawful figure.
--
-- `verified_at` and `verified_by` are cleared. The attestation was to $35,000; leaving it in place
-- while changing the number would dress our reading as a person's. Nothing here sets it — only an
-- admin saving /admin/states does that, and now there is something for them to save.
--
-- The CPI adjustment is not modelled: `revenue_cap` is a single number and the Department publishes
-- a new one each fiscal year, so this figure is a floor that drifts. Recorded rather than
-- approximated.
--
-- =========================================================================
-- THE DISCLAIMER SURVIVED THE REWRITE UNCHANGED
-- =========================================================================
-- SB 466 § 22(1)(d): 'Labeled with "MADE IN A COTTAGE FOOD OPERATION THAT IS NOT SUBJECT TO
-- GOVERNMENT FOOD SAFETY INSPECTION" printed prominently on the label for the food item'. Our stored
-- text matches exactly, no trailing period, and AB 352 keeps the same sentence. Only the source
-- moves.

set search_path = public;

-- ---------------------------------------------------------------------------
-- The programme row.
-- ---------------------------------------------------------------------------
update public.state_food_programs set
  revenue_cap = 100000,
  source_url = 'https://archive.leg.state.nv.us/Session/83rd2025/Bills/SB/SB466_EN.pdf',
  source_etag = null,
  source_last_modified = null,
  source_content_hash = null,
  source_signal = null,
  source_fetched_at = null,
  source_changed_at = null,
  source_checked_at = now(),
  venue_note =
    'Express prohibition, and the authority is now SB 466 (ch. 512, Statutes of Nevada 2025), '
    'effective 2025-07-01, which repealed NRS chapter 446 entirely — NRS 446.866, cited here until '
    '20260908160000, has not existed since. SB 466 § 22(1)(a) carries the restriction forward '
    'verbatim: a food item must be "[s]old ... directly to a consumer ... by means of an in-person '
    'transaction that does not involve selling the food item by telephone or via the Internet." '
    'DUE TO REVERSE ON 2027-07-01: AB 352 (ch. 420, Statutes of Nevada 2025) § 16 authorises a '
    'cottage food operation to sell "via a transaction by telephone or via the Internet" and to '
    'fulfil "in person, by mail or through a food delivery service platform". Its § 29(2)(b) makes '
    'that effective 2027-07-01 for all substantive purposes, so it is not law yet and this row must '
    'stay banned until then. On that date Nevada leaves the online-ban list and its sellers may list '
    'food here.',
  cap_note =
    'SB 466 § 22 raised the limit from $35,000 to $100,000 and requires the State Department of '
    'Agriculture to adjust it annually by the Consumer Price Index (All Items) measured from July '
    '2025. The figure stored here is therefore a FLOOR that drifts upward each fiscal year; the '
    'published adjusted amount governs.'
where state_code = 'NV' and ordinal = 1;

-- ---------------------------------------------------------------------------
-- The state-wide rule: the cap that pauses storefronts, and a stale signature.
-- ---------------------------------------------------------------------------
update public.state_cottage_food_rules set
  revenue_cap = 100000,
  -- The admin verified $35,000. Changing the number without clearing the attestation would present
  -- our reading as theirs.
  verified_at = null,
  verified_by = null,
  notes =
    'Nev. Rev. Stat. chapter 446 was REPEALED IN ITS ENTIRETY by SB 466 § 77 (ch. 512, Statutes of '
    'Nevada 2025), effective 2025-07-01, and the scheme rebuilt at §§ 2 to 44 of that act under the '
    'State Department of Agriculture instead of the Division of Public and Behavioral Health. The '
    'earlier note here cited NRS 446.866 and 587.6945 read in a National Agricultural Law Center '
    'compilation, and was verified on 2026-09-05 against a section that had not existed for fourteen '
    'months. '
    'CAP: SB 466 § 22 sets gross sales at not more than $100,000 per calendar year, up from $35,000, '
    'adjusted annually by the Consumer Price Index (All Items) from July 2025. The stored $35,000 '
    'was less than half the lawful figure and record_order_revenue pauses a storefront on this '
    'column. The CPI adjustment is not modelled, so $100,000 is a floor. '
    'ONLINE SALES REMAIN BANNED and the ban is confirmed on the new text: § 22(1)(a) requires "an '
    'in-person transaction that does not involve selling the food item by telephone or via the '
    'Internet." AB 352 (ch. 420) reverses this on 2027-07-01. '
    'VERIFICATION CLEARED: the signature was to the superseded figure. An admin should re-read '
    'SB 466 § 22 and re-save this row.'
where state_code = 'NV';

-- ---------------------------------------------------------------------------
-- The label rule: same sentence, live authority.
-- ---------------------------------------------------------------------------
update public.state_label_rules set
  source_url = 'https://archive.leg.state.nv.us/Session/83rd2025/Bills/SB/SB466_EN.pdf',
  source_etag = null,
  source_last_modified = null,
  source_content_hash = null,
  source_signal = null,
  source_fetched_at = null,
  source_changed_at = null,
  source_checked_at = now(),
  notes = notes ||
    ' CLOSED (20260908160000): the disclaimer SURVIVED the 2025 rewrite unchanged. SB 466 § 22(1)(d) '
    '(ch. 512, Statutes of Nevada 2025, effective 2025-07-01) requires the item be ''Labeled with '
    '"MADE IN A COTTAGE FOOD OPERATION THAT IS NOT SUBJECT TO GOVERNMENT FOOD SAFETY INSPECTION" '
    'printed prominently on the label for the food item''. Our stored text matches exactly, with no '
    'trailing period, and AB 352 carries the same sentence forward. Only the citation was dead: this '
    'row pointed at NRS chapter 446, every section of which SB 466 § 77 repealed. The sweep reported '
    'NOT FOUND because the chapter page is now nothing but repeal notices — which is the checker '
    'working, not failing.'
where program_id in (select id from public.state_food_programs where state_code = 'NV' and ordinal = 1)
  and notes not like '%20260908160000%';
