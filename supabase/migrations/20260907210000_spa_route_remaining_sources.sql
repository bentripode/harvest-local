-- Harvest Local — running the Texas route across the sixteen states still on a compilation.
--
-- 20260907200000 found Texas's statute by reading the application shell for its chunk names, the
-- chunks for an environment block, and the environment block for a file server. That worked because
-- Texas's problem was client rendering. Applied to the other sixteen, it found that MOST OF THEM
-- HAVE A DIFFERENT PROBLEM, which is worth writing down so nobody repeats the search.
--
-- Two rows are repointed. The rest are diagnosed rather than fixed, and the diagnosis is the useful
-- part.
--
-- =========================================================================
-- 1. CONNECTICUT WAS THE WRONG CHAPTER, NOT THE WRONG SITE
-- =========================================================================
-- Every previous attempt used cga.ct.gov chapter 418, which returns 140KB of real statute — and
-- contains 21a-100 through 21a-105, not 21a-62f. Chapter 417 carries it, four times, alongside
-- "cottage food" thirty-four times and the section heading "Sec. 21a-62f. Authorized food items.
-- Prohibited food items." It also sends an ETag and a Last-Modified, so this row gets the strong
-- staleness signal.
--
-- A 200 response of the right size from the right host is not evidence that the document is the
-- right one. That was the same mistake as the navigation false positives in 20260907190000, wearing
-- different clothes.
--
-- =========================================================================
-- 2. GEORGIA'S RULES HAVE THEIR OWN SITE
-- =========================================================================
-- The label rule cites Ga. Comp. R. & Regs. 40-7-19, an administrative rule rather than a statute,
-- and the Secretary of State publishes those separately from the code: rules.sos.ga.gov/GAC/40-7-19
-- returns "Subject 40-7-19 COTTAGE FOOD REGULATIONS" with the rule text, 25 mentions of the subject
-- number and 74 of "cottage food".
--
-- =========================================================================
-- 3. MISSOURI LOOKED LIKE A WIN AND WAS NOT
-- =========================================================================
-- revisor.mo.gov/main/OneSection.aspx?section=196.298 returns 200 and mentions "196.298" five
-- times, which passed a naive check. Reading what it rendered: page title, breadcrumb, search form,
-- chapter heading — and the word "label" exactly once. The statute BODY is not in what the server
-- sends. Missouri stays on the compilation, and this is recorded because the row would otherwise
-- look verified to the next person running the same query.
--
-- =========================================================================
-- 4. WHAT IS ACTUALLY BLOCKING THE OTHER THIRTEEN
-- =========================================================================
-- Only two of the sixteen turned out to be client-rendered at all, so the Texas route mostly did
-- not apply:
--
--   CLIENT-RENDERED, LEAD NOT YET FOLLOWED   DE (regulations.delaware.gov), MD (mgaleg.maryland.gov
--                                            — its six mentions of 21-330.1 are all social-share
--                                            URLs; the text arrives some other way)
--   WRONG DOCUMENT ID, NEEDS A LOOKUP        KY (statute.aspx?id= serves a PDF of some other
--                                            section), LA (Law.aspx?d= likewise)
--   URL NOT FOUND YET                        HI 404, IL 404, NJ 404
--   HOST REFUSES US                          MA 403
--   COMMERCIAL HOST                          NY (govt.westlaw.com serves a browse page; 1 NYCRR is
--                                            not freely published in a fetchable form we found)
--   NOT A URL PROBLEM AT ALL                 AL — alison.legislature.state.al.us returns 59KB with
--                                            no section text and no bundles to follow
--
--   NOTHING TO VERIFY AGAINST                CA x3, OR x2, ME's second programme, IL label rule.
--                                            These have no citation in their notes at all, so no
--                                            URL can be checked against them. They do not need a
--                                            better source; they need somebody to record which
--                                            provision the row is describing. That is a data gap
--                                            this pass created and cannot close by fetching.
--
-- The last group is the one worth acting on first: a source is only verifiable against a citation,
-- and seven rows have none.

set search_path = public;

-- ---------------------------------------------------------------------------
-- Connecticut: chapter 417, and the label rule rides the same chapter.
-- ---------------------------------------------------------------------------
update public.state_food_programs set
  source_url = 'https://www.cga.ct.gov/current/pub/chap_417.htm',
  source_etag = null,
  source_last_modified = null,
  source_content_hash = null,
  source_signal = null,
  source_fetched_at = null,
  source_changed_at = null,
  venue_note = coalesce(venue_note, '') ||
    ' SOURCE (20260907210000): repointed from the compilation to Conn. Gen. Stat. chapter 417, '
    'which carries 21a-62f. Earlier attempts used chapter 418 — a real 140KB document from the '
    'right host that contains 21a-100 to 21a-105 and none of the cottage food sections.'
where state_code = 'CT' and ordinal = 1
  and coalesce(venue_note, '') not like '%20260907210000%';

update public.state_label_rules set
  source_url = 'https://www.cga.ct.gov/current/pub/chap_417.htm',
  source_etag = null,
  source_last_modified = null,
  source_content_hash = null,
  source_signal = null,
  source_fetched_at = null,
  source_changed_at = null,
  notes = coalesce(notes, '') ||
    ' SOURCE (20260907210000): repointed to Conn. Gen. Stat. chapter 417, which contains 21a-62f '
    'and the rest of the cottage food sections. NOTE that this row still has no citation of its own '
    'recorded, so the URL is the programme''s rather than one verified against a labelling '
    'provision — the gap to close here is the citation, not the source.'
where program_id in (select id from public.state_food_programs where state_code = 'CT' and ordinal = 1)
  and coalesce(notes, '') not like '%20260907210000%';

-- ---------------------------------------------------------------------------
-- Georgia: the rule, not the code.
-- ---------------------------------------------------------------------------
update public.state_label_rules set
  source_url = 'https://rules.sos.ga.gov/GAC/40-7-19',
  source_etag = null,
  source_last_modified = null,
  source_content_hash = null,
  source_signal = null,
  source_fetched_at = null,
  source_changed_at = null,
  notes = coalesce(notes, '') ||
    ' SOURCE (20260907210000): repointed to rules.sos.ga.gov/GAC/40-7-19, "Subject 40-7-19 COTTAGE '
    'FOOD REGULATIONS", where the labelling rule this row describes actually lives. The programme '
    'row cites Ga. Code 26-2-21 and keeps its own source; the rule and the statute are different '
    'instruments on different sites.'
where program_id in (select id from public.state_food_programs where state_code = 'GA' and ordinal = 1)
  and coalesce(notes, '') not like '%20260907210000%';
