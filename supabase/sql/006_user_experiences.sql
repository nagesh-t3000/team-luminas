drop function if exists public.create_user_experience(uuid, text, text, text, text);
drop function if exists public.list_user_experiences_by_username(text, integer);

create table if not exists public.user_experiences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  title text not null,
  organization text not null,
  period text not null,
  summary text not null,
  created_at timestamptz not null default timezone('utc', now()),
  constraint user_experiences_title_length_check
    check (length(trim(title)) between 1 and 80),
  constraint user_experiences_organization_length_check
    check (length(trim(organization)) between 1 and 80),
  constraint user_experiences_period_length_check
    check (length(trim(period)) between 1 and 40),
  constraint user_experiences_summary_length_check
    check (length(trim(summary)) between 1 and 500)
);

create index if not exists user_experiences_user_created_at_idx
  on public.user_experiences (user_id, created_at desc);

create or replace function public.create_user_experience(
  user_id_input uuid,
  title_input text,
  organization_input text,
  period_input text,
  summary_input text
)
returns table (
  id uuid,
  user_id uuid,
  title text,
  organization text,
  period text,
  summary text,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized_title text;
  normalized_organization text;
  normalized_period text;
  normalized_summary text;
begin
  if user_id_input is null then
    raise exception 'A user id is required.';
  end if;

  normalized_title := left(trim(coalesce(title_input, '')), 80);
  normalized_organization := left(trim(coalesce(organization_input, '')), 80);
  normalized_period := left(trim(coalesce(period_input, '')), 40);
  normalized_summary := left(trim(coalesce(summary_input, '')), 500);

  if normalized_title = '' then
    raise exception 'Add a role or title for this experience.';
  end if;

  if normalized_organization = '' then
    raise exception 'Add the company, project, or organization.';
  end if;

  if normalized_period = '' then
    raise exception 'Add the time period for this experience.';
  end if;

  if normalized_summary = '' then
    raise exception 'Add a short summary for this experience.';
  end if;

  if not exists (
    select 1
    from public.users
    where users.id = user_id_input
  ) then
    raise exception 'User not found.';
  end if;

  return query
  insert into public.user_experiences (
    user_id,
    title,
    organization,
    period,
    summary
  )
  values (
    user_id_input,
    normalized_title,
    normalized_organization,
    normalized_period,
    normalized_summary
  )
  returning
    user_experiences.id,
    user_experiences.user_id,
    user_experiences.title,
    user_experiences.organization,
    user_experiences.period,
    user_experiences.summary,
    user_experiences.created_at;
end;
$$;

create or replace function public.list_user_experiences_by_username(
  username_input text,
  limit_count integer default 20
)
returns table (
  id uuid,
  user_id uuid,
  title text,
  organization text,
  period text,
  summary text,
  created_at timestamptz
)
language sql
security definer
set search_path = public
as $$
  select
    user_experiences.id,
    user_experiences.user_id,
    user_experiences.title,
    user_experiences.organization,
    user_experiences.period,
    user_experiences.summary,
    user_experiences.created_at
  from public.user_experiences
  join public.users
    on users.id = user_experiences.user_id
  where lower(users.username) = lower(trim(coalesce(username_input, '')))
  order by user_experiences.created_at desc
  limit greatest(limit_count, 1);
$$;

alter table public.user_experiences enable row level security;

revoke all on public.user_experiences from anon, authenticated;

grant execute on function public.create_user_experience(uuid, text, text, text, text) to anon, authenticated;
grant execute on function public.list_user_experiences_by_username(text, integer) to anon, authenticated;

comment on table public.user_experiences is
  'Experience entries created by users for display on their profile experience tab.';
