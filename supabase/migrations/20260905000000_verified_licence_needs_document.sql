-- Harvest Local — a verified licence must have a document behind it.
--
-- `seller_licenses_document_required` (20260904130000) requires a file for the three required
-- types, but was added NOT VALID so rows uploaded through the old generic form survived. One such
-- row exists on the dev project: a pending cottage-food permit with `document_path` null, sitting
-- in the review queue offering a Verify button.
--
-- Verifying it would record that an admin examined a document that does not exist, and both the
-- storefront gate and the label generator trust that record. `reviewLicenseAction` now refuses it,
-- and this is the same rule at the data layer, so it holds for any path that writes the row.
--
-- Narrower than the NOT VALID constraint on purpose: a PENDING licence with no document is just an
-- incomplete upload and stays allowed, because rejecting those outright would strand the seller
-- with no way to see what went wrong. It is the transition to `verified` that is blocked.

set search_path = public;

create or replace function public.seller_licenses_guard_verification()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.verification_status = 'verified' and new.document_path is null then
    raise exception 'a licence cannot be verified without a document'
      using errcode = 'check_violation',
            hint = 'Ask the seller to upload the document before verifying.';
  end if;
  return new;
end;
$$;

create trigger seller_licenses_guard_verification
  before insert or update of verification_status, document_path on public.seller_licenses
  for each row execute function public.seller_licenses_guard_verification();

comment on function public.seller_licenses_guard_verification() is
  'A licence may only reach verification_status = ''verified'' with a document attached. Pending '
  'rows without one are fine — they are incomplete uploads, not false records.';
