-- Harvest Local — correcting a sentence I got wrong in 20260906540000.
--
-- That migration's appended note told the next reader that leaving `nutrition_if_claimed` in
-- `required_elements` "made this label permanently unprintable". IT DID NOT. `renderLabel()` has
-- always carried an explicit exception for that element and never blocked a label on it, so the
-- fourteen affected rules printed fine the whole time. The move from required to optional is a
-- modelling correction — an element the renderer must be told to ignore is not a required element —
-- and not a fix to broken behaviour.
--
-- The wrong sentence was already written into `state_label_rules.notes` on the hosted database
-- before it was caught, and a note in this table is read as a finding. So it is corrected in place
-- rather than left to be believed. On a database built from scratch 20260906540000 already carries
-- the corrected wording and this migration matches nothing, which is the intended shape: it is a
-- repair for environments that took the earlier text, not a second opinion.

set search_path = public;

update public.state_label_rules set
  notes = replace(
    notes,
    'Left required, it made this label permanently unprintable.',
    'No label changes: renderLabel() already refused to block on it.'
  )
where notes like '%Left required, it made this label permanently unprintable.%';
