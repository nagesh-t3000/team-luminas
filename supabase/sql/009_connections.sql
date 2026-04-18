drop function if exists public.get_public_user_by_username(text);
drop function if exists public.list_connected_usernames(text);
drop function if exists public.get_connection_count(text);
drop function if exists public.toggle_user_connection(text, text);

create table if not exists public.user_connections (
  id uuid primary key default gen_random_uuid(),
  user_low_id uuid not null references public.users (id) on delete cascade,
  user_high_id uuid not null references public.users (id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  constraint user_connections_distinct_users_check
    check (user_low_id <> user_high_id),
  constraint user_connections_pair_unique
    unique (user_low_id, user_high_id)
);

create index if not exists user_connections_low_id_idx
  on public.user_connections (user_low_id);

create index if not exists user_connections_high_id_idx
  on public.user_connections (user_high_id);

create or replace function public.get_public_user_by_username(username_input text)
returns table (
  id uuid,
  username text,
  email text,
  full_name text,
  bio text,
  professional_role text,
  created_at timestamptz
)
language sql
security definer
set search_path = public
as $$
  select
    users.id,
    users.username,
    users.email,
    users.full_name,
    users.bio,
    users.professional_role,
    users.created_at
  from public.users
  where lower(users.username) = lower(trim(coalesce(username_input, '')))
  limit 1;
$$;

create or replace function public.list_connected_usernames(username_input text)
returns table (
  username text
)
language sql
security definer
set search_path = public
as $$
  with target_user as (
    select users.id
    from public.users
    where lower(users.username) = lower(trim(coalesce(username_input, '')))
    limit 1
  )
  select connected_user.username
  from target_user
  join public.user_connections
    on public.user_connections.user_low_id = target_user.id
    or public.user_connections.user_high_id = target_user.id
  join public.users as connected_user
    on connected_user.id = case
      when public.user_connections.user_low_id = target_user.id then public.user_connections.user_high_id
      else public.user_connections.user_low_id
    end
  order by lower(connected_user.username);
$$;

create or replace function public.get_connection_count(username_input text)
returns table (
  connection_count bigint
)
language sql
security definer
set search_path = public
as $$
  with target_user as (
    select users.id
    from public.users
    where lower(users.username) = lower(trim(coalesce(username_input, '')))
    limit 1
  )
  select count(*)::bigint as connection_count
  from target_user
  join public.user_connections
    on public.user_connections.user_low_id = target_user.id
    or public.user_connections.user_high_id = target_user.id;
$$;

create or replace function public.toggle_user_connection(
  source_username_input text,
  target_username_input text
)
returns table (
  is_connected boolean,
  connection_count bigint
)
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized_source_username text;
  normalized_target_username text;
  source_user_id uuid;
  target_user_id uuid;
  low_user_id uuid;
  high_user_id uuid;
  connection_exists boolean := false;
begin
  normalized_source_username := lower(trim(coalesce(source_username_input, '')));
  normalized_target_username := lower(trim(coalesce(target_username_input, '')));

  if normalized_source_username = '' then
    raise exception 'A source username is required.';
  end if;

  if normalized_target_username = '' then
    raise exception 'A target username is required.';
  end if;

  select users.id
  into source_user_id
  from public.users
  where lower(users.username) = normalized_source_username
  limit 1;

  if source_user_id is null then
    raise exception 'Source user not found.';
  end if;

  select users.id
  into target_user_id
  from public.users
  where lower(users.username) = normalized_target_username
  limit 1;

  if target_user_id is null then
    raise exception 'Target user not found.';
  end if;

  if source_user_id = target_user_id then
    raise exception 'You cannot connect with yourself.';
  end if;

  if source_user_id::text < target_user_id::text then
    low_user_id := source_user_id;
    high_user_id := target_user_id;
  else
    low_user_id := target_user_id;
    high_user_id := source_user_id;
  end if;

  select exists(
    select 1
    from public.user_connections
    where public.user_connections.user_low_id = low_user_id
      and public.user_connections.user_high_id = high_user_id
  )
  into connection_exists;

  if connection_exists then
    delete from public.user_connections
    where public.user_connections.user_low_id = low_user_id
      and public.user_connections.user_high_id = high_user_id;

    return query
    select
      false as is_connected,
      counts.connection_count
    from public.get_connection_count(source_username_input) as counts;
  end if;

  insert into public.user_connections (
    user_low_id,
    user_high_id
  )
  values (
    low_user_id,
    high_user_id
  )
  on conflict on constraint user_connections_pair_unique do nothing;

  return query
  select
    true as is_connected,
    counts.connection_count
  from public.get_connection_count(source_username_input) as counts;
end;
$$;

alter table public.user_connections enable row level security;

revoke all on public.user_connections from anon, authenticated;

grant execute on function public.get_public_user_by_username(text) to anon, authenticated;
grant execute on function public.list_connected_usernames(text) to anon, authenticated;
grant execute on function public.get_connection_count(text) to anon, authenticated;
grant execute on function public.toggle_user_connection(text, text) to anon, authenticated;

comment on table public.user_connections is
  'Undirected professional connections between two users.';
