-- Harvest Local — New Hampshire: the rule paraphrases, the statute prescribes, and I followed the rule.
--
-- 20260908130000 changed both New Hampshire disclaimers to match He-P 2300, an administrative rule.
-- BOTH CHANGES WERE WRONG, and one of them replaced a correct value with an incorrect one. The
-- integration test that failed afterwards is what forced the statute to be read.
--
-- RSA 143-A:12 V(c), read 2026-09-08 at gencourt.state.nh.us — the statute prescribes both sentences
-- verbatim:
--
--   (1) Products made by homestead food operations exempt from licensure shall also be clearly
--       labeled with the following statement: "This product is exempt from New Hampshire licensing
--       and inspection."
--
--   (2) Products made by nonexempt homestead food operations shall also be clearly labeled with the
--       following statement: "This product is made in a residential food production area licensed by
--       the New Hampshire Department of Health and Human Services."
--
-- Against what 20260908130000 wrote:
--
--   EXEMPT — the statute HAS the full stop, inside the quotation marks. The rule's rendering omits
--   it, and I removed it from a value that was already right. Restored.
--
--   NONEXEMPT — the statute says "a residential FOOD PRODUCTION AREA licensed by THE NEW HAMPSHIRE
--   DEPARTMENT OF HEALTH AND HUMAN SERVICES." I changed it to the rule's "a residential KITCHEN
--   licensed by NH DHHS", which is wrong twice over. The value before my change was also wrong once
--   — it said "residential kitchen" where the statute says "residential food production area" — so
--   this row has never been right until now.
--
-- =========================================================================
-- WHY THE STATUTE AND NOT THE RULE
-- =========================================================================
-- An agency rule cannot rewrite a sentence the legislature prescribed verbatim, and the statutory
-- text is the later one: RSA 143-A:12 carries a 2022 amendment (2022, 133:2), and He-P 2300's
-- wording is the older phrasing. The rule paraphrases; the statute governs.
--
-- The conflict itself is recorded rather than tidied away, because it is real and a reader who finds
-- He-P 2300 first will otherwise reach the same wrong conclusion I did.
--
-- =========================================================================
-- THE MISTAKE WORTH KEEPING
-- =========================================================================
-- This project already carries the lesson in the other direction: Kentucky's ban is in the STATUTE
-- and the regulation's silence does not disprove it (20260906290000), and Kentucky's label is in the
-- statute while the regulation only delegates (20260908130000). Here the same pair appears with the
-- rule holding a competing sentence, and the rule looked authoritative because it was the document
-- that actually contained a quotable string.
--
-- A source that contains the sentence is not thereby the source of the sentence. The disclaimer
-- checker rewards documents that contain a match, so it will keep pointing here; the answer is to
-- follow the delegation upward before believing it.

set search_path = public;

update public.state_label_rules set
  disclaimer_text = 'This product is exempt from New Hampshire licensing and inspection.',
  source_url = 'https://www.gencourt.state.nh.us/rsa/html/X/143-A/143-A-12.htm',
  source_etag = null,
  source_last_modified = null,
  source_content_hash = null,
  source_signal = null,
  source_fetched_at = null,
  source_changed_at = null,
  notes = notes ||
    ' CORRECTION (20260908150000): 20260908130000 removed the full stop from this sentence on the '
    'strength of He-P 2300 (7), which renders it without one. THE STATUTE HAS IT. RSA 143-A:12 '
    'V(c)(1): ''shall also be clearly labeled with the following statement: "This product is exempt '
    'from New Hampshire licensing and inspection."'' The period is restored and the source now '
    'points at the statute. The rule paraphrases the statute rather than the other way round, and '
    'RSA 143-A:12 carries a 2022 amendment while He-P 2300 does not.'
where program_id in (select id from public.state_food_programs where state_code = 'NH' and ordinal = 1)
  and notes not like '%20260908150000%';

update public.state_label_rules set
  disclaimer_text =
    'This product is made in a residential food production area licensed by the New Hampshire '
    'Department of Health and Human Services.',
  source_url = 'https://www.gencourt.state.nh.us/rsa/html/X/143-A/143-A-12.htm',
  source_etag = null,
  source_last_modified = null,
  source_content_hash = null,
  source_signal = null,
  source_fetched_at = null,
  source_changed_at = null,
  notes = notes ||
    ' CORRECTION (20260908150000): this row has never carried the statutory sentence. RSA 143-A:12 '
    'V(c)(2) requires ''"This product is made in a residential food production area licensed by the '
    'New Hampshire Department of Health and Human Services."'' It previously said "residential '
    'KITCHEN" with the agency named in full — wrong in one word — and 20260908130000 then rewrote it '
    'to He-P 2300''s "residential kitchen licensed by NH DHHS", wrong in two. The statute governs: '
    'an agency rule cannot rewrite a sentence the legislature prescribed verbatim, and RSA 143-A:12 '
    'is the later text (2022, 133:2). '
    'THE CONFLICT IS REAL AND IS LEFT ON THE RECORD: He-P 2300 (h) genuinely prescribes the shorter '
    'wording, so a reader who finds the rule first will reach the wrong conclusion, as this pass '
    'did. A source that CONTAINS a sentence is not thereby the source OF it.'
where program_id in (select id from public.state_food_programs where state_code = 'NH' and ordinal = 2)
  and notes not like '%20260908150000%';
