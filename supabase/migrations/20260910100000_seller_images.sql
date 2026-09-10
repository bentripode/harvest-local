-- Harvest Local — a face and a banner for a storefront.
--
-- `20260909120000` added `story_image_path` / `story_image_url` to seller_profiles and
-- `20260909130000` took them off again the same day, on the grounds that a column no code path
-- fills is the same mistake as a nullable owner or a seeded deadline. There is an uploader now, so
-- these arrive WITH the form that writes them, which is the condition that was missing.
--
-- Two images, not one, because they answer different questions and are cropped differently:
--   avatar — who this is. Square, shown at 28-64px beside the name on the gallery, the basket, the
--            dashboard and the storefront. `SellerAvatar` draws an initial on a name-derived hue
--            when it is null, so a seller without one is never a grey hole.
--   cover  — what they make. Wide, shown once at the top of the storefront and nowhere else. Null
--            renders no band at all rather than a placeholder, because an empty banner is worse
--            than none.
--
-- Both store the storage PATH beside the public URL, the same shape as `seller_posts.image_path` /
-- `image_url` and `products.images`. The URL is what every read renders; the path is what lets the
-- save action delete the object it is replacing, which is the only way these do not accumulate
-- orphans in the bucket forever.
--
-- Objects live in the `product-images` bucket. Its name is now historical: the policies on it are
-- "public read" and "a seller writes only under a folder named after their own seller_profiles.id",
-- which is exactly right for every public image a seller owns. Reusing it keeps ONE set of storage
-- policies to audit rather than two that must be kept in step. Paths are prefixed by kind —
-- `{sellerId}/avatar/…`, `{sellerId}/cover/…`, `{sellerId}/posts/…`, `{sellerId}/products/…`.
--
-- These are NOT protected columns: `seller_profiles_guard_columns` is a denylist of the platform's
-- own fields (is_paused, the Connect flags, avg_rating, home_state), so a seller may write these
-- through the ordinary owner policy, which is what the form needs.

alter table public.seller_profiles
  add column if not exists avatar_path text
    check (avatar_path is null or char_length(avatar_path) <= 300),
  add column if not exists avatar_url  text
    check (avatar_url is null or char_length(avatar_url) <= 600),
  add column if not exists cover_path  text
    check (cover_path is null or char_length(cover_path) <= 300),
  add column if not exists cover_url   text
    check (cover_url is null or char_length(cover_url) <= 600);

comment on column public.seller_profiles.avatar_path is
  'Storage path in the product-images bucket, under {seller_id}/avatar/. Kept so the save action '
  'can delete the object it replaces; every read renders avatar_url instead.';

comment on column public.seller_profiles.avatar_url is
  'Public URL of the seller''s square mark. Null is normal and renders as an initial on a '
  'name-derived hue (SellerAvatar), never as an empty box.';

comment on column public.seller_profiles.cover_path is
  'Storage path in the product-images bucket, under {seller_id}/cover/. Kept for replacement '
  'deletes; reads use cover_url.';

comment on column public.seller_profiles.cover_url is
  'Public URL of the wide banner at the top of the storefront. Null renders no band at all — an '
  'empty banner is worse than none.';
