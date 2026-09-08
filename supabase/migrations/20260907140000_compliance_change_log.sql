-- Harvest Local — when a rule moves, know who it lands on.
--
-- An admin can flip `cat_meat` to `banned` on `/admin/programs/[id]` and every live listing in that
-- category stays published. `products_guard_food_categories` only fires on an INSERT or UPDATE of a
-- product — nothing re-checks the catalogue when the RULE changes underneath it. The original
-- migrations knew this and each carried a one-off backfill; nothing does it for an admin edit.
--
-- That matters more after the verification pass than it did before, for two reasons. The data moves
-- a lot: five of the ten states read closely had changed within eighteen months, and `verified_at`
-- is still null on essentially every row, so most of them are going to be edited. And the pass
-- proved the edits go BOTH ways — Washington was seeded permitting an unlawful listing, Hawaii
-- seeded banning a lawful one — so a change can newly forbid something live, or newly permit
-- something parked.
--
-- =========================================================================
-- 1. THE LOG RECORDS ONLY WHAT MATTERS
-- =========================================================================
-- `notes`, `source_url`, `source_checked_at`, `verified_at` and `updated_at` change constantly and
-- affect nobody's listing. Logging them would bury the changes that do — an admin re-reading a
-- statute and stamping the row is the single most common write this table will ever see.
--
-- =========================================================================
-- 2. SEVERITY IS DERIVED, NOT TYPED IN
-- =========================================================================
--   `blocking`       an axis or online_orders moved TO banned — live listings are now unlawful
--   `unblocking`     one moved AWAY from banned — parked listings could come back, and the seller
--                    should be told, because nobody watches a draft
--   `label`          required_elements, a disclaimer, predisclosure — labels and listings are stale
--   `informational`  caps, thresholds, licence and training flags: real, but nothing to unpublish
--
-- The distinction between `blocking` and `unblocking` is the one the pass earned. Hawaii's ban had
-- nothing behind it and was removed; the sellers it had been blocking had no way to know.
--
-- =========================================================================
-- 3. THE TRIGGER ONLY WRITES. ENFORCEMENT IS SOMEBODY ELSE'S JOB.
-- =========================================================================
-- Unpublishing inside the trigger would make one admin's form submission synchronously rewrite
-- other people's catalogues, inside their transaction, with no notification path — and a mistake
-- would be very hard to undo. The trigger records; `compliance-change-sweep` acts and notifies, and
-- `processed_at` is what stops it acting twice.

set search_path = public;

create table if not exists public.compliance_change_log (
  id            uuid primary key default gen_random_uuid(),
  table_name    text not null check (table_name in ('state_food_programs', 'state_label_rules')),
  program_id    uuid not null references public.state_food_programs(id) on delete cascade,
  state_code    char(2) not null,
  program_name  text not null,

  severity      text not null
                  check (severity in ('blocking', 'unblocking', 'label', 'informational')),
  /** [{ "column": "cat_meat", "old": "conditional", "new": "banned" }, ...] */
  changes       jsonb not null,

  changed_by    uuid references public.profiles(id) on delete set null,
  changed_at    timestamptz not null default now(),
  /** When the sweep acted on it. Null means it has not been handled yet. */
  processed_at  timestamptz,
  /** What the sweep did, for the admin who wants to know what their edit cost. */
  outcome       jsonb
);

comment on table public.compliance_change_log is
  'Material changes to compliance reference data, with the affected listings worked out afterwards '
  'by compliance-change-sweep. The trigger only records: unpublishing inside an admin form '
  'submission would rewrite other people''s catalogues inside their transaction with no '
  'notification path.';

create index if not exists compliance_change_log_unprocessed_idx
  on public.compliance_change_log (changed_at)
  where processed_at is null;
create index if not exists compliance_change_log_program_idx
  on public.compliance_change_log (program_id, changed_at desc);

alter table public.compliance_change_log enable row level security;

-- Admins only. A seller learns about a change through a notification naming their own listing, not
-- by reading a feed of every state's edits.
create policy "change log: admin reads" on public.compliance_change_log
  for select using (public.is_admin());

-- ---------------------------------------------------------------------------
-- The trigger.
-- ---------------------------------------------------------------------------
create or replace function public.log_compliance_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cols text[];
  v_col text;
  v_old jsonb := to_jsonb(old);
  v_new jsonb := to_jsonb(new);
  v_changes jsonb := '[]'::jsonb;
  v_severity text := 'informational';
  v_axis_cols text[] := array[
    'cat_shelf_stable', 'cat_refrigerated', 'cat_meat', 'cat_acidified',
    'cat_low_acid_canned', 'cat_fermented'
  ];
  v_label_cols text[] := array[
    'required_elements', 'optional_elements', 'element_alternatives', 'disclaimer_text',
    'disclaimer_min_pt', 'disclaimer_all_caps', 'metric_required', 'placard_required',
    'placard_text', 'predisclosure_required', 'regulator_website_url', 'seller_statement_prompt'
  ];
  v_program public.state_food_programs;
  v_program_id uuid;
  v_ov text;
  v_nv text;
begin
  if tg_table_name = 'state_food_programs' then
    v_cols := array[
      'name', 'online_orders', 'mail_delivery', 'direct_delivery', 'retail_allowed',
      'revenue_cap', 'cap_basis', 'cap_category', 'license_threshold',
      'license_required', 'inspection_required', 'recipe_approval', 'training_required',
      'local_preemption'
    ] || v_axis_cols;
    v_program_id := new.id;
  else
    v_cols := v_label_cols;
    v_program_id := new.program_id;
  end if;

  foreach v_col in array v_cols loop
    -- `is distinct from` so a null on either side counts as a change.
    if (v_old -> v_col) is distinct from (v_new -> v_col) then
      v_changes := v_changes || jsonb_build_object(
        'column', v_col,
        'old', v_old -> v_col,
        'new', v_new -> v_col
      );

      v_ov := v_old ->> v_col;
      v_nv := v_new ->> v_col;

      if v_col = any(v_axis_cols) or v_col = 'online_orders' then
        if v_nv = 'banned' then
          v_severity := 'blocking';
        elsif v_ov = 'banned' and v_severity <> 'blocking' then
          v_severity := 'unblocking';
        end if;
      elsif v_col = any(v_label_cols) and v_severity = 'informational' then
        v_severity := 'label';
      end if;
    end if;
  end loop;

  if jsonb_array_length(v_changes) = 0 then
    return new;
  end if;

  select * into v_program from public.state_food_programs where id = v_program_id;

  insert into public.compliance_change_log
    (table_name, program_id, state_code, program_name, severity, changes, changed_by)
  values
    (tg_table_name, v_program_id, v_program.state_code, v_program.name, v_severity, v_changes,
     auth.uid());

  return new;
end;
$$;

drop trigger if exists state_food_programs_log_change on public.state_food_programs;
create trigger state_food_programs_log_change
  after update on public.state_food_programs
  for each row execute function public.log_compliance_change();

drop trigger if exists state_label_rules_log_change on public.state_label_rules;
create trigger state_label_rules_log_change
  after update on public.state_label_rules
  for each row execute function public.log_compliance_change();

-- ---------------------------------------------------------------------------
-- Who a change lands on: the live listings that would now fail the guards.
-- ---------------------------------------------------------------------------
create or replace function public.compliance_change_impact(p_program_id uuid)
returns table (
  seller_id     uuid,
  profile_id    uuid,
  business_name text,
  product_id    uuid,
  product_title text,
  reason        text
)
language sql
stable
security definer
set search_path = public
as $$
  with affected_sellers as (
    -- Sellers on this programme, plus — where the programme is the state's first — the sellers who
    -- have not chosen one and therefore fall back to it.
    select sp.id, sp.profile_id, sp.business_name, sp.home_state
    from public.seller_profiles sp
    join public.state_food_programs fp on fp.id = p_program_id
    where sp.home_state = fp.state_code
      and (
        sp.food_program_id = p_program_id
        or (
          sp.food_program_id is null
          and fp.id = (
            select fp2.id from public.state_food_programs fp2
            where fp2.state_code = fp.state_code order by fp2.ordinal limit 1
          )
        )
      )
  )
  select
    s.id, s.profile_id, s.business_name, p.id, p.title,
    case
      when not public.seller_allows_online_food_sales(s.id)
        then 'the state no longer permits online food sales'
      else 'the state no longer permits this kind of food'
    end
  from affected_sellers s
  join public.products p on p.seller_id = s.id
  join public.categories c on c.id = p.category_id
  where p.status in ('active', 'sold_out')
    and c.requires_food_permit
    and (
      not public.seller_allows_online_food_sales(s.id)
      or exists (
        select 1 from unnest(coalesce(c.food_axes, '{}'::text[])) as axis
        where not public.seller_permits_food_axis(s.id, axis)
      )
    );
$$;

comment on function public.compliance_change_impact(uuid) is
  'The live food listings on a programme that would now fail the publish guards — what an admin '
  'edit actually costs. Includes sellers who have chosen no programme where this is the state''s '
  'first, because that is the row they fall back to.';

revoke all on function public.compliance_change_impact(uuid) from public, anon;
grant execute on function public.compliance_change_impact(uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- The preview: what each axis would cost BEFORE anyone touches it.
-- ---------------------------------------------------------------------------
create or replace function public.program_listing_exposure(p_program_id uuid)
returns table (
  axis          text,
  sellers       int,
  listings      int
)
language sql
stable
security definer
set search_path = public
as $$
  with affected_sellers as (
    select sp.id
    from public.seller_profiles sp
    join public.state_food_programs fp on fp.id = p_program_id
    where sp.home_state = fp.state_code
      and (
        sp.food_program_id = p_program_id
        or (
          sp.food_program_id is null
          and fp.id = (
            select fp2.id from public.state_food_programs fp2
            where fp2.state_code = fp.state_code order by fp2.ordinal limit 1
          )
        )
      )
  ),
  live as (
    select s.id as seller_id, p.id as product_id, coalesce(c.food_axes, '{}'::text[]) as axes
    from affected_sellers s
    join public.products p on p.seller_id = s.id
    join public.categories c on c.id = p.category_id
    where p.status in ('active', 'sold_out')
      and c.requires_food_permit
  )
  -- One row per axis: what banning that axis would take down.
  select a.axis,
         count(distinct l.seller_id)::int,
         count(distinct l.product_id)::int
  from unnest(array[
    'shelf_stable', 'refrigerated', 'meat', 'acidified', 'low_acid_canned', 'fermented'
  ]) as a(axis)
  left join live l on a.axis = any(l.axes)
  group by a.axis
  union all
  -- And what banning online food sales outright would take down: all of it.
  select 'online_orders',
         count(distinct l.seller_id)::int,
         count(distinct l.product_id)::int
  from live l;
$$;

comment on function public.program_listing_exposure(uuid) is
  'For each regulatory axis, how many live listings and sellers on this programme would be '
  'unpublished if it were banned — the blast radius, shown to an admin BEFORE they change a flag. '
  'A pure read: it simulates nothing and changes nothing.';

revoke all on function public.program_listing_exposure(uuid) from public, anon;
grant execute on function public.program_listing_exposure(uuid) to authenticated, service_role;
