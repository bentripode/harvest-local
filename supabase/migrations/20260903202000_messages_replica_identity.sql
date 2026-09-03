-- Supabase Realtime evaluates RLS + filters against the full row for postgres_changes; with the
-- default replica identity (primary key only) a filtered, RLS-scoped subscription on `messages`
-- receives nothing. FULL replica identity fixes it.

alter table public.messages replica identity full;
