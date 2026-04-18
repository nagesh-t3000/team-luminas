drop function if exists public.get_user_settings(uuid);
drop function if exists public.upsert_user_settings(uuid, text, text[], text[]);
drop trigger if exists set_user_settings_updated_at on public.user_settings;
drop function if exists public.touch_user_settings_updated_at();

create table if not exists public.user_settings (
  user_id uuid primary key references public.users (id) on delete cascade,
  profile_photo_url text,
  skilled_domains text[] not null default '{}'::text[],
  preferred_suggestions text[] not null default '{}'::text[],
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint user_settings_profile_photo_url_length_check
    check (profile_photo_url is null or length(profile_photo_url) <= 4096),
  constraint user_settings_skilled_domains_limit_check
    check (coalesce(array_length(skilled_domains, 1), 0) <= 8),
  constraint user_settings_preferred_suggestions_limit_check
    check (coalesce(array_length(preferred_suggestions, 1), 0) <= 12)
);

create or replace function public.touch_user_settings_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := timezone('utc', now());
  return new;
end;
$$;

create trigger set_user_settings_updated_at
before update on public.user_settings
for each row
execute function public.touch_user_settings_updated_at();

create or replace function public.get_user_settings(user_id_input uuid)
returns table (
  user_id uuid,
  profile_photo_url text,
  skilled_domains text[],
  preferred_suggestions text[],
  created_at timestamptz,
  updated_at timestamptz
)
language sql
security definer
set search_path = public
as $$
  select
    user_settings.user_id,
    user_settings.profile_photo_url,
    user_settings.skilled_domains,
    user_settings.preferred_suggestions,
    user_settings.created_at,
    user_settings.updated_at
  from public.user_settings
  where user_settings.user_id = user_id_input
  limit 1;
$$;

create or replace function public.upsert_user_settings(
  user_id_input uuid,
  profile_photo_url_input text default null,
  skilled_domains_input text[] default null,
  preferred_suggestions_input text[] default null
)
returns table (
  user_id uuid,
  profile_photo_url text,
  skilled_domains text[],
  preferred_suggestions text[],
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized_profile_photo_url text;
  normalized_skilled_domains text[];
  normalized_preferred_suggestions text[];
begin
  if user_id_input is null then
    raise exception 'A user id is required.';
  end if;

  if not exists (
    select 1
    from public.users
    where users.id = user_id_input
  ) then
    raise exception 'User not found.';
  end if;

  normalized_profile_photo_url := nullif(left(trim(coalesce(profile_photo_url_input, '')), 4096), '');

  normalized_skilled_domains := coalesce(
    array(
      select item
      from (
        select
          left(trim(value), 60) as item,
          min(ord) as first_position
        from unnest(coalesce(skilled_domains_input, '{}'::text[])) with ordinality as values_list(value, ord)
        where trim(coalesce(value, '')) <> ''
        group by left(trim(value), 60)
        order by min(ord)
        limit 8
      ) normalized
      order by first_position
    ),
    '{}'::text[]
  );

  normalized_preferred_suggestions := coalesce(
    array(
      select item
      from (
        select
          lower(left(trim(value), 40)) as item,
          min(ord) as first_position
        from unnest(coalesce(preferred_suggestions_input, '{}'::text[])) with ordinality as values_list(value, ord)
        where trim(coalesce(value, '')) <> ''
        group by lower(left(trim(value), 40))
        order by min(ord)
        limit 12
      ) normalized
      order by first_position
    ),
    '{}'::text[]
  );

  if exists (
    select 1
    from unnest(normalized_preferred_suggestions) as selected_role
    where selected_role not in ('founder', 'investor', 'job_seeker', 'recruiter', 'advisor')
  ) then
    raise exception 'Preferred suggestions must be one of: founder, investor, job_seeker, recruiter, advisor.';
  end if;

  return query
  insert into public.user_settings (
    user_id,
    profile_photo_url,
    skilled_domains,
    preferred_suggestions
  )
  values (
    user_id_input,
    normalized_profile_photo_url,
    normalized_skilled_domains,
    normalized_preferred_suggestions
  )
  on conflict on constraint user_settings_pkey do update
  set
    profile_photo_url = excluded.profile_photo_url,
    skilled_domains = excluded.skilled_domains,
    preferred_suggestions = excluded.preferred_suggestions
  returning
    public.user_settings.user_id,
    public.user_settings.profile_photo_url,
    public.user_settings.skilled_domains,
    public.user_settings.preferred_suggestions,
    public.user_settings.created_at,
    public.user_settings.updated_at;
end;
$$;

alter table public.user_settings enable row level security;

revoke all on public.user_settings from anon, authenticated;

grant execute on function public.get_user_settings(uuid) to anon, authenticated;
grant execute on function public.upsert_user_settings(uuid, text, text[], text[]) to anon, authenticated;

comment on table public.user_settings is
  'One-to-one settings table for user profile photo, skilled domains, and suggestion preferences.';
