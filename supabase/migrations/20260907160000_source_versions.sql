-- Harvest Local — the version line every source document states about itself.
--
-- `source_version` (20260907150000) is the strong half of the staleness tripwire, and it shipped
-- empty: a machine cannot invent it, so it needed one pass over every source document.
--
-- Each of the 60 distinct URLs behind the 70 programme rows and their label rules was fetched and
-- read for the marker it states about ITSELF — not for what the law says, which is a different job
-- this table already records elsewhere.
--
-- =========================================================================
-- THREE KINDS OF MARKER, BECAUSE THREE KINDS OF DOCUMENT
-- =========================================================================
--   A CODIFIED SECTION states its amendment history. Utah prints "Amended by Chapter 433, 2026
--   General Session"; Washington "[ 2015 c 203 s 1; 2011 c 281 s 1.]"; Virginia a chain ending
--   "2026, c. 605."; Wisconsin "History: 1987 a. 399; ...". A later re-read finding a new session
--   year means the law moved, full stop. This is the marker the column was designed for.
--
--   A COMPILATION states its currency. The National Agricultural Law Center's state PDFs — which
--   49 of our 70 rows still cite — print "Current through Register Vol. 43, No. 3, December 31,
--   2024." That is a weaker claim (it dates the COMPILATION, not the statute) but it is exactly the
--   right thing to watch: when NALC republishes, somebody should re-read.
--
--   AN ENROLLED ACT states nothing, because it never changes. Tennessee's Public Chapter 431 is a
--   signed PDF that will be byte-identical forever. Recording that is useful in itself: the
--   tripwire on that URL is inherently silent, and what actually moves is the codified section it
--   amended, T.C.A. 53-1-118, which nothing here watches.
--
-- =========================================================================
-- WHAT IS DELIBERATELY LEFT NULL
-- =========================================================================
-- 28 of the 60 URLs get nothing, and that is the honest answer rather than a gap to fill later:
--
--   * Roughly twenty NALC compilations carry NO currency line at all. Illinois, Michigan, Missouri,
--     Montana, Nebraska, Oklahoma, Rhode Island and South Carolina among them — the document simply
--     does not say when it was current. Inventing a date would defeat the entire point of a column
--     whose value is that it can be trusted.
--   * A handful of live statute pages (Texas, West Virginia, the Cornell and FindLaw mirrors) render
--     their credit lines in ways this pass could not extract reliably. A wrong amendment line is
--     worse than none, so they wait for a human on the review form.
--   * Wyoming's source is a 500-page Title 11 compilation. It contains plenty of effective dates,
--     none of them demonstrably section 11-49's, so none was taken.
--
-- =========================================================================
-- WHAT THIS TURNED UP
-- =========================================================================
-- Most of the NALC compilations are current only through DECEMBER 2024, and several rows depend on
-- them for states whose law this pass never re-read from primary text. That is now visible on the
-- row rather than buried in a PDF, and it is the more useful finding than any single date here.
--
-- `verified_at` and `source_checked_at` are untouched. Recording what a document says about itself
-- is not the same as a person having read it, and only the second is an attestation.

set search_path = public;

with v(url, version) as (values
  ('https://nationalaglawcenter.org/wp-content/uploads/assets/cottagefood/Alabama.pdf', 'Current through Register Vol. 43, No. 3, December 31, 2024.'),
  ('https://nationalaglawcenter.org/wp-content/uploads/assets/cottagefood/Arkansas.pdf', 'Current through all legislation of the 2024 Fiscal Session and the Second Extraordinary Session (2024).'),
  ('https://nationalaglawcenter.org/wp-content/uploads/assets/cottagefood/Arizona.pdf', 'Current through L. 2024, ch. 259; Current through Register Vol. 31, No. 2, January 10, 2025.'),
  ('https://nationalaglawcenter.org/wp-content/uploads/assets/cottagefood/California.pdf', 'Current through the 2024 Legislative Session.'),
  ('https://nationalaglawcenter.org/wp-content/uploads/assets/cottagefood/Colorado.pdf', 'current through the 2026 Regular Session, effective as of June 4, 2026.'),
  ('https://code.dccouncil.gov/us/dc/council/code/sections/7-742.02', 'Oct. 3, 2001, D.C. Law 14-28, § 4932; as added Jan. 25, 2014, D.C. Law 20-63, § 2, 60 DCR 16530; Mar. 10, 2020, D.C. Law 23-61, § 2(b).'),
  ('https://nationalaglawcenter.org/wp-content/uploads/assets/cottagefood/Delaware.pdf', 'Current through Register Vol. 28, No. 6, December 1, 2024.'),
  ('https://nationalaglawcenter.org/wp-content/uploads/assets/cottagefood/Florida.pdf', 'Current through 2024 legislative session.'),
  ('https://nationalaglawcenter.org/wp-content/uploads/assets/cottagefood/Georgia.pdf', 'Current through Rules and Regulations filed through December 18, 2024.'),
  ('https://nationalaglawcenter.org/wp-content/uploads/assets/cottagefood/Hawaii.pdf', 'Current through November 2024.'),
  ('https://nationalaglawcenter.org/wp-content/uploads/assets/cottagefood/Idaho.pdf', 'Current through July 1, 2026.'),
  ('https://nationalaglawcenter.org/wp-content/uploads/assets/cottagefood/Kansas.pdf', 'Current through Register Vol. 43, No. 52, December 26, 2024.'),
  ('https://nationalaglawcenter.org/wp-content/uploads/assets/cottagefood/Kentucky.pdf', 'Current through Register Vol. 51, No. 6, December 1, 2024.'),
  ('https://nationalaglawcenter.org/wp-content/uploads/assets/cottagefood/Massachusetts.pdf', 'Current through Register 1537, December 20, 2024.'),
  ('https://nationalaglawcenter.org/wp-content/uploads/assets/cottagefood/Maryland.pdf', 'Current through Register Vol. 51, No. 26, December 27, 2024.'),
  ('https://nationalaglawcenter.org/wp-content/uploads/assets/cottagefood/Maine.pdf', 'Current through 2024 - 52, December 25, 2024.'),
  ('https://nationalaglawcenter.org/wp-content/uploads/assets/cottagefood/New-Jersey.pdf', 'Current through Register Vol. 56, No. 24, December 18, 2024.'),
  ('https://nationalaglawcenter.org/wp-content/uploads/assets/cottagefood/Nevada.pdf', 'Current through laws passed by the 2025 Regular Session of the 83rd Nevada State Legislature.'),
  ('https://nationalaglawcenter.org/wp-content/uploads/assets/cottagefood/New-York.pdf', 'Current through Register Vol. 46, No. 52, December 24, 2024.'),
  ('https://nationalaglawcenter.org/wp-content/uploads/assets/cottagefood/Ohio.pdf', 'Current through all regulations passed and filed through December 16, 2024.'),
  ('https://nationalaglawcenter.org/wp-content/uploads/assets/cottagefood/Oregon.pdf', 'Current through Register Vol. 63, No. 3, March 1, 2024.'),
  ('https://nationalaglawcenter.org/wp-content/uploads/assets/cottagefood/Pennsylvania.pdf', 'Current through Register Vol. 54, No. 52, December 28, 2024.'),
  ('https://publications.tnsosfiles.com/acts/114/pub/pc0431.pdf', 'Public Chapter No. 431, 2025 (enrolled). A signed public chapter is immutable, so this document will never change; what moves is the codified section it amends, T.C.A. 53-1-118.'),
  ('https://le.utah.gov/xcode/Title4/Chapter5/4-5-S501.html', 'Amended by Chapter 327, 2023 General Session'),
  ('https://le.utah.gov/xcode/Title4/Chapter5A/4-5a-S104.html', 'Amended by Chapter 433, 2026 General Session'),
  ('https://le.utah.gov/xcode/Title26B/Chapter7/26B-7-S416.html', 'Amended by Chapter 487, 2025 General Session'),
  ('https://law.lis.virginia.gov/vacode/title3.2/chapter51/section3.2-5130/', '1993, c. 936, § 3.1-398.1; 2003, c. 420; 2004, c. 953; 2008, cc. 459, 860; 2011, c. 316; 2013, c. 285; 2022, c. 204; 2024, c. 131; 2026, c. 605.'),
  ('https://www.healthvermont.gov/sites/default/files/document/reg-manufactured-food.pdf', 'Final Adopted Rule Effective Date: 1/15/2026'),
  ('https://www.healthvermont.gov/sites/default/files/document/reg-food-service-establishments.pdf', 'Effective December 1, 2003'),
  ('https://app.leg.wa.gov/RCW/default.aspx?cite=69.22&full=true', '[ 2015 c 203 s 1; 2011 c 281 s 1.]'),
  ('https://docs.legis.wisconsin.gov/document/statutes/97.29', 'History: 1987 a. 399; 1989 a. 174; 1991 a. 39, 210; 1999 a. 83; 2013 a. 302; 2015 a. 55, 242.'),
  ('https://nationalaglawcenter.org/wp-content/uploads/assets/cottagefood/Texas.pdf', 'Current through Reg. 49, No. 52; December 27, 2024.'))
update public.state_food_programs p
   set source_version = v.version
  from v
 where p.source_url = v.url
   and p.source_version is distinct from v.version;

with v(url, version) as (values
  ('https://nationalaglawcenter.org/wp-content/uploads/assets/cottagefood/Alabama.pdf', 'Current through Register Vol. 43, No. 3, December 31, 2024.'),
  ('https://nationalaglawcenter.org/wp-content/uploads/assets/cottagefood/Arkansas.pdf', 'Current through all legislation of the 2024 Fiscal Session and the Second Extraordinary Session (2024).'),
  ('https://nationalaglawcenter.org/wp-content/uploads/assets/cottagefood/Arizona.pdf', 'Current through L. 2024, ch. 259; Current through Register Vol. 31, No. 2, January 10, 2025.'),
  ('https://nationalaglawcenter.org/wp-content/uploads/assets/cottagefood/California.pdf', 'Current through the 2024 Legislative Session.'),
  ('https://nationalaglawcenter.org/wp-content/uploads/assets/cottagefood/Colorado.pdf', 'current through the 2026 Regular Session, effective as of June 4, 2026.'),
  ('https://code.dccouncil.gov/us/dc/council/code/sections/7-742.02', 'Oct. 3, 2001, D.C. Law 14-28, § 4932; as added Jan. 25, 2014, D.C. Law 20-63, § 2, 60 DCR 16530; Mar. 10, 2020, D.C. Law 23-61, § 2(b).'),
  ('https://nationalaglawcenter.org/wp-content/uploads/assets/cottagefood/Delaware.pdf', 'Current through Register Vol. 28, No. 6, December 1, 2024.'),
  ('https://nationalaglawcenter.org/wp-content/uploads/assets/cottagefood/Florida.pdf', 'Current through 2024 legislative session.'),
  ('https://nationalaglawcenter.org/wp-content/uploads/assets/cottagefood/Georgia.pdf', 'Current through Rules and Regulations filed through December 18, 2024.'),
  ('https://nationalaglawcenter.org/wp-content/uploads/assets/cottagefood/Hawaii.pdf', 'Current through November 2024.'),
  ('https://nationalaglawcenter.org/wp-content/uploads/assets/cottagefood/Idaho.pdf', 'Current through July 1, 2026.'),
  ('https://nationalaglawcenter.org/wp-content/uploads/assets/cottagefood/Kansas.pdf', 'Current through Register Vol. 43, No. 52, December 26, 2024.'),
  ('https://nationalaglawcenter.org/wp-content/uploads/assets/cottagefood/Kentucky.pdf', 'Current through Register Vol. 51, No. 6, December 1, 2024.'),
  ('https://nationalaglawcenter.org/wp-content/uploads/assets/cottagefood/Massachusetts.pdf', 'Current through Register 1537, December 20, 2024.'),
  ('https://nationalaglawcenter.org/wp-content/uploads/assets/cottagefood/Maryland.pdf', 'Current through Register Vol. 51, No. 26, December 27, 2024.'),
  ('https://nationalaglawcenter.org/wp-content/uploads/assets/cottagefood/Maine.pdf', 'Current through 2024 - 52, December 25, 2024.'),
  ('https://nationalaglawcenter.org/wp-content/uploads/assets/cottagefood/New-Jersey.pdf', 'Current through Register Vol. 56, No. 24, December 18, 2024.'),
  ('https://nationalaglawcenter.org/wp-content/uploads/assets/cottagefood/Nevada.pdf', 'Current through laws passed by the 2025 Regular Session of the 83rd Nevada State Legislature.'),
  ('https://nationalaglawcenter.org/wp-content/uploads/assets/cottagefood/New-York.pdf', 'Current through Register Vol. 46, No. 52, December 24, 2024.'),
  ('https://nationalaglawcenter.org/wp-content/uploads/assets/cottagefood/Ohio.pdf', 'Current through all regulations passed and filed through December 16, 2024.'),
  ('https://nationalaglawcenter.org/wp-content/uploads/assets/cottagefood/Oregon.pdf', 'Current through Register Vol. 63, No. 3, March 1, 2024.'),
  ('https://nationalaglawcenter.org/wp-content/uploads/assets/cottagefood/Pennsylvania.pdf', 'Current through Register Vol. 54, No. 52, December 28, 2024.'),
  ('https://publications.tnsosfiles.com/acts/114/pub/pc0431.pdf', 'Public Chapter No. 431, 2025 (enrolled). A signed public chapter is immutable, so this document will never change; what moves is the codified section it amends, T.C.A. 53-1-118.'),
  ('https://le.utah.gov/xcode/Title4/Chapter5/4-5-S501.html', 'Amended by Chapter 327, 2023 General Session'),
  ('https://le.utah.gov/xcode/Title4/Chapter5A/4-5a-S104.html', 'Amended by Chapter 433, 2026 General Session'),
  ('https://le.utah.gov/xcode/Title26B/Chapter7/26B-7-S416.html', 'Amended by Chapter 487, 2025 General Session'),
  ('https://law.lis.virginia.gov/vacode/title3.2/chapter51/section3.2-5130/', '1993, c. 936, § 3.1-398.1; 2003, c. 420; 2004, c. 953; 2008, cc. 459, 860; 2011, c. 316; 2013, c. 285; 2022, c. 204; 2024, c. 131; 2026, c. 605.'),
  ('https://www.healthvermont.gov/sites/default/files/document/reg-manufactured-food.pdf', 'Final Adopted Rule Effective Date: 1/15/2026'),
  ('https://www.healthvermont.gov/sites/default/files/document/reg-food-service-establishments.pdf', 'Effective December 1, 2003'),
  ('https://app.leg.wa.gov/RCW/default.aspx?cite=69.22&full=true', '[ 2015 c 203 s 1; 2011 c 281 s 1.]'),
  ('https://docs.legis.wisconsin.gov/document/statutes/97.29', 'History: 1987 a. 399; 1989 a. 174; 1991 a. 39, 210; 1999 a. 83; 2013 a. 302; 2015 a. 55, 242.'),
  ('https://nationalaglawcenter.org/wp-content/uploads/assets/cottagefood/Texas.pdf', 'Current through Reg. 49, No. 52; December 27, 2024.'))
update public.state_label_rules r
   set source_version = v.version
  from v
 where r.source_url = v.url
   and r.source_version is distinct from v.version;
