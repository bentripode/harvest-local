-- Wikimedia Commons pictures of a market, and the credit that licenses them.
--
-- Unlike a Google Places photo (20260916100000), a Commons file under CC0/CC BY/CC BY-SA or in the
-- public domain MAY be copied and served from our own bucket — that is the whole reason to prefer
-- it. What the licence asks for instead is attribution, and for CC BY-SA the licence must be named
-- alongside. So the credit is stored WITH the picture rather than fetched later: a photograph whose
-- author we have lost is one we are no longer licensed to publish.
--
-- `image_source` gains 'commons'. The website scan keys on this value to decide what it may
-- overwrite, so a Commons picture is safe from it exactly as an admin upload is.

alter table public.markets
  add column if not exists image_credit text,
  add column if not exists image_license text;

alter table public.markets
  drop constraint if exists markets_image_source_check;

alter table public.markets
  add constraint markets_image_source_check
  check (image_source in ('website', 'admin', 'commons'));

-- A Commons picture without a credit is unpublishable, so the pair travels together or not at all.
alter table public.markets
  add constraint markets_commons_needs_credit
  check (
    image_source is distinct from 'commons'
    or (image_credit is not null and image_license is not null and image_source_url is not null)
  );

comment on column public.markets.image_credit is
  'Who took the picture, as the licence requires it be shown. Mandatory for image_source = ''commons''.';
comment on column public.markets.image_license is
  'The licence short name printed beside the credit, e.g. "CC BY-SA 4.0". Mandatory for image_source = ''commons''.';
comment on column public.markets.image_source is
  'website = copied by scripts/market-websites.mjs; admin = uploaded on /admin/markets; commons = scripts/commons-photos.mjs. The scan only ever touches ''website''.';
