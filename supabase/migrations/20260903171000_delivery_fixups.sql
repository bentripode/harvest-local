-- Harvest Local — make upsert_address.p_id optional (null = insert a new address). Same function
-- signature; only a parameter default changes, so generated types treat p_id as optional.

set search_path = public, extensions;

create or replace function public.upsert_address(
  p_id     uuid default null,
  p_label  text default null,
  p_line1  text default null,
  p_line2  text default null,
  p_city   text default null,
  p_state  text default null,
  p_postal text default null,
  p_lng    double precision default null,
  p_lat    double precision default null
)
returns uuid
language plpgsql
security invoker
set search_path = public, extensions
as $$
declare
  v_id  uuid;
  v_loc extensions.geography;
begin
  v_loc := ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography;

  if p_id is null then
    insert into public.addresses (user_id, label, line1, line2, city, state, postal_code, location)
    values ((select auth.uid()), p_label, p_line1, nullif(p_line2, ''), p_city, p_state, p_postal, v_loc)
    returning id into v_id;
  else
    update public.addresses set
      label = p_label, line1 = p_line1, line2 = nullif(p_line2, ''), city = p_city,
      state = p_state, postal_code = p_postal, location = v_loc, updated_at = now()
    where id = p_id and user_id = (select auth.uid())
    returning id into v_id;
    if v_id is null then
      raise exception 'address not found';
    end if;
  end if;

  return v_id;
end;
$$;
