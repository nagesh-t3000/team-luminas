alter table public.users
  add column if not exists company_verification_status text not null default 'required';

alter table public.users
  add column if not exists company_verification_website_url text;

alter table public.users
  add column if not exists company_verification_review_notes text;

alter table public.users
  add column if not exists company_verified_at timestamptz;

alter table public.users
  drop constraint if exists users_company_verification_status_check;

alter table public.users
  add constraint users_company_verification_status_check
  check (company_verification_status in ('required', 'pending', 'approved', 'rejected'));

alter table if exists public.user_settings
  drop constraint if exists user_settings_company_domains_limit_check;

alter table if exists public.user_settings
  add constraint user_settings_company_domains_limit_check
    check (coalesce(array_length(company_domains, 1), 0) <= 1);

drop function if exists public.get_user_settings(uuid);

create or replace function public.get_user_settings(user_id_input uuid)
returns table (
  user_id uuid,
  profile_photo_url text,
  skilled_domains text[],
  is_professional_account boolean,
  company_domains text[],
  preferred_suggestions text[],
  company_verification_status text,
  company_verification_website_url text,
  company_verification_review_notes text,
  company_verified_at timestamptz,
  created_at timestamptz,
  updated_at timestamptz
)
language sql
security definer
set search_path = public
as $$
  select
    users.id as user_id,
    user_settings.profile_photo_url,
    user_settings.skilled_domains,
    coalesce(user_settings.is_professional_account, false) as is_professional_account,
    coalesce(user_settings.company_domains, '{}'::text[]) as company_domains,
    user_settings.preferred_suggestions,
    users.company_verification_status,
    users.company_verification_website_url,
    users.company_verification_review_notes,
    users.company_verified_at,
    coalesce(user_settings.created_at, users.created_at) as created_at,
    coalesce(user_settings.updated_at, users.created_at) as updated_at
  from public.users
  left join public.user_settings
    on user_settings.user_id = users.id
  where users.id = user_id_input
  limit 1;
$$;

drop function if exists public.sync_company_verification_profile(uuid, boolean, text[], text);

create or replace function public.sync_company_verification_profile(
  user_id_input uuid,
  is_professional_account_input boolean default false,
  company_domains_input text[] default null,
  company_verification_website_url_input text default null
)
returns table (
  company_verification_status text,
  company_verification_website_url text,
  company_verification_review_notes text,
  company_verified_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized_company_domains text[];
  normalized_company_verification_website_url text;
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

  normalized_company_domains := coalesce(
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
        limit 1
      ) normalized
      order by first_position
    ),
    '{}'::text[]
  );

  normalized_company_verification_website_url := nullif(
    left(trim(coalesce(company_verification_website_url_input, '')), 300),
    ''
  );

  if coalesce(is_professional_account_input, false) = false then
    return query
    update public.users
    set
      company_verification_status = 'required',
      company_verification_website_url = null,
      company_verification_review_notes = null,
      company_verified_at = null
    where users.id = user_id_input
    returning
      users.company_verification_status,
      users.company_verification_website_url,
      users.company_verification_review_notes,
      users.company_verified_at;

    return;
  end if;

  if coalesce(array_length(normalized_company_domains, 1), 0) = 0
    or normalized_company_verification_website_url is null then
    return query
    update public.users
    set
      company_verification_status = 'required',
      company_verification_website_url = normalized_company_verification_website_url,
      company_verification_review_notes = null,
      company_verified_at = null
    where users.id = user_id_input
    returning
      users.company_verification_status,
      users.company_verification_website_url,
      users.company_verification_review_notes,
      users.company_verified_at;

    return;
  end if;

  return query
  update public.users
  set
    company_verification_status = 'pending',
    company_verification_website_url = normalized_company_verification_website_url,
    company_verification_review_notes = null,
    company_verified_at = null
  where users.id = user_id_input
  returning
    users.company_verification_status,
    users.company_verification_website_url,
    users.company_verification_review_notes,
    users.company_verified_at;
end;
$$;

grant execute on function public.get_user_settings(uuid) to anon, authenticated;
grant execute on function public.sync_company_verification_profile(uuid, boolean, text[], text) to anon, authenticated;
