-- Harvest Local — Phase 5: admin license review (the audit trail behind /admin/licenses).
--
-- `seller_licenses.verification_status` has been platform-only since Phase 2
-- (`seller_licenses_guard_status`), but nothing ever set it: every license a seller uploaded sat
-- `pending` forever, and `license-expiry-scan` — which scans `verification_status = 'verified'`
-- only — never saw any of them. The reviewing surface is `/admin/licenses`; this migration adds
-- the columns that record who decided what, and why.

set search_path = public;

alter table public.seller_licenses
  add column if not exists reviewed_at timestamptz,
  add column if not exists reviewed_by uuid references public.profiles(id) on delete set null,
  add column if not exists review_note text check (char_length(review_note) <= 2000);

comment on column public.seller_licenses.review_note is
  'Why the admin verified or rejected this document. Shown to the seller on /seller/compliance — '
  'a rejection is required to carry one (enforced in reviewLicenseAction).';

-- Pending work first: the queue is ordered by submission, and the reviewed rows are the long tail.
create index if not exists seller_licenses_review_ix
  on public.seller_licenses (verification_status, created_at desc);

-- The review columns are exactly as platform-only as `verification_status` itself. A seller may
-- update their own license row ("licenses: seller updates own"), so without this they could stamp
-- a verification trail onto their own record, or quietly clear the note explaining a rejection.
-- SECURITY INVOKER trigger, so `is_platform_context()` is the right predicate here (CLAUDE.md:
-- it reads `current_user`, which is the *caller* outside a SECURITY DEFINER body).
create or replace function public.seller_licenses_guard_status()
returns trigger
language plpgsql
as $$
begin
  if not public.is_platform_context() and (
       new.verification_status is distinct from old.verification_status
    or new.reviewed_at         is distinct from old.reviewed_at
    or new.reviewed_by         is distinct from old.reviewed_by
    or new.review_note         is distinct from old.review_note
  ) then
    raise exception 'license verification may only be changed by the platform';
  end if;
  return new;
end;
$$;
