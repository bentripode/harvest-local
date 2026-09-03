-- Harvest Local — Phase 4: order reports (ARCHITECTURE §2.7). A buyer or seller flags a problem
-- with an order; admins triage. Stripe refunds + the `refunds` table are Phase 5.

set search_path = public;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles where id = (select auth.uid()) and role = 'admin'
  );
$$;

create table public.reports (
  id              uuid primary key default gen_random_uuid(),
  order_id        uuid not null references public.orders(id) on delete cascade,
  reporter_id     uuid not null references public.profiles(id) on delete cascade,
  reason          text not null check (reason in
                    ('not_received','not_as_described','damaged','payment','conduct','other')),
  description     text check (char_length(description) <= 2000),
  status          text not null default 'open'
                    check (status in ('open','investigating','resolved','refunded')),
  resolution_note text,
  resolved_by     uuid references public.profiles(id) on delete set null,
  resolved_at     timestamptz,
  created_at      timestamptz not null default now(),
  unique (order_id, reporter_id)
);
create index reports_status_ix on public.reports (status, created_at);

-- ---------------------------------------------------------------------------
-- The reporter must be a party to the order, and the order must be past payment.
-- ---------------------------------------------------------------------------
create or replace function public.reports_verify_reporter()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_order public.orders;
begin
  select * into v_order from public.orders where id = new.order_id;
  if not found then raise exception 'order not found'; end if;
  if v_order.status = 'pending_payment' then
    raise exception 'cannot report an unpaid order' using errcode = 'check_violation';
  end if;
  if new.reporter_id <> v_order.buyer_id
     and not exists (
       select 1 from public.seller_profiles sp
       where sp.id = v_order.seller_id and sp.profile_id = new.reporter_id
     ) then
    raise exception 'only a party to the order can report it' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;
create trigger reports_verify_reporter
  before insert on public.reports
  for each row execute function public.reports_verify_reporter();

-- ---------------------------------------------------------------------------
alter table public.reports enable row level security;

create policy "reports: reporter or admin reads"
  on public.reports for select
  using (reporter_id = (select auth.uid()) or public.is_admin());

create policy "reports: reporter files own"
  on public.reports for insert
  with check (reporter_id = (select auth.uid()));

create policy "reports: admin triages"
  on public.reports for update
  using (public.is_admin())
  with check (public.is_admin());

do $$
begin
  execute 'revoke all on function public.is_admin() from public, anon';
end $$;
