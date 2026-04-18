alter table if exists public.user_settings
  drop constraint if exists user_settings_profile_photo_url_length_check;

alter table if exists public.user_settings
  add constraint user_settings_profile_photo_url_length_check
  check (profile_photo_url is null or length(profile_photo_url) <= 200000);

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
