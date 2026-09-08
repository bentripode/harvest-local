-- Harvest Local — every quoted-law string checked against the document it cites.
--
-- `disclaimer_text` and `placard_text` are the only columns whose contents get PRINTED ONTO FOOD
-- without anybody reading them again. Two errors had been found in them by accident: Colorado's "may
-- also contain common food allergies" for the statute's "may also process common food allergens",
-- and a run of programmes carrying a sibling's sentence. Accident is a bad discovery mechanism, so
-- `scripts/verify-disclaimers.mjs` now fetches each row's own source, finds the stored string on a
-- letters-and-digits basis, and pulls the source's own characters back out of that span — so a
-- near-miss shows exactly which characters differ.
--
-- 55 strings across 45 disclaimers and 10 placards. Result: 37 EXACT, 6 DIFFERS, 11 NOT FOUND,
-- 1 refused. Three are corrected here on primary text; the rest are recorded where they were found,
-- because a NOT FOUND is a place to look rather than a proven error.
--
-- =========================================================================
-- CORRECTED
-- =========================================================================
-- CALIFORNIA — A FULL STOP WE ADDED. Health & Saf. Code 114365.3(e)(1), read at leginfo: "The words
-- "Made in a Home Kitchen" or "Repackaged in a Home Kitchen," as applicable". The words inside the
-- quotation marks carry NO trailing period, and (f)(3) repeats them the same way. We stored "Made in
-- a Home Kitchen." and printed it at 12 point on the primary display panel. Same class as the dash
-- added in VA, the full stop in NV and the sentence-casing in WY.
--
-- COLORADO — A SOURCE THAT CANNOT CONTAIN THE SENTENCE, and this one is ours. 20260908110000
-- repointed the row at HB26-1033 because that is where the amended (3)(a)(II) was read. But the bill
-- only reproduces the subsections it amends, and (3)(a)(V) and (3)(c) are not among them — so the
-- disclaimer and the placard cite a document that does not contain either. Both are verbatim in the
-- 2024 code volume, which is now the source. The volume predates HB26-1033, so the note says which
-- parts of this row come from the amendment instead.
--
-- INDIANA — THE CHAPTER PAGE, NOT THE SECTION. The row cited justia's chapter 5.3 index, which is a
-- table of contents: 18KB of section headings and no statutory text. The disclaimer is verbatim on
-- the 16-42-5.3-5 page. The citation was right and the URL was one level too high.
--
-- =========================================================================
-- NOT CORRECTED, AND WHY
-- =========================================================================
-- FALSE POSITIVES, left alone: New Jersey's "N.J.A.C. 8:24-11" reads as "8:2411" because the PDF
-- drops the hyphen, and New Hampshire's He-P 2300 page decodes badly under UTF-8. Both are artifacts
-- of reading, not of storing.
--
-- TWO THAT ARE BIGGER THAN A DISCLAIMER, and neither is guessed at here:
--
--   NEVADA — NRS 446.866, the cottage food section this row rests on, is marked "Repealed. (See
--   chapter 420, Statutes of Nevada 2025, at page 2690; chapter 512, Statutes of Nevada 2025.)" So
--   the stored disclaimer is quoted from law that no longer exists, and the programme row describes
--   a repealed scheme. Nevada bans online cottage-food sales under every programme it runs, so no
--   listing on this platform is affected today — but the data is wrong and a replacement scheme has
--   to be read before anything here is trusted.
--
--   KENTUCKY — 902 KAR 45:090 contains NO disclaimer at all. It delegates: "(5) Home-based processed
--   food products shall: (a) Be labeled as required by KRS 217.136(3)", and for microprocessors "(4)
--   Product labels ... shall be labeled in accordance with KRS 217.005 to 217.215". Following that
--   through, the Kentucky site answers for KRS 217.136 with "The link you have followed was to a
--   version of a statute that was in effect at the time the document was prepared but HAS BEEN
--   SUPERSEDED by a later version or repealed and is no longer valid." Both Kentucky rows therefore
--   quote a fragment from a statute whose current text has not been read. This is the third time
--   Kentucky has turned on the difference between its regulation and its enabling statute.
--
-- THE REST are unread rather than wrong: AK's placard, AL, IA's second programme and NH's second are
-- NOT FOUND against sources that are summaries or indexes; Tennessee's enrolled-act PDF now answers
-- with 2.6KB where it once served the whole chapter; Georgia's rules site refuses us outright.

set search_path = public;

-- ---------------------------------------------------------------------------
-- California: the statute quotes the words without a full stop.
-- ---------------------------------------------------------------------------
update public.state_label_rules set
  disclaimer_text = 'Made in a Home Kitchen',
  notes = notes ||
    ' DISCLAIMER SWEEP (20260908120000): the stored text was "Made in a Home Kitchen." and '
    '§ 114365.3(e)(1) requires "The words ''Made in a Home Kitchen'' or ''Repackaged in a Home '
    'Kitchen,'' as applicable" — no full stop inside the quotation marks, and (f)(3) repeats them '
    'the same way. The period was ours and was being printed at 12 point on the primary display '
    'panel. NOT MODELLED: the statute offers a SECOND form. A producer repackaging a purchased '
    'ready-to-eat product must print "Repackaged in a Home Kitchen" instead, and one disclaimer_text '
    'column cannot hold an either/or that depends on a fact about the product. A Californian '
    'repackager gets the wrong one of the two.'
where program_id in (select id from public.state_food_programs where state_code = 'CA' and ordinal in (1, 2))
  and notes not like '%20260908120000%';

-- ---------------------------------------------------------------------------
-- Colorado: cite a document that actually contains the sentence.
-- ---------------------------------------------------------------------------
update public.state_label_rules set
  source_url = 'https://leg.colorado.gov/sites/default/files/images/olls/crs2024-title-25.pdf',
  source_etag = null,
  source_last_modified = null,
  source_content_hash = null,
  source_signal = null,
  source_fetched_at = null,
  source_changed_at = null,
  notes = notes ||
    ' DISCLAIMER SWEEP (20260908120000): 20260908110000 pointed this row at HB26-1033, which is '
    'where the amended (3)(a)(II) was read — but an amending bill reproduces only the subsections it '
    'amends, and (3)(a)(V) and (3)(c) are not among them, so the disclaimer and the placard cited a '
    'document containing neither. Both are verbatim in the 2024 code volume, which is now the '
    'source. THE VOLUME PREDATES THE AMENDMENT: the county, the department-issued registration '
    'number and (3)(a)(VI) come from HB26-1033 (signed 2026-06-04) and will not be found in it. The '
    'disclaimer correction made in 20260908110000 is confirmed exact against this volume.'
where program_id in (select id from public.state_food_programs where state_code = 'CO' and ordinal = 1)
  and notes not like '%20260908120000%';

-- ---------------------------------------------------------------------------
-- Indiana: the section, not the chapter index.
-- ---------------------------------------------------------------------------
update public.state_label_rules set
  source_url = 'https://law.justia.com/codes/indiana/title-16/article-42/chapter-5-3/section-16-42-5-3-5/',
  source_etag = null,
  source_last_modified = null,
  source_content_hash = null,
  source_signal = null,
  source_fetched_at = null,
  source_changed_at = null,
  notes = notes ||
    ' DISCLAIMER SWEEP (20260908120000): the row cited the chapter 5.3 index, which is a table of '
    'section headings with no statutory text — so the disclaimer could never be verified against it. '
    'The citation was right and the URL was one level too high. It now points at 16-42-5.3-5, where '
    'the sentence and the "at least 10 point type" requirement both appear verbatim.'
where program_id in (select id from public.state_food_programs where state_code = 'IN' and ordinal = 1)
  and notes not like '%20260908120000%';

-- ---------------------------------------------------------------------------
-- Nevada: the section is repealed.
-- ---------------------------------------------------------------------------
update public.state_label_rules set
  notes = notes ||
    ' DISCLAIMER SWEEP (20260908120000): NOT FOUND, and the reason is that the law is gone. '
    'NRS 446.866 — the cottage food section this row rests on — is listed at leg.state.nv.us as '
    '"Repealed. (See chapter 420, Statutes of Nevada 2025, at page 2690; chapter 512, Statutes of '
    'Nevada 2025.)" The stored disclaimer is quoted from repealed law and the programme row '
    'describes a scheme that no longer exists. Nothing is unblocked or blocked by this today, '
    'because Nevada bans online cottage-food sales under every programme it runs — but nothing here '
    'should be trusted until the 2025 replacement is read. The text is left in place rather than '
    'emptied: emptying it would make the label unprintable, which asserts something we also do not '
    'know.'
where program_id in (select id from public.state_food_programs where state_code = 'NV' and ordinal = 1)
  and notes not like '%20260908120000%';

-- ---------------------------------------------------------------------------
-- Kentucky: the regulation delegates, and the statute it delegates to has moved.
-- ---------------------------------------------------------------------------
update public.state_label_rules set
  notes = notes ||
    ' DISCLAIMER SWEEP (20260908120000): NOT FOUND — 902 KAR 45:090 contains no disclaimer at all. '
    'It delegates: "(5) Home-based processed food products shall: (a) Be labeled as required by KRS '
    '217.136(3)", and for microprocessors "(4) Product labels for home-based microprocessed foods '
    'shall be labeled in accordance with KRS 217.005 to 217.215 and 21 U.S.C. 343(w)." Following '
    'that through on 2026-09-08, apps.legislature.ky.gov answers for KRS 217.136 with "The link you '
    'have followed was to a version of a statute that was in effect at the time the document was '
    'prepared but has been SUPERSEDED by a later version or repealed and is no longer valid." So the '
    'stored fragment is quoted from a statute whose current text nobody here has read. THIS IS THE '
    'THIRD TIME Kentucky has turned on the gap between its regulation and its enabling statute — see '
    'the venue-list correction in 20260906290000. Read KRS 217.136(3) as it now stands.'
where program_id in (select id from public.state_food_programs where state_code = 'KY' and ordinal in (1, 2))
  and notes not like '%20260908120000%';

-- ---------------------------------------------------------------------------
-- The remainder: recorded where the next reader will find them.
-- ---------------------------------------------------------------------------
update public.state_label_rules set
  notes = notes ||
    ' DISCLAIMER SWEEP (20260908120000): NOT FOUND against this row''s own source, which is a '
    'summary rather than the law. The sentence may still be right; nothing here has been changed on '
    'the strength of its absence from a compilation. Reading the state''s own text is what closes '
    'this.'
where program_id in (
    select id from public.state_food_programs
    where (state_code = 'AL' and ordinal = 1)
       or (state_code = 'IA' and ordinal = 2)
       or (state_code = 'NH' and ordinal = 2)
  )
  and notes not like '%20260908120000%';

update public.state_label_rules set
  notes = notes ||
    ' DISCLAIMER SWEEP (20260908120000): the disclaimer verified EXACT against AS 17.20.332, but the '
    'PLACARD text did not appear there at all. A placard sentence that is not in the section the '
    'label comes from has to come from somewhere, and this row does not say where.'
where program_id in (select id from public.state_food_programs where state_code = 'AK' and ordinal = 1)
  and notes not like '%20260908120000%';

update public.state_label_rules set
  notes = notes ||
    ' DISCLAIMER SWEEP (20260908120000): could not be checked. publications.tnsosfiles.com answered '
    'with 2.6KB where it previously served the whole public chapter, so the sweep had nothing to '
    'compare against. This is a fetch failure and not a finding about the text, which was read in '
    'full from the same host on 2026-09-06.'
where program_id in (select id from public.state_food_programs where state_code = 'TN' and ordinal = 1)
  and notes not like '%20260908120000%';

update public.state_label_rules set
  notes = notes ||
    ' DISCLAIMER SWEEP (20260908120000): could not be checked — rules.sos.ga.gov refuses both the '
    'sweep and curl with a 96-byte block page. The rule text was read there on 2026-09-07, so this '
    'is a host that will not answer a script rather than a source that has gone missing.'
where program_id in (select id from public.state_food_programs where state_code = 'GA' and ordinal = 1)
  and notes not like '%20260908120000%';

update public.state_label_rules set
  notes = notes ||
    ' DISCLAIMER SWEEP (20260908120000): the words match and the characters do not — the compilation '
    'shows the sentence ending "...Inspections" with the full stop OUTSIDE the closing quotation '
    'mark, where we store it inside. On a compilation that is not enough to act on, because the '
    'punctuation of a quoted sentence is exactly what a summary is careless with. 16 Del. Admin. '
    'Code 4458A settles it.'
where program_id in (select id from public.state_food_programs where state_code = 'DE' and ordinal = 1)
  and notes not like '%20260908120000%';
