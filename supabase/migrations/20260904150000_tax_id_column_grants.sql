-- Harvest Local — actually fence off `seller_licenses.tax_id_encrypted`.
--
-- `20260904140000_tax_id_protection.sql` did:
--
--   revoke select (tax_id_encrypted) on public.seller_licenses from anon, authenticated;
--
-- which is a no-op. Supabase grants those roles SELECT on the whole TABLE, and a table-level grant
-- confers every column including ones later revoked individually — a column REVOKE only bites when
-- the role's privilege is itself column-level. The integration suite caught it: a seller could
-- still select the ciphertext.
--
-- The working form is to drop the table-wide grant and hand back an explicit column list. That also
-- makes `select *` a permission error for these roles, which is deliberate: a star-select is
-- exactly how the ciphertext would leak back into a page by accident.

set search_path = public;

revoke select on public.seller_licenses from anon, authenticated;

grant select (
  id,
  seller_id,
  license_type,
  license_number,
  tax_id_last4,
  issuing_state,
  issued_date,
  expiration_date,
  document_path,
  verification_status,
  review_note,
  reviewed_at,
  reviewed_by,
  purged_at,
  created_at,
  updated_at
) on public.seller_licenses to anon, authenticated;

-- INSERT / UPDATE are untouched: RLS ("licenses: seller inserts own" / "seller updates own" /
-- "admin all") still decides who may write, and `seller_licenses_guard_status` still freezes the
-- verification trail. A seller writes `tax_id_encrypted` on insert through the compliance action,
-- which is why it is not revoked from the insert path.

comment on column public.seller_licenses.tax_id_encrypted is
  'AES-256-GCM ciphertext of the SSN/EIN, keyed by TAX_ID_ENCRYPTION_KEY which lives only in the '
  'application environment. SELECT is granted column-by-column to anon/authenticated and this '
  'column is not on the list, so no browser session can read it back — only service_role can. '
  'Nothing in the app decrypts today; every screen renders tax_id_last4.';
