drop function if exists public.create_skill_post(uuid, text, text, jsonb);
drop function if exists public.create_skill_post(uuid, text, text);
drop function if exists public.list_skill_posts(integer);
drop function if exists public.list_skill_posts_by_username(text, integer);
create or replace function public.is_valid_skill_post_media_items(media_items_input jsonb)
returns boolean
language sql
immutable
as $$
  select
    jsonb_typeof(coalesce(media_items_input, '[]'::jsonb)) = 'array'
    and jsonb_array_length(coalesce(media_items_input, '[]'::jsonb)) <= 4
    and not exists (
      select 1
      from jsonb_array_elements(coalesce(media_items_input, '[]'::jsonb)) as media_item
      where jsonb_typeof(media_item) <> 'object'
        or trim(coalesce(media_item ->> 'kind', '')) not in ('image', 'video')
        or trim(coalesce(media_item ->> 'url', '')) = ''
        or length(coalesce(media_item ->> 'url', '')) > 4000000
    );
$$;

create table if not exists public.skill_posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.users (id) on delete cascade,
  skilled_domain text not null,
  content text not null default '',
  media_items jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  constraint skill_posts_skilled_domain_length_check
    check (length(trim(skilled_domain)) between 1 and 60),
  constraint skill_posts_content_length_check
    check (length(trim(content)) <= 1000),
  constraint skill_posts_content_or_media_check
    check (length(trim(content)) >= 1 or jsonb_array_length(media_items) > 0),
  constraint skill_posts_media_items_valid_check
    check (public.is_valid_skill_post_media_items(media_items))
);

alter table if exists public.skill_posts
  alter column content set default '';

alter table if exists public.skill_posts
  add column if not exists media_items jsonb not null default '[]'::jsonb;

alter table if exists public.skill_posts
  drop constraint if exists skill_posts_content_length_check;

alter table if exists public.skill_posts
  add constraint skill_posts_content_length_check
  check (length(trim(content)) <= 1000);

alter table if exists public.skill_posts
  drop constraint if exists skill_posts_content_or_media_check;

alter table if exists public.skill_posts
  add constraint skill_posts_content_or_media_check
  check (length(trim(content)) >= 1 or jsonb_array_length(media_items) > 0);

alter table if exists public.skill_posts
  drop constraint if exists skill_posts_media_items_valid_check;

alter table if exists public.skill_posts
  add constraint skill_posts_media_items_valid_check
  check (public.is_valid_skill_post_media_items(media_items));

create index if not exists skill_posts_author_created_at_idx
  on public.skill_posts (author_id, created_at desc);

create index if not exists skill_posts_created_at_idx
  on public.skill_posts (created_at desc);

create or replace function public.create_skill_post(
  author_id_input uuid,
  skilled_domain_input text,
  content_input text,
  media_items_input jsonb default '[]'::jsonb
)
returns table (
  id uuid,
  author_id uuid,
  skilled_domain text,
  content text,
  media_items jsonb,
  created_at timestamptz,
  author_username text,
  author_full_name text,
  author_professional_role text,
  author_profile_photo_url text,
  author_is_verified boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized_skilled_domain text;
  normalized_content text;
  normalized_media_items jsonb;
begin
  if author_id_input is null then
    raise exception 'A user id is required.';
  end if;

  normalized_skilled_domain := left(trim(coalesce(skilled_domain_input, '')), 60);
  normalized_content := left(trim(coalesce(content_input, '')), 1000);
  normalized_media_items := coalesce(
    (
      select jsonb_agg(
        jsonb_build_object(
          'kind', trim(media_item ->> 'kind'),
          'url', trim(media_item ->> 'url')
        )
        order by ord
      )
      from (
        select media_item, ord
        from jsonb_array_elements(coalesce(media_items_input, '[]'::jsonb)) with ordinality as media_list(media_item, ord)
        where jsonb_typeof(media_item) = 'object'
          and trim(coalesce(media_item ->> 'kind', '')) in ('image', 'video')
          and trim(coalesce(media_item ->> 'url', '')) <> ''
        order by ord
        limit 4
      ) normalized_media
    ),
    '[]'::jsonb
  );

  if normalized_skilled_domain = '' then
    raise exception 'Choose one of your saved skills before posting.';
  end if;

  if not public.is_valid_skill_post_media_items(coalesce(media_items_input, '[]'::jsonb)) then
    raise exception 'Attach up to 4 images or videos per post.';
  end if;

  if normalized_content = '' and jsonb_array_length(normalized_media_items) = 0 then
    raise exception 'Write something or attach media before posting.';
  end if;

  if not exists (
    select 1
    from public.users
    where users.id = author_id_input
  ) then
    raise exception 'User not found.';
  end if;

  if not exists (
    select 1
    from public.user_settings
    where user_settings.user_id = author_id_input
      and normalized_skilled_domain = any(user_settings.skilled_domains)
  ) then
    raise exception 'You can only post skills saved on your profile.';
  end if;

  return query
  with inserted_post as (
    insert into public.skill_posts (
      author_id,
      skilled_domain,
      content,
      media_items
    )
    values (
      author_id_input,
      normalized_skilled_domain,
      normalized_content,
      normalized_media_items
    )
    returning
      skill_posts.id,
      skill_posts.author_id,
      skill_posts.skilled_domain,
      skill_posts.content,
      skill_posts.media_items,
      skill_posts.created_at
  )
  select
    inserted_post.id,
    inserted_post.author_id,
    inserted_post.skilled_domain,
    inserted_post.content,
    inserted_post.media_items,
    inserted_post.created_at,
    users.username as author_username,
    users.full_name as author_full_name,
    users.professional_role as author_professional_role,
    user_settings.profile_photo_url as author_profile_photo_url,
    (
      users.human_verification_status = 'verified'
      and coalesce(user_settings.is_professional_account, false)
    ) as author_is_verified
  from inserted_post
  join public.users
    on users.id = inserted_post.author_id
  left join public.user_settings
    on user_settings.user_id = inserted_post.author_id;
end;
$$;

create or replace function public.list_skill_posts(limit_count integer default 20)
returns table (
  id uuid,
  author_id uuid,
  skilled_domain text,
  content text,
  media_items jsonb,
  created_at timestamptz,
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
    skill_posts.id,
    skill_posts.author_id,
    skill_posts.skilled_domain,
    skill_posts.content,
    skill_posts.media_items,
    skill_posts.created_at,
    users.username as author_username,
    users.full_name as author_full_name,
    users.professional_role as author_professional_role,
    user_settings.profile_photo_url as author_profile_photo_url,
    (
      users.human_verification_status = 'verified'
      and coalesce(user_settings.is_professional_account, false)
    ) as author_is_verified
  from public.skill_posts
  join public.users
    on users.id = skill_posts.author_id
  left join public.user_settings
    on user_settings.user_id = skill_posts.author_id
  order by skill_posts.created_at desc
  limit greatest(limit_count, 1);
$$;

create or replace function public.list_skill_posts_by_username(
  username_input text,
  limit_count integer default 20
)
returns table (
  id uuid,
  author_id uuid,
  skilled_domain text,
  content text,
  media_items jsonb,
  created_at timestamptz,
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
    skill_posts.id,
    skill_posts.author_id,
    skill_posts.skilled_domain,
    skill_posts.content,
    skill_posts.media_items,
    skill_posts.created_at,
    users.username as author_username,
    users.full_name as author_full_name,
    users.professional_role as author_professional_role,
    user_settings.profile_photo_url as author_profile_photo_url,
    (
      users.human_verification_status = 'verified'
      and coalesce(user_settings.is_professional_account, false)
    ) as author_is_verified
  from public.skill_posts
  join public.users
    on users.id = skill_posts.author_id
  left join public.user_settings
    on user_settings.user_id = skill_posts.author_id
  where lower(users.username) = lower(trim(coalesce(username_input, '')))
  order by skill_posts.created_at desc
  limit greatest(limit_count, 1);
$$;

alter table public.skill_posts enable row level security;

revoke all on public.skill_posts from anon, authenticated;

grant execute on function public.create_skill_post(uuid, text, text, jsonb) to anon, authenticated;
grant execute on function public.list_skill_posts(integer) to anon, authenticated;
grant execute on function public.list_skill_posts_by_username(text, integer) to anon, authenticated;

comment on table public.skill_posts is
  'Skill-based posts created by users from the domains saved in their profile settings, with optional image and video attachments.';
