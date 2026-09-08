-- Harvest Local — a tripwire for the law moving, as opposed to our data moving.
--
-- `compliance_change_log` catches an admin editing a row. It cannot catch the thing that actually
-- went wrong repeatedly during the verification pass: the STATUTE changing while our row sat still.
--
-- Five of the ten states read closely had changed within eighteen months — TN 2025, TX 2025, UT
-- effective 5/6/2026, VT's whole rule replaced 15 Jan 2026, VA 2026 c. 605. Vermont is the one that
-- nearly got through: three rows cited "VT Admin. Code 12-5-52 §§ 6.1.1 and 6.2.1", the rule was
-- replaced by the Manufactured Food Rule, and **the new rule also has a 6.1.1 and a 6.2.1**. The
-- citation still resolved. The labelling list at 6.2.1 survived almost unchanged. Only 6.1.1's
-- content had been swapped underneath it, from a home-bakery weekly exemption to a cottage-food
-- annual one.
--
-- No parser catches that. What can be caught is that the DOCUMENT moved, and then a human looks.
--
-- =========================================================================
-- TWO SIGNALS, AND THEY ARE NOT EQUALLY GOOD
-- =========================================================================
-- `source_version` is the strong one and it is entered by a person: the statute's own amendment
-- line, which these publishers print at the foot of every section —
--
--     "Amended by Chapter 433, 2026 General Session"                      (Utah)
--     "Amended 2017, No. 76, § 5; 2025, No. 42, § 5, eff. July 1, 2025"   (Vermont)
--     "1993, c. 936 ... 2024, c. 131; 2026, c. 605."                      (Virginia)
--     "[ 2023 c 352 s 2 ; 2011 c 281 s 3 .]"                              (Washington)
--
-- A re-read that finds a different session year is unambiguous. It is the single most useful field
-- on this migration and it costs an admin one copy-paste.
--
-- The HTTP validators are the weak one and they are collected by a machine: `ETag` and
-- `Last-Modified` where the host sends them, a body hash where it does not. A moved validator means
-- "look", not "the law changed" — a legislature site can re-render a page for a session banner. So
-- `source_signal` records WHICH signal moved, and an admin can weigh a strong ETag against a noisy
-- hash rather than being handed one undifferentiated alarm. A tripwire that cries wolf is worse
-- than none, for the same reason an invented deadline is worse than none: people stop looking.
--
-- =========================================================================
-- IT FLAGS. IT NEVER UNVERIFIES.
-- =========================================================================
-- `source_changed_at` moving past `source_checked_at` is what the admin surface reads. `verified_at`
-- is untouched — it is a human attestation, and nothing automatic gets to withdraw one. The whole
-- point is to send a person to look, not to decide for them.

set search_path = public;

alter table public.state_food_programs
  add column if not exists source_version text,
  add column if not exists source_etag text,
  add column if not exists source_last_modified text,
  add column if not exists source_content_hash text,
  add column if not exists source_signal text
    check (source_signal is null or source_signal in ('etag', 'last_modified', 'content_hash')),
  add column if not exists source_fetched_at timestamptz,
  add column if not exists source_changed_at timestamptz;

comment on column public.state_food_programs.source_version is
  'The statute or rule''s own amendment line, copied verbatim by the admin who read it — e.g. '
  '"Amended by Chapter 433, 2026 General Session". The strongest staleness signal there is: a '
  're-read that finds a different session year means the law moved, full stop.';
comment on column public.state_food_programs.source_signal is
  'Which HTTP signal the watcher is using for this URL: etag and last_modified come from the '
  'publisher and are trustworthy; content_hash is a fallback for hosts that send neither and is '
  'noisy, because a page can re-render without the law changing.';
comment on column public.state_food_programs.source_changed_at is
  'When the watcher last saw the document move. Compared against source_checked_at to decide '
  'whether a human needs to re-read it. Never clears verified_at — that is an attestation and '
  'nothing automatic withdraws one.';

alter table public.state_label_rules
  add column if not exists source_version text,
  add column if not exists source_etag text,
  add column if not exists source_last_modified text,
  add column if not exists source_content_hash text,
  add column if not exists source_signal text
    check (source_signal is null or source_signal in ('etag', 'last_modified', 'content_hash')),
  add column if not exists source_fetched_at timestamptz,
  add column if not exists source_changed_at timestamptz;

comment on column public.state_label_rules.source_version is
  'The rule''s own amendment line, copied verbatim. See the matching column on '
  'state_food_programs.';

-- The admin surfaces ask one question: what has moved since a person last read it.
create index if not exists state_food_programs_source_moved_idx
  on public.state_food_programs (source_changed_at)
  where source_changed_at is not null;
create index if not exists state_label_rules_source_moved_idx
  on public.state_label_rules (source_changed_at)
  where source_changed_at is not null;

-- ---------------------------------------------------------------------------
-- What the admin surfaces read.
-- ---------------------------------------------------------------------------
create or replace function public.stale_compliance_sources()
returns table (
  program_id      uuid,
  state_code      char(2),
  program_name    text,
  source_url      text,
  source_signal   text,
  source_changed_at timestamptz,
  source_checked_at date,
  in_label_rule   boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select fp.id, fp.state_code, fp.name, fp.source_url, fp.source_signal,
         fp.source_changed_at, fp.source_checked_at, false
  from public.state_food_programs fp
  where fp.source_changed_at is not null
    and (fp.source_checked_at is null or fp.source_changed_at::date > fp.source_checked_at)
  union all
  select fp.id, fp.state_code, fp.name, lr.source_url, lr.source_signal,
         lr.source_changed_at, lr.source_checked_at, true
  from public.state_label_rules lr
  join public.state_food_programs fp on fp.id = lr.program_id
  where lr.source_changed_at is not null
    and (lr.source_checked_at is null or lr.source_changed_at::date > lr.source_checked_at)
  order by 6 desc;
$$;

comment on function public.stale_compliance_sources() is
  'Rows whose source document has moved since a person last read it. The admin list and the weekly '
  'review scan both read this. It reports; it changes nothing and it never touches verified_at.';

revoke all on function public.stale_compliance_sources() from public, anon;
grant execute on function public.stale_compliance_sources() to authenticated, service_role;
