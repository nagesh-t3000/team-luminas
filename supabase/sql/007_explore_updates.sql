drop function if exists public.list_explore_updates(integer, text);
drop function if exists public.list_explore_updates(integer, text, text);

create table if not exists public.explore_updates (
  id uuid primary key default gen_random_uuid(),
  category text not null,
  source_name text not null,
  title text not null,
  summary text not null,
  location text not null default 'Remote',
  external_url text,
  image_url text,
  tags text[] not null default '{}'::text[],
  raw_payload jsonb not null default '{}'::jsonb,
  published_at timestamptz not null default timezone('utc', now()),
  created_at timestamptz not null default timezone('utc', now()),
  constraint explore_updates_category_check
    check (lower(trim(category)) in ('hackathon', 'event', 'job')),
  constraint explore_updates_source_name_check
    check (length(trim(source_name)) between 1 and 80),
  constraint explore_updates_title_check
    check (length(trim(title)) between 1 and 140),
  constraint explore_updates_summary_check
    check (length(trim(summary)) between 1 and 1000),
  constraint explore_updates_location_check
    check (length(trim(location)) between 1 and 120),
  constraint explore_updates_external_url_check
    check (external_url is null or length(trim(external_url)) between 1 and 4096),
  constraint explore_updates_image_url_check
    check (image_url is null or length(trim(image_url)) between 1 and 4096),
  constraint explore_updates_tags_limit_check
    check (coalesce(array_length(tags, 1), 0) <= 8),
  constraint explore_updates_raw_payload_check
    check (jsonb_typeof(raw_payload) = 'object')
);

alter table public.explore_updates
  add column if not exists raw_payload jsonb not null default '{}'::jsonb;

alter table public.explore_updates
  add column if not exists published_at timestamptz not null default timezone('utc', now());

create index if not exists explore_updates_category_published_at_idx
  on public.explore_updates (category, published_at desc);

create index if not exists explore_updates_published_at_idx
  on public.explore_updates (published_at desc);

create unique index if not exists explore_updates_source_title_idx
  on public.explore_updates (lower(source_name), lower(title));

create or replace function public.list_explore_updates(
  limit_count integer default 24,
  category_input text default null,
  search_input text default null
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
  created_at timestamptz
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
    explore_updates.created_at
  from public.explore_updates
  where
    (
      nullif(lower(trim(coalesce(category_input, ''))), '') is null
      or lower(explore_updates.category) = lower(trim(category_input))
    )
    and (
      nullif(trim(coalesce(search_input, '')), '') is null
      or explore_updates.title ilike '%' || trim(search_input) || '%'
      or explore_updates.summary ilike '%' || trim(search_input) || '%'
      or explore_updates.source_name ilike '%' || trim(search_input) || '%'
      or explore_updates.location ilike '%' || trim(search_input) || '%'
      or explore_updates.raw_payload::text ilike '%' || trim(search_input) || '%'
      or exists (
        select 1
        from unnest(explore_updates.tags) as tag
        where tag ilike '%' || trim(search_input) || '%'
      )
    )
  order by explore_updates.published_at desc, explore_updates.created_at desc
  limit greatest(limit_count, 1);
$$;

insert into public.explore_updates (
  category,
  source_name,
  title,
  summary,
  location,
  external_url,
  image_url,
  tags,
  raw_payload,
  published_at
)
values
  (
    'hackathon',
    'Flipkart Grid',
    'Flipkart Grid 7.0 registrations open for problem-solving and AI tracks',
    'Team-based hackathon with commerce, logistics, AI, and sustainability problem statements. Open to students and early-career builders looking for product and engineering exposure.',
    'India',
    'https://www.flipkartcareers.com/#!/',
    'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=1200&q=80',
    array['hackathon', 'commerce', 'ai', 'students'],
    jsonb_build_object(
      'source_type', 'hackathon_listing',
      'company', 'Flipkart',
      'audience', jsonb_build_array('students', 'early_career_engineers'),
      'format', 'hybrid',
      'cta', 'Register your team'
    ),
    timezone('utc', now()) - interval '2 hours'
  ),
  (
    'job',
    'Flipkart Careers',
    'Flipkart hiring SDE II for marketplace platform reliability',
    'Backend-focused role covering distributed systems, observability, and high-scale order workflows. Strong fit for engineers with Java, microservices, and performance tuning experience.',
    'Bengaluru, India',
    'https://www.flipkartcareers.com/#!/joblist',
    'https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&w=1200&q=80',
    array['job', 'backend', 'java', 'distributed-systems'],
    jsonb_build_object(
      'source_type', 'job_post',
      'company', 'Flipkart',
      'employment_type', 'full_time',
      'seniority', 'mid_level',
      'team', 'Marketplace Platform'
    ),
    timezone('utc', now()) - interval '5 hours'
  ),
  (
    'event',
    'Microsoft Reactor',
    'Applied AI build sprint for startup teams this weekend',
    'Hands-on event covering copilots, RAG pipelines, and demo reviews for builders shipping AI features. Includes office hours with engineers and product mentors.',
    'Bengaluru, India',
    'https://developer.microsoft.com/en-us/reactor/',
    'https://images.unsplash.com/photo-1515169067868-5387ec356754?auto=format&fit=crop&w=1200&q=80',
    array['event', 'ai', 'startup', 'workshop'],
    jsonb_build_object(
      'source_type', 'community_event',
      'host', 'Microsoft Reactor',
      'format', 'in_person',
      'cta', 'Reserve a seat'
    ),
    timezone('utc', now()) - interval '8 hours'
  ),
  (
    'job',
    'Razorpay Jobs',
    'Razorpay opening product analyst roles for growth and retention',
    'Opportunity for analysts who enjoy experimentation, funnel diagnostics, and merchant product insights. SQL, dashboards, and experimentation experience preferred.',
    'Bengaluru, India',
    'https://razorpay.com/jobs/',
    'https://images.unsplash.com/photo-1552664730-d307ca884978?auto=format&fit=crop&w=1200&q=80',
    array['job', 'analytics', 'growth', 'fintech'],
    jsonb_build_object(
      'source_type', 'job_post',
      'company', 'Razorpay',
      'employment_type', 'full_time',
      'seniority', 'associate_to_mid'
    ),
    timezone('utc', now()) - interval '12 hours'
  ),
  (
    'hackathon',
    'Devfolio',
    'Web3 x AI hack weekend announced with mentorship and grants',
    'Buildathon for teams exploring developer tooling, AI agents, and crypto infrastructure. Shortlisted submissions get mentor reviews and post-event showcase slots.',
    'Remote',
    'https://devfolio.co/hackathons',
    'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&w=1200&q=80',
    array['hackathon', 'web3', 'ai', 'remote'],
    jsonb_build_object(
      'source_type', 'hackathon_listing',
      'platform', 'Devfolio',
      'format', 'remote',
      'cta', 'See hackathon brief'
    ),
    timezone('utc', now()) - interval '18 hours'
  ),
  (
    'event',
    'Google Developers Group Bengaluru',
    'Cloud and GenAI meetup focused on production-ready deployment patterns',
    'Community meetup discussing evaluation, monitoring, and rollout patterns for LLM-backed apps. Lightning talks from founders and platform engineers included.',
    'Bengaluru, India',
    'https://gdg.community.dev/',
    'https://images.unsplash.com/photo-1504384308090-c894fdcc538d?auto=format&fit=crop&w=1200&q=80',
    array['event', 'genai', 'cloud', 'community'],
    jsonb_build_object(
      'source_type', 'meetup',
      'host', 'GDG Bengaluru',
      'format', 'in_person',
      'cta', 'RSVP now'
    ),
    timezone('utc', now()) - interval '1 day'
  ),
  (
    'job',
    'PhonePe Careers',
    'PhonePe looking for frontend engineers across consumer payments surfaces',
    'Role covers React, performance, experimentation, and UX polish for high-traffic consumer journeys. Experience with design systems and instrumentation is valuable.',
    'Bengaluru, India',
    'https://www.phonepe.com/careers/',
    'https://images.unsplash.com/photo-1498050108023-c5249f4df085?auto=format&fit=crop&w=1200&q=80',
    array['job', 'frontend', 'react', 'consumer'],
    jsonb_build_object(
      'source_type', 'job_post',
      'company', 'PhonePe',
      'employment_type', 'full_time',
      'seniority', 'mid_level'
    ),
    timezone('utc', now()) - interval '1 day 6 hours'
  ),
  (
    'event',
    'T-Hub',
    'Founder demo day and investor office hours for SaaS and deeptech startups',
    'Operator-focused session for founders refining fundraising narratives, GTM milestones, and technical differentiation before investor conversations.',
    'Hyderabad, India',
    'https://t-hub.co/',
    'https://images.unsplash.com/photo-1511578314322-379afb476865?auto=format&fit=crop&w=1200&q=80',
    array['event', 'founders', 'demo-day', 'fundraising'],
    jsonb_build_object(
      'source_type', 'startup_event',
      'host', 'T-Hub',
      'format', 'in_person',
      'cta', 'Apply for a slot'
    ),
    timezone('utc', now()) - interval '1 day 12 hours'
  ),
  (
    'hackathon',
    'MLH',
    'Global hackathon weekend for AI productivity tools and developer experience',
    'Remote-first hackathon for builders experimenting with code assistants, workflow automation, and team productivity. Includes sponsor APIs and mentor checkpoints.',
    'Remote',
    'https://mlh.io/seasons/2026/events',
    'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=1200&q=80',
    array['hackathon', 'developer-tools', 'productivity', 'remote'],
    jsonb_build_object(
      'source_type', 'hackathon_listing',
      'organizer', 'Major League Hacking',
      'format', 'remote',
      'cta', 'Browse event details'
    ),
    timezone('utc', now()) - interval '2 days'
  ),
  (
    'job',
    'Swiggy Careers',
    'Swiggy hiring data scientists for demand forecasting and supply planning',
    'Opportunity for professionals building models for time-series prediction, experimentation, and operational optimization in fast-moving marketplace systems.',
    'Bengaluru, India',
    'https://careers.swiggy.com/',
    'https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?auto=format&fit=crop&w=1200&q=80',
    array['job', 'data-science', 'forecasting', 'marketplace'],
    jsonb_build_object(
      'source_type', 'job_post',
      'company', 'Swiggy',
      'employment_type', 'full_time',
      'seniority', 'mid_to_senior'
    ),
    timezone('utc', now()) - interval '2 days 4 hours'
  ),
  (
    'event',
    'NASSCOM',
    'Tech hiring and startup talent networking evening announced for next week',
    'Networking event for recruiters, operators, and candidates across product, engineering, and data roles. Includes short hiring spotlights from participating companies.',
    'Mumbai, India',
    'https://nasscom.in/',
    'https://images.unsplash.com/photo-1517457373958-b7bdd4587205?auto=format&fit=crop&w=1200&q=80',
    array['event', 'networking', 'hiring', 'talent'],
    jsonb_build_object(
      'source_type', 'networking_event',
      'host', 'NASSCOM',
      'format', 'in_person',
      'cta', 'Request invite'
    ),
    timezone('utc', now()) - interval '3 days'
  ),
  (
    'job',
    'Zerodha Careers',
    'Zerodha opening design roles for retail investing and education products',
    'Looking for product designers who can simplify complex financial workflows, collaborate closely with engineers, and ship clear self-serve experiences.',
    'Bengaluru, India',
    'https://careers.zerodha.com/',
    'https://images.unsplash.com/photo-1524758631624-e2822e304c36?auto=format&fit=crop&w=1200&q=80',
    array['job', 'design', 'fintech', 'product'],
    jsonb_build_object(
      'source_type', 'job_post',
      'company', 'Zerodha',
      'employment_type', 'full_time',
      'seniority', 'mid_level'
    ),
    timezone('utc', now()) - interval '3 days 6 hours'
  )
on conflict do nothing;

alter table public.explore_updates enable row level security;

revoke all on public.explore_updates from anon, authenticated;

grant execute on function public.list_explore_updates(integer, text, text) to anon, authenticated;

comment on table public.explore_updates is
  'Seeded professional updates for the Explore section, including jobs, events, and hackathons with raw source payloads.';
