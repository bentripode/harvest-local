-- Harvest Local — Texas gets a source a machine can actually read.
--
-- `statutes.capitol.texas.gov/Docs/HS/htm/HS.437.htm` is now an Angular application shell. Fetching
-- it — the HTML path or the PDF path — returns a 250KB bundle containing none of chapter 437. So
-- the staleness watcher pointed at it was hashing a front-end deployment: it would have fired when
-- the site was redeployed and stayed silent when the legislature amended the chapter. Wrong in both
-- directions, on one of the eleven predisclosure states.
--
-- =========================================================================
-- WHERE THE DOCUMENT ACTUALLY LIVES
-- =========================================================================
-- The shell names its own chunks; the chunks name an environment block; the environment block names
-- two hosts:
--
--     TCASCore:       https://tcss.legis.texas.gov/api/
--     FileServerPath: https://tcss.legis.texas.gov/resources
--
-- The viewer calls `DocViewer/GetDocument/...` on the first, but the second serves the chapter files
-- directly and needs no parameters at all:
--
--     https://tcss.legis.texas.gov/resources/HS/htm/HS.437.htm
--
-- 151KB of statute. Same publisher, same file the site itself renders — this is the Legislature's
-- own document, not a mirror or a reproduction.
--
-- =========================================================================
-- CHECKED, NOT ASSUMED
-- =========================================================================
-- Verified by content rather than by the URL resolving:
--
--   * "437.0193" appears 4 times and "437.0194" twice, as headings and cross-references rather than
--     the single navigation mention that produced the false positives in 20260907190000.
--   * It contains "NOT SUBJECT TO GOVERNMENTAL LICENSING OR INSPECTION" — the exact disclaimer this
--     row stores, so the document and the row demonstrably describe the same law.
--   * It contains "before the operator accepts payment", the § 437.0194(b)(2) phrase that makes
--     Texas a predisclosure state.
--   * It carries the 2025 activity our reading depends on, including the S.B. 541 repeal of
--     § 437.0193(d).
--
-- =========================================================================
-- AND IT IS WATCHABLE, WHICH THE OLD ONE NEVER WAS
-- =========================================================================
-- The host sends BOTH validators:
--
--     Last-Modified: Wed, 01 Jul 2026 05:05:57 GMT
--     ETag: "1dd09174ce7e7e0"
--
-- So this source gets the strong signal rather than the byte-hash fallback the compilations are
-- stuck with — the watcher will read the publisher's own answer to "has this changed". The
-- fingerprints are cleared here so it re-baselines against the new document on its next run rather
-- than comparing it to an application shell.
--
-- `source_version` records the latest act the document itself states against our sections. The ETag
-- is the primary signal for this row; the amendment line is the human-checkable one.
--
-- WORTH KNOWING FOR THE NEXT STATE: several legislatures have moved to client-rendered viewers, and
-- the pattern that found this one is general — read the shell for its chunk names, the chunks for
-- the environment block, and the environment block for the file server. The rendered site is not
-- always the only way in.

set search_path = public;

update public.state_food_programs set
  source_url = 'https://tcss.legis.texas.gov/resources/HS/htm/HS.437.htm',
  source_version = 'Repealed by Acts 2025, 89th Leg., R.S., Ch. 303 (S.B. 541), Sec. 8(1), eff. September 1, 2025.',
  source_etag = null,
  source_last_modified = null,
  source_content_hash = null,
  source_signal = null,
  source_fetched_at = null,
  source_changed_at = null,
  venue_note = venue_note ||
    ' SOURCE (20260907200000): repointed from statutes.capitol.texas.gov, which is now a JavaScript '
    'application shell serving none of the statute, to the Legislature''s own file server at '
    'tcss.legis.texas.gov/resources — the document the site itself renders. It sends both an ETag '
    'and a Last-Modified, so this row gets the strong staleness signal rather than a byte hash.'
where state_code = 'TX' and ordinal = 1
  and venue_note not like '%20260907200000%';

update public.state_label_rules set
  source_url = 'https://tcss.legis.texas.gov/resources/HS/htm/HS.437.htm',
  source_version = 'Repealed by Acts 2025, 89th Leg., R.S., Ch. 303 (S.B. 541), Sec. 8(1), eff. September 1, 2025.',
  source_etag = null,
  source_last_modified = null,
  source_content_hash = null,
  source_signal = null,
  source_fetched_at = null,
  source_changed_at = null,
  notes = notes ||
    ' SOURCE (20260907200000): repointed to tcss.legis.texas.gov/resources/HS/htm/HS.437.htm, which '
    'contains both § 437.0193 (the label and its prescribed disclosure) and § 437.0194 (the '
    'before-payment requirement). The previous URL was an application shell containing neither.'
where program_id in (select id from public.state_food_programs where state_code = 'TX' and ordinal = 1)
  and notes not like '%20260907200000%';
