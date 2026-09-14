-- Harvest Local — markets filled in by research, with the sources to show for it.
--
-- The USDA directory and each market's own website leave most markets with no hours and many with
-- no usable website: in Texas, 235 of 236 had no hours after the website scan. Those gaps are now
-- filled by research (web search, read by a person or by Claude on the owner's instruction,
-- 2026-09-14) and published directly — so everything researched says where it came from, and a
-- buyer can check it before driving anywhere.
--
-- Deliberately NOT collected from Facebook itself: facebook.com/robots.txt states that "collection
-- of data on Facebook through automated means is prohibited unless you have express written
-- permission". A market's Facebook page is LINKED (USDA lists many; research finds more); its logo
-- and hours are not scraped from it.

-- The market's Facebook page, as a link. USDA's keyed API calls it `media_facebook`.
alter table public.markets
  add column facebook_url text,
  -- Where `website_url` came from: the USDA directory, or research when USDA had none (or one that
  -- is dead or someone else's now). Lets a re-import or a review tell the two apart.
  add column website_source text check (website_source in ('usda', 'research'));

update public.markets set website_source = 'usda' where website_url is not null;

-- Hours from research sit alongside a person's and a website's. `source_note` is what the page
-- prints ("Yelp, Nextdoor and a 2026 event listing"); `source_url` is the one to follow.
alter table public.market_hours drop constraint if exists market_hours_source_check;
alter table public.market_hours
  add constraint market_hours_source_check check (source in ('admin', 'website', 'research')),
  add column source_note text,
  add column source_url text;

comment on column public.markets.facebook_url is
  'The market''s Facebook page — linked only; nothing is collected from it (Facebook forbids automated collection).';
comment on column public.market_hours.source_note is
  'For source = research: the listings the hours were read from, as shown beside them.';
