-- Harvest Local — Alaska requires the sign it was recorded as not requiring.
--
-- 20260908130000 removed an invented placard sentence from Alaska and said "placard_required stays
-- true, because a sign genuinely is required". It did not stay true: it was already FALSE, so the
-- migration removed the wording and left the row saying no sign is needed at all. That is a worse
-- state than it found, and the integration test written alongside it is what caught the claim.
--
-- AS 17.20.332, read 2026-09-08: "A retail space selling a homemade food SHALL PROMINENTLY DISPLAY A
-- SIGN indicating that the homemade food was made in a home kitchen, may contain allergens, and is
-- not, except for meat and meat products permitted under (h) of this section, regulated or
-- inspected."
--
-- "Shall prominently display a sign" is a requirement, so the flag is true. The wording stays null
-- because the section prescribes substance and not text — the same pair Nebraska carries, where
-- 81-2,280(5)(b) requires the notification at a physical sale point and prescribes no sentence for
-- it.
--
-- The lesson is narrower than the fix: a migration that asserts the state of a column it does not
-- write is asserting something it has not checked.

set search_path = public;

update public.state_label_rules set
  placard_required = true,
  notes = notes ||
    ' CORRECTION (20260908140000): 20260908130000 said placard_required "stays true" for Alaska. It '
    'was false, so removing the invented sentence left this row asserting that no sign is required. '
    'AS 17.20.332 says "A retail space selling a homemade food shall prominently display a sign '
    'indicating that..." — a requirement. The flag is now true and placard_text stays null, which is '
    'the Nebraska pairing: a sign the state demands and does not word.'
where program_id in (select id from public.state_food_programs where state_code = 'AK' and ordinal = 1)
  and notes not like '%20260908140000%';
