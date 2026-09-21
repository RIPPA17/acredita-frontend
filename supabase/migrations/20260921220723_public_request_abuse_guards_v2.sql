drop trigger if exists access_requests_public_abuse_guard on public.access_requests;
drop trigger if exists privacy_requests_public_abuse_guard on public.privacy_requests;
drop function if exists private.guard_public_request_abuse();

create or replace function private.guard_access_request_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  recent_count integer;
begin
  new.full_name := pg_catalog.btrim(new.full_name);
  new.company_name := pg_catalog.btrim(new.company_name);
  new.email := pg_catalog.lower(pg_catalog.btrim(new.email));
  new.rut := pg_catalog.nullif(pg_catalog.btrim(pg_catalog.coalesce(new.rut, '')), '');
  new.industry := pg_catalog.nullif(pg_catalog.btrim(pg_catalog.coalesce(new.industry, '')), '');
  new.phone := pg_catalog.nullif(pg_catalog.btrim(pg_catalog.coalesce(new.phone, '')), '');
  new.company_size := pg_catalog.nullif(pg_catalog.btrim(pg_catalog.coalesce(new.company_size, '')), '');
  new.message := pg_catalog.nullif(pg_catalog.btrim(pg_catalog.coalesce(new.message, '')), '');

  if new.email !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$' then
    raise exception using errcode = '22023', message = 'Ingresa un correo válido.';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('access_requests:' || new.email, 0)
  );

  if exists (
    select 1
    from public.access_requests ar
    where pg_catalog.lower(ar.email) = new.email
      and ar.requested_role = new.requested_role
      and ar.request_type = new.request_type
      and ar.status in ('pending', 'contacted')
      and ar.created_at >= pg_catalog.now() - interval '7 days'
  ) then
    raise exception using errcode = 'P0001', message = 'Ya recibimos una solicitud reciente para este correo. Nuestro equipo la revisará antes de registrar otra.';
  end if;

  select count(*) into recent_count
  from public.access_requests ar
  where pg_catalog.lower(ar.email) = new.email
    and ar.created_at >= pg_catalog.now() - interval '24 hours';

  if recent_count >= 5 then
    raise exception using errcode = 'P0001', message = 'Alcanzaste el límite de solicitudes para este correo. Intenta nuevamente más adelante.';
  end if;

  return new;
end;
$$;

revoke all on function private.guard_access_request_insert() from public, anon, authenticated;
grant execute on function private.guard_access_request_insert() to postgres, service_role;

create or replace function private.guard_privacy_request_abuse()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  normalized_email text;
  recent_count integer;
begin
  normalized_email := pg_catalog.lower(pg_catalog.btrim(new.requester_email));

  if normalized_email = '' or pg_catalog.char_length(normalized_email) > 320
     or normalized_email !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$' then
    raise exception using errcode = '22023', message = 'Correo inválido.';
  end if;

  if pg_catalog.char_length(pg_catalog.btrim(new.requester_name)) not between 2 and 200
     or pg_catalog.char_length(pg_catalog.btrim(new.scope)) not between 2 and 1500
     or pg_catalog.char_length(pg_catalog.coalesce(new.details,'')) > 5000 then
    raise exception using errcode = '22023', message = 'La solicitud contiene campos inválidos o demasiado extensos.';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('privacy_requests:' || normalized_email, 0)
  );

  select count(*) into recent_count
  from public.privacy_requests pr
  where pg_catalog.lower(pg_catalog.btrim(pr.requester_email)) = normalized_email
    and pr.created_at >= pg_catalog.now() - interval '1 day';

  if recent_count >= 10 then
    raise exception using errcode = 'P0001', message = 'Demasiadas solicitudes recientes. Intenta nuevamente más tarde.';
  end if;

  new.requester_email := normalized_email;
  return new;
end;
$$;

revoke all on function private.guard_privacy_request_abuse() from public, anon, authenticated;
grant execute on function private.guard_privacy_request_abuse() to postgres, service_role;

create trigger privacy_requests_public_abuse_guard
before insert on public.privacy_requests
for each row execute function private.guard_privacy_request_abuse();
