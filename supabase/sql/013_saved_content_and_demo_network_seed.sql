drop function if exists public.list_saved_content_by_user(uuid, integer);
drop function if exists public.toggle_saved_content(uuid, text, uuid);

create table if not exists public.saved_content (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  content_type text not null,
  content_id uuid not null,
  created_at timestamptz not null default timezone('utc', now()),
  constraint saved_content_type_check
    check (lower(trim(content_type)) in ('skill_post', 'event')),
  constraint saved_content_unique
    unique (user_id, content_type, content_id)
);

create index if not exists saved_content_user_created_at_idx
  on public.saved_content (user_id, created_at desc);

create index if not exists saved_content_target_idx
  on public.saved_content (content_type, content_id);

create or replace function public.toggle_saved_content(
  user_id_input uuid,
  content_type_input text,
  content_id_input uuid
)
returns table (
  is_saved boolean,
  saved_count bigint
)
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized_content_type text;
  existing_save_id uuid;
begin
  normalized_content_type := lower(trim(coalesce(content_type_input, '')));

  if user_id_input is null then
    raise exception 'A user id is required.';
  end if;

  if content_id_input is null then
    raise exception 'A content id is required.';
  end if;

  if not exists (
    select 1
    from public.users
    where users.id = user_id_input
  ) then
    raise exception 'User not found.';
  end if;

  if normalized_content_type = 'skill_post' then
    if not exists (
      select 1
      from public.skill_posts
      where skill_posts.id = content_id_input
    ) then
      raise exception 'Skill post not found.';
    end if;
  elsif normalized_content_type = 'event' then
    if not exists (
      select 1
      from public.explore_updates
      where explore_updates.id = content_id_input
        and lower(explore_updates.category) = 'event'
    ) then
      raise exception 'Event not found.';
    end if;
  else
    raise exception 'Saved content must be a skill post or event.';
  end if;

  select saved_content.id
  into existing_save_id
  from public.saved_content
  where saved_content.user_id = user_id_input
    and saved_content.content_type = normalized_content_type
    and saved_content.content_id = content_id_input
  limit 1;

  if existing_save_id is not null then
    delete from public.saved_content
    where saved_content.id = existing_save_id;

    return query
    select
      false as is_saved,
      count(*)::bigint as saved_count
    from public.saved_content
    where saved_content.user_id = user_id_input;
    return;
  end if;

  insert into public.saved_content (
    user_id,
    content_type,
    content_id
  )
  values (
    user_id_input,
    normalized_content_type,
    content_id_input
  );

  return query
  select
    true as is_saved,
    count(*)::bigint as saved_count
  from public.saved_content
  where saved_content.user_id = user_id_input;
end;
$$;

create or replace function public.list_saved_content_by_user(
  user_id_input uuid,
  limit_count integer default 30
)
returns table (
  id uuid,
  content_type text,
  content_id uuid,
  saved_at timestamptz,
  title text,
  summary text,
  image_url text,
  target_path text,
  author_id uuid,
  author_username text,
  author_full_name text,
  author_profile_photo_url text
)
language sql
security definer
set search_path = public
as $$
  select
    saved_content.id,
    saved_content.content_type,
    saved_content.content_id,
    saved_content.created_at as saved_at,
    case
      when saved_content.content_type = 'event' then explore_updates.title
      else skill_posts.skilled_domain
    end as title,
    case
      when saved_content.content_type = 'event' then explore_updates.summary
      else skill_posts.content
    end as summary,
    case
      when saved_content.content_type = 'event' then explore_updates.image_url
      else nullif(skill_posts.media_items -> 0 ->> 'url', '')
    end as image_url,
    case
      when saved_content.content_type = 'event' then '/explore'
      when post_author.username is not null then '/profile/' || post_author.username
      else '/dashboard'
    end as target_path,
    case
      when saved_content.content_type = 'event' then explore_updates.author_id
      else skill_posts.author_id
    end as author_id,
    case
      when saved_content.content_type = 'event' then event_author.username
      else post_author.username
    end as author_username,
    case
      when saved_content.content_type = 'event' then event_author.full_name
      else post_author.full_name
    end as author_full_name,
    case
      when saved_content.content_type = 'event' then event_settings.profile_photo_url
      else post_settings.profile_photo_url
    end as author_profile_photo_url
  from public.saved_content
  left join public.explore_updates
    on saved_content.content_type = 'event'
    and explore_updates.id = saved_content.content_id
  left join public.users as event_author
    on event_author.id = explore_updates.author_id
  left join public.user_settings as event_settings
    on event_settings.user_id = event_author.id
  left join public.skill_posts
    on saved_content.content_type = 'skill_post'
    and skill_posts.id = saved_content.content_id
  left join public.users as post_author
    on post_author.id = skill_posts.author_id
  left join public.user_settings as post_settings
    on post_settings.user_id = post_author.id
  where saved_content.user_id = user_id_input
  order by saved_content.created_at desc
  limit greatest(limit_count, 1);
$$;

alter table public.saved_content enable row level security;

revoke all on public.saved_content from anon, authenticated;

grant execute on function public.toggle_saved_content(uuid, text, uuid) to anon, authenticated;
grant execute on function public.list_saved_content_by_user(uuid, integer) to anon, authenticated;

comment on table public.saved_content is
  'User-saved skill posts and authored events for profile and dashboard recall.';

with seed_users as (
  select
    idx,
    ((idx - 1) % 10) + 1 as persona_idx,
    ('7f0d1000-0000-4000-8000-' || lpad(to_hex(idx), 12, '0'))::uuid as user_id,
    'luminas.member' || lpad(idx::text, 2, '0') as username,
    'luminas.member' || lpad(idx::text, 2, '0') || '@luminas-demo.test' as email,
    (array['Aarav', 'Diya', 'Kabir', 'Mira', 'Rohan', 'Ishita', 'Vivaan', 'Anaya', 'Aditya', 'Meera', 'Krish', 'Tara', 'Arjun', 'Siya'])[((idx - 1) % 14) + 1] as first_name,
    (array['Sharma', 'Patel', 'Iyer', 'Singh', 'Reddy', 'Mehta', 'Nair', 'Gupta', 'Jain', 'Kapoor', 'Rao', 'Bose', 'Kulkarni', 'Verma'])[((idx - 1) % 14) + 1] as last_name,
    (array['Bengaluru, India', 'Mumbai, India', 'Delhi, India', 'Hyderabad, India', 'Pune, India', 'Chennai, India', 'Ahmedabad, India', 'Kochi, India'])[((idx - 1) % 8) + 1] as city
  from generate_series(1, 28) as idx
),
persona_profiles as (
  select
    seed_users.*,
    case persona_idx
      when 1 then 'Frontend Engineer'
      when 2 then 'Backend Engineer'
      when 3 then 'Product Manager'
      when 4 then 'Product Designer'
      when 5 then 'ML Engineer'
      when 6 then 'Data Analyst'
      when 7 then 'Founder'
      when 8 then 'Growth Marketer'
      when 9 then 'DevOps Engineer'
      else 'Talent Partner'
    end as professional_role,
    case persona_idx
      when 1 then 'React'
      when 2 then 'APIs'
      when 3 then 'Product Strategy'
      when 4 then 'UX Design'
      when 5 then 'Machine Learning'
      when 6 then 'Analytics'
      when 7 then 'Operations'
      when 8 then 'Growth Marketing'
      when 9 then 'Cloud Infrastructure'
      else 'Talent Acquisition'
    end as primary_skill,
    case persona_idx
      when 1 then 'TypeScript'
      when 2 then 'Postgres'
      when 3 then 'User Research'
      when 4 then 'Design Systems'
      when 5 then 'Python'
      when 6 then 'SQL'
      when 7 then 'Customer Support'
      when 8 then 'Lifecycle CRM'
      when 9 then 'Observability'
      else 'Hiring Ops'
    end as secondary_skill,
    case persona_idx
      when 1 then 'Design Systems'
      when 2 then 'Distributed Systems'
      when 3 then 'Activation'
      when 4 then 'Mobile UX'
      when 5 then 'RAG Systems'
      when 6 then 'Experimentation'
      when 7 then 'Process Design'
      when 8 then 'Performance Ads'
      when 9 then 'Platform Reliability'
      else 'Employer Branding'
    end as tertiary_skill,
    case persona_idx
      when 1 then 'Northstar Labs'
      when 2 then 'ScaleForge'
      when 3 then 'LoopPilot'
      when 4 then 'PixelMint'
      when 5 then 'VectorLeap'
      when 6 then 'Metric Harbor'
      when 7 then 'OpsNest'
      when 8 then 'Launchlane'
      when 9 then 'CloudRelay'
      else 'TalentGrid'
    end as organization,
    case persona_idx
      when 1 then 'northstarlabs.in'
      when 2 then 'scaleforge.dev'
      when 3 then 'looppilot.io'
      when 4 then 'pixelmint.design'
      when 5 then 'vectorleap.ai'
      when 6 then 'metricharbor.com'
      when 7 then 'opsnest.co'
      when 8 then 'launchlane.co'
      when 9 then 'cloudrelay.dev'
      else 'talentgrid.work'
    end as company_domain,
    idx <= 18 as is_professional_account
  from seed_users
),
final_users as (
  select
    persona_profiles.*,
    trim(first_name || ' ' || last_name) as full_name,
    format(
      '%s in %s sharing practical updates on %s, execution quality, and useful professional conversations.',
      professional_role,
      split_part(city, ',', 1),
      lower(primary_skill)
    ) as bio,
    case persona_idx
      when 1 then array['recruiter', 'founder']::text[]
      when 2 then array['recruiter', 'advisor']::text[]
      when 3 then array['founder', 'advisor']::text[]
      when 4 then array['founder', 'recruiter']::text[]
      when 5 then array['founder', 'recruiter']::text[]
      when 6 then array['founder', 'advisor']::text[]
      when 7 then array['investor', 'advisor']::text[]
      when 8 then array['founder', 'advisor']::text[]
      when 9 then array['recruiter', 'founder']::text[]
      else array['job_seeker', 'recruiter']::text[]
    end as preferred_suggestions
  from persona_profiles
)
insert into public.users (
  id,
  username,
  email,
  password_hash,
  full_name,
  bio,
  professional_role,
  human_verification_status,
  human_verification_provider,
  human_verified_at,
  human_verification_evidence,
  created_at
)
select
  final_users.user_id,
  final_users.username,
  final_users.email,
  extensions.crypt('DemoPass123!', extensions.gen_salt('bf')),
  final_users.full_name,
  left(final_users.bio, 280),
  final_users.professional_role,
  case
    when final_users.is_professional_account then 'verified'
    when final_users.idx % 3 = 0 then 'pending'
    else 'required'
  end,
  case
    when final_users.is_professional_account then 'seed'
    when final_users.idx % 3 = 0 then 'manual-demo'
    else null
  end,
  case
    when final_users.is_professional_account then timezone('utc', now()) - make_interval(days => (20 - (final_users.idx % 9))::int)
    else null
  end,
  jsonb_build_object(
    'seeded', true,
    'batch', 'saved-content-network',
    'synthetic_profile', true,
    'region', 'india'
  ),
  timezone('utc', now()) - make_interval(days => (35 - final_users.idx)::int)
from final_users
on conflict (id) do update
set
  username = excluded.username,
  email = excluded.email,
  password_hash = excluded.password_hash,
  full_name = excluded.full_name,
  bio = excluded.bio,
  professional_role = excluded.professional_role,
  human_verification_status = excluded.human_verification_status,
  human_verification_provider = excluded.human_verification_provider,
  human_verified_at = excluded.human_verified_at,
  human_verification_evidence = excluded.human_verification_evidence,
  created_at = excluded.created_at;

with seed_users as (
  select
    idx,
    ((idx - 1) % 10) + 1 as persona_idx,
    ('7f0d1000-0000-4000-8000-' || lpad(to_hex(idx), 12, '0'))::uuid as user_id
  from generate_series(1, 28) as idx
),
final_users as (
  select
    seed_users.idx,
    seed_users.user_id,
    case persona_idx
      when 1 then 'React'
      when 2 then 'APIs'
      when 3 then 'Product Strategy'
      when 4 then 'UX Design'
      when 5 then 'Machine Learning'
      when 6 then 'Analytics'
      when 7 then 'Operations'
      when 8 then 'Growth Marketing'
      when 9 then 'Cloud Infrastructure'
      else 'Talent Acquisition'
    end as primary_skill,
    case persona_idx
      when 1 then 'TypeScript'
      when 2 then 'Postgres'
      when 3 then 'User Research'
      when 4 then 'Design Systems'
      when 5 then 'Python'
      when 6 then 'SQL'
      when 7 then 'Customer Support'
      when 8 then 'Lifecycle CRM'
      when 9 then 'Observability'
      else 'Hiring Ops'
    end as secondary_skill,
    case persona_idx
      when 1 then 'Design Systems'
      when 2 then 'Distributed Systems'
      when 3 then 'Activation'
      when 4 then 'Mobile UX'
      when 5 then 'RAG Systems'
      when 6 then 'Experimentation'
      when 7 then 'Process Design'
      when 8 then 'Performance Ads'
      when 9 then 'Platform Reliability'
      else 'Employer Branding'
    end as tertiary_skill,
    case persona_idx
      when 1 then 'northstarlabs.in'
      when 2 then 'scaleforge.dev'
      when 3 then 'looppilot.io'
      when 4 then 'pixelmint.design'
      when 5 then 'vectorleap.ai'
      when 6 then 'metricharbor.com'
      when 7 then 'opsnest.co'
      when 8 then 'launchlane.co'
      when 9 then 'cloudrelay.dev'
      else 'talentgrid.work'
    end as company_domain,
    idx <= 18 as is_professional_account,
    case persona_idx
      when 1 then array['recruiter', 'founder']::text[]
      when 2 then array['recruiter', 'advisor']::text[]
      when 3 then array['founder', 'advisor']::text[]
      when 4 then array['founder', 'recruiter']::text[]
      when 5 then array['founder', 'recruiter']::text[]
      when 6 then array['founder', 'advisor']::text[]
      when 7 then array['investor', 'advisor']::text[]
      when 8 then array['founder', 'advisor']::text[]
      when 9 then array['recruiter', 'founder']::text[]
      else array['job_seeker', 'recruiter']::text[]
    end as preferred_suggestions
  from seed_users
)
insert into public.user_settings (
  user_id,
  profile_photo_url,
  skilled_domains,
  is_professional_account,
  company_domains,
  preferred_suggestions,
  created_at,
  updated_at
)
select
  final_users.user_id,
  'https://i.pravatar.cc/400?img=' || (30 + final_users.idx),
  array[final_users.primary_skill, final_users.secondary_skill, final_users.tertiary_skill]::text[],
  final_users.is_professional_account,
  case
    when final_users.is_professional_account then array[final_users.company_domain]::text[]
    else '{}'::text[]
  end,
  final_users.preferred_suggestions,
  timezone('utc', now()) - make_interval(days => (34 - final_users.idx)::int),
  timezone('utc', now()) - make_interval(days => (2 + (final_users.idx % 6))::int)
from final_users
on conflict (user_id) do update
set
  profile_photo_url = excluded.profile_photo_url,
  skilled_domains = excluded.skilled_domains,
  is_professional_account = excluded.is_professional_account,
  company_domains = excluded.company_domains,
  preferred_suggestions = excluded.preferred_suggestions,
  created_at = excluded.created_at,
  updated_at = excluded.updated_at;

with seed_users as (
  select
    idx,
    ((idx - 1) % 10) + 1 as persona_idx,
    ('7f0d1000-0000-4000-8000-' || lpad(to_hex(idx), 12, '0'))::uuid as user_id
  from generate_series(1, 28) as idx
)
insert into public.user_experiences (
  id,
  user_id,
  title,
  organization,
  period,
  summary,
  created_at
)
select
  ('7f0d2000-0000-4000-8000-' || lpad(to_hex(idx), 12, '0'))::uuid,
  seed_users.user_id,
  case persona_idx
    when 1 then 'Frontend Engineer'
    when 2 then 'Backend Engineer'
    when 3 then 'Product Manager'
    when 4 then 'Product Designer'
    when 5 then 'ML Engineer'
    when 6 then 'Data Analyst'
    when 7 then 'Founder'
    when 8 then 'Growth Marketer'
    when 9 then 'DevOps Engineer'
    else 'Talent Partner'
  end,
  case persona_idx
    when 1 then 'Northstar Labs'
    when 2 then 'ScaleForge'
    when 3 then 'LoopPilot'
    when 4 then 'PixelMint'
    when 5 then 'VectorLeap'
    when 6 then 'Metric Harbor'
    when 7 then 'OpsNest'
    when 8 then 'Launchlane'
    when 9 then 'CloudRelay'
    else 'TalentGrid'
  end,
  case
    when idx % 4 = 0 then '2023 - Present'
    when idx % 4 = 1 then '2022 - Present'
    when idx % 4 = 2 then '2021 - Present'
    else '2024 - Present'
  end,
  case persona_idx
    when 1 then 'Improving React interfaces, handoff quality, and component consistency across product teams.'
    when 2 then 'Building reliable APIs, background workflows, and practical observability for product delivery.'
    when 3 then 'Owning onboarding, activation, and weekly experiment readouts for growth-minded product teams.'
    when 4 then 'Designing mobile-first flows, calmer interfaces, and clear decision-making moments.'
    when 5 then 'Shipping retrieval, evaluation, and model-integration workflows for applied AI products.'
    when 6 then 'Turning usage data into retention, activation, and team-health reporting for operators.'
    when 7 then 'Running hiring, support, and process design for an early-stage operating team.'
    when 8 then 'Managing lifecycle, paid, and referral experiments with tighter feedback loops.'
    when 9 then 'Supporting cloud infrastructure, deploy reliability, and platform health for builders.'
    else 'Helping startups hire faster with cleaner interview loops and stronger candidate communication.'
  end,
  timezone('utc', now()) - make_interval(days => (30 - idx)::int)
from seed_users
on conflict (id) do update
set
  user_id = excluded.user_id,
  title = excluded.title,
  organization = excluded.organization,
  period = excluded.period,
  summary = excluded.summary,
  created_at = excluded.created_at;

with seed_users as (
  select
    idx,
    ((idx - 1) % 10) + 1 as persona_idx,
    ('7f0d1000-0000-4000-8000-' || lpad(to_hex(idx), 12, '0'))::uuid as user_id
  from generate_series(1, 28) as idx
),
seed_posts as (
  select
    idx,
    ((idx - 1) % 28) + 1 as author_idx,
    case
      when idx <= 28 then 1
      else 2
    end as variant
  from generate_series(1, 40) as idx
)
insert into public.skill_posts (
  id,
  author_id,
  skilled_domain,
  content,
  media_items,
  created_at
)
select
  ('7f0d3000-0000-4000-8000-' || lpad(to_hex(seed_posts.idx), 12, '0'))::uuid,
  authors.user_id,
  case authors.persona_idx
    when 1 then 'React'
    when 2 then 'APIs'
    when 3 then 'Product Strategy'
    when 4 then 'UX Design'
    when 5 then 'Machine Learning'
    when 6 then 'Analytics'
    when 7 then 'Operations'
    when 8 then 'Growth Marketing'
    when 9 then 'Cloud Infrastructure'
    else 'Talent Acquisition'
  end,
  case
    when seed_posts.variant = 1 then
      case authors.persona_idx
        when 1 then 'Finished a cleaner React handoff this week. Fewer component edge cases made reviews and QA much calmer.'
        when 2 then 'Refactored one noisy API workflow and finally made retries predictable for the rest of the team.'
        when 3 then 'Shorter onboarding paths are still outperforming our heavier setup flow. Speed to first value keeps winning.'
        when 4 then 'A quieter mobile layout tested better than the version packed with explanations and extra options.'
        when 5 then 'Small improvements in retrieval labeling made our evaluation notes much easier to trust.'
        when 6 then 'A simpler scorecard helped product reviews move faster because the readout was obvious at a glance.'
        when 7 then 'Documented the support-to-product handoff that keeps our operating week from becoming reactive.'
        when 8 then 'Clear milestone messaging is still beating discount-heavy experiments for early activation.'
        when 9 then 'We cut one flaky deployment path and reduced platform noise more than expected.'
        else 'A tighter interview loop improved candidate response quality without slowing down hiring.'
      end
    else
      case authors.persona_idx
        when 1 then 'Sharing a few frontend system notes from recent launches: smaller props, clearer states, and fewer surprise layouts.'
        when 2 then 'Queue visibility is underrated. Once the team could see slow paths clearly, fixes got much easier to prioritize.'
        when 3 then 'Experiment reviews are smoother when the team writes down the tradeoff before shipping the variant.'
        when 4 then 'Error recovery on mobile matters more than another feature explanation block.'
        when 5 then 'Reranking quality improved once we separated exploratory prompts from troubleshooting prompts.'
        when 6 then 'A lighter dashboard with fewer vanity metrics made weekly decision-making a lot sharper.'
        when 7 then 'Founders need fewer scattered tools and more dependable process ownership as the team grows.'
        when 8 then 'Lifecycle experiments work better when the copy sounds like a teammate instead of a campaign.'
        when 9 then 'Observability work is easier to defend when you can tie it directly to fewer broken handoffs.'
        else 'Candidates notice the difference when scheduling, scorecards, and follow-up notes all feel intentional.'
      end
  end,
  case
    when seed_posts.idx % 3 = 0 then '[]'::jsonb
    else jsonb_build_array(
      jsonb_build_object(
        'kind', 'image',
        'url',
        case (seed_posts.idx % 8)
          when 0 then 'https://images.unsplash.com/photo-1498050108023-c5249f4df085?auto=format&fit=crop&w=1200&q=80'
          when 1 then 'https://images.unsplash.com/photo-1552664730-d307ca884978?auto=format&fit=crop&w=1200&q=80'
          when 2 then 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=1200&q=80'
          when 3 then 'https://images.unsplash.com/photo-1511578314322-379afb476865?auto=format&fit=crop&w=1200&q=80'
          when 4 then 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&w=1200&q=80'
          when 5 then 'https://images.unsplash.com/photo-1504384308090-c894fdcc538d?auto=format&fit=crop&w=1200&q=80'
          when 6 then 'https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?auto=format&fit=crop&w=1200&q=80'
          else 'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&w=1200&q=80'
        end
      )
    )
  end,
  timezone('utc', now()) - make_interval(days => (12 - (seed_posts.idx % 9))::int, hours => (seed_posts.idx % 18)::int)
from seed_posts
join seed_users as authors
  on authors.idx = seed_posts.author_idx
on conflict (id) do update
set
  author_id = excluded.author_id,
  skilled_domain = excluded.skilled_domain,
  content = excluded.content,
  media_items = excluded.media_items,
  created_at = excluded.created_at;

with seed_users as (
  select
    idx,
    ((idx - 1) % 10) + 1 as persona_idx,
    ('7f0d1000-0000-4000-8000-' || lpad(to_hex(idx), 12, '0'))::uuid as user_id,
    (array['Aarav', 'Diya', 'Kabir', 'Mira', 'Rohan', 'Ishita', 'Vivaan', 'Anaya', 'Aditya', 'Meera', 'Krish', 'Tara', 'Arjun', 'Siya'])[((idx - 1) % 14) + 1] as first_name,
    (array['Sharma', 'Patel', 'Iyer', 'Singh', 'Reddy', 'Mehta', 'Nair', 'Gupta', 'Jain', 'Kapoor', 'Rao', 'Bose', 'Kulkarni', 'Verma'])[((idx - 1) % 14) + 1] as last_name,
    (array['Bengaluru, India', 'Mumbai, India', 'Delhi, India', 'Hyderabad, India', 'Pune, India', 'Chennai, India', 'Ahmedabad, India', 'Kochi, India'])[((idx - 1) % 8) + 1] as city
  from generate_series(1, 28) as idx
)
insert into public.explore_updates (
  id,
  author_id,
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
select
  ('7f0d4000-0000-4000-8000-' || lpad(to_hex(idx), 12, '0'))::uuid,
  seed_users.user_id,
  'event',
  trim(seed_users.first_name || ' ' || seed_users.last_name),
  case seed_users.persona_idx
    when 1 then 'Frontend systems meetup for product engineers'
    when 2 then 'Backend reliability roundtable for API builders'
    when 3 then 'Product-led growth breakfast for SaaS operators'
    when 4 then 'Design critique session for mobile-first teams'
    when 5 then 'Applied AI workshop on evaluation and reranking'
    when 6 then 'Analytics review clinic for product teams'
    when 7 then 'Founder ops sprint for startup execution'
    when 8 then 'Growth experiment teardown for GTM operators'
    when 9 then 'Cloud resilience meetup for platform teams'
    else 'Talent network evening for startup hiring teams'
  end,
  case seed_users.persona_idx
    when 1 then 'Small group session covering component systems, design tokens, and practical frontend review loops.'
    when 2 then 'Evening meetup on retries, job design, and observability patterns for teams shipping APIs at pace.'
    when 3 then 'Operator discussion on activation, setup friction, and how to make product reviews more actionable.'
    when 4 then 'Hands-on critique circle focused on onboarding, mobile UX, and stronger error recovery choices.'
    when 5 then 'Workshop covering retrieval quality, evaluation habits, and better AI shipping checklists.'
    when 6 then 'Peer session on dashboards, experiment readouts, and how to make metrics more decision-ready.'
    when 7 then 'Founders sharing support workflows, hiring decisions, and lean operating habits that actually stick.'
    when 8 then 'Growth leads comparing messaging experiments, CRM moments, and calmer lifecycle communication.'
    when 9 then 'Platform engineers discussing release confidence, incident reduction, and healthier infrastructure rituals.'
    else 'Recruiters and hiring operators trading notes on candidate experience, process quality, and closing speed.'
  end,
  seed_users.city,
  case
    when seed_users.idx % 3 = 0 then 'https://www.eventbrite.com/'
    when seed_users.idx % 3 = 1 then 'https://lu.ma'
    else 'https://www.meetup.com/'
  end,
  case (seed_users.idx % 8)
    when 0 then 'https://images.unsplash.com/photo-1515187029135-18ee286d815b?auto=format&fit=crop&w=1200&q=80'
    when 1 then 'https://images.unsplash.com/photo-1511578314322-379afb476865?auto=format&fit=crop&w=1200&q=80'
    when 2 then 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=1200&q=80'
    when 3 then 'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&w=1200&q=80'
    when 4 then 'https://images.unsplash.com/photo-1498050108023-c5249f4df085?auto=format&fit=crop&w=1200&q=80'
    when 5 then 'https://images.unsplash.com/photo-1504384308090-c894fdcc538d?auto=format&fit=crop&w=1200&q=80'
    when 6 then 'https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?auto=format&fit=crop&w=1200&q=80'
    else 'https://images.unsplash.com/photo-1517457373958-b7bdd4587205?auto=format&fit=crop&w=1200&q=80'
  end,
  case seed_users.persona_idx
    when 1 then array['react', 'frontend', 'design-systems', 'networking']::text[]
    when 2 then array['backend', 'apis', 'observability', 'meetup']::text[]
    when 3 then array['product', 'growth', 'saas', 'roundtable']::text[]
    when 4 then array['design', 'mobile', 'ux', 'community']::text[]
    when 5 then array['ml', 'evaluation', 'rag', 'workshop']::text[]
    when 6 then array['analytics', 'experiments', 'product', 'peer-review']::text[]
    when 7 then array['founders', 'operations', 'startup', 'community']::text[]
    when 8 then array['growth', 'crm', 'activation', 'teardown']::text[]
    when 9 then array['cloud', 'platform', 'reliability', 'community']::text[]
    else array['talent', 'hiring', 'startup', 'networking']::text[]
  end,
  jsonb_build_object(
    'source_type', 'member_event',
    'created_by_existing_user', true,
    'format', case when seed_users.idx % 2 = 0 then 'in_person' else 'hybrid' end,
    'cta', case when seed_users.idx % 2 = 0 then 'Reserve your seat' else 'Request invite' end,
    'seed_batch', 'saved-content-network'
  ),
  timezone('utc', now()) + make_interval(days => (1 + (seed_users.idx % 10))::int, hours => (seed_users.idx % 6)::int)
from seed_users
where seed_users.idx <= 16
on conflict (id) do update
set
  author_id = excluded.author_id,
  category = excluded.category,
  source_name = excluded.source_name,
  title = excluded.title,
  summary = excluded.summary,
  location = excluded.location,
  external_url = excluded.external_url,
  image_url = excluded.image_url,
  tags = excluded.tags,
  raw_payload = excluded.raw_payload,
  published_at = excluded.published_at;

with connection_pairs as (
  select 1 as pair_order, idx as left_idx, idx + 1 as right_idx
  from generate_series(1, 10) as idx
  union all
  select 2 as pair_order, idx as left_idx, idx + 8 as right_idx
  from generate_series(1, 10) as idx
),
ordered_pairs as (
  select
    row_number() over (order by pair_order, left_idx, right_idx) as row_idx,
    least(left_idx, right_idx) as low_idx,
    greatest(left_idx, right_idx) as high_idx
  from connection_pairs
),
seed_users as (
  select
    idx,
    ('7f0d1000-0000-4000-8000-' || lpad(to_hex(idx), 12, '0'))::uuid as user_id
  from generate_series(1, 28) as idx
)
insert into public.user_connections (
  id,
  user_low_id,
  user_high_id,
  created_at
)
select
  ('7f0d5000-0000-4000-8000-' || lpad(to_hex(row_idx), 12, '0'))::uuid,
  low_user.user_id,
  high_user.user_id,
  timezone('utc', now()) - make_interval(days => (18 - (row_idx % 8))::int)
from ordered_pairs
join seed_users as low_user
  on low_user.idx = ordered_pairs.low_idx
join seed_users as high_user
  on high_user.idx = ordered_pairs.high_idx
on conflict (id) do update
set
  user_low_id = excluded.user_low_id,
  user_high_id = excluded.user_high_id,
  created_at = excluded.created_at;

with skill_post_saves as (
  select
    idx,
    (10 + idx) as saver_idx,
    ('7f0d3000-0000-4000-8000-' || lpad(to_hex(idx), 12, '0'))::uuid as content_id
  from generate_series(1, 10) as idx
),
event_saves as (
  select
    10 + idx as row_idx,
    (15 + idx) as saver_idx,
    ('7f0d4000-0000-4000-8000-' || lpad(to_hex(idx), 12, '0'))::uuid as content_id
  from generate_series(1, 10) as idx
),
seed_users as (
  select
    idx,
    ('7f0d1000-0000-4000-8000-' || lpad(to_hex(idx), 12, '0'))::uuid as user_id
  from generate_series(1, 28) as idx
)
insert into public.saved_content (
  id,
  user_id,
  content_type,
  content_id,
  created_at
)
select
  ('7f0d6000-0000-4000-8000-' || lpad(to_hex(skill_post_saves.idx), 12, '0'))::uuid,
  savers.user_id,
  'skill_post',
  skill_post_saves.content_id,
  timezone('utc', now()) - make_interval(days => (9 - (skill_post_saves.idx % 4))::int)
from skill_post_saves
join seed_users as savers
  on savers.idx = skill_post_saves.saver_idx
union all
select
  ('7f0d6000-0000-4000-8000-' || lpad(to_hex(event_saves.row_idx), 12, '0'))::uuid,
  savers.user_id,
  'event',
  event_saves.content_id,
  timezone('utc', now()) - make_interval(days => (6 - (event_saves.row_idx % 3))::int)
from event_saves
join seed_users as savers
  on savers.idx = event_saves.saver_idx
on conflict (id) do update
set
  user_id = excluded.user_id,
  content_type = excluded.content_type,
  content_id = excluded.content_id,
  created_at = excluded.created_at;

with post_campaigns as (
  select
    idx,
    ('7f0d1000-0000-4000-8000-' || lpad(to_hex(idx), 12, '0'))::uuid as owner_id,
    ('7f0d3000-0000-4000-8000-' || lpad(to_hex(idx), 12, '0'))::uuid as target_id
  from generate_series(1, 5) as idx
),
event_campaigns as (
  select
    5 + idx as row_idx,
    ('7f0d1000-0000-4000-8000-' || lpad(to_hex(idx), 12, '0'))::uuid as owner_id,
    ('7f0d4000-0000-4000-8000-' || lpad(to_hex(idx), 12, '0'))::uuid as target_id
  from generate_series(1, 5) as idx
)
insert into public.ad_campaigns (
  id,
  owner_id,
  target_type,
  target_id,
  objective,
  budget_inr,
  duration_days,
  audience_summary,
  audience_labels,
  status,
  created_at,
  updated_at
)
select
  ('7f0d7000-0000-4000-8000-' || lpad(to_hex(post_campaigns.idx), 12, '0'))::uuid,
  post_campaigns.owner_id,
  'skill_post',
  post_campaigns.target_id,
  case
    when post_campaigns.idx % 2 = 0 then 'reach more hiring leads'
    else 'boost profile discovery'
  end,
  1500 + (post_campaigns.idx * 500),
  5 + post_campaigns.idx,
  'Promoting strong skill proof to relevant founders, recruiters, and operating peers.',
  array['founders', 'recruiters', 'operators']::text[],
  case
    when post_campaigns.idx % 3 = 0 then 'draft'
    when post_campaigns.idx % 2 = 0 then 'paused'
    else 'active'
  end,
  timezone('utc', now()) - make_interval(days => (4 + post_campaigns.idx)::int),
  timezone('utc', now()) - make_interval(days => (post_campaigns.idx % 3)::int)
from post_campaigns
union all
select
  ('7f0d7000-0000-4000-8000-' || lpad(to_hex(event_campaigns.row_idx), 12, '0'))::uuid,
  event_campaigns.owner_id,
  'event',
  event_campaigns.target_id,
  case
    when event_campaigns.row_idx % 2 = 0 then 'fill more seats'
    else 'reach local operators'
  end,
  2200 + (event_campaigns.row_idx * 400),
  4 + event_campaigns.row_idx,
  'Highlighting timely member events to people likely to attend, share, and invite peers.',
  array['community', 'operators', 'local-builders']::text[],
  case
    when event_campaigns.row_idx % 2 = 0 then 'active'
    else 'paused'
  end,
  timezone('utc', now()) - make_interval(days => (3 + event_campaigns.row_idx)::int),
  timezone('utc', now()) - make_interval(hours => event_campaigns.row_idx::int)
from event_campaigns
on conflict (id) do update
set
  owner_id = excluded.owner_id,
  target_type = excluded.target_type,
  target_id = excluded.target_id,
  objective = excluded.objective,
  budget_inr = excluded.budget_inr,
  duration_days = excluded.duration_days,
  audience_summary = excluded.audience_summary,
  audience_labels = excluded.audience_labels,
  status = excluded.status,
  created_at = excluded.created_at,
  updated_at = excluded.updated_at;
