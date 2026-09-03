-- Harvest Local — Phase 5: refunds. An admin issues a full refund from the dispute queue; Stripe
-- processes it and the `charge.refunded` webhook does the order unwind (rule 2). This table is a
-- queryable mirror, written by the admin action and reconciled by the webhook.

set search_path = public;

create table public.refunds (
  id               uuid primary key default gen_random_uuid(),
  order_id         uuid not null unique references public.orders(id) on delete cascade,
  report_id        uuid references public.reports(id) on delete set null,
  stripe_refund_id text not null,
  amount           numeric(10,2) not null check (amount >= 0),
  reason           text,
  initiated_by     uuid references public.profiles(id) on delete set null,
  created_at       timestamptz not null default now()
);

alter table public.refunds enable row level security;

-- The order's buyer/seller see "refunded $X"; admins see all. No client writes.
create policy "refunds: party or admin reads"
  on public.refunds for select
  using (
    public.is_admin()
    or exists (
      select 1 from public.orders o
      where o.id = refunds.order_id
        and (
          o.buyer_id = (select auth.uid())
          or o.seller_id in (
            select sp.id from public.seller_profiles sp where sp.profile_id = (select auth.uid())
          )
        )
    )
  );
