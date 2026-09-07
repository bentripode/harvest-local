-- Harvest Local — the recurring duties that are not documents.
--
-- `license-expiry-scan` knows about anything with an `expiration_date` on a `seller_licenses` row.
-- It does not know about the obligations the verification pass kept turning up that have no
-- document behind them at all:
--
--   * VERMONT, 18 V.S.A. 4358(c) and Manufactured Food Rule 6.1: a licence-exempt food
--     manufacturing establishment must file a licensing exemption ANNUALLY, "on or before a date
--     established by the Department" — the Department's own guidance says before 15 January — and
--     the filing must attest to completed training.
--   * VERMONT again, Manufactured Food Rule 6.2.2.1: training approved by the Department "Both
--     before beginning manufacturing and annually thereafter".
--   * WASHINGTON, RCW 69.22.030(1): "All cottage food operations must be permitted EVERY TWO YEARS".
--   * UTAH, 26B-7-416(12)(b): a microenterprise home kitchen permit "is renewable on an annual
--     basis".
--
-- Miss one and the consequence is not a warning — it is operating without the exemption or the
-- permit you were relying on. A seller has no way to know any of this from the app today.
--
-- =========================================================================
-- ONLY WHAT WAS ACTUALLY READ
-- =========================================================================
-- Four programmes are seeded, from the four texts above, because those are the ones this session
-- read. Every other programme gets nothing rather than a guess: an invented deadline is worse than
-- no deadline, because a seller who trusts it stops looking. `/admin/programs` is where more get
-- added as rows are verified, and `state_food_programs.verified_at` is still null on essentially
-- all of them.
--
-- =========================================================================
-- TWO SHAPES OF SCHEDULE, BECAUSE STATES USE BOTH
-- =========================================================================
-- `fixed_date` is a calendar deadline that comes round every year regardless of when you started —
-- Vermont's 15 January filing. `interval` is a clock that starts when you last did the thing:
-- Washington's two-year permit and Vermont's annual training, which the rule ties to "before
-- beginning manufacturing and annually thereafter" rather than to a date.
--
-- An interval obligation with no completion recorded is due from the seller's storefront start
-- date, which is the closest thing we have to "when they began".

set search_path = public;

create table if not exists public.program_obligations (
  id            uuid primary key default gen_random_uuid(),
  program_id    uuid not null references public.state_food_programs(id) on delete cascade,

  kind          text not null
                  check (kind in ('annual_filing', 'training', 'permit_renewal', 'other')),
  label         text not null,
  /** What it is and what happens if it lapses, in the seller's words. */
  detail        text not null,
  /** The words it rests on, so a seller can check us. */
  citation      text,
  source_url    text,

  schedule      text not null check (schedule in ('fixed_date', 'interval')),
  /** For `fixed_date`: the calendar deadline, every year. */
  due_month     int check (due_month between 1 and 12),
  due_day       int check (due_day between 1 and 31),
  /** For `interval`: months from the last completion, or from the storefront start. */
  interval_months int check (interval_months > 0),

  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  constraint program_obligations_schedule_shape check (
    (schedule = 'fixed_date' and due_month is not null and due_day is not null
       and interval_months is null)
    or
    (schedule = 'interval' and interval_months is not null
       and due_month is null and due_day is null)
  )
);

comment on table public.program_obligations is
  'Recurring duties a programme puts on a seller that are NOT documents with an expiry date — '
  'annual exemption filings, renewal training, permit renewals. license-expiry-scan covers the '
  'document case; this covers everything else. Seeded only for programmes whose text has actually '
  'been read, because an invented deadline is worse than no deadline.';

create index if not exists program_obligations_program_idx
  on public.program_obligations (program_id);

alter table public.program_obligations enable row level security;

-- Reference data, like the programmes themselves: anyone may read, only an admin may write.
create policy "obligations: public read" on public.program_obligations
  for select using (true);
create policy "obligations: admin write" on public.program_obligations
  for all using (public.is_admin()) with check (public.is_admin());

create trigger program_obligations_set_updated_at before update on public.program_obligations
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- What a seller has done about them.
-- ---------------------------------------------------------------------------
create table if not exists public.seller_obligation_completions (
  id            uuid primary key default gen_random_uuid(),
  seller_id     uuid not null references public.seller_profiles(id) on delete cascade,
  obligation_id uuid not null references public.program_obligations(id) on delete cascade,
  /**
   * Which occurrence this was: the due year for a fixed date ('2027'), or the ISO date the interval
   * clock restarted from. Text because the two shapes are not the same kind of key.
   */
  period_key    text not null,
  completed_at  timestamptz not null default now(),
  note          text,

  unique (seller_id, obligation_id, period_key)
);

comment on table public.seller_obligation_completions is
  'A seller marking a recurring obligation done for one occurrence. Self-reported and not verified '
  'by anyone here — the state is who checks, and asking an admin to adjudicate a Vermont training '
  'attestation would be us pretending to an authority we do not have.';

alter table public.seller_obligation_completions enable row level security;

create policy "obligation completions: owner all" on public.seller_obligation_completions
  for all using (
    seller_id in (select id from public.seller_profiles where profile_id = auth.uid())
    or public.is_admin()
  ) with check (
    seller_id in (select id from public.seller_profiles where profile_id = auth.uid())
  );

-- ---------------------------------------------------------------------------
-- What we have already said about them, so a reminder is sent once.
-- ---------------------------------------------------------------------------
create table if not exists public.seller_obligation_notices (
  seller_id     uuid not null references public.seller_profiles(id) on delete cascade,
  obligation_id uuid not null references public.program_obligations(id) on delete cascade,
  period_key    text not null,
  /** 30, 10 or 1 — the reminder that was sent. */
  days_out      int not null check (days_out in (30, 10, 1)),
  sent_at       timestamptz not null default now(),

  primary key (seller_id, obligation_id, period_key, days_out)
);

comment on table public.seller_obligation_notices is
  'One row per reminder actually sent, so the daily scan is idempotent and a seller is not told the '
  'same thing every morning for a month.';

alter table public.seller_obligation_notices enable row level security;

create policy "obligation notices: owner reads" on public.seller_obligation_notices
  for select using (
    seller_id in (select id from public.seller_profiles where profile_id = auth.uid())
    or public.is_admin()
  );
-- Written by the scan under the service role only; no client writes it.

-- ---------------------------------------------------------------------------
-- The four obligations this session actually read.
-- ---------------------------------------------------------------------------

-- Vermont's two licence-exempt routes: the annual filing, and the training it attests to.
insert into public.program_obligations
  (program_id, kind, label, detail, citation, source_url, schedule, due_month, due_day)
select fp.id, 'annual_filing',
  'Licensing exemption filing',
  'Vermont wants a filing from you every year to keep your licence exemption. It has to say you '
  'completed the Department''s training. Miss it and you are operating without the exemption you '
  'are relying on — nothing here can restore it for you.',
  '18 V.S.A. 4358(c): "Annually, a food manufacturing establishment claiming a licensing exemption '
  'pursuant to this title shall submit to the Department a licensing exemption filing as required '
  'by rule. The licensing exemption filing shall require the food manufacturing establishment to '
  'attest to the completion of any training required by rule pursuant to section 4303 of this '
  'title." The Department''s guidance gives the date as before 15 January.',
  'https://www.healthvermont.gov/sites/default/files/document/reg-manufactured-food.pdf',
  'fixed_date', 1, 15
from public.state_food_programs fp
where fp.state_code = 'VT' and fp.ordinal in (2, 4)
  and not exists (
    select 1 from public.program_obligations o
    where o.program_id = fp.id and o.kind = 'annual_filing'
  );

insert into public.program_obligations
  (program_id, kind, label, detail, citation, source_url, schedule, interval_months)
select fp.id, 'training',
  'Department-approved food safety training',
  'Vermont requires this before you start selling and every year after. The annual exemption '
  'filing asks you to confirm you have done it.',
  'Manufactured Food Rule 6.2.2.1: "Both before beginning manufacturing and annually thereafter, a '
  'license exempt food manufacturing establishment shall complete training approved by the '
  'Department in food handling, cleanliness, sanitation, and healthfulness and attest to the '
  'completion of the training as required by Section 6.1 of this Rule."',
  'https://www.healthvermont.gov/sites/default/files/document/reg-manufactured-food.pdf',
  'interval', 12
from public.state_food_programs fp
where fp.state_code = 'VT' and fp.ordinal in (2, 4)
  and not exists (
    select 1 from public.program_obligations o
    where o.program_id = fp.id and o.kind = 'training'
  );

-- Washington: the permit itself, every two years.
insert into public.program_obligations
  (program_id, kind, label, detail, citation, source_url, schedule, interval_months)
select fp.id, 'permit_renewal',
  'Cottage food permit renewal',
  'Washington permits cottage food operations for two years at a time. Renewing means the fees '
  'again and another basic hygiene inspection, so start before it lapses.',
  'RCW 69.22.030(1): "All cottage food operations must be permitted every two years by the '
  'department on forms developed by the department. All permits and permit renewals must be made on '
  'forms developed by the director and be accompanied by an inspection fee as provided in RCW '
  '69.22.040, a $75 public health review fee, and a $30 processing fee."',
  'https://app.leg.wa.gov/RCW/default.aspx?cite=69.22&full=true',
  'interval', 24
from public.state_food_programs fp
where fp.state_code = 'WA' and fp.ordinal = 1
  and not exists (
    select 1 from public.program_obligations o
    where o.program_id = fp.id and o.kind = 'permit_renewal'
  );

-- Utah's microenterprise route: an annual permit from the LOCAL health department.
insert into public.program_obligations
  (program_id, kind, label, detail, citation, source_url, schedule, interval_months)
select fp.id, 'permit_renewal',
  'Microenterprise home kitchen permit renewal',
  'Your permit comes from your local health department, not the state, and it lasts a year. It is '
  'tied to the location and the hours on it, so renew with them rather than with Utah.',
  'Utah Code 26B-7-416(12): a microenterprise home kitchen permit "(a) is nontransferable; '
  '(b) is renewable on an annual basis; (c) is restricted to the location and hours listed on the '
  'permit".',
  'https://le.utah.gov/xcode/Title26B/Chapter7/26B-7-S416.html',
  'interval', 12
from public.state_food_programs fp
where fp.state_code = 'UT' and fp.ordinal = 3
  and not exists (
    select 1 from public.program_obligations o
    where o.program_id = fp.id and o.kind = 'permit_renewal'
  );
