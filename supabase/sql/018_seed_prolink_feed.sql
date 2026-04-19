delete from public.prolink_feed_items
where raw_payload ->> 'seed_batch' = 'prolink-v1';

with config as (
  select
    array[
      'Aarav', 'Isha', 'Rohan', 'Meera', 'Kabir', 'Anaya', 'Vivaan', 'Siya',
      'Arjun', 'Diya', 'Neel', 'Tara', 'Ishaan', 'Myra', 'Advik', 'Kiara'
    ]::text[] as first_names,
    array[
      'Mehta', 'Kapoor', 'Shah', 'Reddy', 'Nair', 'Jain', 'Khanna', 'Bose',
      'Rao', 'Agarwal', 'Malhotra', 'Patel', 'Sinha', 'Verma', 'Gupta', 'Menon'
    ]::text[] as last_names,
    array[
      'Northstar', 'BlueOrbit', 'Vertex', 'Signal', 'Radius', 'Nimbus', 'Bridge', 'Pulse',
      'Elevate', 'Launch', 'Meridian', 'Catalyst', 'Anchor', 'Summit', 'Orbit', 'Nova'
    ]::text[] as company_prefixes,
    array[
      'Labs', 'Capital', 'Collective', 'Works', 'Studio', 'Partners', 'Network', 'Guild',
      'Systems', 'Health', 'Commerce', 'Cloud', 'Ventures', 'Stack', 'Dynamics', 'Advisory'
    ]::text[] as company_suffixes,
    array[
      'AI', 'Fintech', 'Healthcare', 'Climate', 'Edtech', 'Developer Tools', 'Commerce', 'Cybersecurity',
      'Data', 'Creator Economy', 'SaaS', 'Logistics'
    ]::text[] as domains,
    array[
      'Bengaluru', 'Mumbai', 'Delhi NCR', 'Pune', 'Hyderabad', 'Chennai', 'Singapore', 'Dubai',
      'Remote India', 'Remote APAC', 'Jakarta', 'London'
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
      'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1519389950473-47ba0277781c?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1552664730-d307ca884978?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1521737604893-d14cc237f11d?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1504384308090-c894fdcc538d?auto=format&fit=crop&w=1200&q=80'
    ]::text[] as media_urls
),
base as (
  select
    gs as seed_index,
    case mod(gs - 1, 8)
      when 0 then 'person'
      when 1 then 'job'
      when 2 then 'event'
      when 3 then 'service'
      when 4 then 'marketplace'
      when 5 then 'post'
      when 6 then 'investment'
      else 'founder_ask'
    end as item_type,
    config.first_names[((gs - 1) % array_length(config.first_names, 1)) + 1] as first_name,
    config.last_names[((gs - 1) % array_length(config.last_names, 1)) + 1] as last_name,
    config.company_prefixes[((gs - 1) % array_length(config.company_prefixes, 1)) + 1] as company_prefix,
    config.company_suffixes[((gs - 1) % array_length(config.company_suffixes, 1)) + 1] as company_suffix,
    config.domains[((gs - 1) % array_length(config.domains, 1)) + 1] as domain_name,
    config.cities[((gs - 1) % array_length(config.cities, 1)) + 1] as city_name,
    config.stages[((gs - 1) % array_length(config.stages, 1)) + 1] as stage_name,
    config.workflows[((gs - 1) % array_length(config.workflows, 1)) + 1] as workflow_name,
    config.audiences[((gs - 1) % array_length(config.audiences, 1)) + 1] as primary_audience,
    config.media_urls[((gs - 1) % array_length(config.media_urls, 1)) + 1] as media_url
  from generate_series(1, 1000) as gs
  cross join config
),
prepared as (
  select
    seed_index,
    item_type,
    format('%s %s', first_name, last_name) as author_name,
    format('%s %s', company_prefix, company_suffix) as company_name,
    domain_name,
    city_name,
    stage_name,
    workflow_name,
    primary_audience,
    media_url,
    case item_type
      when 'person' then format(
        '%s %s is open to %s conversations with %s operators',
        first_name,
        last_name,
        domain_name,
        stage_name
      )
      when 'job' then format(
        '%s hiring for a %s role in %s',
        format('%s %s', company_prefix, company_suffix),
        domain_name,
        city_name
      )
      when 'event' then format(
        '%s builders meetup: %s edition',
        domain_name,
        initcap(replace(stage_name, '-', ' '))
      )
      when 'service' then format(
        '%s offering a done-for-you %s sprint',
        first_name,
        domain_name
      )
      when 'marketplace' then format(
        '%s marketplace drop for %s teams',
        initcap(domain_name),
        stage_name
      )
      when 'post' then format(
        '%s shares a reel on cleaner %s execution',
        first_name,
        domain_name
      )
      when 'investment' then format(
        '%s thesis update for %s founders',
        format('%s %s', company_prefix, company_suffix),
        domain_name
      )
      else format(
        '%s wants warm intros for the next %s push',
        first_name,
        domain_name
      )
    end as headline,
    case item_type
      when 'person' then format(
        '%s is using ProLink to surface a short intro reel, recent wins in %s, and the kind of founder or recruiter conversations that feel most relevant right now.',
        format('%s %s', first_name, last_name),
        domain_name
      )
      when 'job' then format(
        '%s is actively hiring someone who can own %s outcomes in a %s environment. The brief highlights scope, speed, and the %s workflow expected from day one.',
        format('%s %s', company_prefix, company_suffix),
        domain_name,
        stage_name,
        workflow_name
      )
      when 'event' then format(
        'A high-context gathering for %s builders, founders, and operators in %s. Expect practical sessions, warm intros, and immediate takeaways for teams navigating a %s moment.',
        domain_name,
        city_name,
        stage_name
      )
      when 'service' then format(
        '%s is promoting a marketplace-ready service offer for %s teams that want faster execution, clearer systems, and shorter feedback loops than a long agency engagement.',
        format('%s %s', first_name, last_name),
        domain_name
      )
      when 'marketplace' then format(
        'A structured marketplace listing for %s teams looking to buy templates, operator support, or specialist workflows tuned for a %s company stage.',
        domain_name,
        stage_name
      )
      when 'post' then format(
        '%s posted a social reel about improving %s execution. The post is written to attract thoughtful founders, recruiters, and advisors who can add momentum or context.',
        format('%s %s', first_name, last_name),
        domain_name
      )
      when 'investment' then format(
        '%s is sharing an investor-style reel with thesis notes, market timing, and signals around %s teams that may be preparing for a %s raise.',
        format('%s %s', company_prefix, company_suffix),
        domain_name,
        stage_name
      )
      else format(
        '%s is transparent about the next bottleneck: %s hiring, partner intros, and strategic guidance needed to move through a %s sprint without losing momentum.',
        format('%s %s', first_name, last_name),
        domain_name,
        stage_name
      )
    end as description,
    case item_type
      when 'job' then 'Ask about role'
      when 'event' then 'Message organizer'
      when 'service' then 'Start chat'
      when 'marketplace' then 'Ask for details'
      when 'post' then 'Reply in chat'
      when 'investment' then 'Request intro'
      when 'founder_ask' then 'Offer help'
      else 'Start intro chat'
    end as cta_label,
    '/messages' as cta_url,
    case
      when city_name like 'Remote%' then city_name
      else city_name
    end as location,
    timezone('utc', now()) - make_interval(hours => seed_index * 3) as published_at,
    jsonb_build_object(
      'seed_batch', 'prolink-v1',
      'seed_index', seed_index,
      'domain', domain_name,
      'stage', stage_name,
      'workflow', workflow_name,
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
    company_name,
    published_at,
    raw_payload
  from prepared
  returning id, item_type, headline, description, author_name, company_name, raw_payload
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
    when 'person' then array['recruiter', 'founder']
    when 'job' then array['job_seeker', 'recruiter']
    when 'event' then array['founder', 'advisor']
    when 'service' then array['founder', 'advisor']
    when 'marketplace' then array['founder', 'job_seeker']
    when 'post' then array['advisor', 'recruiter']
    when 'investment' then array['founder', 'advisor']
    else array['investor', 'advisor']
  end::text[] as secondary_audiences,
  array[
    lower(inserted_items.item_type),
    lower(inserted_items.raw_payload ->> 'domain'),
    replace(lower(inserted_items.raw_payload ->> 'stage'), '-', '_')
  ]::text[] as topic_tags,
  array[
    lower(inserted_items.raw_payload ->> 'domain'),
    case inserted_items.item_type
      when 'job' then 'hiring'
      when 'event' then 'community'
      when 'service' then 'execution'
      when 'marketplace' then 'buying'
      when 'investment' then 'fundraising'
      when 'founder_ask' then 'founder_ops'
      else 'networking'
    end
  ]::text[] as skill_tags,
  array[
    replace(lower(inserted_items.raw_payload ->> 'stage'), '-', '_'),
    replace(lower(inserted_items.raw_payload ->> 'workflow'), '-', '_'),
    lower(inserted_items.item_type)
  ]::text[] as marketplace_tags,
  case inserted_items.item_type
    when 'job' then 'hire'
    when 'event' then 'attend'
    when 'service' then 'offer'
    when 'marketplace' then 'buy'
    when 'investment' then 'invest'
    when 'founder_ask' then 'raise'
    when 'post' then 'learn'
    else 'network'
  end as intent_type,
  70 + mod(((inserted_items.raw_payload ->> 'seed_index')::integer), 28) as quality_score,
  case inserted_items.item_type
    when 'person' then format(
      '%s is a strong match for users who want warm operator discovery around %s and quick context before reaching out.',
      inserted_items.author_name,
      inserted_items.raw_payload ->> 'domain'
    )
    when 'job' then format(
      'This hiring reel is most relevant for people tracking credible %s roles with visible scope and speed.',
      inserted_items.raw_payload ->> 'domain'
    )
    when 'event' then format(
      'This event is likely relevant to users looking for a %s network moment with practical upside.',
      inserted_items.raw_payload ->> 'domain'
    )
    when 'service' then format(
      'This offer fits users who need marketplace-ready %s support without a long sales cycle.',
      inserted_items.raw_payload ->> 'domain'
    )
    when 'marketplace' then format(
      'This listing is built for buyers or operators comparing %s options quickly.',
      inserted_items.raw_payload ->> 'domain'
    )
    when 'post' then format(
      'This content reel should resonate with users who want practical %s lessons and relevant replies.',
      inserted_items.raw_payload ->> 'domain'
    )
    when 'investment' then format(
      'This deal-flow style update is relevant for founders or investors watching %s momentum.',
      inserted_items.raw_payload ->> 'domain'
    )
    else format(
      'This founder ask is relevant for users who can unlock hiring, intros, or advice in %s.',
      inserted_items.raw_payload ->> 'domain'
    )
  end as ai_summary,
  'seeded-prolink-v1' as ai_model,
  timezone('utc', now()) as ai_enriched_at
from inserted_items;
