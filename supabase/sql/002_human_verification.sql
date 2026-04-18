drop function if exists public.login_or_create_user(text, text);
drop function if exists public.complete_user_profile(uuid, text, text, text);
drop function if exists public.get_user_auth_state(uuid);
drop function if exists public.start_human_verification(uuid, text);
drop function if exists public.complete_human_verification(uuid, text, text);
drop function if exists public.complete_human_verification(uuid, text, text, text, numeric, numeric, jsonb);
drop function if exists public.complete_human_verification(uuid, text, text, text, jsonb, numeric, numeric, jsonb);

create or replace function public.login_or_create_user(
  identifier_input text,
  password_input text
)
returns table (
  id uuid,
  username text,
  email text,
  full_name text,
  bio text,
  professional_role text,
  human_verification_status text,
  human_verification_provider text,
  human_verified_at timestamptz,
  human_verification_failure_reason text,
  created_at timestamptz,
  was_created boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized_identifier text;
  candidate_username text;
  base_username text;
  candidate_email text;
  suffix integer := 1;
  matched_user public.users%rowtype;
begin
  normalized_identifier := lower(trim(coalesce(identifier_input, '')));

  if normalized_identifier = '' then
    raise exception 'Username or email is required.';
  end if;

  if length(trim(coalesce(password_input, ''))) < 6 then
    raise exception 'Password must be at least 6 characters.';
  end if;

  select *
  into matched_user
  from public.users
  where lower(users.email) = normalized_identifier
     or lower(users.username) = normalized_identifier
  limit 1;

  if found then
    if matched_user.password_hash = extensions.crypt(password_input, matched_user.password_hash) then
      return query
      select
        matched_user.id,
        matched_user.username,
        matched_user.email,
        matched_user.full_name,
        matched_user.bio,
        matched_user.professional_role,
        matched_user.human_verification_status,
        matched_user.human_verification_provider,
        matched_user.human_verified_at,
        matched_user.human_verification_failure_reason,
        matched_user.created_at,
        false;
    end if;

    raise exception 'That account already exists, but the password is incorrect.';
  end if;

  if position('@' in normalized_identifier) > 0 then
    candidate_email := normalized_identifier;
    base_username := split_part(normalized_identifier, '@', 1);
  else
    base_username := normalized_identifier;
    candidate_email := normalized_identifier || '@luminas-user.app';
  end if;

  base_username := lower(
    regexp_replace(base_username, '[^a-zA-Z0-9._-]', '', 'g')
  );
  base_username := trim(both '._-' from base_username);

  if base_username = '' then
    base_username := 'luminasuser';
  end if;

  candidate_username := left(base_username, 24);

  while exists (
    select 1
    from public.users
    where lower(users.username) = lower(candidate_username)
       or lower(users.email) = lower(candidate_email)
  ) loop
    suffix := suffix + 1;
    candidate_username := left(base_username, greatest(24 - length(suffix::text), 1)) || suffix::text;

    if position('@' in normalized_identifier) = 0 then
      candidate_email := candidate_username || '@luminas-user.app';
    end if;
  end loop;

  insert into public.users (
    username,
    email,
    password_hash,
    full_name,
    bio,
    professional_role
  )
  values (
    candidate_username,
    candidate_email,
    extensions.crypt(password_input, extensions.gen_salt('bf')),
    null,
    null,
    null
  )
  returning * into matched_user;

  return query
  select
    matched_user.id,
    matched_user.username,
    matched_user.email,
    matched_user.full_name,
    matched_user.bio,
    matched_user.professional_role,
    matched_user.human_verification_status,
    matched_user.human_verification_provider,
    matched_user.human_verified_at,
    matched_user.human_verification_failure_reason,
    matched_user.created_at,
    true;
end;
$$;

alter table public.users
  add column if not exists human_verification_status text not null default 'required';

alter table public.users
  add column if not exists human_verification_provider text;

alter table public.users
  add column if not exists human_verification_reference text;

alter table public.users
  add column if not exists human_verification_started_at timestamptz;

alter table public.users
  add column if not exists human_verified_at timestamptz;

alter table public.users
  add column if not exists human_verification_attempts integer not null default 0;

alter table public.users
  add column if not exists human_verification_failure_reason text;

alter table public.users
  add column if not exists human_verification_face_signature_hash text;

alter table public.users
  add column if not exists human_verification_face_id text;

alter table public.users
  add column if not exists human_verification_face_vector jsonb;

alter table public.users
  add column if not exists human_verification_face_vector_version text;

alter table public.users
  add column if not exists human_verification_duplicate_user_id uuid;

alter table public.users
  add column if not exists human_verification_liveness_score numeric(4, 3);

alter table public.users
  add column if not exists human_verification_anti_spoof_score numeric(4, 3);

alter table public.users
  add column if not exists human_verification_evidence jsonb not null default '{}'::jsonb;

alter table public.users
  drop constraint if exists users_human_verification_status_check;

alter table public.users
  add constraint users_human_verification_status_check
  check (human_verification_status in ('required', 'pending', 'verified', 'failed'));

alter table public.users
  drop constraint if exists users_human_verification_duplicate_user_id_fkey;

alter table public.users
  add constraint users_human_verification_duplicate_user_id_fkey
  foreign key (human_verification_duplicate_user_id)
  references public.users (id)
  on delete set null;

create index if not exists users_human_verification_face_signature_hash_idx
  on public.users (human_verification_face_signature_hash)
  where human_verification_face_signature_hash is not null;

create unique index if not exists users_human_verification_face_id_verified_uidx
  on public.users (human_verification_face_id)
  where human_verification_face_id is not null
    and human_verification_status = 'verified';

update public.users
set
  human_verification_status = 'verified',
  human_verified_at = coalesce(
    human_verified_at,
    human_verification_started_at,
    created_at,
    timezone('utc', now())
  ),
  human_verification_failure_reason = null
where human_verification_status = 'failed'
  and human_verification_failure_reason = 'account_face_mismatch'
  and human_verification_face_id is not null
  and human_verification_face_vector is not null
  and human_verification_duplicate_user_id is null;

create or replace function public.complete_user_profile(
  user_id_input uuid,
  full_name_input text,
  bio_input text,
  professional_role_input text
)
returns table (
  id uuid,
  username text,
  email text,
  full_name text,
  bio text,
  professional_role text,
  human_verification_status text,
  human_verification_provider text,
  human_verified_at timestamptz,
  human_verification_failure_reason text,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized_full_name text;
  normalized_bio text;
  normalized_professional_role text;
  updated_user public.users%rowtype;
begin
  normalized_full_name := trim(coalesce(full_name_input, ''));
  normalized_bio := trim(coalesce(bio_input, ''));
  normalized_professional_role := trim(coalesce(professional_role_input, ''));

  if user_id_input is null then
    raise exception 'A user id is required.';
  end if;

  if normalized_full_name = '' then
    raise exception 'Full name is required.';
  end if;

  if normalized_bio = '' then
    raise exception 'Bio is required.';
  end if;

  if normalized_professional_role = '' then
    raise exception 'Professional role is required.';
  end if;

  update public.users
  set
    full_name = left(normalized_full_name, 80),
    bio = left(normalized_bio, 280),
    professional_role = left(normalized_professional_role, 40),
    human_verification_status = case
      when users.human_verification_status = 'verified' then 'verified'
      else 'required'
    end
  where users.id = user_id_input
  returning * into updated_user;

  if not found then
    raise exception 'User not found.';
  end if;

  return query
  select
    updated_user.id,
    updated_user.username,
    updated_user.email,
    updated_user.full_name,
    updated_user.bio,
    updated_user.professional_role,
    updated_user.human_verification_status,
    updated_user.human_verification_provider,
    updated_user.human_verified_at,
    updated_user.human_verification_failure_reason,
    updated_user.created_at;
end;
$$;

create or replace function public.get_user_auth_state(user_id_input uuid)
returns table (
  id uuid,
  username text,
  email text,
  full_name text,
  bio text,
  professional_role text,
  human_verification_status text,
  human_verification_provider text,
  human_verified_at timestamptz,
  human_verification_failure_reason text,
  created_at timestamptz
)
language sql
security definer
set search_path = public
as $$
  select
    users.id,
    users.username,
    users.email,
    users.full_name,
    users.bio,
    users.professional_role,
    users.human_verification_status,
    users.human_verification_provider,
    users.human_verified_at,
    users.human_verification_failure_reason,
    users.created_at
  from public.users
  where users.id = user_id_input
  limit 1;
$$;

create or replace function public.start_human_verification(
  user_id_input uuid,
  provider_input text default null
)
returns table (
  id uuid,
  username text,
  email text,
  full_name text,
  bio text,
  professional_role text,
  human_verification_status text,
  human_verification_provider text,
  human_verified_at timestamptz,
  human_verification_failure_reason text,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized_provider text;
  updated_user public.users%rowtype;
begin
  normalized_provider := nullif(left(trim(coalesce(provider_input, '')), 80), '');

  if user_id_input is null then
    raise exception 'A user id is required.';
  end if;

  update public.users
  set
    human_verification_status = case
      when users.human_verification_status = 'verified' then 'verified'
      else 'pending'
    end,
    human_verification_provider = coalesce(normalized_provider, users.human_verification_provider),
    human_verification_started_at = case
      when users.human_verification_status = 'verified' then users.human_verification_started_at
      else timezone('utc', now())
    end,
    human_verification_attempts = case
      when users.human_verification_status = 'verified' then users.human_verification_attempts
      else coalesce(users.human_verification_attempts, 0) + 1
    end,
    human_verification_failure_reason = case
      when users.human_verification_status = 'verified' then users.human_verification_failure_reason
      else null
    end,
    human_verification_duplicate_user_id = case
      when users.human_verification_status = 'verified' then users.human_verification_duplicate_user_id
      else null
    end,
    human_verification_face_signature_hash = case
      when users.human_verification_status = 'verified' then users.human_verification_face_signature_hash
      else null
    end,
    human_verification_face_id = case
      when users.human_verification_status = 'verified' then users.human_verification_face_id
      else null
    end,
    human_verification_face_vector = case
      when users.human_verification_status = 'verified' then users.human_verification_face_vector
      else null
    end,
    human_verification_face_vector_version = case
      when users.human_verification_status = 'verified' then users.human_verification_face_vector_version
      else null
    end,
    human_verification_liveness_score = case
      when users.human_verification_status = 'verified' then users.human_verification_liveness_score
      else null
    end,
    human_verification_anti_spoof_score = case
      when users.human_verification_status = 'verified' then users.human_verification_anti_spoof_score
      else null
    end,
    human_verification_evidence = case
      when users.human_verification_status = 'verified' then users.human_verification_evidence
      else '{}'::jsonb
    end
  where users.id = user_id_input
    and coalesce(trim(users.full_name), '') <> ''
  returning * into updated_user;

  if not found then
    raise exception 'Complete the user profile before starting verification.';
  end if;

  return query
  select
    updated_user.id,
    updated_user.username,
    updated_user.email,
    updated_user.full_name,
    updated_user.bio,
    updated_user.professional_role,
    updated_user.human_verification_status,
    updated_user.human_verification_provider,
    updated_user.human_verified_at,
    updated_user.human_verification_failure_reason,
    updated_user.created_at;
end;
$$;

create or replace function public.is_matching_face_identity(
  stored_face_id_input text,
  stored_face_vector_input jsonb,
  candidate_face_id_input text,
  candidate_face_vector_input jsonb
)
returns boolean
language plpgsql
immutable
as $$
declare
  stored_averages jsonb;
  candidate_averages jsonb;
  stored_length integer;
  candidate_length integer;
  stored_version text;
  candidate_version text;
  idx integer;
  stored_value numeric;
  candidate_value numeric;
  squared_distance numeric := 0;
  max_delta numeric := 0;
  cosine_dot numeric := 0;
  stored_norm numeric := 0;
  candidate_norm numeric := 0;
  euclidean_distance numeric;
  cosine_similarity numeric;
begin
  if stored_face_id_input is not null
     and candidate_face_id_input is not null
     and stored_face_id_input = candidate_face_id_input then
    return true;
  end if;

  if jsonb_typeof(stored_face_vector_input) <> 'object'
     or jsonb_typeof(candidate_face_vector_input) <> 'object' then
    return false;
  end if;

  stored_version := nullif(trim(coalesce(stored_face_vector_input ->> 'version', '')), '');
  candidate_version := nullif(trim(coalesce(candidate_face_vector_input ->> 'version', '')), '');

  if stored_version is distinct from candidate_version then
    return false;
  end if;

  stored_averages := coalesce(stored_face_vector_input -> 'averages', '[]'::jsonb);
  candidate_averages := coalesce(candidate_face_vector_input -> 'averages', '[]'::jsonb);

  if jsonb_typeof(stored_averages) <> 'array'
     or jsonb_typeof(candidate_averages) <> 'array' then
    return false;
  end if;

  stored_length := jsonb_array_length(stored_averages);
  candidate_length := jsonb_array_length(candidate_averages);

  if stored_length = 0 or candidate_length = 0 or stored_length <> candidate_length then
    return false;
  end if;

  for idx in 0..stored_length - 1 loop
    stored_value := (stored_averages ->> idx)::numeric;
    candidate_value := (candidate_averages ->> idx)::numeric;
    squared_distance := squared_distance + power(stored_value - candidate_value, 2);
    max_delta := greatest(max_delta, abs(stored_value - candidate_value));
    cosine_dot := cosine_dot + (stored_value * candidate_value);
    stored_norm := stored_norm + power(stored_value, 2);
    candidate_norm := candidate_norm + power(candidate_value, 2);
  end loop;

  euclidean_distance := sqrt(squared_distance);
  cosine_similarity := case
    when stored_norm = 0 or candidate_norm = 0 then 0
    else cosine_dot / sqrt(stored_norm * candidate_norm)
  end;

  return euclidean_distance <= 0.06
    and max_delta <= 0.035
    and cosine_similarity >= 0.999;
exception
  when invalid_text_representation then
    return false;
end;
$$;

create or replace function public.complete_human_verification(
  user_id_input uuid,
  provider_input text default null,
  reference_input text default null,
  face_id_input text default null,
  face_vector_input jsonb default null,
  liveness_score_input numeric default null,
  anti_spoof_score_input numeric default null,
  evidence_input jsonb default null
)
returns table (
  id uuid,
  username text,
  email text,
  full_name text,
  bio text,
  professional_role text,
  human_verification_status text,
  human_verification_provider text,
  human_verified_at timestamptz,
  human_verification_failure_reason text,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized_provider text;
  normalized_reference text;
  normalized_face_id text;
  normalized_face_vector jsonb;
  normalized_face_vector_version text;
  normalized_liveness_score numeric(4, 3);
  normalized_anti_spoof_score numeric(4, 3);
  normalized_evidence jsonb;
  existing_verified_user_id uuid;
  verification_user public.users%rowtype;
  current_user_verification_status text;
  current_user_face_signature_hash text;
  current_user_face_id text;
  current_user_face_vector jsonb;
  current_user_face_vector_version text;
  updated_user public.users%rowtype;
begin
  normalized_provider := nullif(left(trim(coalesce(provider_input, '')), 80), '');
  normalized_reference := nullif(left(trim(coalesce(reference_input, '')), 120), '');
  normalized_face_id := nullif(left(trim(coalesce(face_id_input, '')), 128), '');
  normalized_face_vector := coalesce(face_vector_input, '{}'::jsonb);
  normalized_face_vector_version := nullif(
    left(trim(coalesce(normalized_face_vector ->> 'version', '')), 80),
    ''
  );
  normalized_liveness_score := round(
    least(greatest(coalesce(liveness_score_input, 0), 0), 1)::numeric,
    3
  );
  normalized_anti_spoof_score := round(
    least(greatest(coalesce(anti_spoof_score_input, 0), 0), 1)::numeric,
    3
  );
  normalized_evidence := coalesce(evidence_input, '{}'::jsonb);

  if user_id_input is null then
    raise exception 'A user id is required.';
  end if;

  if normalized_face_id is null then
    raise exception 'A backend face id is required.';
  end if;

  if jsonb_typeof(normalized_face_vector) <> 'object' then
    raise exception 'A backend face vector payload is required.';
  end if;

  select *
  into verification_user
  from public.users
  where users.id = user_id_input
    and coalesce(trim(users.full_name), '') <> ''
  limit 1;

  if not found then
    raise exception 'Complete the user profile before finishing verification.';
  end if;

  current_user_verification_status := verification_user.human_verification_status;
  current_user_face_signature_hash := verification_user.human_verification_face_signature_hash;
  current_user_face_id := verification_user.human_verification_face_id;
  current_user_face_vector := verification_user.human_verification_face_vector;
  current_user_face_vector_version := verification_user.human_verification_face_vector_version;

  if normalized_liveness_score < 0.82 or normalized_anti_spoof_score < 0.80 then
    update public.users
    set
      human_verification_status = 'failed',
      human_verification_provider = coalesce(normalized_provider, users.human_verification_provider, 'manual-demo'),
      human_verification_reference = coalesce(normalized_reference, users.human_verification_reference),
      human_verification_started_at = coalesce(users.human_verification_started_at, timezone('utc', now())),
      human_verified_at = null,
      human_verification_failure_reason = 'anti_spoof_failed',
      human_verification_duplicate_user_id = null,
      human_verification_face_signature_hash = case
        when current_user_verification_status = 'verified'
          then current_user_face_signature_hash
        else normalized_face_id
      end,
      human_verification_face_id = case
        when current_user_verification_status = 'verified'
          then current_user_face_id
        else normalized_face_id
      end,
      human_verification_face_vector = case
        when current_user_verification_status = 'verified'
          then current_user_face_vector
        else normalized_face_vector
      end,
      human_verification_face_vector_version = case
        when current_user_verification_status = 'verified'
          then current_user_face_vector_version
        else normalized_face_vector_version
      end,
      human_verification_liveness_score = normalized_liveness_score,
      human_verification_anti_spoof_score = normalized_anti_spoof_score,
      human_verification_evidence = normalized_evidence
    where users.id = user_id_input
      and coalesce(trim(users.full_name), '') <> ''
    returning * into updated_user;

    if not found then
      raise exception 'Complete the user profile before finishing verification.';
    end if;

    raise exception 'Face verification failed. Use your real uncovered face and try again.';
  end if;

  if current_user_verification_status = 'verified'
     and current_user_face_id is not null
     and current_user_face_vector is not null
     and not public.is_matching_face_identity(
       current_user_face_id,
       current_user_face_vector,
       normalized_face_id,
       normalized_face_vector
     ) then
    raise exception 'Face verification failed. This face does not match the verified owner of this account.';
  end if;

  select users.id
  into existing_verified_user_id
  from public.users
  where users.id <> user_id_input
    and users.human_verification_status = 'verified'
    and users.human_verification_face_id = normalized_face_id
  limit 1;

  if existing_verified_user_id is not null then
    update public.users
    set
      human_verification_status = 'failed',
      human_verification_provider = coalesce(normalized_provider, users.human_verification_provider, 'manual-demo'),
      human_verification_reference = coalesce(normalized_reference, users.human_verification_reference),
      human_verification_started_at = coalesce(users.human_verification_started_at, timezone('utc', now())),
      human_verified_at = null,
      human_verification_failure_reason = 'duplicate_identity_detected',
      human_verification_duplicate_user_id = existing_verified_user_id,
      human_verification_face_signature_hash = case
        when current_user_verification_status = 'verified'
          then current_user_face_signature_hash
        else normalized_face_id
      end,
      human_verification_face_id = case
        when current_user_verification_status = 'verified'
          then current_user_face_id
        else normalized_face_id
      end,
      human_verification_face_vector = case
        when current_user_verification_status = 'verified'
          then current_user_face_vector
        else normalized_face_vector
      end,
      human_verification_face_vector_version = case
        when current_user_verification_status = 'verified'
          then current_user_face_vector_version
        else normalized_face_vector_version
      end,
      human_verification_liveness_score = normalized_liveness_score,
      human_verification_anti_spoof_score = normalized_anti_spoof_score,
      human_verification_evidence = normalized_evidence
    where users.id = user_id_input
      and coalesce(trim(users.full_name), '') <> ''
    returning * into updated_user;

    if not found then
      raise exception 'Complete the user profile before finishing verification.';
    end if;

    raise exception 'This face appears to already be verified on another account.';
  end if;

  update public.users
  set
    human_verification_status = 'verified',
    human_verification_provider = coalesce(normalized_provider, users.human_verification_provider, 'manual-demo'),
    human_verification_reference = coalesce(normalized_reference, users.human_verification_reference),
    human_verification_started_at = coalesce(users.human_verification_started_at, timezone('utc', now())),
    human_verified_at = timezone('utc', now()),
    human_verification_failure_reason = null,
    human_verification_duplicate_user_id = null,
    human_verification_face_signature_hash = normalized_face_id,
    human_verification_face_id = normalized_face_id,
    human_verification_face_vector = normalized_face_vector,
    human_verification_face_vector_version = normalized_face_vector_version,
    human_verification_liveness_score = normalized_liveness_score,
    human_verification_anti_spoof_score = normalized_anti_spoof_score,
    human_verification_evidence = normalized_evidence
  where users.id = user_id_input
    and coalesce(trim(users.full_name), '') <> ''
  returning * into updated_user;

  if not found then
    raise exception 'Complete the user profile before finishing verification.';
  end if;

  return query
  select
    updated_user.id,
    updated_user.username,
    updated_user.email,
    updated_user.full_name,
    updated_user.bio,
    updated_user.professional_role,
    updated_user.human_verification_status,
    updated_user.human_verification_provider,
    updated_user.human_verified_at,
    updated_user.human_verification_failure_reason,
    updated_user.created_at;
end;
$$;

create or replace function public.complete_human_verification(
  user_id_input uuid,
  provider_input text default null,
  reference_input text default null,
  face_signature_input text default null,
  liveness_score_input numeric default null,
  anti_spoof_score_input numeric default null,
  evidence_input jsonb default null
)
returns table (
  id uuid,
  username text,
  email text,
  full_name text,
  bio text,
  professional_role text,
  human_verification_status text,
  human_verification_provider text,
  human_verified_at timestamptz,
  human_verification_failure_reason text,
  created_at timestamptz
)
language sql
security definer
set search_path = public
as $$
  select *
  from public.complete_human_verification(
    user_id_input,
    provider_input,
    reference_input,
    face_signature_input,
    jsonb_build_object(
      'legacy_face_signature_hash', face_signature_input,
      'source', 'legacy-client-signature',
      'version', 'legacy-client-signature'
    ),
    liveness_score_input,
    anti_spoof_score_input,
    coalesce(evidence_input, '{}'::jsonb)
  );
$$;

grant execute on function public.get_user_auth_state(uuid) to anon, authenticated;
grant execute on function public.start_human_verification(uuid, text) to anon, authenticated;
grant execute on function public.complete_human_verification(uuid, text, text, text, numeric, numeric, jsonb) to anon, authenticated;
grant execute on function public.complete_human_verification(uuid, text, text, text, jsonb, numeric, numeric, jsonb) to anon, authenticated;
