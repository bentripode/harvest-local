-- Harvest Local — what we read from a market's own website.
--
-- The USDA directory gives a market's name, place and (usually) website, and since its JSON API
-- replaced the CSV it gives no opening times at all. `scripts/market-websites.mjs` visits each
-- market's site and records two things the market says about itself there:
--
--   1. The picture it offers for link previews (og:image). A ~480px copy goes in the public
--      `market-images` bucket — copied rather than hotlinked so the directory does not break when a
--      market redesigns, is not blocked as mixed content when their image is http, and does not
--      make every visitor's browser call a third-party server. The card links back to the site.
--   2. Opening hours, but ONLY where the site publishes them as schema.org structured data
--      (`openingHoursSpecification` / `openingHours`). That is the market's own machine-readable
--      statement, not prose we interpreted — the rule from 20260908220000 still holds: a schedule
--      is never parsed out of free text.
--
-- Provenance is kept on both, because a buyer may drive somewhere on the strength of it.

-- ===========================================================================
-- markets: the picture, and the last visit to the site
-- ===========================================================================
alter table public.markets
  add column image_path         text,
  add column image_url          text,
  -- The exact address we copied from, so a takedown or a re-check knows what it is looking at.
  add column image_source_url   text,
  add column website_checked_at timestamptz,
  -- One short line on the last visit: 'ok', 'no preview image', 'robots.txt disallows', 'HTTP 404'…
  -- Kept so a re-run can skip sites that asked not to be crawled, and so nobody has to guess why a
  -- market has no picture.
  add column website_check_note text;

comment on column public.markets.image_url is
  'Public URL of our thumbnail copy of the market''s own link-preview image. Null = none found.';
comment on column public.markets.image_source_url is
  'Where image_url was copied from (the site''s og:image). Provenance for takedowns and re-checks.';

-- ===========================================================================
-- market_hours: who said so
--
-- Until now every row was entered by a person. Website rows are replaced wholesale on each scan;
-- admin rows are never touched by it, and the scan writes nothing for a market that has any —
-- a person who checked beats a page nobody has updated since 2019.
-- ===========================================================================
alter table public.market_hours
  add column source text not null default 'admin'
    check (source in ('admin', 'website'));

comment on column public.market_hours.source is
  'admin = entered by a person; website = read from the market''s own schema.org opening hours.';

-- ===========================================================================
-- market-images bucket: public read, written by the service role alone.
--
-- No storage.objects write policy at all, so only the service-role scan can put anything here. A
-- public bucket serves its objects by URL without a SELECT policy.
-- ===========================================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('market-images', 'market-images', true, 2097152, array['image/jpeg', 'image/webp'])
on conflict (id) do nothing;
