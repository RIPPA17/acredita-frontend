create or replace function private.guard_public_request_abuse()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  normalized_email text;
  recent_count integer;
begin
  normalized_email := lower(btrim(
    case
      when TG_TABLE_NAME = 'access_requests' then to_jsonb(NEW)->>'email'
      when TG_TABLE_NAME = 'privacy_requests' then to_jsonb(NEW)->>'requester_email'
      else null
    end
  ));

  if normalized_email is null or normalized_email = '' or char_length(normalized_email) > 320
     or normalized_email !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$' then
    raise exception using errcode = '22023', message = 'Correo inválido.';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(TG_TABLE_NAME || ':' || normalized_email, 0)
  );

  if TG_TABLE_NAME = 'access_requests' then
    if char_length(btrim(coalesce(to_jsonb(NEW)->>'full_name',''))) not between 2 and 120
       or char_length(btrim(coalesce(to_jsonb(NEW)->>'company_name',''))) not between 2 and 180
       or char_length(coalesce(to_jsonb(NEW)->>'rut','')) > 32
       or char_length(coalesce(to_jsonb(NEW)->>'industry','')) > 80
       or char_length(coalesce(to_jsonb(NEW)->>'phone','')) > 40
       or char_length(coalesce(to_jsonb(NEW)->>'message','')) > 4000 then
      raise exception using errcode = '22023', message = 'La solicitud contiene campos inválidos o demasiado extensos.';
    end if;

    select count(*) into recent_count
      from public.access_requests
     where lower(btrim(email)) = normalized_email
       and created_at >= pg_catalog.now() - interval '1 hour';

    if recent_count >= 3 then
      raise exception using errcode = 'P0001', message = 'Demasiadas solicitudes recientes. Intenta nuevamente más tarde.';
    end if;

    NEW.email := normalized_email;
  elsif TG_TABLE_NAME = 'privacy_requests' then
    if char_length(btrim(coalesce(to_jsonb(NEW)->>'requester_name',''))) not between 2 and 200
       or char_length(btrim(coalesce(to_jsonb(NEW)->>'scope',''))) not between 2 and 1500
       or char_length(coalesce(to_jsonb(NEW)->>'details','')) > 5000 then
      raise exception using errcode = '22023', message = 'La solicitud contiene campos inválidos o demasiado extensos.';
    end if;

    select count(*) into recent_count
      from public.privacy_requests
     where lower(btrim(requester_email)) = normalized_email
       and created_at >= pg_catalog.now() - interval '1 day';

    if recent_count >= 10 then
      raise exception using errcode = 'P0001', message = 'Demasiadas solicitudes recientes. Intenta nuevamente más tarde.';
    end if;

    NEW.requester_email := normalized_email;
  end if;

  return NEW;
end;
$$;

revoke all on function private.guard_public_request_abuse() from public, anon, authenticated;
grant execute on function private.guard_public_request_abuse() to postgres, service_role;

drop trigger if exists access_requests_public_abuse_guard on public.access_requests;
create trigger access_requests_public_abuse_guard
before insert on public.access_requests
for each row execute function private.guard_public_request_abuse();

drop trigger if exists privacy_requests_public_abuse_guard on public.privacy_requests;
create trigger privacy_requests_public_abuse_guard
before insert on public.privacy_requests
for each row execute function private.guard_public_request_abuse();
