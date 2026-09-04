-- Harvest Local — allow multiple (partial) refunds per order.
--
-- `refunds.order_id` was UNIQUE (one refund per order). Drop it: an admin can now refund an order in
-- several parts, up to the order total. The natural key becomes `stripe_refund_id` (one mirror row
-- per Stripe Refund object) — that's what makes the `charge.refunded` webhook idempotent.

alter table public.refunds drop constraint if exists refunds_order_id_key;

create unique index refunds_stripe_refund_id_ux on public.refunds (stripe_refund_id);
create index refunds_order_ix on public.refunds (order_id);

-- The `refund_issued` notification dedupe moves from per-order to per-refund: each Stripe refund
-- notifies the parties once (payload now carries `refund_id`).
drop index if exists public.notifications_refund_issued_ux;
create unique index notifications_refund_issued_ux
  on public.notifications (channel, user_id, (payload ->> 'refund_id'))
  where template = 'refund_issued';
