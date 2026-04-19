delete from public.prolink_feed_items
where raw_payload ->> 'seed_batch' = 'prolink-sponsored-v1';

with config as (
  select
    array[
      'Northstar', 'BlueOrbit', 'Signal', 'Meridian', 'Launch', 'Catalyst', 'Anchor', 'Nova',
      'Bridge', 'Pulse', 'Vertex', 'Nimbus'
    ]::text[] as sponsor_prefixes,
    array[
      'Cloud', 'Capital', 'Health', 'Works', 'Commerce', 'Advisory', 'Ventures', 'Systems',
      'Network', 'Dynamics', 'Collective', 'Guild'
    ]::text[] as sponsor_suffixes,
    array[
      'Aarav', 'Isha', 'Rohan', 'Meera', 'Kabir', 'Anaya', 'Vivaan', 'Siya',
      'Arjun', 'Diya', 'Neel', 'Tara'
    ]::text[] as contact_first_names,
    array[
      'Mehta', 'Kapoor', 'Shah', 'Reddy', 'Nair', 'Jain', 'Khanna', 'Bose',
      'Rao', 'Agarwal', 'Malhotra', 'Patel'
    ]::text[] as contact_last_names,
    array[
      'AI', 'Fintech', 'Healthcare', 'Climate', 'Edtech', 'Developer Tools',
      'Commerce', 'Cybersecurity', 'Data', 'Creator Economy', 'SaaS', 'Logistics'
    ]::text[] as domains,
    array[
      'Bengaluru', 'Mumbai', 'Delhi NCR', 'Pune', 'Hyderabad', 'Chennai',
      'Singapore', 'Dubai', 'Remote India', 'Remote APAC', 'Jakarta', 'London'
    ]::text[] as cities,
    array[
      'pre-seed', 'seed', 'series-a', 'series-b', 'growth', 'enterprise rollout'
    ]::text[] as stages,
    array[
      'async-first', 'hybrid', 'founder-led', 'design-heavy', 'sales-assisted', 'community-driven'
    ]::text[] as workflows,
    array[
      'founder', 'investor', 'job_seeker', 'recruiter', 'advisor'
    ]::text[] as audiences,
    array[
      'reach more members', 'drive qualified replies', 'generate warm intros',
      'promote a live launch', 'fill senior pipeline', 'attract domain buyers'
    ]::text[] as campaign_goals,
    array[
      'starter', 'growth', 'priority', 'premium'
    ]::text[] as budget_tiers,
    array[
      'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1519389950473-47ba0277781c?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1552664730-d307ca884978?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1521737604893-d14cc237f11d?auto=format&fit=crop&w=1200&q=80'
    ]::text[] as media_urls
),
base as (
  select
    gs as seed_index,
    case mod(gs - 1, 6)
      when 0 then 'job'
      when 1 then 'event'
      when 2 then 'service'
      when 3 then 'marketplace'
      when 4 then 'post'
      else 'investment'
    end as item_type,
    config.sponsor_prefixes[((gs - 1) % array_length(config.sponsor_prefixes, 1)) + 1] as sponsor_prefix,
    config.sponsor_suffixes[((gs - 1) % array_length(config.sponsor_suffixes, 1)) + 1] as sponsor_suffix,
    config.contact_first_names[((gs - 1) % array_length(config.contact_first_names, 1)) + 1] as contact_first_name,
    config.contact_last_names[((gs - 1) % array_length(config.contact_last_names, 1)) + 1] as contact_last_name,
    config.domains[((gs - 1) % array_length(config.domains, 1)) + 1] as domain_name,
    config.cities[((gs - 1) % array_length(config.cities, 1)) + 1] as city_name,
    config.stages[((gs - 1) % array_length(config.stages, 1)) + 1] as stage_name,
    config.workflows[((gs - 1) % array_length(config.workflows, 1)) + 1] as workflow_name,
    config.audiences[((gs - 1) % array_length(config.audiences, 1)) + 1] as primary_audience,
    config.campaign_goals[((gs - 1) % array_length(config.campaign_goals, 1)) + 1] as campaign_goal,
    config.budget_tiers[((gs - 1) % array_length(config.budget_tiers, 1)) + 1] as budget_tier,
    config.media_urls[((gs - 1) % array_length(config.media_urls, 1)) + 1] as media_url
  from generate_series(1, 180) as gs
  cross join config
),
prepared as (
  select
    seed_index,
    item_type,
    format('%s %s', contact_first_name, contact_last_name) as author_name,
    format('%s %s', sponsor_prefix, sponsor_suffix) as sponsor_name,
    domain_name,
    city_name,
    stage_name,
    workflow_name,
    primary_audience,
    campaign_goal,
    budget_tier,
    media_url,
    case item_type
      when 'job' then format(
        'Sponsored: %s is promoting senior %s hiring for %s operators',
        format('%s %s', sponsor_prefix, sponsor_suffix),
        domain_name,
        replace(primary_audience, '_', ' ')
      )
      when 'event' then format(
        'Sponsored: %s live session for %s teams in %s',
        initcap(domain_name),
        stage_name,
        city_name
      )
      when 'service' then format(
        'Sponsored: done-for-you %s sprint for %s members',
        domain_name,
        replace(primary_audience, '_', ' ')
      )
      when 'marketplace' then format(
        'Sponsored: curated %s offer stack for %s companies',
        domain_name,
        stage_name
      )
      when 'post' then format(
        'Sponsored: %s playbook for better %s execution',
        format('%s %s', sponsor_prefix, sponsor_suffix),
        domain_name
      )
      else format(
        'Sponsored: investor brief for %s founders preparing a %s move',
        domain_name,
        stage_name
      )
    end as headline,
    case item_type
      when 'job' then format(
        '%s is paying to reach serious %s talent with a tighter hiring brief, clear mandate, and a %s workflow. Built for users already showing interest in %s opportunities.',
        format('%s %s', sponsor_prefix, sponsor_suffix),
        domain_name,
        workflow_name,
        domain_name
      )
      when 'event' then format(
        'A promoted invite for %s builders in %s. The campaign is aimed at %s members who are likely to respond to a %s stage conversation with practical upside.',
        domain_name,
        city_name,
        replace(primary_audience, '_', ' '),
        stage_name
      )
      when 'service' then format(
        'This sponsored service offer is targeting users who need faster %s execution, a shorter sales cycle, and a %s operating style instead of a long agency process.',
        domain_name,
        workflow_name
      )
      when 'marketplace' then format(
        'A promoted marketplace drop for teams comparing %s support, templates, and operators. The budget tier is tuned for higher visibility among relevant %s users.',
        domain_name,
        replace(primary_audience, '_', ' ')
      )
      when 'post' then format(
        'This promoted post is meant to pull in qualified replies from users already signaling interest in %s, %s, and hands-on operator content.',
        domain_name,
        workflow_name
      )
      else format(
        'A paid investor-style placement designed for users tracking %s momentum, %s fundraising context, and sponsor-backed discovery on ProLink.',
        domain_name,
        stage_name
      )
    end as description,
    case item_type
      when 'job' then 'Request role brief'
      when 'event' then 'Ask for event invite'
      when 'service' then 'Start sponsor chat'
      when 'marketplace' then 'Ask for offer details'
      when 'post' then 'Reply to sponsor'
      else 'Request investor intro'
    end as cta_label,
    '/messages' as cta_url,
    city_name as location,
    timezone('utc', now()) - make_interval(hours => seed_index * 2) as published_at,
    jsonb_build_object(
      'seed_batch', 'prolink-sponsored-v1',
      'seed_index', seed_index,
      'is_sponsored', true,
      'sponsorship_label', 'Sponsored',
      'sponsor_name', format('%s %s', sponsor_prefix, sponsor_suffix),
      'campaign_goal', campaign_goal,
      'budget_tier', budget_tier,
      'target_domains', to_jsonb(array[
        lower(domain_name),
        replace(lower(stage_name), '-', '_'),
        replace(lower(workflow_name), '-', '_')
      ]::text[]),
      'target_locations', to_jsonb(array[
        replace(lower(city_name), ' ', '_')
      ]::text[]),
      'campaign_priority', 55 + mod(seed_index, 36),
      'objective', campaign_goal,
      'promotion_kind', 'prolink_sponsored',
      'primary_audience', primary_audience,
      'source_kind', item_type
    ) as raw_payload
  from base
),
inserted_items as (
  insert into public.prolink_feed_items (
    item_type,
    headline,
    description,
    media_kind,
    media_url,
    cta_label,
    cta_url,
    location,
    author_name,
    company_name,
    published_at,
    raw_payload
  )
  select
    item_type,
    headline,
    description,
    'image',
    media_url,
    cta_label,
    cta_url,
    location,
    author_name,
    sponsor_name,
    published_at,
    raw_payload
  from prepared
  returning id, item_type, author_name, company_name, raw_payload
)
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
  ai_enriched_at
)
select
  inserted_items.id,
  inserted_items.raw_payload ->> 'primary_audience' as primary_audience,
  case inserted_items.item_type
    when 'job' then array['job_seeker', 'recruiter']
    when 'event' then array['founder', 'advisor']
    when 'service' then array['founder', 'advisor']
    when 'marketplace' then array['founder', 'job_seeker']
    when 'post' then array['advisor', 'recruiter']
    else array['founder', 'investor']
  end::text[] as secondary_audiences,
  array[
    'sponsored',
    lower(inserted_items.raw_payload ->> 'campaign_goal'),
    lower(inserted_items.raw_payload ->> 'budget_tier')
  ]::text[] as topic_tags,
  array[
    lower(inserted_items.raw_payload -> 'target_domains' ->> 0),
    lower(inserted_items.raw_payload -> 'target_domains' ->> 2),
    'paid_distribution'
  ]::text[] as skill_tags,
  array[
    replace(lower(inserted_items.raw_payload -> 'target_domains' ->> 1), '-', '_'),
    lower(inserted_items.raw_payload ->> 'budget_tier'),
    'sponsored'
  ]::text[] as marketplace_tags,
  case inserted_items.item_type
    when 'job' then 'hire'
    when 'event' then 'attend'
    when 'service' then 'offer'
    when 'marketplace' then 'buy'
    when 'post' then 'learn'
    else 'invest'
  end as intent_type,
  68 + mod(((inserted_items.raw_payload ->> 'seed_index')::integer), 24) as quality_score,
  format(
    'Sponsored placement for %s users showing likely interest in %s, %s, and %s style opportunities.',
    replace(inserted_items.raw_payload ->> 'primary_audience', '_', ' '),
    inserted_items.raw_payload -> 'target_domains' ->> 0,
    inserted_items.raw_payload -> 'target_domains' ->> 1,
    inserted_items.raw_payload ->> 'campaign_goal'
  ) as ai_summary,
  'seeded-prolink-sponsored-v1' as ai_model,
  timezone('utc', now()) as ai_enriched_at
from inserted_items;
