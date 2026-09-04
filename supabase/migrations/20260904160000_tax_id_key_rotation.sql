-- Harvest Local — support rotating the tax-ID encryption key.
--
-- `20260904140000` encrypts under a single key with no way to change it: rotating meant decrypting
-- and re-encrypting every row by hand, with no record of which rows were done. This records the key
-- id alongside the ciphertext so the `tax-id-rekey` job can find what's stale — and an admin can
-- see when an old key is safe to retire — without decrypting anything.
--
-- Ciphertext written before this is `v1.<payload>`, always key 1; new writes are
-- `v2.<keyId>.<payload>`. The column mirrors the id inside the ciphertext.

set search_path = public;

alter table public.seller_licenses
  add column if not exists tax_id_key_id smallint;

comment on column public.seller_licenses.tax_id_key_id is
  'Which entry of TAX_ID_ENCRYPTION_KEYS encrypted tax_id_encrypted. Mirrors the id inside the '
  'ciphertext so rotation progress is countable without decrypting. Not granted to client roles.';

-- Everything encrypted so far predates the keyring and is therefore key 1.
update public.seller_licenses
  set tax_id_key_id = 1
  where tax_id_encrypted is not null
    and tax_id_key_id is null;

-- Finding the stale rows is the job's whole query.
create index if not exists seller_licenses_tax_id_key_ix
  on public.seller_licenses (tax_id_key_id)
  where tax_id_encrypted is not null;

-- Deliberately NOT added to the column-level SELECT grant from `20260904150000`: client roles have
-- no use for it, and every column left off that list is one that cannot leak through a page.

-- Re-encryption is a distinct thing to audit: it means the plaintext was in memory again.
alter table public.tax_id_audit
  drop constraint if exists tax_id_audit_action_check;

alter table public.tax_id_audit
  add constraint tax_id_audit_action_check
    check (action in ('stored', 'decrypted', 'purged', 'rekeyed'));
