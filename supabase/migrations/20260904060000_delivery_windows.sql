-- Harvest Local — delivery time windows.
--
-- A delivery-enabled seller lists a few buyer-selectable time-window labels ("Saturdays 9am–12pm").
-- Free text — no date math or timezone handling. The buyer picks one at checkout and it's frozen on
-- the order (`orders.delivery_window`), shown on both order boards. Windows don't affect pricing.

alter table public.seller_profiles
  add column if not exists delivery_windows jsonb not null default '[]'::jsonb;

alter table public.seller_profiles
  add constraint seller_profiles_delivery_windows_shape
  check (
    jsonb_typeof(delivery_windows) = 'array'
    and jsonb_array_length(delivery_windows) <= 12
  );

alter table public.orders
  add column if not exists delivery_window text
  constraint orders_delivery_window_len check (delivery_window is null or length(delivery_window) <= 80);

comment on column public.seller_profiles.delivery_windows is
  'Buyer-selectable delivery time-window labels, e.g. ["Saturdays 9am-12pm"]. Free text; the seller edits them on /seller/settings.';
comment on column public.orders.delivery_window is
  'The window label the buyer chose at checkout (frozen). Null for pickup, or delivery from a seller with no windows configured.';
