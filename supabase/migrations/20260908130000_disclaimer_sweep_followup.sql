-- Harvest Local — closing out what the disclaimer sweep left open.
--
-- 20260908120000 corrected three rows and listed nine it could not close: sources that were
-- summaries, hosts that refuse scripts, and two states whose underlying law had moved. Every one has
-- now been chased to primary text except four, and those four say exactly where they stopped.
--
-- Two errors in the stored text, three citations that could never verify, one invented sentence, and
-- one repeal that is much larger than a label.
--
-- =========================================================================
-- 1. NEW HAMPSHIRE — BOTH ROWS WRONG, IN DIFFERENT WAYS
-- =========================================================================
-- He-P 2300, read 2026-09-08 at gencourt.state.nh.us. The sweep had reported the first row as a
-- difference and the second as not found; decoding the page as windows-1252 rather than UTF-8 showed
-- why, and showed that both stored strings are wrong.
--
--   EXEMPT HOME FOOD OPERATIONS, (7): 'The following statement: "This product is exempt from New
--   Hampshire licensing and inspection" in at least the equivalent of 10 point font'. NO FULL STOP
--   inside the quotation marks. Ours had one. Same class as the period added to California.
--
--   HOMESTEAD, (h): 'The following statement: "This product is made in a residential kitchen
--   licensed by NH DHHS" in at least the equivalent of 10 point font'. WE STORED THE ABBREVIATION
--   EXPANDED — "licensed by the New Hampshire Department of Health and Human Services." — plus a
--   full stop. The rule prescribes the abbreviation, so the expansion is our prose in a column that
--   exists to hold the state's. It is also longer, which matters when the rule fixes a minimum font
--   size and a label has finite room.
--
-- =========================================================================
-- 2. ALASKA — A PLACARD SENTENCE NOBODY WROTE
-- =========================================================================
-- AS 17.20.332: "A retail space selling a homemade food shall prominently display A SIGN INDICATING
-- THAT the homemade food was made in a home kitchen, may contain allergens, and is not, except for
-- meat and meat products permitted under (h) of this section, regulated or inspected."
--
-- That prescribes SUBSTANCE AND NOT WORDING. We stored "THESE PRODUCTS ARE NOT SUBJECT TO STATE
-- INSPECTION." in capitals, which appears nowhere in the section — an invented paraphrase presented
-- as quoted law, exactly like the Missouri placard removed earlier. placard_text goes to null;
-- placard_required stays TRUE, because a sign genuinely is required. The row records the three facts
-- the sign has to convey so a seller can be asked for wording rather than handed ours.
--
-- =========================================================================
-- 3. KENTUCKY — THE TEXT WAS RIGHT AND THE INSTRUMENT WAS NOT, TWICE OVER
-- =========================================================================
-- 902 KAR 45:090 contains no disclaimer; it delegates. Following the delegation:
--
--   HOME-BASED PROCESSOR — the current KRS 217.136(3)(e) requires 'The following statement in ten
--   (10) point type: "This product is home-produced and processed"'. OUR STORED TEXT IS EXACT. Only
--   the citation was wrong, and the earlier "superseded" answer was a stale version id rather than a
--   repeal: the section is live and was amended in 2019.
--
--   HOME-BASED MICROPROCESSOR — 902 KAR 45:090(4) sends it to "KRS 217.005 to 217.215", the general
--   food, drug and cosmetic law, and KRS 217.137 ("Administrative regulations on home-based
--   microprocessors", effective 2019-03-26) PRESCRIBES NO LABEL AT ALL. So the statement on this row
--   was inherited from the processor route, whose 217.136(3) applies to a different operator. It
--   goes to null: no sentence is prescribed, and printing another route's is the fault found in
--   Vermont, Maryland, Ohio and California's microenterprise row.
--
-- WHAT ALSO CAME OUT OF READING 217.137: subsection (2) still says microprocessor products "may only
-- be offered for sale by farmers markets, certified roadside stands, or on the processor's farm."
-- The online ban recorded against this programme is therefore CORRECT and is left alone — worth
-- saying, because the "superseded" answer made it look as though it might not be.
--
-- =========================================================================
-- 4. THREE CITATIONS THAT COULD NEVER VERIFY
-- =========================================================================
-- Same shape as Colorado's and Indiana's in 20260908120000: right sentence, wrong document.
--
--   TN  pointed at 2025 Pub. Ch. 431, the AMENDING chapter, which renumbers and does not carry the
--       statement. The text is verbatim in 2022 Pub. Ch. 862 § 3, where it was originally read.
--   IA  pointed at a justia chapter index. Iowa Code 137D.2(7)(f) has it verbatim, period included.
--   KY  see above.
--
-- =========================================================================
-- 5. NEVADA — THE WHOLE CHAPTER IS REPEALED
-- =========================================================================
-- 20260908120000 recorded NRS 446.866 as repealed. Reading the chapter page shows it is not one
-- section: EVERY SECTION OF NRS CHAPTER 446 is marked "[Repealed.]" — the definitions, the permit
-- scheme, the enforcement provisions and the cottage food exemption alike — by chapter 420 and
-- chapter 512, Statutes of Nevada 2025. NRS 446A does not exist, so the replacement is somewhere
-- this pass has not found.
--
-- Nevada's programme row, its label rule and its online-sales ban all rest on a repealed chapter.
-- Nothing is changed here beyond saying so, because the fix is to read two session-law chapters and
-- that is a different piece of work from a disclaimer sweep. It is the largest single piece of
-- unsound compliance data in this table and should be next.
--
-- =========================================================================
-- 6. STILL OPEN, AND WHY
-- =========================================================================
--   DE  regulations.delaware.gov serves an application shell for 16 Del. Admin. Code 4458A — 65KB of
--       webfonts and no rule text. The compilation shows the sentence ending outside the quotation
--       marks, which suggests our trailing period is added, as in CA and NH. NOT ACTED ON: that is a
--       compilation's punctuation, which is the thing a compilation is least careful with.
--   NJ  the only source is a compilation PDF, and the reported difference is an artifact — the PDF
--       drops the hyphen in "N.J.A.C. 8:24-11". N.J.A.C. 8:24 itself was not reachable at the paths
--       tried.
--   AL  no primary source found; the row remains on a compilation.
--   GA  rules.sos.ga.gov answers every scripted request with a 168-byte block page. The rule was
--       read there by hand on 2026-09-07, so this is a host that will not talk to a script rather
--       than a source that has gone missing.

set search_path = public;

-- ---------------------------------------------------------------------------
-- New Hampshire: the rule's own words, in both programmes.
-- ---------------------------------------------------------------------------
update public.state_label_rules set
  disclaimer_text = 'This product is exempt from New Hampshire licensing and inspection',
  notes = notes ||
    ' SWEEP FOLLOW-UP (20260908130000): He-P 2300 (7) reads ''The following statement: "This product '
    'is exempt from New Hampshire licensing and inspection" in at least the equivalent of 10 point '
    'font and a color that provides a clear contrast to the background''. NO FULL STOP inside the '
    'quotation marks; ours had one. The sweep first reported this as a difference it could not '
    'characterise because the page is windows-1252 and was being decoded as UTF-8 — the checker now '
    'detects the charset.'
where program_id in (select id from public.state_food_programs where state_code = 'NH' and ordinal = 1)
  and notes not like '%20260908130000%';

update public.state_label_rules set
  disclaimer_text = 'This product is made in a residential kitchen licensed by NH DHHS',
  notes = notes ||
    ' SWEEP FOLLOW-UP (20260908130000): He-P 2300 (h) reads ''The following statement: "This product '
    'is made in a residential kitchen licensed by NH DHHS" in at least the equivalent of 10 point '
    'font''. WE HAD EXPANDED THE ABBREVIATION to "licensed by the New Hampshire Department of Health '
    'and Human Services." and added a full stop. The rule prescribes "NH DHHS", so the expansion was '
    'our prose in the column that exists to hold the state''s — and it is materially longer, which '
    'matters where the rule fixes a minimum font size and a label has finite room.'
where program_id in (select id from public.state_food_programs where state_code = 'NH' and ordinal = 2)
  and notes not like '%20260908130000%';

-- ---------------------------------------------------------------------------
-- Alaska: a sign is required; its wording is not prescribed.
-- ---------------------------------------------------------------------------
update public.state_label_rules set
  placard_text = null,
  notes = notes ||
    ' SWEEP FOLLOW-UP (20260908130000): the placard text was INVENTED. AS 17.20.332 says "A retail '
    'space selling a homemade food shall prominently display a sign INDICATING THAT the homemade '
    'food was made in a home kitchen, may contain allergens, and is not, except for meat and meat '
    'products permitted under (h) of this section, regulated or inspected." That is substance '
    'without wording, and "THESE PRODUCTS ARE NOT SUBJECT TO STATE INSPECTION." appears nowhere in '
    'the section — the same invention removed from Missouri. placard_text is now null and '
    'placard_required stays true, because a sign genuinely is required. THE THREE FACTS the sign '
    'must convey are: made in a home kitchen; may contain allergens; not regulated or inspected, '
    'except for meat and meat products permitted under (h). The disclaimer on this row verified '
    'EXACT against the same section and is untouched.'
where program_id in (select id from public.state_food_programs where state_code = 'AK' and ordinal = 1)
  and notes not like '%20260908130000%';

-- ---------------------------------------------------------------------------
-- Kentucky: the processor's sentence is right, the microprocessor's was borrowed.
-- ---------------------------------------------------------------------------
update public.state_label_rules set
  source_url = 'https://apps.legislature.ky.gov/law/statutes/statute.aspx?id=57382',
  source_etag = null,
  source_last_modified = null,
  source_content_hash = null,
  source_signal = null,
  source_fetched_at = null,
  source_changed_at = null,
  notes = notes ||
    ' SWEEP FOLLOW-UP (20260908130000): the stored sentence is EXACT and the citation was wrong. The '
    'current KRS 217.136(3)(e) requires ''The following statement in ten (10) point type: "This '
    'product is home-produced and processed"'', read 2026-09-08. The earlier "superseded" answer '
    'from the Kentucky site was a STALE VERSION ID rather than a repeal — the section is live and '
    'was last amended in 2019. 902 KAR 45:090 remains the right instrument for the operating rules '
    'and the wrong one for the label, which is why it never verified.'
where program_id in (select id from public.state_food_programs where state_code = 'KY' and ordinal = 1)
  and notes not like '%20260908130000%';

update public.state_label_rules set
  disclaimer_text = null,
  notes = notes ||
    ' SWEEP FOLLOW-UP (20260908130000): THE STATEMENT WAS INHERITED and is removed. 902 KAR '
    '45:090(4) sends a microprocessor label to "KRS 217.005 to 217.215 and 21 U.S.C. 343(w)" — the '
    'general food, drug and cosmetic law — and KRS 217.137, "Administrative regulations on '
    'home-based microprocessors" (effective 2019-03-26), prescribes no label at all. The sentence '
    'stored here was KRS 217.136(3)(e)''s, which governs a home-based PROCESSOR, a different '
    'operator. Same fault as Vermont''s licensed rows, Maryland''s on-farm route, Ohio''s home '
    'bakery and California''s microenterprise chapter. '
    'ALSO NOTE: 902 KAR 45:090(4) requires that "Draft copies of all home-based microprocessed food '
    'product labels shall be submitted for review by the cabinet prior to labeling and marketing", '
    'so anything this generator produces for a Kentucky microprocessor is a draft for the cabinet '
    'rather than a label to print. '
    'AND THE ONLINE BAN IS CONFIRMED, not disturbed: KRS 217.137(2) still says these products "may '
    'only be offered for sale by farmers markets, certified roadside stands, or on the processor''s '
    'farm."'
where program_id in (select id from public.state_food_programs where state_code = 'KY' and ordinal = 2)
  and notes not like '%20260908130000%';

-- ---------------------------------------------------------------------------
-- Tennessee and Iowa: cite the document that carries the sentence.
-- ---------------------------------------------------------------------------
update public.state_label_rules set
  source_url = 'https://publications.tnsosfiles.com/acts/112/pub/pc0862.pdf',
  source_etag = null,
  source_last_modified = null,
  source_content_hash = null,
  source_signal = null,
  source_fetched_at = null,
  source_changed_at = null,
  notes = notes ||
    ' SWEEP FOLLOW-UP (20260908130000): the row cited 2025 Pub. Ch. 431, which AMENDS and renumbers '
    'and does not carry the statement — the same fault as Colorado citing HB26-1033. The disclaimer '
    'is verbatim in 2022 Pub. Ch. 862 § 3, at acts/112, which is where it was originally read and '
    'is now the source. Ch. 431 remains the authority for the renumbering and for the removal of '
    'net weight and lot code, as this row''s earlier note records.'
where program_id in (select id from public.state_food_programs where state_code = 'TN' and ordinal = 1)
  and notes not like '%20260908130000%';

update public.state_label_rules set
  source_url = 'https://www.legis.iowa.gov/docs/code/137D.pdf',
  source_etag = null,
  source_last_modified = null,
  source_content_hash = null,
  source_signal = null,
  source_fetched_at = null,
  source_changed_at = null,
  notes = notes ||
    ' SWEEP FOLLOW-UP (20260908130000): the row cited a justia chapter index, which lists section '
    'headings and no text. Iowa Code 137D.2(7)(f) carries the sentence verbatim, full stop inside '
    'the quotation marks: ''The following statement: "This product was produced at a home food '
    'processing establishment."'' Read from the state''s own chapter PDF on 2026-09-08, which is now '
    'the source.'
where program_id in (select id from public.state_food_programs where state_code = 'IA' and ordinal = 2)
  and notes not like '%20260908130000%';

-- ---------------------------------------------------------------------------
-- Nevada: it is the whole chapter, not one section.
-- ---------------------------------------------------------------------------
update public.state_label_rules set
  notes = notes ||
    ' SWEEP FOLLOW-UP (20260908130000): worse than recorded. It is not that NRS 446.866 was '
    'repealed — EVERY SECTION OF NRS CHAPTER 446 is marked "[Repealed.]" on the state''s own chapter '
    'page (revision stamp 2026-04-15), by chapter 420 and chapter 512, Statutes of Nevada 2025: the '
    'definitions, the permit scheme, the enforcement provisions and the cottage food exemption '
    'alike. NRS 446A does not exist, so the replacement scheme is somewhere this pass has not found. '
    'Nevada''s programme row, this label rule and the online-sales ban all rest on that chapter. '
    'Nothing has been changed on the strength of it, because the fix is to read two session-law '
    'chapters — but this is the largest single piece of unsound data in the table and should be the '
    'next thing done.'
where program_id in (select id from public.state_food_programs where state_code = 'NV' and ordinal = 1)
  and notes not like '%20260908130000%';

-- ---------------------------------------------------------------------------
-- The four still open, each with where it stopped.
-- ---------------------------------------------------------------------------
update public.state_label_rules set
  notes = notes ||
    ' SWEEP FOLLOW-UP (20260908130000): still open. regulations.delaware.gov serves an application '
    'shell for 16 Del. Admin. Code 4458A — 65KB of webfonts with no rule text — so the trailing full '
    'stop question is unresolved. The compilation shows the sentence ending OUTSIDE the quotation '
    'marks, which is the same shape as the periods removed from California and New Hampshire, but a '
    'compilation''s punctuation is the last thing to act on.'
where program_id in (select id from public.state_food_programs where state_code = 'DE' and ordinal = 1)
  and notes not like '%20260908130000%';

update public.state_label_rules set
  notes = notes ||
    ' SWEEP FOLLOW-UP (20260908130000): the reported difference is an ARTIFACT — the compilation PDF '
    'drops the hyphen in "N.J.A.C. 8:24-11", so the words match and the characters appear not to. '
    'Nothing is wrong with the stored text as far as this can tell, but it has still never been '
    'checked against N.J.A.C. 8:24 itself, which was not reachable at the paths tried.'
where program_id in (select id from public.state_food_programs where state_code = 'NJ' and ordinal = 1)
  and notes not like '%20260908130000%';

update public.state_label_rules set
  notes = notes ||
    ' SWEEP FOLLOW-UP (20260908130000): still open. No primary source for the Alabama disclaimer was '
    'found, and the row remains on a National Agricultural Law Center summary in which the sentence '
    'does not appear at all. Either the summary paraphrases it or the sentence came from somewhere '
    'else; neither can be settled from here.'
where program_id in (select id from public.state_food_programs where state_code = 'AL' and ordinal = 1)
  and notes not like '%20260908130000%';

update public.state_label_rules set
  notes = notes ||
    ' SWEEP FOLLOW-UP (20260908130000): still unverifiable by script. rules.sos.ga.gov answers every '
    'automated request with a 168-byte block page, including curl with a browser agent. The rule was '
    'read there by hand on 2026-09-07, so this is a host that will not talk to a script rather than '
    'a source that has gone missing — the sweep will keep reporting it and that is expected.'
where program_id in (select id from public.state_food_programs where state_code = 'GA' and ordinal = 1)
  and notes not like '%20260908130000%';
