-- A market's Google Place ID, so its page can show Google's photographs of it.
--
-- The place id is the ONLY thing from the Places API that may live in this table. Google's Places
-- policy says "You must not pre-fetch, cache, or store Places API content beyond the allowed
-- exceptions", and names exactly one exception: "the place_id is exempt from caching restrictions.
-- You can therefore store place ID values indefinitely."
--
-- So there is deliberately no photo column, no photo reference, no rating and no opening hours
-- here. Those are fetched live when a market page is rendered and shown with the photographer's
-- credit; copying them into our own tables is the thing the policy forbids, and it is also what
-- `markets.image_url` means, which is why a Places photograph must never be written there.
-- `image_url` is our own copy of a picture a market's OWN website offered for link previews
-- (20260914110000), taken under that site's terms — a different picture under different rules.

alter table public.markets
  add column if not exists google_place_id text,
  add column if not exists google_place_checked_at timestamptz,
  add column if not exists google_place_note text;

comment on column public.markets.google_place_id is
  'Google Place ID. The only Places API value we may store (their policy exempts it explicitly). Never a photo, rating or schedule.';
comment on column public.markets.google_place_checked_at is
  'When we last asked Google which place this is — set whether or not a match was found.';
comment on column public.markets.google_place_note is
  'Why no place matched: the name disagreed, the nearest candidate was too far, or we hold no coordinates to verify against.';

-- Not unique: our USDA import carries genuine duplicate rows for one market (two "Dallas Farmers
-- Market" rows), and both may legitimately resolve to the same place.
create index if not exists markets_google_place_id_idx
  on public.markets (google_place_id)
  where google_place_id is not null;

-- Lets the resolver find the markets it has not asked about lately without a full scan.
create index if not exists markets_google_place_checked_idx
  on public.markets (state, google_place_checked_at nulls first);

-- No RLS change. `markets` already reads publicly through "markets: public read published", and a
-- place id is a public identifier — it is what a Google Maps link is made of. Writes stay with the
-- service role, as for every other column the scanners fill.
