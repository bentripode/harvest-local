-- Harvest Local — storefront posts, and public questions.
--
-- A storefront between orders is a static page. Two cheap things fix that: a seller saying "no
-- bread this Saturday, back on the 14th", and a buyer asking "is this gluten free" where the answer
-- helps the next forty people who wondered.
--
-- The Q&A is also the only text on the site the seller doesn't have to write. A storefront with
-- twelve answered questions is twelve paragraphs of specific, searchable language about a real
-- product, contributed by the people who wanted to know.
--
-- =========================================================================
-- AN UNANSWERED QUESTION IS NOT PUBLIC
-- =========================================================================
-- Both competitors show every question the moment it is asked, with an empty "no questions yet"
-- panel on every page. That is a storefront anyone can write on: a seller who is away for a week
-- comes back to whatever a stranger decided to leave on their shop front, and it has been visible
-- the whole time.
--
-- So a question is private between the asker and the seller until the seller answers it. Answering
-- is what publishes it — which also means the public Q&A is entirely made of exchanges the seller
-- chose to stand behind. The asker always sees their own; the seller always sees all of theirs.
--
-- The answer itself follows `reviews`: one public reply per question, and a BEFORE UPDATE column
-- guard so the seller can edit the answer and nothing else. A seller must not be able to rewrite
-- the question they were asked.

set search_path = public;

-- ===========================================================================
-- seller_posts
-- ===========================================================================
create table public.seller_posts (
  id         uuid primary key default gen_random_uuid(),
  seller_id  uuid not null references public.seller_profiles(id) on delete cascade,
  body       text not null check (char_length(body) between 1 and 1000),
  /** A path in the public `product-images` bucket, under the seller's own folder. */
  image_path text check (image_path is null or char_length(image_path) <= 300),
  image_url  text check (image_url is null or char_length(image_url) <= 600),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index seller_posts_seller_ix on public.seller_posts (seller_id, created_at desc);

create trigger seller_posts_set_updated_at before update on public.seller_posts
  for each row execute function public.set_updated_at();

-- ===========================================================================
-- seller_questions
-- ===========================================================================
create table public.seller_questions (
  id          uuid primary key default gen_random_uuid(),
  seller_id   uuid not null references public.seller_profiles(id) on delete cascade,
  /** Optional: asked about one listing rather than the storefront generally. */
  product_id  uuid references public.products(id) on delete set null,
  asker_id    uuid not null references public.profiles(id) on delete cascade,
  /** The asker's first name, snapshotted — `profiles` is owner-read-only, as with reviews. */
  asker_name  text check (asker_name is null or char_length(asker_name) <= 120),

  body        text not null check (char_length(body) between 1 and 1000),

  answer      text check (answer is null or char_length(answer) between 1 and 2000),
  answered_at timestamptz,

  status      text not null default 'open'
                check (status in ('open', 'answered', 'hidden')),

  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  -- `answered` and "has an answer" are the same fact; keeping them in step here means the public
  -- read policy can trust either one.
  constraint seller_questions_answer_status
    check ((status = 'answered') = (answer is not null))
);

create index seller_questions_seller_ix on public.seller_questions (seller_id, created_at desc);
create index seller_questions_public_ix
  on public.seller_questions (seller_id, answered_at desc) where status = 'answered';

create trigger seller_questions_set_updated_at before update on public.seller_questions
  for each row execute function public.set_updated_at();

-- Same reasoning as `reviews.reviewer_name` (20260908120000): the public Q&A is read by signed-out
-- visitors, and `profiles` is owner-only, so the name has to travel with the row.
create or replace function public.seller_questions_capture_asker_name()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  select p.display_name into new.asker_name
    from public.profiles p where p.id = new.asker_id;
  return new;
end;
$$;

create trigger seller_questions_capture_asker_name
  before insert on public.seller_questions
  for each row execute function public.seller_questions_capture_asker_name();

-- ---------------------------------------------------------------------------
-- The seller may answer, and may not rewrite the question.
--
-- Straight from `reviews_guard_columns`: an UPDATE policy wide enough to let a seller answer is
-- wide enough to let them edit what they were asked, so the columns are frozen at the data layer
-- rather than trusted to the handler.
-- ---------------------------------------------------------------------------
create or replace function public.seller_questions_guard_columns()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if public.is_platform_context() then
    return new;
  end if;
  if new.id         is distinct from old.id
     or new.seller_id  is distinct from old.seller_id
     or new.product_id is distinct from old.product_id
     or new.asker_id   is distinct from old.asker_id
     or new.asker_name is distinct from old.asker_name
     or new.body       is distinct from old.body
     or new.created_at is distinct from old.created_at then
    raise exception 'only a question''s answer may be edited'
      using errcode = 'insufficient_privilege';
  end if;
  return new;
end;
$$;

create trigger seller_questions_guard_columns
  before update on public.seller_questions
  for each row execute function public.seller_questions_guard_columns();

-- ===========================================================================
-- RLS
-- ===========================================================================
alter table public.seller_posts enable row level security;
alter table public.seller_questions enable row level security;

-- Posts are readable exactly when the storefront is — including a seller on a break, whose
-- "back on the 14th" post is the most useful thing on the page.
create policy "posts: public read live"
  on public.seller_posts for select
  using (
    exists (
      select 1 from public.seller_profiles sp
       where sp.id = seller_posts.seller_id
         and (sp.is_paused = false
              or sp.pause_reason = 'vacation'
              or sp.profile_id = (select auth.uid()))
    )
  );

create policy "posts: seller writes own"
  on public.seller_posts for all
  using (
    seller_id in (
      select sp.id from public.seller_profiles sp where sp.profile_id = (select auth.uid())
    )
  )
  with check (
    seller_id in (
      select sp.id from public.seller_profiles sp where sp.profile_id = (select auth.uid())
    )
  );

-- A question is public once answered. Before that it is between the asker and the seller.
create policy "questions: answered are public"
  on public.seller_questions for select
  using (
    status = 'answered'
    or asker_id = (select auth.uid())
    or seller_id in (
      select sp.id from public.seller_profiles sp where sp.profile_id = (select auth.uid())
    )
    or public.is_admin()
  );

create policy "questions: signed-in users ask"
  on public.seller_questions for insert
  with check (
    asker_id = (select auth.uid())
    and status = 'open'
    and answer is null
    and exists (
      select 1 from public.seller_profiles sp
       where sp.id = seller_id and sp.is_paused = false
    )
  );

create policy "questions: seller answers"
  on public.seller_questions for update
  using (
    seller_id in (
      select sp.id from public.seller_profiles sp where sp.profile_id = (select auth.uid())
    )
  )
  with check (
    seller_id in (
      select sp.id from public.seller_profiles sp where sp.profile_id = (select auth.uid())
    )
  );

-- The asker may withdraw their own question; the seller may not delete one to make it go away.
-- Hiding is what a seller does with a question they will not answer, and a hidden question was
-- never public in the first place.
create policy "questions: asker withdraws own"
  on public.seller_questions for delete
  using (asker_id = (select auth.uid()));
