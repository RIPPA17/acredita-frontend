create or replace function private.guard_access_request_insert()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  recent_count integer;
begin
  new.full_name := btrim(new.full_name);
  new.company_name := btrim(new.company_name);
  new.email := lower(btrim(new.email));
  new.rut := nullif(btrim(coalesce(new.rut, '')), '');
  new.industry := nullif(btrim(coalesce(new.industry, '')), '');
  new.phone := nullif(btrim(coalesce(new.phone, '')), '');
  new.company_size := nullif(btrim(coalesce(new.company_size, '')), '');
  new.message := nullif(btrim(coalesce(new.message, '')), '');

  if new.email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    raise exception using errcode = '22023', message = 'Ingresa un correo válido.';
  end if;
  if new.rut is not null and char_length(new.rut) > 24 then
    raise exception using errcode = '22023', message = 'El RUT supera el largo permitido.';
  end if;
  if new.industry is not null and char_length(new.industry) > 120 then
    raise exception using errcode = '22023', message = 'La industria o rubro supera el largo permitido.';
  end if;
  if new.phone is not null and char_length(new.phone) > 50 then
    raise exception using errcode = '22023', message = 'El teléfono supera el largo permitido.';
  end if;

  if exists (
    select 1
    from public.access_requests ar
    where lower(ar.email) = new.email
      and ar.requested_role = new.requested_role
      and ar.request_type = new.request_type
      and ar.status in ('pending', 'contacted')
      and ar.created_at >= now() - interval '7 days'
  ) then
    raise exception using errcode = 'P0001', message = 'Ya recibimos una solicitud reciente para este correo. Nuestro equipo la revisará antes de registrar otra.';
  end if;

  select count(*) into recent_count
  from public.access_requests ar
  where lower(ar.email) = new.email
    and ar.created_at >= now() - interval '24 hours';

  if recent_count >= 5 then
    raise exception using errcode = 'P0001', message = 'Alcanzaste el límite de solicitudes para este correo. Intenta nuevamente más adelante.';
  end if;

  return new;
end;
$$;

revoke all on function private.guard_access_request_insert() from public;

drop trigger if exists guard_access_request_insert on public.access_requests;
create trigger guard_access_request_insert
before insert on public.access_requests
for each row execute function private.guard_access_request_insert();

create index if not exists access_requests_email_created_at_idx
on public.access_requests (lower(email), created_at desc);

alter table public.access_requests
  drop constraint if exists access_requests_industry_length_check,
  add constraint access_requests_industry_length_check check (industry is null or char_length(industry) <= 120),
  drop constraint if exists access_requests_phone_length_check,
  add constraint access_requests_phone_length_check check (phone is null or char_length(phone) <= 50),
  drop constraint if exists access_requests_rut_length_check,
  add constraint access_requests_rut_length_check check (rut is null or char_length(rut) <= 24);
