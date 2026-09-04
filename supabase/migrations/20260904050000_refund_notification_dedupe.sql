-- Harvest Local — dedupe `refund_issued` notifications; support partial refunds.
--
-- The `charge.refunded` webhook now queues `refund_issued` for both full AND partial refunds, and
-- it may re-deliver. One notification per party per order is enough, so a partial unique index +
-- `queueNotification(..., { tolerateDuplicate: true })` collapse the repeats (same pattern as the
-- license-milestone and new-message dedupes).
--
-- `refunds.order_id` stays UNIQUE: one refund record per order, whose `amount` is now allowed to be
-- less than the order total. (Multiple partial refunds on one order are still not supported.)

create unique index notifications_refund_issued_ux
  on public.notifications (channel, user_id, (payload ->> 'order_id'))
  where template = 'refund_issued';
