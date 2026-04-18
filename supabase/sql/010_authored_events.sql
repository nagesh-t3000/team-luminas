alter table public.explore_updates
  add column if not exists author_id uuid references public.users (id) on delete set null;

create index if not exists explore_updates_author_published_at_idx
  on public.explore_updates (author_id, published_at desc);

drop function if exists public.list_explore_updates(integer, text, text);

create function public.list_explore_updates(
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
  left join public.users
    on users.id = explore_updates.author_id
  left join public.user_settings
    on user_settings.user_id = users.id
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

with authored_events as (
  select *
  from (
    values
      (
        '6b5357e9-d865-4fbf-9d4c-71dd4f6fc101'::uuid,
        'aarya.sharma',
        'event',
        'Frontend systems chai circle for React engineers',
        'Small in-person evening session on design tokens, component APIs, and practical strategies for keeping React UI systems maintainable across fast-moving product teams.',
        'Bengaluru, India',
        'https://lu.ma',
        'https://images.unsplash.com/photo-1515187029135-18ee286d815b?auto=format&fit=crop&w=1200&q=80',
        array['react', 'design-systems', 'frontend', 'networking']::text[],
        jsonb_build_object(
          'source_type', 'member_event',
          'cta', 'Reserve your seat',
          'format', 'in_person',
          'created_by_existing_user', true
        ),
        timezone('utc', now()) + interval '2 days 3 hours'
      ),
      (
        '6b5357e9-d865-4fbf-9d4c-71dd4f6fc102'::uuid,
        'rohan.mehta',
        'event',
        'PLG teardown breakfast for SaaS operators',
        'Roundtable for product and growth leads comparing activation experiments, onboarding drop-off fixes, and ways to instrument first-value moments without overcomplicating setup.',
        'Mumbai, India',
        'https://www.meetup.com/',
        'https://images.unsplash.com/photo-1511578314322-379afb476865?auto=format&fit=crop&w=1200&q=80',
        array['product', 'growth', 'saas', 'roundtable']::text[],
        jsonb_build_object(
          'source_type', 'member_event',
          'cta', 'Request an invite',
          'format', 'in_person',
          'created_by_existing_user', true
        ),
        timezone('utc', now()) + interval '3 days 1 hour'
      ),
      (
        '6b5357e9-d865-4fbf-9d4c-71dd4f6fc103'::uuid,
        'kavya.iyer',
        'event',
        'RAG evaluation workshop for applied ML teams',
        'Hands-on session covering retrieval debugging, reranker evaluation, and how to design review loops that actually catch hallucinations before rollout.',
        'Chennai, India',
        'https://sessionize.com/',
        'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=1200&q=80',
        array['ml', 'rag', 'evaluation', 'workshop']::text[],
        jsonb_build_object(
          'source_type', 'member_event',
          'cta', 'Join the workshop',
          'format', 'hybrid',
          'created_by_existing_user', true
        ),
        timezone('utc', now()) + interval '4 days 5 hours'
      ),
      (
        '6b5357e9-d865-4fbf-9d4c-71dd4f6fc104'::uuid,
        'sneha.reddy',
        'event',
        'Founder ops sprint for support-led SaaS teams',
        'Practical session for startup operators sharing hiring plans, support workflows, and process templates that keep customer-facing teams aligned during growth.',
        'Hyderabad, India',
        'https://lu.ma',
        'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&w=1200&q=80',
        array['founders', 'operations', 'saas', 'community']::text[],
        jsonb_build_object(
          'source_type', 'member_event',
          'cta', 'See agenda',
          'format', 'in_person',
          'created_by_existing_user', true
        ),
        timezone('utc', now()) + interval '5 days 2 hours'
      ),
      (
        '6b5357e9-d865-4fbf-9d4c-71dd4f6fc105'::uuid,
        'imran.khan',
        'event',
        'Backend reliability meetup on queues, retries, and observability',
        'Evening meetup for API and platform engineers trading notes on resilient job processing, alert fatigue, and event-driven system design in production.',
        'Pune, India',
        'https://www.eventbrite.com/',
        'https://images.unsplash.com/photo-1498050108023-c5249f4df085?auto=format&fit=crop&w=1200&q=80',
        array['backend', 'apis', 'observability', 'meetup']::text[],
        jsonb_build_object(
          'source_type', 'member_event',
          'cta', 'Save your spot',
          'format', 'in_person',
          'created_by_existing_user', true
        ),
        timezone('utc', now()) + interval '6 days 4 hours'
      )
  ) as seeded(
    id,
    author_username,
    category,
    title,
    summary,
    location,
    external_url,
    image_url,
    tags,
    raw_payload,
    published_at
  )
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
  authored_events.id,
  users.id,
  authored_events.category,
  coalesce(nullif(trim(users.full_name), ''), users.username) as source_name,
  authored_events.title,
  authored_events.summary,
  authored_events.location,
  authored_events.external_url,
  authored_events.image_url,
  authored_events.tags,
  authored_events.raw_payload || jsonb_build_object('author_username', users.username),
  authored_events.published_at
from authored_events
join public.users
  on lower(users.username) = lower(authored_events.author_username)
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

grant execute on function public.list_explore_updates(integer, text, text) to anon, authenticated;
