-- Harvest Local — enforce the `seller-docs` bucket's private + constrained config (LAUNCH.md §7).
--
-- `20260901221902_phase1_storage_and_seed.sql` creates `seller-docs` with `public = false`, but via
-- `insert ... on conflict (id) do nothing` — so if the bucket already existed on a hosted project
-- (created in the dashboard, possibly public), that insert was a silent no-op and the setting was
-- never asserted. This migration makes it explicit and idempotent: license / ID documents must
-- never be publicly readable.

update storage.buckets
  set public = false,
      file_size_limit = 10485760,                                   -- 10 MiB
      allowed_mime_types = array['image/jpeg', 'image/png', 'application/pdf']
  where id = 'seller-docs';

-- Belt-and-braces: if the bucket somehow doesn't exist yet, create it (private).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('seller-docs', 'seller-docs', false, 10485760,
        array['image/jpeg', 'image/png', 'application/pdf'])
on conflict (id) do nothing;

-- The access policy (`seller-docs: owner all`, folder = seller_profiles.id) is defined in the
-- phase-1 storage migration and unchanged here. There is deliberately no public-read policy:
-- documents are reached only through short-lived signed URLs minted server-side.
