-- Harvest Local — take the tax ID out of the database in readable form.
--
-- `20260904130000_seller_documents.sql` started collecting SSNs and EINs into
-- `seller_licenses.license_number`, in plaintext, under ordinary RLS. That is a breach target and a
-- compliance obligation. Three changes here:
--
--   1. The number is stored encrypted (AES-256-GCM, key held by the app, never by Postgres) in its
--      own column, and `tax_id_last4` carries the only part any screen ever shows.
--   2. `tax_id_encrypted` is revoked from anon and authenticated at the COLUMN level, so no browser
--      session — seller or admin — can fetch the ciphertext at all. Only service_role reads it, and
--      today nothing in the app decrypts: the last 4 is enough for every screen we have.
--   3. Every store / purge / decrypt is written to `tax_id_audit`.
--
-- The retention purge (4 years past a seller's last sale, documents included) is the Inngest
-- `tax-id-retention` job, which uses `purged_at` below.

set search_path = public;

-- ---------------------------------------------------------------------------
-- 1. Columns
-- ---------------------------------------------------------------------------
alter table public.seller_licenses
  add column if not exists tax_id_encrypted text,
  add column if not exists tax_id_last4 char(4),
  add column if not exists purged_at timestamptz;

comment on column public.seller_licenses.tax_id_encrypted is
  'AES-256-GCM ciphertext of the SSN/EIN, keyed by TAX_ID_ENCRYPTION_KEY which lives only in the '
  'application environment. Postgres cannot read it, and SELECT is revoked from anon/authenticated '
  'so no browser session can fetch it either. Nothing in the app decrypts today.';

comment on column public.seller_licenses.tax_id_last4 is
  'The last 4 digits, the only part any screen shows. Kept in plaintext deliberately.';

comment on column public.seller_licenses.purged_at is
  'Set by the tax-id-retention job when the number and its documents were destroyed.';

comment on column public.seller_licenses.license_number is
  'The identifying number on a NON-sensitive document (an ID or permit number). A tax ID never '
  'goes here — see tax_id_encrypted / tax_id_last4.';

-- ---------------------------------------------------------------------------
-- 2. Any plaintext already collected: keep the last 4, destroy the rest.
--
-- There is no key inside Postgres, so these cannot be encrypted in place. Since the collecting
-- form shipped hours before this migration, the realistic count is zero or a handful — and leaving
-- readable SSNs behind to avoid re-asking for one is the wrong trade. Affected sellers re-upload;
-- the checklist will show the tax ID as missing.
-- ---------------------------------------------------------------------------
update public.seller_licenses
  set tax_id_last4 = right(regexp_replace(license_number, '\D', '', 'g'), 4),
      license_number = null
  where license_type = 'tax_id'
    and license_number is not null;

-- ---------------------------------------------------------------------------
-- 3. Column-level revoke. Table RLS still applies on top of this.
-- ---------------------------------------------------------------------------
revoke select (tax_id_encrypted) on public.seller_licenses from anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4. The audit trail.
-- ---------------------------------------------------------------------------
create table if not exists public.tax_id_audit (
  id          uuid primary key default gen_random_uuid(),
  license_id  uuid references public.seller_licenses(id) on delete set null,
  seller_id   uuid references public.seller_profiles(id) on delete set null,
  action      text not null check (action in ('stored', 'decrypted', 'purged')),
  -- Null for the retention job, which acts on its own schedule rather than for a person.
  actor_id    uuid references public.profiles(id) on delete set null,
  note        text,
  created_at  timestamptz not null default now()
);
create index tax_id_audit_seller_ix on public.tax_id_audit (seller_id, created_at desc);

alter table public.tax_id_audit enable row level security;

-- Admins read it; nobody writes through PostgREST. Every writer is a trusted server path holding
-- the service-role key, which bypasses RLS.
create policy "tax id audit: admin read"
  on public.tax_id_audit for select
  using (public.is_admin());

comment on table public.tax_id_audit is
  'Every time a tax ID was stored, decrypted or destroyed. Append-only in practice: written only '
  'by service-role paths, readable only by admins.';
