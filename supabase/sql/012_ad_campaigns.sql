drop function if exists public.list_authored_explore_updates(uuid, text, integer);
drop function if exists public.create_ad_campaign(uuid, text, uuid, text, integer, integer, text, text[], text);
drop function if exists public.list_ad_campaigns_by_user(uuid, integer);
drop function if exists public.update_ad_campaign_status(uuid, uuid, text);

create table if not exists public.ad_campaigns (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.users (id) on delete cascade,
  target_type text not null,
  target_id uuid not null,
  objective text not null,
  budget_inr integer not null,
  duration_days integer not null,
  audience_summary text not null default '',
  audience_labels text[] not null default '{}'::text[],
  status text not null default 'draft',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint ad_campaigns_target_type_check
    check (lower(trim(target_type)) in ('event', 'skill_post')),
  constraint ad_campaigns_objective_length_check
    check (length(trim(objective)) between 1 and 80),
  constraint ad_campaigns_budget_inr_check
    check (budget_inr between 500 and 500000),
  constraint ad_campaigns_duration_days_check
    check (duration_days between 1 and 30),
  constraint ad_campaigns_audience_summary_length_check
    check (length(trim(audience_summary)) <= 500),
  constraint ad_campaigns_audience_labels_limit_check
    check (coalesce(array_length(audience_labels, 1), 0) <= 8),
  constraint ad_campaigns_status_check
    check (lower(trim(status)) in ('draft', 'active', 'paused'))
);

create index if not exists ad_campaigns_owner_created_at_idx
  on public.ad_campaigns (owner_id, created_at desc);

create index if not exists ad_campaigns_owner_status_created_at_idx
  on public.ad_campaigns (owner_id, status, created_at desc);

create index if not exists ad_campaigns_target_lookup_idx
  on public.ad_campaigns (target_type, target_id);

create or replace function public.list_authored_explore_updates(
  author_id_input uuid,
  category_input text default null,
  limit_count integer default 24
)
returns table (
  id uuid,
  category text,
  source_name text,
  title text,
  summary text,
  location text,
  external_url text,
  image_url text,
  tags text[],
  raw_payload jsonb,
  published_at timestamptz,
  created_at timestamptz,
  author_id uuid,
  author_username text,
  author_full_name text,
  author_professional_role text,
  author_profile_photo_url text,
  author_is_verified boolean
)
language sql
security definer
set search_path = public
as $$
  select
    explore_updates.id,
    explore_updates.category,
    explore_updates.source_name,
    explore_updates.title,
    explore_updates.summary,
    explore_updates.location,
    explore_updates.external_url,
    explore_updates.image_url,
    explore_updates.tags,
    explore_updates.raw_payload,
    explore_updates.published_at,
    explore_updates.created_at,
    users.id as author_id,
    users.username as author_username,
    users.full_name as author_full_name,
    users.professional_role as author_professional_role,
    user_settings.profile_photo_url as author_profile_photo_url,
    coalesce(
      users.human_verification_status = 'verified'
      and user_settings.is_professional_account,
      false
    ) as author_is_verified
  from public.explore_updates
  join public.users
    on users.id = explore_updates.author_id
  left join public.user_settings
    on user_settings.user_id = users.id
  where explore_updates.author_id = author_id_input
    and (
      nullif(lower(trim(coalesce(category_input, ''))), '') is null
      or lower(explore_updates.category) = lower(trim(category_input))
    )
  order by explore_updates.published_at desc, explore_updates.created_at desc
  limit greatest(limit_count, 1);
$$;

create or replace function public.create_ad_campaign(
  owner_id_input uuid,
  target_type_input text,
  target_id_input uuid,
  objective_input text,
  budget_inr_input integer,
  duration_days_input integer,
  audience_summary_input text default '',
  audience_labels_input text[] default null,
  status_input text default 'active'
)
returns table (
  id uuid,
  owner_id uuid,
  target_type text,
  target_id uuid,
  objective text,
  budget_inr integer,
  duration_days integer,
  audience_summary text,
  audience_labels text[],
  status text,
  created_at timestamptz,
  updated_at timestamptz,
  target_title text,
  target_context text,
  target_path text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized_target_type text;
  normalized_objective text;
  normalized_audience_summary text;
  normalized_status text;
  normalized_audience_labels text[];
begin
  if owner_id_input is null then
    raise exception 'A user id is required to create an ad.';
  end if;

  normalized_target_type := lower(trim(coalesce(target_type_input, '')));
  normalized_objective := left(trim(coalesce(objective_input, '')), 80);
  normalized_audience_summary := left(trim(coalesce(audience_summary_input, '')), 500);
  normalized_status := lower(trim(coalesce(status_input, 'active')));
  normalized_audience_labels := coalesce(
    (
      select array_agg(label)
      from (
        select distinct left(trim(label), 40) as label
        from unnest(coalesce(audience_labels_input, '{}'::text[])) as label
        where trim(label) <> ''
        limit 8
      ) normalized_labels
    ),
    '{}'::text[]
  );

  if not exists (
    select 1
    from public.users
    where users.id = owner_id_input
  ) then
    raise exception 'User not found.';
  end if;

  if normalized_target_type not in ('event', 'skill_post') then
    raise exception 'Choose an event or skill post to boost.';
  end if;

  if target_id_input is null then
    raise exception 'Select a post or event to boost.';
  end if;

  if normalized_objective = '' then
    raise exception 'Choose a campaign objective.';
  end if;

  if budget_inr_input is null or budget_inr_input < 500 or budget_inr_input > 500000 then
    raise exception 'Budget must be between INR 500 and INR 500000.';
  end if;

  if duration_days_input is null or duration_days_input < 1 or duration_days_input > 30 then
    raise exception 'Duration must be between 1 and 30 days.';
  end if;

  if normalized_status not in ('draft', 'active', 'paused') then
    raise exception 'Invalid campaign status.';
  end if;

  if normalized_target_type = 'event' then
    if not exists (
      select 1
      from public.explore_updates
      where explore_updates.id = target_id_input
        and explore_updates.author_id = owner_id_input
        and lower(explore_updates.category) = 'event'
    ) then
      raise exception 'You can only boost your own published events.';
    end if;
  end if;

  if normalized_target_type = 'skill_post' then
    if not exists (
      select 1
      from public.skill_posts
      where skill_posts.id = target_id_input
        and skill_posts.author_id = owner_id_input
    ) then
      raise exception 'You can only boost your own skill posts.';
    end if;
  end if;

  return query
  with inserted_campaign as (
    insert into public.ad_campaigns (
      owner_id,
      target_type,
      target_id,
      objective,
      budget_inr,
      duration_days,
      audience_summary,
      audience_labels,
      status
    )
    values (
      owner_id_input,
      normalized_target_type,
      target_id_input,
      normalized_objective,
      budget_inr_input,
      duration_days_input,
      normalized_audience_summary,
      normalized_audience_labels,
      normalized_status
    )
    returning *
  )
  select
    inserted_campaign.id,
    inserted_campaign.owner_id,
    inserted_campaign.target_type,
    inserted_campaign.target_id,
    inserted_campaign.objective,
    inserted_campaign.budget_inr,
    inserted_campaign.duration_days,
    inserted_campaign.audience_summary,
    inserted_campaign.audience_labels,
    inserted_campaign.status,
    inserted_campaign.created_at,
    inserted_campaign.updated_at,
    case
      when inserted_campaign.target_type = 'event' then explore_updates.title
      else skill_posts.skilled_domain
    end as target_title,
    case
      when inserted_campaign.target_type = 'event' then coalesce(explore_updates.location, 'Event')
      else coalesce(users.professional_role, users.username, 'Skill post')
    end as target_context,
    case
      when inserted_campaign.target_type = 'event' then '/explore'
      when users.username is not null then '/profile/' || users.username
      else '/dashboard'
    end as target_path
  from inserted_campaign
  left join public.explore_updates
    on inserted_campaign.target_type = 'event'
    and explore_updates.id = inserted_campaign.target_id
  left join public.skill_posts
    on inserted_campaign.target_type = 'skill_post'
    and skill_posts.id = inserted_campaign.target_id
  left join public.users
    on users.id = skill_posts.author_id;
end;
$$;

create or replace function public.list_ad_campaigns_by_user(
  owner_id_input uuid,
  limit_count integer default 24
)
returns table (
  id uuid,
  owner_id uuid,
  target_type text,
  target_id uuid,
  objective text,
  budget_inr integer,
  duration_days integer,
  audience_summary text,
  audience_labels text[],
  status text,
  created_at timestamptz,
  updated_at timestamptz,
  target_title text,
  target_context text,
  target_path text
)
language sql
security definer
set search_path = public
as $$
  select
    ad_campaigns.id,
    ad_campaigns.owner_id,
    ad_campaigns.target_type,
    ad_campaigns.target_id,
    ad_campaigns.objective,
    ad_campaigns.budget_inr,
    ad_campaigns.duration_days,
    ad_campaigns.audience_summary,
    ad_campaigns.audience_labels,
    ad_campaigns.status,
    ad_campaigns.created_at,
    ad_campaigns.updated_at,
    case
      when ad_campaigns.target_type = 'event' then explore_updates.title
      else skill_posts.skilled_domain
    end as target_title,
    case
      when ad_campaigns.target_type = 'event' then coalesce(explore_updates.location, 'Event')
      else coalesce(users.professional_role, users.username, 'Skill post')
    end as target_context,
    case
      when ad_campaigns.target_type = 'event' then '/explore'
      when users.username is not null then '/profile/' || users.username
      else '/dashboard'
    end as target_path
  from public.ad_campaigns
  left join public.explore_updates
    on ad_campaigns.target_type = 'event'
    and explore_updates.id = ad_campaigns.target_id
  left join public.skill_posts
    on ad_campaigns.target_type = 'skill_post'
    and skill_posts.id = ad_campaigns.target_id
  left join public.users
    on users.id = skill_posts.author_id
  where ad_campaigns.owner_id = owner_id_input
  order by ad_campaigns.created_at desc
  limit greatest(limit_count, 1);
$$;

create or replace function public.update_ad_campaign_status(
  campaign_id_input uuid,
  owner_id_input uuid,
  status_input text
)
returns table (
  id uuid,
  owner_id uuid,
  target_type text,
  target_id uuid,
  objective text,
  budget_inr integer,
  duration_days integer,
  audience_summary text,
  audience_labels text[],
  status text,
  created_at timestamptz,
  updated_at timestamptz,
  target_title text,
  target_context text,
  target_path text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized_status text;
begin
  normalized_status := lower(trim(coalesce(status_input, '')));

  if campaign_id_input is null or owner_id_input is null then
    raise exception 'Campaign and user ids are required.';
  end if;

  if normalized_status not in ('active', 'paused') then
    raise exception 'Campaigns can only be updated to active or paused.';
  end if;

  update public.ad_campaigns
  set
    status = normalized_status,
    updated_at = timezone('utc', now())
  where ad_campaigns.id = campaign_id_input
    and ad_campaigns.owner_id = owner_id_input;

  if not found then
    raise exception 'Campaign not found.';
  end if;

  return query
  select *
  from public.list_ad_campaigns_by_user(owner_id_input, 100)
  where list_ad_campaigns_by_user.id = campaign_id_input;
end;
$$;

alter table public.ad_campaigns enable row level security;

revoke all on public.ad_campaigns from anon, authenticated;

grant execute on function public.list_authored_explore_updates(uuid, text, integer) to anon, authenticated;
grant execute on function public.create_ad_campaign(uuid, text, uuid, text, integer, integer, text, text[], text) to anon, authenticated;
grant execute on function public.list_ad_campaigns_by_user(uuid, integer) to anon, authenticated;
grant execute on function public.update_ad_campaign_status(uuid, uuid, text) to anon, authenticated;

comment on table public.ad_campaigns is
  'Saved ad campaigns that let verified professionals boost their own events and skill posts.';
