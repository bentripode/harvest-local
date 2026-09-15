-- Harvest Local — what actually landed in the seller's bank.
--
-- `/seller` already reports revenue, and it is our own order math: the sum of `orders.total` for
-- completed orders, which is what BUYERS PAID. That is the right number for "how am I trading" and
-- the wrong one for "why is my bank £27 short". The difference is Stripe's processing fees, refunds
-- and dispute holds, and payout timing — three things we do not compute and must never appear to.
--
-- ===========================================================================
-- THIS TABLE IS A MIRROR. IT HOLDS NOTHING WE WORKED OUT OURSELVES.
-- ===========================================================================
-- CLAUDE.md rule 2: Stripe is the source of truth for money and our tables are a queryable copy kept
-- in sync by webhooks. Every column below is a field of a Stripe `Payout` object, written by the
-- webhook and by nothing else. There is deliberately no `net`, no `fees`, no `expected_total` — the
-- moment this table carries a figure we derived, a seller has two numbers for the same thing and no
-- way to know which is real.
--
-- For the same reason there is no `payout_items` table. What is *inside* a payout is a list of
-- balance transactions Stripe already owns and can answer for at any time; copying it here would
-- create a second copy that can drift and would have to be reconciled. The payout page reads that
-- through to Stripe when a seller opens one. Mirror what you must query; ask for the rest.
--
-- These are CONNECT events: they arrive with `event.account` set to the connected account, and
-- verify against STRIPE_CONNECT_WEBHOOK_SECRET. With that secret unset no payout event verifies and
-- this table simply stays empty, which is the honest failure — an empty ledger, not a wrong one.

set search_path = public;

create table public.payouts (
  id                 uuid primary key default gen_random_uuid(),
  seller_id          uuid not null references public.seller_profiles(id) on delete cascade,

  /** The Stripe Payout id. Unique, which is what makes the webhook upsert idempotent. */
  stripe_payout_id   text not null,

  /** Minor units come off the wire; stored as numeric like every other money column. */
  amount             numeric(12, 2) not null,
  currency           text not null,

  /**
   * Stripe's own status, stored verbatim rather than mapped onto words of ours. A vocabulary we
   * invented would need updating whenever Stripe adds a state, and would be wrong in between.
   */
  status             text not null,

  /** When Stripe expects it to land. A DATE: it is a banking day, not an instant. */
  arrival_date       date,

  /** Stripe's creation time for the payout, which is not when we heard about it. */
  stripe_created_at  timestamptz,

  /** Present only on a failure. Shown to the seller — a failed payout with no reason is a mystery. */
  failure_code       text,
  failure_message    text,

  /** "standard" or "instant", and the descriptor the bank shows. Both are Stripe's words. */
  method             text,
  statement_descriptor text,

  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create unique index payouts_stripe_id_ux on public.payouts (stripe_payout_id);
create index payouts_seller_ix on public.payouts (seller_id, arrival_date desc nulls last);

create trigger payouts_set_updated_at before update on public.payouts
  for each row execute function public.set_updated_at();

comment on table public.payouts is
  'Mirror of Stripe Payout objects for connected accounts, written only by the Connect webhook. '
  'Holds no derived figures — what is inside a payout is read through to Stripe on demand.';

-- ===========================================================================
-- RLS
--
-- A seller reads their own and writes none of it. There is no INSERT or UPDATE policy at all: the
-- only writer is the service role in the webhook, which bypasses RLS. A payout row a seller could
-- edit would be a payout record that disagrees with the bank.
-- ===========================================================================
alter table public.payouts enable row level security;

grant select on public.payouts to authenticated;
grant all on public.payouts to service_role;

create policy "payouts: seller reads own"
  on public.payouts for select
  using (
    seller_id in (
      select sp.id from public.seller_profiles sp where sp.profile_id = (select auth.uid())
    )
    -- `is_admin()` is revoked from anon by design, so admins are matched inline.
    or exists (
      select 1 from public.profiles p
       where p.id = (select auth.uid()) and p.role = 'admin'
    )
  );
