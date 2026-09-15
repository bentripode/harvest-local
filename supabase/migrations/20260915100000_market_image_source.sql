-- Harvest Local — who put a market's picture there.
--
-- Until now every market picture came from the website scan (the site's own link-preview image).
-- /admin/markets now lets a person upload one by hand — usually the logo on a market's Facebook
-- page, which the scan may not collect (facebook.com/robots.txt forbids automated collection) but a
-- person may save and upload.
--
-- The column exists so the scan never undoes that work: it replaces or clears a `website` picture
-- when the site changes, and leaves an `admin` one alone whatever the site says. Without it, the
-- next scan of a market whose site has no preview image would delete the logo someone uploaded.

alter table public.markets
  add column image_source text check (image_source in ('website', 'admin'));

update public.markets set image_source = 'website' where image_url is not null;

comment on column public.markets.image_source is
  'website = copied by scripts/market-websites.mjs; admin = uploaded on /admin/markets. The scan never touches admin.';
