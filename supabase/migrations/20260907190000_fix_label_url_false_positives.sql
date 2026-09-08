-- Harvest Local — four label URLs that passed a check they should have failed.
--
-- 20260907180000 accepted a candidate document if the text contained the label rule's cited
-- section. That test has a hole: a statute site links its neighbours. A FindLaw page for
-- Ark. Code 20-57-504 carries "20-57-505" in its next-section navigation, so the 504 page passed a
-- test for 505 while containing none of it.
--
-- The integration suite caught Arkansas, which is what an assertion written against the INTENDED
-- outcome is for — the test said "Arkansas's label rule points at 505", the migration had left it
-- on 504, and the disagreement was the bug rather than the test.
--
-- Checking the other rows where the label section differs from the programme's found three more:
--
--   AR  label 20-57-505, sat on the 20-57-504 page      (0 occurrences as content)
--   AZ  label 36-932,    sat on the 36-931 page
--   OH  label 3715.023,  sat on the 3715.025 page       (0 occurrences of 3715.023 at all)
--   SD  label 34-18-37,  sat on the 34-18-38 page
--
-- Each replacement was checked by counting occurrences rather than testing for presence: the
-- section appears five times on Arkansas's own page and twice on Arizona's and Ohio's, against zero
-- or one in a navigation link. A single mention is a cross-reference; a document about a section
-- says its number repeatedly.
--
-- THE GENERAL LESSON, for whoever verifies the remaining twenty-two: "the document mentions the
-- section" is too weak a test on a site that cross-links. Prefer the section's own page, and treat
-- a single occurrence as a near miss rather than a match.

set search_path = public;

with v(state_code, ordinal, url) as (values
  ('AR', 1, 'https://codes.findlaw.com/ar/title-20-public-health-and-welfare/ar-code-sect-20-57-505/'),
  ('AZ', 1, 'https://www.azleg.gov/ars/36/00932.htm'),
  ('OH', 1, 'https://codes.ohio.gov/ohio-revised-code/section-3715.023'),
  ('OH', 2, 'https://codes.ohio.gov/ohio-revised-code/section-3715.023'),
  ('SD', 1, 'https://law.justia.com/codes/south-dakota/title-34/chapter-18/section-34-18-37/')
)
update public.state_label_rules r
   set source_url = v.url,
       -- As always, the fingerprints describe the document being left behind.
       source_version = null,
       source_etag = null,
       source_last_modified = null,
       source_content_hash = null,
       source_signal = null,
       source_fetched_at = null,
       source_changed_at = null
  from v, public.state_food_programs p
 where p.state_code = v.state_code
   and p.ordinal = v.ordinal
   and r.program_id = p.id
   and r.source_url is distinct from v.url;
