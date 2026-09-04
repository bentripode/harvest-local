-- Harvest Local — hardening: server-side rate limiting for the public write paths
-- (checkout, promo validation, messaging, order reports). LAUNCH.md §7.
--
-- Fixed-window counter kept in Postgres — no extra infra, and Postgres is already on the
-- critical path for every action being limited. Check-and-increment is one atomic statement
-- inside a SECURITY DEFINER function.

set search_path = public;

create table public.rate_limits (
  bucket       text        not null,
  window_start timestamptz not null,
  count        integer     not null default 0,
  primary key (bucket, window_start)
);

-- Fully private: RLS on with no policies, and the check function (below) runs as the table
-- owner, so nothing reachable by anon/authenticated can read or write this.
alter table public.rate_limits enable row level security;

-- ---------------------------------------------------------------------------
-- Atomic fixed-window check-and-increment. Returns whether the caller is under the limit and,
-- if not, whole seconds until the window rolls over. Keys are built server-side from the
-- authenticated user id (never from user input), so EXECUTE is service_role only — callers go
-- through the admin client in src/lib/rate-limit.ts.
-- ---------------------------------------------------------------------------
create or replace function public.check_rate_limit(
  p_key         text,
  p_max         integer,
  p_window_secs integer
)
returns table (allowed boolean, retry_after integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_epoch        bigint      := floor(extract(epoch from clock_timestamp()));
  v_window_start timestamptz := to_timestamp((v_epoch / p_window_secs) * p_window_secs);
  v_count        integer;
begin
  insert into public.rate_limits (bucket, window_start, count)
  values (p_key, v_window_start, 1)
  on conflict (bucket, window_start)
    do update set count = public.rate_limits.count + 1
  returning count into v_count;

  -- Bound the table to ~one row per active bucket.
  delete from public.rate_limits
  where bucket = p_key and window_start < v_window_start;

  if v_count > p_max then
    return query select
      false,
      greatest(
        1,
        ceil(extract(epoch from
          (v_window_start + make_interval(secs => p_window_secs)) - clock_timestamp()
        ))::integer
      );
  else
    return query select true, 0;
  end if;
end;
$$;

revoke all on function public.check_rate_limit(text, integer, integer) from public, anon, authenticated;
grant execute on function public.check_rate_limit(text, integer, integer) to service_role;
