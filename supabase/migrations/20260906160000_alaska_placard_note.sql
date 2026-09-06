-- Harvest Local — say WHY Alaska stopped requiring a placard.
--
-- 20260906090000 set `placard_required = false` for Alaska and never explained it in the notes, so
-- the row asserts something with no visible basis — exactly the failure the verification pass
-- exists to remove. The reason is real and belongs in the data:
--
-- AS 17.20.332 puts the producer's name, address, telephone number and the quoted statement on the
-- PACKAGE, and for food that is not packaged obliges the producer to convey the same information to
-- the buyer. That is a disclosure duty, not a written point-of-sale placard, and Alaska prescribes
-- no placard text anywhere. The placard we had came from the summary, not the statute.
--
-- Nothing else changes; `verified_at` stays null.

set search_path = public;

update public.state_label_rules set
  notes = notes ||
    ' NO PLACARD: this row previously required one, on the strength of the summary rather than the '
    'statute. AS 17.20.332 places the information on the package and, for unpackaged food, on the '
    'producer to tell the buyer directly. Alaska prescribes no placard text, so there is nothing to '
    'print and placard_required is false.'
where program_id in (select id from public.state_food_programs where state_code = 'AK' and ordinal = 1)
  and verified_at is null
  and notes not like '%NO PLACARD%';
