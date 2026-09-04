-- Harvest Local — dedupe `new_message` notifications on the message id.
--
-- `message-notify` (Inngest) emails the recipient of a chat message. Inngest retries a function
-- that fails mid-run, so the queue insert has to be idempotent: one row per (channel, message).
-- `queueNotification(..., { tolerateDuplicate: true })` treats the unique-index collision as a
-- no-op — same pattern as the license-reminder milestone dedupe.

create unique index notifications_new_message_ux
  on public.notifications (channel, (payload ->> 'message_id'))
  where template = 'new_message';
