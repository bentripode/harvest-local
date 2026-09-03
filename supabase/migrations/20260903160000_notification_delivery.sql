-- Harvest Local — Phase 3: notification delivery.
--
-- The `notifications` queue has only ever held `in_app` rows (rendered on /seller/compliance).
-- `notification-dispatch` (Inngest) now also sends `email` rows via Resend. Two columns support the
-- retry loop; a partial index is the dispatcher's work queue.

alter table public.notifications
  add column if not exists error         text,
  add column if not exists attempt_count int not null default 0;

comment on column public.notifications.error is
  'Last delivery failure detail (email/sms channels).';
comment on column public.notifications.attempt_count is
  'Delivery attempts by notification-dispatch; a row is abandoned (status = failed) past the cap.';

-- Dispatcher work queue: unsent rows on a real delivery channel, oldest first.
create index if not exists notifications_dispatch_ix
  on public.notifications (created_at)
  where status = 'queued' and channel <> 'in_app';

-- The license-reminder dedupe index now has to allow one row PER CHANNEL for a milestone
-- (the fan-out inserts in_app + email together).
drop index if exists public.notifications_license_milestone_ux;
create unique index notifications_license_milestone_ux
  on public.notifications (channel, (payload ->> 'license_id'), (payload ->> 'milestone'))
  where template = 'license_expiring';
