-- Harvest Local — give Vermont's new cottage food operation row a label rule.
--
-- `20260906020000` added the Vermont Cottage Food Operation programme, which the statute has and our
-- data did not. That broke an invariant worth keeping: every programme in `state_food_programs` has
-- a row in `state_label_rules`, and two integration tests assert exactly that. The invariant is not
-- bookkeeping — `renderLabel()` refuses to print when a programme's rule is unrecorded, so a
-- Vermont seller on the new row would have been able to choose it during onboarding and then find
-- the label generator would not produce a label for them.
--
-- The rule is COPIED from Vermont's Home Baker row rather than sourced independently, and that is
-- the honest description of it. All three existing Vermont rules are byte-identical to each other —
-- the same five required elements, no disclaimer text, no metric requirement, no placard — and all
-- three cite the same summary page rather than Vermont law. Extending an identical rule to a fourth
-- Vermont programme adds no new claim; inventing a different one would.
--
-- So this row inherits their content AND their provenance: the same `source_url`, and `verified_at`
-- left null. It is not primary-sourced, and it should not be mistaken for the online-sales bans in
-- `20260906030000`, every one of which was read out of statute or regulation. Vermont's labelling
-- requirements are unverified across all four rows and remain a job for whoever reviews the state.

set search_path = public;

insert into public.state_label_rules (
  program_id, required_elements, disclaimer_text, disclaimer_min_pt, disclaimer_all_caps,
  disclaimer_font_note, metric_required, placard_required, placard_text, notes,
  source_url, source_checked_at, predisclosure_required
)
select
  new_row.id,
  sibling.required_elements,
  sibling.disclaimer_text,
  sibling.disclaimer_min_pt,
  sibling.disclaimer_all_caps,
  sibling.disclaimer_font_note,
  sibling.metric_required,
  sibling.placard_required,
  sibling.placard_text,
  'Copied from the Vermont Home Baker rule, which is identical to the Home Food Processor and Home '
  'Caterer rules. Not independently sourced: all four Vermont label rules trace to the same summary '
  'page rather than to Vermont law, and none is verified. Added so the new Cottage Food Operation '
  'programme has a rule at all — renderLabel() refuses to print without one.',
  sibling.source_url,
  sibling.source_checked_at,
  sibling.predisclosure_required
from public.state_food_programs new_row
join public.state_food_programs sib_prog
  on sib_prog.state_code = 'VT' and sib_prog.ordinal = 1
join public.state_label_rules sibling
  on sibling.program_id = sib_prog.id
where new_row.state_code = 'VT'
  and new_row.ordinal = 4
  and not exists (
    select 1 from public.state_label_rules r where r.program_id = new_row.id
  );
