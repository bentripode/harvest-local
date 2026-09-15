-- Harvest Local — remove two columns nothing writes.
--
-- `20260909120000` added `story_image_path` and `story_image_url` alongside the story, on the
-- assumption that a seller would upload a photo with it. They wouldn't: there is no image uploader
-- in the seller UI at all. `seller_posts` has the same two columns from `20260908290000` and they
-- have never been populated either — the composer collects text and nothing else.
--
-- A column that no code path fills is the same mistake as a nullable owner or a seeded deadline: it
-- looks supported, reads as a gap someone forgot, and the next person to touch this writes a query
-- against it. Removed the same day it was added, before anything depends on it.
--
-- The home page illustrates a story with the seller's newest product image instead. That is a real
-- photograph of their own work, already uploaded through a path that exists, and it needs no bucket
-- policy, no upload form and no moderation surface that we do not have. When there is an uploader,
-- a story photo is a migration and a form together.

set search_path = public;

alter table public.seller_profiles
  drop column if exists story_image_path,
  drop column if exists story_image_url;
