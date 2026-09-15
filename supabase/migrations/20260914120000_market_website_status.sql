-- Harvest Local — whether a market's listed website is still the market's.
--
-- The directory's addresses are years old, and the first scan of Texas (2026-09-14) found what
-- happens to a lapsed market domain: two now serve Indonesian gambling spam (one with a sexualised
-- advert as its preview image), two are registrar for-sale pages, one is a French car blog. The
-- cards had been linking buyers straight to them. So the scan now records a verdict, and the app
-- stops linking to a site that is no longer the market's.
--
--   ok           the page is a market page (mentions a farmers market, or names this one)
--   unreachable  no DNS / no connection / 404 — the site is gone
--   parked       a registrar's for-sale page
--   taken_over   someone else's spam on the old domain
--   unrelated    a real page that never mentions this market
--   null         not scanned, or no verdict possible (403, robots.txt, a social platform, a timeout)
--                — the link is still shown, because we have no reason to think it is wrong.
--
-- `website_url` itself is never cleared: it is the directory's data, and a site can come back.

alter table public.markets
  add column website_status text
    check (website_status in ('ok', 'unreachable', 'parked', 'taken_over', 'unrelated')),
  -- A picture a person looked at and removed. The scan will not copy the same image back; a site
  -- that changes its picture gets a fresh look, because the new one might be fine.
  add column image_rejected_source_url text;

comment on column public.markets.website_status is
  'Scan verdict on website_url. parked / taken_over / unrelated / unreachable = do not link to it.';
comment on column public.markets.image_rejected_source_url is
  'An image a person removed on review; scripts/market-websites.mjs will not re-copy this exact URL.';
