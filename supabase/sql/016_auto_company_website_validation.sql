drop function if exists public.apply_company_website_verification_result(uuid, text, text, text, timestamptz);

create or replace function public.apply_company_website_verification_result(
  user_id_input uuid,
  company_verification_website_url_input text,
  company_verification_status_input text,
  company_verification_review_notes_input text default null,
  company_verified_at_input timestamptz default null
)
returns table (
  company_verification_status text,
  company_verification_website_url text,
  company_verification_review_notes text,
  company_verified_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized_company_verification_website_url text;
  normalized_company_verification_status text;
  normalized_company_verification_review_notes text;
begin
  if user_id_input is null then
    raise exception 'A user id is required.';
  end if;

  if not exists (
    select 1
    from public.users
    where users.id = user_id_input
  ) then
    raise exception 'User not found.';
  end if;

  normalized_company_verification_website_url := nullif(
    left(trim(coalesce(company_verification_website_url_input, '')), 300),
    ''
  );

  if normalized_company_verification_website_url is null then
    raise exception 'A company website URL is required.';
  end if;

  normalized_company_verification_status := lower(trim(coalesce(company_verification_status_input, '')));

  if normalized_company_verification_status not in ('approved', 'rejected', 'pending') then
    raise exception 'Company verification status must be approved, rejected, or pending.';
  end if;

  normalized_company_verification_review_notes := nullif(
    left(trim(coalesce(company_verification_review_notes_input, '')), 1200),
    ''
  );

  return query
  update public.users
  set
    company_verification_status = normalized_company_verification_status,
    company_verification_website_url = normalized_company_verification_website_url,
    company_verification_review_notes = normalized_company_verification_review_notes,
    company_verified_at = case
      when normalized_company_verification_status = 'approved'
        then coalesce(company_verified_at_input, now())
      else null
    end
  where users.id = user_id_input
  returning
    users.company_verification_status,
    users.company_verification_website_url,
    users.company_verification_review_notes,
    users.company_verified_at;
end;
$$;

grant execute on function public.apply_company_website_verification_result(uuid, text, text, text, timestamptz)
to anon, authenticated;
