-- Harvest Local — remember what went on the jars, because a recall asks.
--
-- `production_date` and `lot_code` are asked for at print time and stored nowhere. That was the
-- right call for the PRODUCT — they are per-batch, and a date printed from a stored value is stale
-- by the next bake — but it left the seller with no record at all.
--
-- New Hampshire says why that matters. Its rule requires a product code including the manufacture
-- date, container size and lot or batch number "to support a recall". A lot code exists so that when
-- something goes wrong you can say WHICH jars. If the only copy is on the jar, the seller cannot
-- answer the one question the code was invented for.
--
-- Nine other states require a lot code or production date on the label (AR, ID, IL, IN, MN, NH, SD,
-- VA and the per-batch elements elsewhere), and the number is beside the point: a seller who has
-- printed 200 labels over a year and is asked "which batches contained the almond flour" needs a
-- list, and this is the cheapest possible one.
--
-- WHAT THIS IS NOT. It is not a batch-tracking system and it does not know what was sold to whom —
-- orders already record that. It is a print log: what label text went onto how many containers, on
-- what day, for which product. Joining it to orders by date is a human's job, and a rough answer
-- from a real log beats an exact answer from nothing.
--
-- WHY THE RENDERED LINES ARE STORED. The label rule can change under a seller — this pass rewrote
-- Vermont's whole rule set and corrected four disclaimers — so re-deriving what a label said from
-- today's rule would produce a label that was never printed. `lines` is a snapshot, in the same
-- spirit as the money fields on an order.

set search_path = public;

create table if not exists public.label_print_runs (
  id            uuid primary key default gen_random_uuid(),
  seller_id     uuid not null references public.seller_profiles(id) on delete cascade,
  product_id    uuid not null references public.products(id) on delete cascade,

  -- The per-batch values as printed. Nullable because not every state asks for them.
  production_date date,
  lot_code      text,
  expiration_date date,

  /** How many containers this run covers. */
  copies        int not null default 1 check (copies > 0 and copies <= 1000),

  /**
   * What the label actually said, as rendered: [{element, caption, value}, ...] plus the
   * disclaimer. A snapshot, because the state's rule can change afterwards.
   */
  lines         jsonb not null default '[]'::jsonb,
  disclaimer    text,

  /** The programme the rule came from, for the same reason. */
  program_name  text,

  printed_at    timestamptz not null default now()
);

comment on table public.label_print_runs is
  'A log of label print runs: which product, what lot code and production date, how many copies, '
  'and the rendered label text as a snapshot. Exists so a seller can answer "which jars" during a '
  'recall — the reason NH requires a product code in the first place. Not a batch-tracking system.';

create index if not exists label_print_runs_seller_printed_idx
  on public.label_print_runs (seller_id, printed_at desc);
create index if not exists label_print_runs_product_idx
  on public.label_print_runs (product_id, printed_at desc);
-- Recall lookup: "which runs carried lot X".
create index if not exists label_print_runs_lot_idx
  on public.label_print_runs (seller_id, lot_code)
  where lot_code is not null;

alter table public.label_print_runs enable row level security;

-- The seller's own record of their own printing. Nobody else has a reason to read it, including
-- buyers: it says nothing about an order.
create policy "print runs: owner reads own" on public.label_print_runs
  for select using (
    seller_id in (select id from public.seller_profiles where profile_id = auth.uid())
    or public.is_admin()
  );

create policy "print runs: owner records own" on public.label_print_runs
  for insert with check (
    seller_id in (select id from public.seller_profiles where profile_id = auth.uid())
  );

-- Deliberately no UPDATE policy. A print log that can be edited after the fact is not a log, and the
-- whole value of it in a recall is that it says what was true at the time.
create policy "print runs: owner deletes own" on public.label_print_runs
  for delete using (
    seller_id in (select id from public.seller_profiles where profile_id = auth.uid())
  );

-- A run must belong to a product the seller actually owns. RLS scopes the insert to the seller's own
-- profile; this stops them logging a run against somebody else's product.
create or replace function public.label_print_runs_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.products p
    where p.id = new.product_id and p.seller_id = new.seller_id
  ) then
    raise exception 'A print run must be for one of your own products.';
  end if;
  return new;
end;
$$;

drop trigger if exists label_print_runs_guard on public.label_print_runs;
create trigger label_print_runs_guard
  before insert on public.label_print_runs
  for each row execute function public.label_print_runs_guard();
