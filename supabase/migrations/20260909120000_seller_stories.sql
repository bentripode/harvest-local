-- Harvest Local — the person behind the food.
--
-- The home page currently argues that the marketplace is worth using. What it cannot do is show
-- that it is made of people, and that is the whole proposition of buying from a neighbour rather
-- than a shelf. A marketplace with three sellers and no faces reads as empty; the same three with
-- their stories on it reads as early.
--
-- ===========================================================================
-- ONE STORY PER SELLER, SO IT LIVES ON seller_profiles
-- ===========================================================================
-- A separate table would be right if a seller had many. They don't: "who I am and why I make this"
-- is one piece of writing, and the thing they have many of already exists — `seller_posts`, which is
-- their running feed. Splitting one row's worth of text into its own table would buy a join and
-- nothing else.
--
-- `bio` stays what it is: the one-liner under the storefront name. The story is the long version,
-- and both are the seller's own words.
--
-- ===========================================================================
-- THE HOME PAGE IS OPT-IN
-- ===========================================================================
-- `story_on_home` defaults FALSE. A story is written for the seller's own storefront; putting
-- somebody's writing on the marketplace's front page is a different act and they should choose it.
-- The cost is that the home page stays empty until sellers opt in, which is the cold-start problem
-- this feature exists to solve — but publishing a person's words to the front page without asking
-- to solve it faster is not a trade this codebase should make.
--
-- None of these are added to `seller_profiles_guard_columns`: the story is the seller's to write,
-- unlike `is_paused` or `avg_rating`, which are verdicts the platform reaches about them.

set search_path = public;

alter table public.seller_profiles
  add column if not exists story text
    constraint seller_profiles_story_len check (story is null or char_length(story) <= 2000),

  /**
   * A path in the public `product-images` bucket, under the seller's own folder — the same place
   * `seller_posts` puts its image, so there is one upload path and one bucket policy, not two.
   */
  add column if not exists story_image_path text
    constraint seller_profiles_story_image_path_len
      check (story_image_path is null or char_length(story_image_path) <= 300),
  add column if not exists story_image_url text
    constraint seller_profiles_story_image_url_len
      check (story_image_url is null or char_length(story_image_url) <= 600),

  /** Opt-in to the marketplace home page. See the note above. */
  add column if not exists story_on_home boolean not null default false;

comment on column public.seller_profiles.story is
  'The seller''s own long-form "who I am". Shown on their storefront, and on the home page only '
  'when story_on_home is true.';
comment on column public.seller_profiles.story_on_home is
  'Seller opt-in to appearing on the marketplace home page. Never set by the platform.';

-- Partial index: the home page asks for exactly this set, and it is a small slice of the table.
create index if not exists seller_profiles_story_home_ix
  on public.seller_profiles (home_state)
  where story_on_home = true and story is not null and is_paused = false;
