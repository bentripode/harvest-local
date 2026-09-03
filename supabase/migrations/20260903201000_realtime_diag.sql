-- Temporary diagnostic used while wiring up Realtime; dropped by 20260903203000.
create or replace function public._realtime_diag()
returns jsonb language sql security definer set search_path = public as $$
  select jsonb_build_object(
    'pub_has_messages', exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and tablename='messages'),
    'pub_tables', (select coalesce(jsonb_agg(tablename), '[]'::jsonb) from pg_publication_tables where pubname='supabase_realtime'),
    'messages_replident', (select relreplident::text from pg_class where oid = 'public.messages'::regclass)
  );
$$;
