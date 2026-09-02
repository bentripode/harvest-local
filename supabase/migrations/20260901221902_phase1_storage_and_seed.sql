-- Harvest Local — Phase 1 storage buckets, storage RLS, and reference/seed data.

-- ===========================================================================
-- Storage buckets
--   product-images : public read, seller writes into their own {sellerProfileId}/ prefix
--   seller-docs    : PRIVATE (license / ID documents) — signed URLs only
-- ===========================================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('product-images', 'product-images', true,  5242880,  array['image/jpeg','image/png','image/webp','image/avif']),
  ('seller-docs',    'seller-docs',    false, 10485760, array['image/jpeg','image/png','application/pdf'])
on conflict (id) do nothing;

-- product-images: anyone can read; a seller can write only under a folder named after
-- their own seller_profiles.id
create policy "product-images: public read"
  on storage.objects for select
  using (bucket_id = 'product-images');

create policy "product-images: seller writes own folder"
  on storage.objects for insert
  with check (
    bucket_id = 'product-images'
    and (storage.foldername(name))[1] in (
      select sp.id::text from public.seller_profiles sp where sp.profile_id = (select auth.uid())
    )
  );

create policy "product-images: seller updates own folder"
  on storage.objects for update
  using (
    bucket_id = 'product-images'
    and (storage.foldername(name))[1] in (
      select sp.id::text from public.seller_profiles sp where sp.profile_id = (select auth.uid())
    )
  );

create policy "product-images: seller deletes own folder"
  on storage.objects for delete
  using (
    bucket_id = 'product-images'
    and (storage.foldername(name))[1] in (
      select sp.id::text from public.seller_profiles sp where sp.profile_id = (select auth.uid())
    )
  );

-- seller-docs: the seller can read/write only their own folder; no public read at all
create policy "seller-docs: owner all"
  on storage.objects for all
  using (
    bucket_id = 'seller-docs'
    and (storage.foldername(name))[1] in (
      select sp.id::text from public.seller_profiles sp where sp.profile_id = (select auth.uid())
    )
  )
  with check (
    bucket_id = 'seller-docs'
    and (storage.foldername(name))[1] in (
      select sp.id::text from public.seller_profiles sp where sp.profile_id = (select auth.uid())
    )
  );

-- ===========================================================================
-- Platform settings
--   access_mode: gate the marketplace for the first 30 days ("Sellers Only")
--   buyer_referral_discount: single global number governing every promo code (Phase 3)
-- ===========================================================================
insert into public.platform_settings (key, value) values
  ('access_mode',            '{"mode": "sellers_only"}'::jsonb),
  ('buyer_referral_discount','{"type": "percent", "value": 10}'::jsonb),
  ('seller_referral_reward', '{"threshold": 3, "coupon": "FREE_MONTH_100"}'::jsonb)
on conflict (key) do nothing;

-- ===========================================================================
-- Categories & sub-categories (tax_code = Stripe product tax code default)
-- ===========================================================================
with top as (
  insert into public.categories (name, slug, tax_code, sort_order) values
    ('Produce',              'produce',              'txcd_40060003', 10),
    ('Baked Goods',          'baked-goods',          'txcd_40060003', 20),
    ('Dairy & Eggs',         'dairy-eggs',           'txcd_40060003', 30),
    ('Meat & Seafood',       'meat-seafood',         'txcd_40060003', 40),
    ('Pantry & Preserves',   'pantry-preserves',     'txcd_40060003', 50),
    ('Beverages',            'beverages',            'txcd_40060003', 60),
    ('Flowers & Plants',     'flowers-plants',       'txcd_99999999', 70),
    ('Crafts & Artisan Goods','crafts-artisan-goods','txcd_99999999', 80)
  returning id, slug
)
insert into public.categories (name, slug, parent_id, sort_order)
select v.name, v.slug, top.id, v.sort_order
from top
join (values
  ('produce',              'Vegetables',       'produce-vegetables',        10),
  ('produce',              'Fruit',            'produce-fruit',             20),
  ('produce',              'Herbs',            'produce-herbs',             30),
  ('baked-goods',          'Bread',            'baked-goods-bread',         10),
  ('baked-goods',          'Pastries',         'baked-goods-pastries',      20),
  ('baked-goods',          'Cakes & Cookies',  'baked-goods-cakes-cookies', 30),
  ('dairy-eggs',           'Eggs',             'dairy-eggs-eggs',           10),
  ('dairy-eggs',           'Cheese',           'dairy-eggs-cheese',         20),
  ('dairy-eggs',           'Milk & Butter',    'dairy-eggs-milk-butter',    30),
  ('meat-seafood',         'Poultry',          'meat-seafood-poultry',      10),
  ('meat-seafood',         'Beef & Pork',      'meat-seafood-beef-pork',    20),
  ('meat-seafood',         'Seafood',          'meat-seafood-seafood',      30),
  ('pantry-preserves',     'Jam & Jelly',      'pantry-jam-jelly',          10),
  ('pantry-preserves',     'Honey',            'pantry-honey',              20),
  ('pantry-preserves',     'Pickles & Ferments','pantry-pickles-ferments',  30),
  ('pantry-preserves',     'Sauces & Spices',  'pantry-sauces-spices',      40),
  ('beverages',            'Coffee & Tea',     'beverages-coffee-tea',      10),
  ('beverages',            'Juice & Cider',    'beverages-juice-cider',     20),
  ('flowers-plants',       'Cut Flowers',      'flowers-cut',               10),
  ('flowers-plants',       'Seedlings',        'flowers-seedlings',         20),
  ('crafts-artisan-goods', 'Soap & Body Care', 'crafts-soap-body-care',     10),
  ('crafts-artisan-goods', 'Candles',          'crafts-candles',            20),
  ('crafts-artisan-goods', 'Textiles',         'crafts-textiles',           30),
  ('crafts-artisan-goods', 'Woodwork',         'crafts-woodwork',           40)
) as v(parent_slug, name, slug, sort_order) on v.parent_slug = top.slug;

-- ===========================================================================
-- Tags
-- ===========================================================================
insert into public.tags (name, slug) values
  ('Organic',        'organic'),
  ('Gluten-Free',    'gluten-free'),
  ('Vegan',          'vegan'),
  ('Dairy-Free',     'dairy-free'),
  ('Nut-Free',       'nut-free'),
  ('Local Honey',    'local-honey'),
  ('Pasture-Raised', 'pasture-raised'),
  ('Grass-Fed',      'grass-fed'),
  ('Heirloom',       'heirloom'),
  ('Seasonal',       'seasonal'),
  ('Small Batch',    'small-batch'),
  ('Handmade',       'handmade')
on conflict (slug) do nothing;
