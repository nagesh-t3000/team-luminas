drop function if exists public.list_skill_posts(integer, uuid);
drop function if exists public.list_skill_posts(integer);
drop function if exists public.list_skill_posts_by_username(text, integer, uuid);
drop function if exists public.list_skill_posts_by_username(text, integer);
drop function if exists public.toggle_skill_post_like(uuid, uuid);
drop function if exists public.list_skill_post_comments(uuid, integer);
drop function if exists public.create_skill_post_comment(uuid, uuid, text);

create table if not exists public.skill_post_likes (
  post_id uuid not null references public.skill_posts (id) on delete cascade,
  user_id uuid not null references public.users (id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  primary key (post_id, user_id)
);

create table if not exists public.skill_post_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.skill_posts (id) on delete cascade,
  author_id uuid not null references public.users (id) on delete cascade,
  content text not null,
  created_at timestamptz not null default timezone('utc', now()),
  constraint skill_post_comments_content_length_check
    check (length(trim(content)) between 1 and 500)
);

create index if not exists skill_post_likes_user_created_at_idx
  on public.skill_post_likes (user_id, created_at desc);

create index if not exists skill_post_comments_post_created_at_idx
  on public.skill_post_comments (post_id, created_at asc);

create index if not exists skill_post_comments_author_created_at_idx
  on public.skill_post_comments (author_id, created_at desc);

create or replace function public.list_skill_posts(
  limit_count integer default 20,
  viewer_id_input uuid default null
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
  author_is_verified boolean,
  like_count bigint,
  comment_count bigint,
  viewer_has_liked boolean
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
    ) as author_is_verified,
    (
      select count(*)::bigint
      from public.skill_post_likes
      where skill_post_likes.post_id = skill_posts.id
    ) as like_count,
    (
      select count(*)::bigint
      from public.skill_post_comments
      where skill_post_comments.post_id = skill_posts.id
    ) as comment_count,
    exists(
      select 1
      from public.skill_post_likes
      where skill_post_likes.post_id = skill_posts.id
        and skill_post_likes.user_id = viewer_id_input
    ) as viewer_has_liked
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
  limit_count integer default 20,
  viewer_id_input uuid default null
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
  author_is_verified boolean,
  like_count bigint,
  comment_count bigint,
  viewer_has_liked boolean
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
    ) as author_is_verified,
    (
      select count(*)::bigint
      from public.skill_post_likes
      where skill_post_likes.post_id = skill_posts.id
    ) as like_count,
    (
      select count(*)::bigint
      from public.skill_post_comments
      where skill_post_comments.post_id = skill_posts.id
    ) as comment_count,
    exists(
      select 1
      from public.skill_post_likes
      where skill_post_likes.post_id = skill_posts.id
        and skill_post_likes.user_id = viewer_id_input
    ) as viewer_has_liked
  from public.skill_posts
  join public.users
    on users.id = skill_posts.author_id
  left join public.user_settings
    on user_settings.user_id = skill_posts.author_id
  where lower(users.username) = lower(trim(coalesce(username_input, '')))
  order by skill_posts.created_at desc
  limit greatest(limit_count, 1);
$$;

create or replace function public.toggle_skill_post_like(
  post_id_input uuid,
  user_id_input uuid
)
returns table (
  post_id uuid,
  like_count bigint,
  viewer_has_liked boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  like_already_exists boolean;
  next_has_liked boolean;
begin
  if post_id_input is null then
    raise exception 'A post id is required.';
  end if;

  if user_id_input is null then
    raise exception 'A user id is required.';
  end if;

  if not exists (
    select 1
    from public.skill_posts
    where skill_posts.id = post_id_input
  ) then
    raise exception 'Skill post not found.';
  end if;

  if not exists (
    select 1
    from public.users
    where users.id = user_id_input
  ) then
    raise exception 'User not found.';
  end if;

  select exists(
    select 1
    from public.skill_post_likes
    where skill_post_likes.post_id = post_id_input
      and skill_post_likes.user_id = user_id_input
  )
  into like_already_exists;

  if like_already_exists then
    delete from public.skill_post_likes
    where skill_post_likes.post_id = post_id_input
      and skill_post_likes.user_id = user_id_input;

    next_has_liked := false;
  else
    insert into public.skill_post_likes (post_id, user_id)
    values (post_id_input, user_id_input)
    on conflict do nothing;

    next_has_liked := true;
  end if;

  return query
  select
    post_id_input,
    (
      select count(*)::bigint
      from public.skill_post_likes
      where skill_post_likes.post_id = post_id_input
    ) as like_count,
    next_has_liked as viewer_has_liked;
end;
$$;

create or replace function public.list_skill_post_comments(
  post_id_input uuid,
  limit_count integer default 40
)
returns table (
  id uuid,
  post_id uuid,
  author_id uuid,
  content text,
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
    skill_post_comments.id,
    skill_post_comments.post_id,
    skill_post_comments.author_id,
    skill_post_comments.content,
    skill_post_comments.created_at,
    users.username as author_username,
    users.full_name as author_full_name,
    users.professional_role as author_professional_role,
    user_settings.profile_photo_url as author_profile_photo_url,
    (
      users.human_verification_status = 'verified'
      and coalesce(user_settings.is_professional_account, false)
    ) as author_is_verified
  from public.skill_post_comments
  join public.users
    on users.id = skill_post_comments.author_id
  left join public.user_settings
    on user_settings.user_id = skill_post_comments.author_id
  where skill_post_comments.post_id = post_id_input
  order by skill_post_comments.created_at asc
  limit greatest(limit_count, 1);
$$;

create or replace function public.create_skill_post_comment(
  post_id_input uuid,
  author_id_input uuid,
  content_input text
)
returns table (
  id uuid,
  post_id uuid,
  author_id uuid,
  content text,
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
  normalized_content text;
begin
  if post_id_input is null then
    raise exception 'A post id is required.';
  end if;

  if author_id_input is null then
    raise exception 'A user id is required.';
  end if;

  normalized_content := left(trim(coalesce(content_input, '')), 500);

  if normalized_content = '' then
    raise exception 'Write a comment before posting.';
  end if;

  if not exists (
    select 1
    from public.skill_posts
    where skill_posts.id = post_id_input
  ) then
    raise exception 'Skill post not found.';
  end if;

  if not exists (
    select 1
    from public.users
    where users.id = author_id_input
  ) then
    raise exception 'User not found.';
  end if;

  return query
  with inserted_comment as (
    insert into public.skill_post_comments (
      post_id,
      author_id,
      content
    )
    values (
      post_id_input,
      author_id_input,
      normalized_content
    )
    returning
      skill_post_comments.id,
      skill_post_comments.post_id,
      skill_post_comments.author_id,
      skill_post_comments.content,
      skill_post_comments.created_at
  )
  select
    inserted_comment.id,
    inserted_comment.post_id,
    inserted_comment.author_id,
    inserted_comment.content,
    inserted_comment.created_at,
    users.username as author_username,
    users.full_name as author_full_name,
    users.professional_role as author_professional_role,
    user_settings.profile_photo_url as author_profile_photo_url,
    (
      users.human_verification_status = 'verified'
      and coalesce(user_settings.is_professional_account, false)
    ) as author_is_verified
  from inserted_comment
  join public.users
    on users.id = inserted_comment.author_id
  left join public.user_settings
    on user_settings.user_id = inserted_comment.author_id;
end;
$$;

alter table public.skill_post_likes enable row level security;
alter table public.skill_post_comments enable row level security;

revoke all on public.skill_post_likes from anon, authenticated;
revoke all on public.skill_post_comments from anon, authenticated;

grant execute on function public.list_skill_posts(integer, uuid) to anon, authenticated;
grant execute on function public.list_skill_posts_by_username(text, integer, uuid) to anon, authenticated;
grant execute on function public.toggle_skill_post_like(uuid, uuid) to anon, authenticated;
grant execute on function public.list_skill_post_comments(uuid, integer) to anon, authenticated;
grant execute on function public.create_skill_post_comment(uuid, uuid, text) to anon, authenticated;

comment on table public.skill_post_likes is
  'Per-user likes recorded against skill posts.';

comment on table public.skill_post_comments is
  'Threaded text comments left on skill posts.';
