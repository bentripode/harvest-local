-- Harvest Local — Phase 4: in-app messaging (ARCHITECTURE §2.6, Supabase Realtime).
--
-- One thread per (buyer, seller, order) — order_id NULL is a general inquiry. RLS scopes both the
-- reads AND the Realtime subscription so a user only ever sees their own conversations. Clients
-- never write conversations directly (RPC) and never update messages (RPC for read receipts).

set search_path = public;

-- ---------------------------------------------------------------------------
create table public.conversations (
  id              uuid primary key default gen_random_uuid(),
  buyer_id        uuid not null references public.profiles(id) on delete cascade,
  seller_id       uuid not null references public.seller_profiles(id) on delete cascade,
  order_id        uuid references public.orders(id) on delete set null,
  last_message_at timestamptz,
  created_at      timestamptz not null default now(),
  constraint conversations_participants_key unique nulls not distinct (buyer_id, seller_id, order_id)
);
create index conversations_buyer_ix  on public.conversations (buyer_id, last_message_at desc nulls last);
create index conversations_seller_ix on public.conversations (seller_id, last_message_at desc nulls last);

create table public.messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id       uuid not null references public.profiles(id) on delete cascade,
  body            text not null check (char_length(body) between 1 and 4000),
  read_at         timestamptz,
  created_at      timestamptz not null default now()
);
create index messages_convo_ix on public.messages (conversation_id, created_at);

-- ---------------------------------------------------------------------------
-- "Is auth.uid() a participant in this conversation?" — reused by every policy.
-- ---------------------------------------------------------------------------
create or replace function public.is_conversation_participant(p_conversation_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.conversations c
    where c.id = p_conversation_id
      and (
        c.buyer_id = (select auth.uid())
        or c.seller_id in (
          select sp.id from public.seller_profiles sp where sp.profile_id = (select auth.uid())
        )
      )
  );
$$;

-- ---------------------------------------------------------------------------
alter table public.conversations enable row level security;
alter table public.messages enable row level security;

create policy "conversations: participant reads"
  on public.conversations for select
  using (
    buyer_id = (select auth.uid())
    or seller_id in (
      select sp.id from public.seller_profiles sp where sp.profile_id = (select auth.uid())
    )
  );
-- inserts/updates: RPC only.

create policy "messages: participant reads"
  on public.messages for select
  using (public.is_conversation_participant(conversation_id));

create policy "messages: participant sends"
  on public.messages for insert
  with check (
    sender_id = (select auth.uid())
    and public.is_conversation_participant(conversation_id)
  );
-- updates (read receipts): RPC only.

-- ---------------------------------------------------------------------------
-- last_message_at bump — clients can't update conversations, so SECURITY DEFINER.
-- ---------------------------------------------------------------------------
create or replace function public.messages_touch_conversation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.conversations set last_message_at = new.created_at where id = new.conversation_id;
  return null;
end;
$$;
create trigger messages_touch_conversation
  after insert on public.messages
  for each row execute function public.messages_touch_conversation();

-- ---------------------------------------------------------------------------
-- get_or_create_conversation — the only way to open a thread.
-- ---------------------------------------------------------------------------
create or replace function public.get_or_create_conversation(
  p_seller_id uuid,
  p_order_id  uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid    uuid := (select auth.uid());
  v_buyer  uuid;
  v_seller uuid;
  v_id     uuid;
begin
  if v_uid is null then raise exception 'not authenticated'; end if;

  if p_order_id is not null then
    select buyer_id, seller_id into v_buyer, v_seller from public.orders where id = p_order_id;
    if v_buyer is null then raise exception 'order not found'; end if;
    if v_uid <> v_buyer
       and not exists (select 1 from public.seller_profiles sp where sp.id = v_seller and sp.profile_id = v_uid) then
      raise exception 'not a participant of this order';
    end if;
  else
    v_seller := p_seller_id;
    -- The seller can't open a general thread with themselves; the caller is the buyer.
    if exists (select 1 from public.seller_profiles sp where sp.id = v_seller and sp.profile_id = v_uid) then
      raise exception 'sellers cannot start a general conversation';
    end if;
    v_buyer := v_uid;
  end if;

  select id into v_id from public.conversations
    where buyer_id = v_buyer and seller_id = v_seller and order_id is not distinct from p_order_id;
  if found then return v_id; end if;

  begin
    insert into public.conversations (buyer_id, seller_id, order_id)
    values (v_buyer, v_seller, p_order_id)
    returning id into v_id;
  exception when unique_violation then
    select id into v_id from public.conversations
      where buyer_id = v_buyer and seller_id = v_seller and order_id is not distinct from p_order_id;
  end;

  return v_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- mark_conversation_read — clears the OTHER party's unread messages.
-- ---------------------------------------------------------------------------
create or replace function public.mark_conversation_read(p_conversation_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_conversation_participant(p_conversation_id) then
    raise exception 'not a participant';
  end if;
  update public.messages
    set read_at = now()
    where conversation_id = p_conversation_id
      and sender_id <> (select auth.uid())
      and read_at is null;
end;
$$;

do $$
begin
  execute 'revoke all on function public.is_conversation_participant(uuid) from public, anon';
  execute 'revoke all on function public.get_or_create_conversation(uuid, uuid) from public, anon';
  execute 'revoke all on function public.mark_conversation_read(uuid) from public, anon';
  execute 'grant execute on function public.get_or_create_conversation(uuid, uuid) to authenticated';
  execute 'grant execute on function public.mark_conversation_read(uuid) to authenticated';
end $$;

-- ---------------------------------------------------------------------------
-- Realtime — RLS still gates what each subscriber receives.
-- ---------------------------------------------------------------------------
alter publication supabase_realtime add table public.messages;
