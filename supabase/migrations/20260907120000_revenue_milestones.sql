-- Harvest Local — warn before the wall, not at it.
--
-- `record_order_revenue` pauses a storefront the moment a cap is crossed, with no warning at any
-- point beforehand. And `license_threshold_crossed_at` — the column that records a seller passing
-- the point where their state wants them licensed — is stamped and then read by NOTHING. There is
-- no template, no producer, no notification anywhere in the codebase. A Vermont seller passes
-- $10,000, now needs a licence, and finds out never.
--
-- Both get approach milestones at 50%, 75% and 90%, and the licensing threshold gets a notice when
-- it is actually crossed.
--
-- WHY THE LEVELS ARE STORED RATHER THAN DERIVED. This function runs once per completed order, so
-- "did we pass 75% with this one" looks answerable by comparing before and after — but only if
-- nothing else moves the total, and refunds and cancellations do. Storing the highest milestone
-- already announced makes each notice fire once and stay fired: a seller who dips back under 75%
-- and climbs through it again is not told twice, which is the right behaviour for a warning about a
-- yearly total.
--
-- The cap and the threshold get separate counters because they are separate numbers with separate
-- consequences — Vermont has a threshold and no cap, Washington a cap and no threshold, and a state
-- could have both.
--
-- Everything else in this function is UNCHANGED from 20260904230000 and 20260904240000: the
-- per-product and per-category bucket tallies, the proportional share, the atomic pause. Only the
-- return signature and the milestone bookkeeping are new. It is reproduced in full because
-- `returns table` cannot be altered in place.

set search_path = public;

alter table public.seller_revenue_tracking
  add column if not exists cap_notice_level int not null default 0
    check (cap_notice_level in (0, 50, 75, 90)),
  add column if not exists license_notice_level int not null default 0
    check (license_notice_level in (0, 50, 75, 90));

comment on column public.seller_revenue_tracking.cap_notice_level is
  'The highest approach milestone (50, 75, 90) already announced for the sales cap this period. '
  'Stored rather than derived so a seller whose total dips on a refund and recovers is not warned '
  'twice about the same line.';
comment on column public.seller_revenue_tracking.license_notice_level is
  'The same, for the licensing threshold. Separate from cap_notice_level because they are separate '
  'numbers: Vermont has a threshold and no cap, Washington a cap and no threshold.';

drop function if exists public.record_order_revenue(uuid);

create function public.record_order_revenue(p_order_id uuid)
returns table (
  gross             numeric,
  cap               numeric,
  over              boolean,
  paused            boolean,
  threshold         numeric,
  threshold_crossed boolean,
  cap_milestone     int,
  license_milestone int
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order     public.orders;
  v_year      int := extract(year from now())::int;
  v_amount    numeric(12,2);
  v_cap       numeric(12,2);
  v_basis     text := 'annual_total';
  v_cap_cat   text;
  v_threshold numeric(12,2);
  v_program   uuid;
  v_gross     numeric(12,2);
  v_was_over  boolean;
  v_over      boolean;
  v_paused    boolean := false;
  v_crossed   timestamptz;
  v_ratio     numeric;
  v_crossed_now boolean := false;
  v_cap_level int := 0;
  v_lic_level int := 0;
  v_cap_ms    int := null;
  v_lic_ms    int := null;
begin
  select * into v_order from public.orders where id = p_order_id for update;

  if not found
     or v_order.status <> 'completed'
     or v_order.revenue_recorded_at is not null then
    select srt.gross_revenue, srt.cap_amount, srt.is_over_cap
      into v_gross, v_cap, v_over
      from public.seller_revenue_tracking srt
      where srt.seller_id = v_order.seller_id
        and srt.state = v_order.seller_state
        and srt.period_year = v_year;
    return query select coalesce(v_gross, 0)::numeric, v_cap, coalesce(v_over, false), false,
                        null::numeric, false, null::int, null::int;
    return;
  end if;

  v_amount := greatest(coalesce(v_order.subtotal, 0) - coalesce(v_order.discount_total, 0), 0);

  -- The cap comes from the seller's chosen program; without one, the state's legacy figure.
  select sp.food_program_id into v_program
    from public.seller_profiles sp where sp.id = v_order.seller_id;

  if v_program is not null then
    select fp.revenue_cap, fp.cap_basis, fp.cap_category, fp.license_threshold
      into v_cap, v_basis, v_cap_cat, v_threshold
      from public.state_food_programs fp where fp.id = v_program;
  else
    select revenue_cap into v_cap
      from public.state_cottage_food_rules where state_code = v_order.seller_state;
  end if;

  -- The annual tally is kept regardless of basis: it is what the compliance page shows.
  insert into public.seller_revenue_tracking (seller_id, state, period_year, gross_revenue, cap_amount)
  values (v_order.seller_id, v_order.seller_state, v_year, v_amount,
          case when v_basis = 'annual_total' then v_cap else null end)
  on conflict (seller_id, state, period_year) do update
    set gross_revenue = public.seller_revenue_tracking.gross_revenue + excluded.gross_revenue,
        cap_amount    = excluded.cap_amount,
        updated_at    = now()
  returning gross_revenue, is_over_cap, license_threshold_crossed_at, cap_notice_level, license_notice_level
    into v_gross, v_was_over, v_crossed, v_cap_level, v_lic_level;

  -- Proportional share of the order's discounted total, so a bucket never counts more than the
  -- seller was actually paid.
  v_ratio := case when coalesce(v_order.subtotal, 0) > 0 then v_amount / v_order.subtotal else 0 end;

  if v_basis = 'per_product' then
    insert into public.seller_revenue_buckets (seller_id, period_year, basis, bucket_key, gross_revenue, cap_amount)
    select v_order.seller_id, v_year, 'per_product', oi.product_id::text,
           round(sum(oi.line_total) * v_ratio, 2), v_cap
      from public.order_items oi
      where oi.order_id = p_order_id and oi.product_id is not null
      group by oi.product_id
    on conflict (seller_id, period_year, basis, bucket_key) do update
      set gross_revenue = public.seller_revenue_buckets.gross_revenue + excluded.gross_revenue,
          cap_amount    = excluded.cap_amount,
          updated_at    = now();

  elsif v_basis = 'per_category' then
    -- Only the capped category is tallied; Virginia leaves everything else uncapped.
    insert into public.seller_revenue_buckets (seller_id, period_year, basis, bucket_key, gross_revenue, cap_amount)
    select v_order.seller_id, v_year, 'per_category', axis,
           round(sum(oi.line_total) * v_ratio, 2), v_cap
      from public.order_items oi
      join public.products p on p.id = oi.product_id
      join public.categories c on c.id = p.category_id
      cross join lateral unnest(c.food_axes) as axis
      where oi.order_id = p_order_id
        and (v_cap_cat is null or axis = v_cap_cat)
      group by axis
    on conflict (seller_id, period_year, basis, bucket_key) do update
      set gross_revenue = public.seller_revenue_buckets.gross_revenue + excluded.gross_revenue,
          cap_amount    = excluded.cap_amount,
          updated_at    = now();
  end if;

  -- Over the cap?
  if v_basis = 'annual_total' then
    v_over := v_cap is not null and v_gross >= v_cap;
    update public.seller_revenue_tracking
      set is_over_cap = v_over, updated_at = now()
      where seller_id = v_order.seller_id and state = v_order.seller_state and period_year = v_year;
  else
    update public.seller_revenue_buckets
      set is_over_cap = (cap_amount is not null and gross_revenue >= cap_amount), updated_at = now()
      where seller_id = v_order.seller_id and period_year = v_year and basis = v_basis;

    select exists (
      select 1 from public.seller_revenue_buckets
      where seller_id = v_order.seller_id and period_year = v_year and basis = v_basis and is_over_cap
    ) into v_over;

    v_was_over := coalesce(v_was_over, false);
    update public.seller_revenue_tracking
      set is_over_cap = v_over, updated_at = now()
      where seller_id = v_order.seller_id and state = v_order.seller_state and period_year = v_year;
  end if;

  if v_over and not coalesce(v_was_over, false) then
    update public.seller_profiles
      set is_paused = true, pause_reason = 'revenue_cap'
      where id = v_order.seller_id;
    v_paused := true;
  end if;

  -- Approach milestones for the cap. Only the HIGHEST newly-passed level is reported, so one big
  -- order that vaults from 40% to 95% produces a single notice rather than three.
  if v_cap is not null and v_cap > 0 and not v_over then
    select max(t.level) into v_cap_ms
      from (values (50), (75), (90)) as t(level)
     where v_gross >= v_cap * t.level / 100.0 and t.level > coalesce(v_cap_level, 0);
    if v_cap_ms is not null then
      update public.seller_revenue_tracking
        set cap_notice_level = v_cap_ms, updated_at = now()
        where seller_id = v_order.seller_id and state = v_order.seller_state and period_year = v_year;
    end if;
  end if;

  -- A licensing threshold is NOT a cap: record the crossing once, never pause.
  if v_threshold is not null and v_gross >= v_threshold and v_crossed is null then
    update public.seller_revenue_tracking
      set license_threshold_crossed_at = now()
      where seller_id = v_order.seller_id and state = v_order.seller_state and period_year = v_year;
    v_crossed_now := true;
  end if;

  -- ... and the same warning on the way up to it. Skipped once the threshold is behind them:
  -- there is nothing left to approach.
  if v_threshold is not null and v_threshold > 0 and v_crossed is null and not v_crossed_now then
    select max(t.level) into v_lic_ms
      from (values (50), (75), (90)) as t(level)
     where v_gross >= v_threshold * t.level / 100.0 and t.level > coalesce(v_lic_level, 0);
    if v_lic_ms is not null then
      update public.seller_revenue_tracking
        set license_notice_level = v_lic_ms, updated_at = now()
        where seller_id = v_order.seller_id and state = v_order.seller_state and period_year = v_year;
    end if;
  end if;

  update public.orders set revenue_recorded_at = now() where id = p_order_id;

  return query select v_gross, v_cap, v_over, v_paused,
                      v_threshold, v_crossed_now, v_cap_ms, v_lic_ms;
end;
$$;


comment on function public.record_order_revenue(uuid) is
  'Adds a completed order''s goods total to the seller''s yearly tally and applies the guardrail: '
  'crossing the cap pauses the storefront atomically. Also reports what the caller should tell the '
  'seller — the highest newly-passed approach milestone (50/75/90) for the cap and for the '
  'licensing threshold, and whether the threshold itself was crossed by this order. Each milestone '
  'is reported at most once per period.';

revoke all on function public.record_order_revenue(uuid) from public, anon, authenticated;
grant execute on function public.record_order_revenue(uuid) to service_role;
