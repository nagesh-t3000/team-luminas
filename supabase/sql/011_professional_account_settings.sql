alter table if exists public.user_settings
  add column if not exists is_professional_account boolean not null default false,
  add column if not exists company_domains text[] not null default '{}'::text[];

alter table if exists public.user_settings
  drop constraint if exists user_settings_company_domains_limit_check,
  drop constraint if exists user_settings_company_domains_requires_professional_account_check;

alter table if exists public.user_settings
  add constraint user_settings_company_domains_limit_check
    check (coalesce(array_length(company_domains, 1), 0) <= 5),
  add constraint user_settings_company_domains_requires_professional_account_check
    check (is_professional_account or coalesce(array_length(company_domains, 1), 0) = 0);

drop function if exists public.get_user_settings(uuid);

create or replace function public.get_user_settings(user_id_input uuid)
returns table (
  user_id uuid,
  profile_photo_url text,
  skilled_domains text[],
  is_professional_account boolean,
  company_domains text[],
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
    user_settings.is_professional_account,
    user_settings.company_domains,
    user_settings.preferred_suggestions,
    user_settings.created_at,
    user_settings.updated_at
  from public.user_settings
  where user_settings.user_id = user_id_input
  limit 1;
$$;

drop function if exists public.upsert_user_settings(uuid, text, text[], text[]);
drop function if exists public.upsert_user_settings(uuid, text, text[], boolean, text[], text[]);

create function public.upsert_user_settings(
  user_id_input uuid,
  profile_photo_url_input text default null,
  skilled_domains_input text[] default null,
  is_professional_account_input boolean default false,
  company_domains_input text[] default null,
  preferred_suggestions_input text[] default null
)
returns table (
  user_id uuid,
  profile_photo_url text,
  skilled_domains text[],
  is_professional_account boolean,
  company_domains text[],
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
  normalized_is_professional_account boolean;
  normalized_company_domains text[];
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

  normalized_profile_photo_url := nullif(left(trim(coalesce(profile_photo_url_input, '')), 200000), '');

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

  normalized_is_professional_account := coalesce(is_professional_account_input, false);

  normalized_company_domains := case
    when normalized_is_professional_account then
      coalesce(
        array(
          select item
          from (
            select
              left(trim(value), 60) as item,
              min(ord) as first_position
            from unnest(coalesce(company_domains_input, '{}'::text[])) with ordinality as values_list(value, ord)
            where trim(coalesce(value, '')) <> ''
            group by left(trim(value), 60)
            order by min(ord)
            limit 5
          ) normalized
          order by first_position
        ),
        '{}'::text[]
      )
    else '{}'::text[]
  end;

  if normalized_is_professional_account and coalesce(array_length(normalized_company_domains, 1), 0) = 0 then
    raise exception 'Professional accounts must include at least one company domain.';
  end if;

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
    is_professional_account,
    company_domains,
    preferred_suggestions
  )
  values (
    user_id_input,
    normalized_profile_photo_url,
    normalized_skilled_domains,
    normalized_is_professional_account,
    normalized_company_domains,
    normalized_preferred_suggestions
  )
  on conflict on constraint user_settings_pkey do update
  set
    profile_photo_url = excluded.profile_photo_url,
    skilled_domains = excluded.skilled_domains,
    is_professional_account = excluded.is_professional_account,
    company_domains = excluded.company_domains,
    preferred_suggestions = excluded.preferred_suggestions
  returning
    public.user_settings.user_id,
    public.user_settings.profile_photo_url,
    public.user_settings.skilled_domains,
    public.user_settings.is_professional_account,
    public.user_settings.company_domains,
    public.user_settings.preferred_suggestions,
    public.user_settings.created_at,
    public.user_settings.updated_at;
end;
$$;

grant execute on function public.get_user_settings(uuid) to anon, authenticated;
grant execute on function public.upsert_user_settings(uuid, text, text[], boolean, text[], text[]) to anon, authenticated;

drop function if exists public.list_public_users(integer);

create or replace function public.list_public_users(limit_count integer default 6)
returns table (
  id uuid,
  username text,
  email text,
  full_name text,
  bio text,
  professional_role text,
  is_verified boolean,
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
    (
      users.human_verification_status = 'verified'
      and coalesce(user_settings.is_professional_account, false)
    ) as is_verified,
    users.created_at
  from public.users
  left join public.user_settings
    on user_settings.user_id = users.id
  order by users.created_at asc
  limit greatest(limit_count, 1);
$$;

drop function if exists public.get_public_user_by_username(text);

create or replace function public.get_public_user_by_username(username_input text)
returns table (
  id uuid,
  username text,
  email text,
  full_name text,
  bio text,
  professional_role text,
  is_verified boolean,
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
    (
      users.human_verification_status = 'verified'
      and coalesce(user_settings.is_professional_account, false)
    ) as is_verified,
    users.created_at
  from public.users
  left join public.user_settings
    on user_settings.user_id = users.id
  where lower(users.username) = lower(trim(coalesce(username_input, '')))
  limit 1;
$$;

grant execute on function public.list_public_users(integer) to anon, authenticated;
grant execute on function public.get_public_user_by_username(text) to anon, authenticated;
