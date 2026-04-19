drop function if exists public.create_authored_event(uuid, text, text, text, text, text, text, text[], timestamptz);

create or replace function public.create_authored_event(
  author_id_input uuid,
  source_name_input text,
  title_input text,
  summary_input text,
  location_input text,
  external_url_input text default null,
  image_url_input text default null,
  tags_input text[] default '{}'::text[],
  published_at_input timestamptz default null
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
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized_source_name text;
  normalized_title text;
  normalized_summary text;
  normalized_location text;
  normalized_external_url text;
  normalized_image_url text;
  normalized_tags text[];
  normalized_published_at timestamptz;
begin
  if author_id_input is null then
    raise exception 'A user id is required.';
  end if;

  normalized_source_name := left(trim(coalesce(source_name_input, '')), 80);
  normalized_title := left(trim(coalesce(title_input, '')), 140);
  normalized_summary := left(trim(coalesce(summary_input, '')), 1000);
  normalized_location := left(trim(coalesce(location_input, '')), 120);
  normalized_external_url := nullif(trim(coalesce(external_url_input, '')), '');
  normalized_image_url := nullif(trim(coalesce(image_url_input, '')), '');
  normalized_published_at := published_at_input;

  normalized_tags := coalesce(
    (
      select array_agg(tag order by ord)
      from (
        select
          deduped_tags.tag,
          deduped_tags.ord
        from (
          select distinct on (lower(tag))
            tag,
            ord
          from (
            select
              left(trim(leading '#' from coalesce(raw_tag, '')), 40) as tag,
              ord
            from unnest(coalesce(tags_input, '{}'::text[])) with ordinality as input_tags(raw_tag, ord)
          ) trimmed_tags
          where tag <> ''
          order by lower(tag), ord
        ) deduped_tags
        order by deduped_tags.ord
        limit 8
      ) limited_tags
    ),
    '{}'::text[]
  );

  if normalized_source_name = '' then
    raise exception 'Add the host, club, company, or organizer name.';
  end if;

  if normalized_title = '' then
    raise exception 'Add an event title.';
  end if;

  if normalized_summary = '' then
    raise exception 'Add a short summary so people know what to expect.';
  end if;

  if normalized_location = '' then
    raise exception 'Add the event location.';
  end if;

  if normalized_published_at is null then
    raise exception 'Choose a valid start date and time.';
  end if;

  if not exists (
    select 1
    from public.users
    left join public.user_settings
      on user_settings.user_id = users.id
    where users.id = author_id_input
      and users.human_verification_status = 'verified'
      and coalesce(user_settings.is_professional_account, false)
  ) then
    raise exception 'Only verified profiles can create events.';
  end if;

  return query
  with inserted_event as (
    insert into public.explore_updates (
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
    values (
      author_id_input,
      'event',
      normalized_source_name,
      normalized_title,
      normalized_summary,
      normalized_location,
      normalized_external_url,
      normalized_image_url,
      normalized_tags,
      jsonb_build_object(
        'source_type', 'member_event',
        'cta', 'View event',
        'format', case when lower(normalized_location) = 'remote' then 'remote' else 'in_person' end,
        'created_by_existing_user', true
      ),
      normalized_published_at
    )
    returning
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
      explore_updates.author_id
  )
  select
    inserted_event.id,
    inserted_event.category,
    inserted_event.source_name,
    inserted_event.title,
    inserted_event.summary,
    inserted_event.location,
    inserted_event.external_url,
    inserted_event.image_url,
    inserted_event.tags,
    inserted_event.raw_payload || jsonb_build_object('author_username', users.username),
    inserted_event.published_at,
    inserted_event.created_at,
    inserted_event.author_id,
    users.username as author_username,
    users.full_name as author_full_name,
    users.professional_role as author_professional_role,
    user_settings.profile_photo_url as author_profile_photo_url,
    (
      users.human_verification_status = 'verified'
      and coalesce(user_settings.is_professional_account, false)
    ) as author_is_verified
  from inserted_event
  join public.users
    on users.id = inserted_event.author_id
  left join public.user_settings
    on user_settings.user_id = inserted_event.author_id;
end;
$$;

grant execute on function public.create_authored_event(uuid, text, text, text, text, text, text, text[], timestamptz) to anon, authenticated;
