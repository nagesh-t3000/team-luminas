drop function if exists public.list_prolink_feed_items(integer, timestamptz);
drop function if exists public.list_prolink_feed_candidates_for_enrichment(integer);
drop function if exists public.upsert_prolink_feed_ai_metadata(
  uuid,
  text,
  text[],
  text[],
  text[],
  text[],
  text,
  integer,
  text,
  text
);

create table if not exists public.prolink_feed_items (
  id uuid primary key default gen_random_uuid(),
  item_type text not null,
  headline text not null,
  description text not null,
  media_kind text not null default 'none',
  media_url text,
  cta_label text not null default 'Explore',
  cta_url text not null default '/explore',
  location text not null default 'Remote',
  author_name text not null default '',
  company_name text not null default '',
  published_at timestamptz not null default timezone('utc', now()),
  is_active boolean not null default true,
  raw_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint prolink_feed_items_item_type_check
    check (lower(trim(item_type)) in ('person', 'event', 'job', 'service', 'marketplace', 'post', 'investment', 'founder_ask')),
  constraint prolink_feed_items_headline_length_check
    check (length(trim(headline)) between 1 and 160),
  constraint prolink_feed_items_description_length_check
    check (length(trim(description)) between 1 and 1200),
  constraint prolink_feed_items_media_kind_check
    check (lower(trim(media_kind)) in ('image', 'video', 'none')),
  constraint prolink_feed_items_media_url_length_check
    check (media_url is null or length(trim(media_url)) <= 500),
  constraint prolink_feed_items_cta_label_length_check
    check (length(trim(cta_label)) between 1 and 40),
  constraint prolink_feed_items_cta_url_length_check
    check (length(trim(cta_url)) between 1 and 300),
  constraint prolink_feed_items_location_length_check
    check (length(trim(location)) between 1 and 120),
  constraint prolink_feed_items_author_name_length_check
    check (length(trim(author_name)) <= 120),
  constraint prolink_feed_items_company_name_length_check
    check (length(trim(company_name)) <= 120)
);

create table if not exists public.prolink_feed_ai_metadata (
  feed_item_id uuid primary key references public.prolink_feed_items (id) on delete cascade,
  primary_audience text not null,
  secondary_audiences text[] not null default '{}'::text[],
  topic_tags text[] not null default '{}'::text[],
  skill_tags text[] not null default '{}'::text[],
  marketplace_tags text[] not null default '{}'::text[],
  intent_type text not null default 'discover',
  quality_score integer not null default 50,
  ai_summary text not null default '',
  ai_model text not null default 'seeded-v1',
  ai_enriched_at timestamptz not null default timezone('utc', now()),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint prolink_feed_ai_primary_audience_check
    check (lower(trim(primary_audience)) in ('founder', 'investor', 'job_seeker', 'recruiter', 'advisor')),
  constraint prolink_feed_ai_secondary_audiences_limit_check
    check (coalesce(array_length(secondary_audiences, 1), 0) <= 4),
  constraint prolink_feed_ai_topic_tags_limit_check
    check (coalesce(array_length(topic_tags, 1), 0) <= 8),
  constraint prolink_feed_ai_skill_tags_limit_check
    check (coalesce(array_length(skill_tags, 1), 0) <= 8),
  constraint prolink_feed_ai_marketplace_tags_limit_check
    check (coalesce(array_length(marketplace_tags, 1), 0) <= 8),
  constraint prolink_feed_ai_intent_type_check
    check (lower(trim(intent_type)) in ('hire', 'raise', 'attend', 'network', 'sell', 'buy', 'learn', 'offer', 'invest', 'discover')),
  constraint prolink_feed_ai_quality_score_check
    check (quality_score between 0 and 100),
  constraint prolink_feed_ai_summary_length_check
    check (length(trim(ai_summary)) between 1 and 500),
  constraint prolink_feed_ai_model_length_check
    check (length(trim(ai_model)) between 1 and 80)
);

create index if not exists prolink_feed_items_active_published_idx
  on public.prolink_feed_items (is_active, published_at desc, id desc);

create index if not exists prolink_feed_items_type_published_idx
  on public.prolink_feed_items (item_type, published_at desc);

create index if not exists prolink_feed_ai_primary_audience_idx
  on public.prolink_feed_ai_metadata (primary_audience, quality_score desc, ai_enriched_at desc);

create index if not exists prolink_feed_ai_intent_idx
  on public.prolink_feed_ai_metadata (intent_type, quality_score desc);

create or replace function public.list_prolink_feed_items(
  limit_count integer default 60,
  cursor_input timestamptz default null
)
returns table (
  id uuid,
  item_type text,
  headline text,
  description text,
  media_kind text,
  media_url text,
  cta_label text,
  cta_url text,
  location text,
  author_name text,
  company_name text,
  published_at timestamptz,
  raw_payload jsonb,
  primary_audience text,
  secondary_audiences text[],
  topic_tags text[],
  skill_tags text[],
  marketplace_tags text[],
  intent_type text,
  quality_score integer,
  ai_summary text,
  ai_model text,
  ai_enriched_at timestamptz
)
language sql
security definer
set search_path = public
as $$
  select
    items.id,
    items.item_type,
    items.headline,
    items.description,
    items.media_kind,
    items.media_url,
    items.cta_label,
    items.cta_url,
    items.location,
    items.author_name,
    items.company_name,
    items.published_at,
    items.raw_payload,
    metadata.primary_audience,
    metadata.secondary_audiences,
    metadata.topic_tags,
    metadata.skill_tags,
    metadata.marketplace_tags,
    metadata.intent_type,
    metadata.quality_score,
    metadata.ai_summary,
    metadata.ai_model,
    metadata.ai_enriched_at
  from public.prolink_feed_items items
  join public.prolink_feed_ai_metadata metadata
    on metadata.feed_item_id = items.id
  where items.is_active
    and (
      cursor_input is null
      or items.published_at < cursor_input
    )
  order by items.published_at desc, items.id desc
  limit least(greatest(limit_count, 1), 200);
$$;

create or replace function public.list_prolink_feed_candidates_for_enrichment(
  limit_count integer default 50
)
returns table (
  id uuid,
  item_type text,
  headline text,
  description text,
  location text,
  author_name text,
  company_name text,
  raw_payload jsonb
)
language sql
security definer
set search_path = public
as $$
  select
    items.id,
    items.item_type,
    items.headline,
    items.description,
    items.location,
    items.author_name,
    items.company_name,
    items.raw_payload
  from public.prolink_feed_items items
  left join public.prolink_feed_ai_metadata metadata
    on metadata.feed_item_id = items.id
  where items.is_active
    and (
      metadata.feed_item_id is null
      or metadata.ai_enriched_at < items.updated_at
    )
  order by items.updated_at desc, items.id desc
  limit least(greatest(limit_count, 1), 100);
$$;

create or replace function public.upsert_prolink_feed_ai_metadata(
  feed_item_id_input uuid,
  primary_audience_input text,
  secondary_audiences_input text[] default null,
  topic_tags_input text[] default null,
  skill_tags_input text[] default null,
  marketplace_tags_input text[] default null,
  intent_type_input text default 'discover',
  quality_score_input integer default 50,
  ai_summary_input text default '',
  ai_model_input text default 'gpt-4.1-mini'
)
returns table (
  feed_item_id uuid,
  primary_audience text,
  secondary_audiences text[],
  topic_tags text[],
  skill_tags text[],
  marketplace_tags text[],
  intent_type text,
  quality_score integer,
  ai_summary text,
  ai_model text,
  ai_enriched_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized_primary_audience text := lower(trim(coalesce(primary_audience_input, '')));
  normalized_intent_type text := lower(trim(coalesce(intent_type_input, 'discover')));
  normalized_quality_score integer := greatest(0, least(coalesce(quality_score_input, 50), 100));
  normalized_ai_summary text := left(trim(coalesce(ai_summary_input, '')), 500);
  normalized_ai_model text := left(trim(coalesce(ai_model_input, 'gpt-4.1-mini')), 80);
  normalized_secondary_audiences text[] := coalesce(
    (
      select array_agg(value)
      from (
        select distinct lower(trim(value)) as value
        from unnest(coalesce(secondary_audiences_input, '{}'::text[])) as value
        where lower(trim(value)) in ('founder', 'investor', 'job_seeker', 'recruiter', 'advisor')
        limit 4
      ) normalized_values
    ),
    '{}'::text[]
  );
  normalized_topic_tags text[] := coalesce(
    (
      select array_agg(value)
      from (
        select distinct left(trim(value), 40) as value
        from unnest(coalesce(topic_tags_input, '{}'::text[])) as value
        where trim(value) <> ''
        limit 8
      ) normalized_values
    ),
    '{}'::text[]
  );
  normalized_skill_tags text[] := coalesce(
    (
      select array_agg(value)
      from (
        select distinct left(trim(value), 40) as value
        from unnest(coalesce(skill_tags_input, '{}'::text[])) as value
        where trim(value) <> ''
        limit 8
      ) normalized_values
    ),
    '{}'::text[]
  );
  normalized_marketplace_tags text[] := coalesce(
    (
      select array_agg(value)
      from (
        select distinct left(trim(value), 40) as value
        from unnest(coalesce(marketplace_tags_input, '{}'::text[])) as value
        where trim(value) <> ''
        limit 8
      ) normalized_values
    ),
    '{}'::text[]
  );
begin
  if feed_item_id_input is null then
    raise exception 'A feed item id is required.';
  end if;

  if not exists (
    select 1
    from public.prolink_feed_items
    where id = feed_item_id_input
  ) then
    raise exception 'ProLink feed item not found.';
  end if;

  if normalized_primary_audience not in ('founder', 'investor', 'job_seeker', 'recruiter', 'advisor') then
    raise exception 'Choose a valid primary audience.';
  end if;

  if normalized_intent_type not in ('hire', 'raise', 'attend', 'network', 'sell', 'buy', 'learn', 'offer', 'invest', 'discover') then
    raise exception 'Choose a valid ProLink intent type.';
  end if;

  if normalized_ai_summary = '' then
    raise exception 'An AI summary is required.';
  end if;

  insert into public.prolink_feed_ai_metadata (
    feed_item_id,
    primary_audience,
    secondary_audiences,
    topic_tags,
    skill_tags,
    marketplace_tags,
    intent_type,
    quality_score,
    ai_summary,
    ai_model,
    ai_enriched_at,
    updated_at
  )
  values (
    feed_item_id_input,
    normalized_primary_audience,
    normalized_secondary_audiences,
    normalized_topic_tags,
    normalized_skill_tags,
    normalized_marketplace_tags,
    normalized_intent_type,
    normalized_quality_score,
    normalized_ai_summary,
    normalized_ai_model,
    timezone('utc', now()),
    timezone('utc', now())
  )
  on conflict (feed_item_id)
  do update set
    primary_audience = excluded.primary_audience,
    secondary_audiences = excluded.secondary_audiences,
    topic_tags = excluded.topic_tags,
    skill_tags = excluded.skill_tags,
    marketplace_tags = excluded.marketplace_tags,
    intent_type = excluded.intent_type,
    quality_score = excluded.quality_score,
    ai_summary = excluded.ai_summary,
    ai_model = excluded.ai_model,
    ai_enriched_at = excluded.ai_enriched_at,
    updated_at = excluded.updated_at;

  return query
  select
    metadata.feed_item_id,
    metadata.primary_audience,
    metadata.secondary_audiences,
    metadata.topic_tags,
    metadata.skill_tags,
    metadata.marketplace_tags,
    metadata.intent_type,
    metadata.quality_score,
    metadata.ai_summary,
    metadata.ai_model,
    metadata.ai_enriched_at
  from public.prolink_feed_ai_metadata metadata
  where metadata.feed_item_id = feed_item_id_input;
end;
$$;
