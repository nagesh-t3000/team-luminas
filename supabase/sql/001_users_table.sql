create extension if not exists pgcrypto;

drop trigger if exists on_auth_user_created on auth.users;
drop function if exists public.handle_new_auth_user();
drop function if exists public.list_public_users(integer);
drop function if exists public.login_or_create_user(text, text);
drop function if exists public.complete_user_profile(uuid, text, text, text);

create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  username text not null unique,
  email text not null unique,
  password_hash text not null,
  full_name text,
  bio text,
  professional_role text,
  created_at timestamptz not null default timezone('utc', now())
);

alter table public.users drop constraint if exists users_id_fkey;
alter table public.users alter column id set default gen_random_uuid();
alter table public.users add column if not exists password_hash text;
alter table public.users add column if not exists bio text;
alter table public.users add column if not exists professional_role text;
update public.users
set password_hash = extensions.crypt(
  gen_random_uuid()::text,
  extensions.gen_salt('bf')
)
where password_hash is null;
alter table public.users alter column password_hash set not null;

create unique index if not exists users_username_lower_idx
  on public.users (lower(username));

create unique index if not exists users_email_lower_idx
  on public.users (lower(email));

create or replace function public.list_public_users(limit_count integer default 6)
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
  order by users.created_at asc
  limit greatest(limit_count, 1);
$$;

create or replace function public.login_or_create_user(
  identifier_input text,
  password_input text
)
returns table (
  id uuid,
  username text,
  email text,
  full_name text,
  bio text,
  professional_role text,
  created_at timestamptz,
  was_created boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized_identifier text;
  candidate_username text;
  base_username text;
  candidate_email text;
  suffix integer := 1;
  matched_user public.users%rowtype;
  password_is_valid boolean := false;
begin
  normalized_identifier := lower(trim(coalesce(identifier_input, '')));

  if normalized_identifier = '' then
    raise exception 'Username or email is required.';
  end if;

  if length(trim(coalesce(password_input, ''))) < 6 then
    raise exception 'Password must be at least 6 characters.';
  end if;

  select *
  into matched_user
  from public.users
  where lower(users.email) = normalized_identifier
     or lower(users.username) = normalized_identifier
  limit 1;

  if found then
    if matched_user.password_hash ~ '^\$2[aby]\$' then
      password_is_valid := matched_user.password_hash = extensions.crypt(password_input, matched_user.password_hash);
    elsif matched_user.password_hash = password_input then
      password_is_valid := true;

      update public.users
      set password_hash = extensions.crypt(password_input, extensions.gen_salt('bf'))
      where id = matched_user.id
      returning * into matched_user;
    end if;

    if password_is_valid then
      return query
      select
        matched_user.id,
        matched_user.username,
        matched_user.email,
        matched_user.full_name,
        matched_user.bio,
        matched_user.professional_role,
        matched_user.created_at,
        false;
    end if;

    raise exception 'That account already exists, but the password is incorrect.';
  end if;

  if position('@' in normalized_identifier) > 0 then
    candidate_email := normalized_identifier;
    base_username := split_part(normalized_identifier, '@', 1);
  else
    base_username := normalized_identifier;
    candidate_email := normalized_identifier || '@luminas-user.app';
  end if;

  base_username := lower(
    regexp_replace(base_username, '[^a-zA-Z0-9._-]', '', 'g')
  );
  base_username := trim(both '._-' from base_username);

  if base_username = '' then
    base_username := 'luminasuser';
  end if;

  candidate_username := left(base_username, 24);

  while exists (
    select 1
    from public.users
    where lower(users.username) = lower(candidate_username)
       or lower(users.email) = lower(candidate_email)
  ) loop
    suffix := suffix + 1;
    candidate_username := left(base_username, greatest(24 - length(suffix::text), 1)) || suffix::text;

    if position('@' in normalized_identifier) = 0 then
      candidate_email := candidate_username || '@luminas-user.app';
    end if;
  end loop;

  insert into public.users (
    username,
    email,
    password_hash,
    full_name,
    bio,
    professional_role
  )
  values (
    candidate_username,
    candidate_email,
    extensions.crypt(password_input, extensions.gen_salt('bf')),
    null,
    null,
    null
  )
  returning * into matched_user;

  return query
  select
    matched_user.id,
    matched_user.username,
    matched_user.email,
    matched_user.full_name,
    matched_user.bio,
    matched_user.professional_role,
    matched_user.created_at,
    true;
end;
$$;

create or replace function public.complete_user_profile(
  user_id_input uuid,
  full_name_input text,
  bio_input text,
  professional_role_input text
)
returns table (
  id uuid,
  username text,
  email text,
  full_name text,
  bio text,
  professional_role text,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized_full_name text;
  normalized_bio text;
  normalized_professional_role text;
  updated_user public.users%rowtype;
begin
  normalized_full_name := trim(coalesce(full_name_input, ''));
  normalized_bio := trim(coalesce(bio_input, ''));
  normalized_professional_role := trim(coalesce(professional_role_input, ''));

  if user_id_input is null then
    raise exception 'A user id is required.';
  end if;

  if normalized_full_name = '' then
    raise exception 'Full name is required.';
  end if;

  if normalized_bio = '' then
    raise exception 'Bio is required.';
  end if;

  if normalized_professional_role = '' then
    raise exception 'Professional role is required.';
  end if;

  update public.users
  set
    full_name = left(normalized_full_name, 80),
    bio = left(normalized_bio, 280),
    professional_role = left(normalized_professional_role, 40)
  where users.id = user_id_input
  returning * into updated_user;

  if not found then
    raise exception 'User not found.';
  end if;

  return query
  select
    updated_user.id,
    updated_user.username,
    updated_user.email,
    updated_user.full_name,
    updated_user.bio,
    updated_user.professional_role,
    updated_user.created_at;
end;
$$;

alter table public.users enable row level security;

drop policy if exists "Public can read users" on public.users;
drop policy if exists "Authenticated users can insert own profile" on public.users;
drop policy if exists "Authenticated users can update own profile" on public.users;

revoke all on public.users from anon, authenticated;

grant execute on function public.list_public_users(integer) to anon, authenticated;
grant execute on function public.login_or_create_user(text, text) to anon, authenticated;
grant execute on function public.complete_user_profile(uuid, text, text, text) to anon, authenticated;

comment on table public.users is
  'App user table for Luminas username/email login and public user previews.';
