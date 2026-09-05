-- Harvest Local — let an admin reject a licence that has no document.
--
-- `seller_licenses_document_required` (20260904130000) was added NOT VALID so rows uploaded through
-- the old generic form survived. NOT VALID exempts existing rows only from the initial validation
-- scan — the constraint is still checked on every subsequent UPDATE. So a legacy row with
-- `document_path` null could not be written to at all: rejecting it failed with 23514, and the
-- admin queue offered a "You can still reject it to tell them why" that the data layer refused.
-- One such row exists on the dev project and it had no route out of the queue.
--
-- The rule the constraint is really after is "do not claim a required licence exists without the
-- document behind it". A rejection claims the opposite — it is the record that we asked and did not
-- get one — so it is the one status that does not need a document. Verified stays impossible
-- without one (this constraint, plus `seller_licenses_guard_verification`), and pending stays
-- possible so an incomplete upload can be fixed rather than stranding the seller.
--
-- Still NOT VALID: the row this exists for is `pending` today, so a validation scan would fail on
-- the very row we are unblocking.

set search_path = public;

alter table public.seller_licenses
  drop constraint if exists seller_licenses_document_required;

alter table public.seller_licenses
  add constraint seller_licenses_document_required
    check (
      verification_status = 'rejected'
      or license_type not in ('id', 'tax_id', 'cottage_food')
      or document_path is not null
    ) not valid;

comment on constraint seller_licenses_document_required on public.seller_licenses is
  'A required licence type must have a document behind it — except once it is rejected, which is '
  'precisely the record that no acceptable document was supplied.';
