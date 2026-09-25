
alter table public.contratistas
  add column if not exists address text;

create or replace function private.admin_create_contractor_impl(
  p_name text,
  p_rut text,
  p_legal_name text default null,
  p_address text default null,
  p_contact_name text default null,
  p_contact_email text default null,
  p_contact_phone text default null
)
returns table(
  contractor_id uuid,
  contractor_key text,
  contractor_name text,
  contractor_rut text
)
language plpgsql
security definer
set search_path=''
as $$
declare
  v_name text := nullif(btrim(coalesce(p_name,'')),'');
  v_rut text := nullif(btrim(coalesce(p_rut,'')),'');
  v_normalized_rut text := private.normalize_rut(p_rut);
  v_id uuid;
  v_key text;
begin
  if (select auth.uid()) is null or not (select private.is_acredita_staff()) then
    raise exception using errcode='42501',message='Solo Administración Acredita puede crear empresas contratistas.';
  end if;
  if v_name is null then
    raise exception using errcode='22023',message='Ingresa el nombre del contratista.';
  end if;
  if v_rut is null or char_length(v_normalized_rut) < 8 then
    raise exception using errcode='22023',message='Ingresa un RUT válido para el contratista.';
  end if;
  if exists(
    select 1
    from public.contratistas c
    where private.normalize_rut(c.rut)=v_normalized_rut
  ) then
    raise exception using errcode='23505',message='Ya existe un contratista registrado con ese RUT.';
  end if;

  v_key := 'contratista_' || substr(replace(extensions.gen_random_uuid()::text,'-',''),1,16);

  insert into public.contratistas(
    name,rut,legal_name,is_active,integration_key,address,
    primary_contact_name,primary_contact_email,primary_contact_phone
  )
  values (
    v_name,v_rut,coalesce(nullif(btrim(p_legal_name),''),v_name),true,v_key,
    nullif(btrim(p_address),''),
    nullif(btrim(p_contact_name),''),
    nullif(lower(btrim(p_contact_email)),''),
    nullif(btrim(p_contact_phone),'')
  )
  returning id into v_id;

  insert into public.audit_logs(actor_profile_id,action,entity_type,entity_id,details)
  values (
    (select auth.uid()),
    'creacion_contratista',
    'contratista',
    v_id,
    jsonb_build_object(
      'integration_key',v_key,
      'name',v_name,
      'rut',v_rut,
      'primary_contact_email',nullif(lower(btrim(p_contact_email)),'')
    )
  );

  return query select v_id,v_key,v_name,v_rut;
end;
$$;

revoke all on function private.admin_create_contractor_impl(text,text,text,text,text,text,text) from public,anon,authenticated;
grant execute on function private.admin_create_contractor_impl(text,text,text,text,text,text,text) to authenticated;

create or replace function public.admin_create_contractor(
  p_name text,
  p_rut text,
  p_legal_name text default null,
  p_address text default null,
  p_contact_name text default null,
  p_contact_email text default null,
  p_contact_phone text default null
)
returns table(
  contractor_id uuid,
  contractor_key text,
  contractor_name text,
  contractor_rut text
)
language sql
security invoker
set search_path=''
as $$
  select * from private.admin_create_contractor_impl(
    p_name,p_rut,p_legal_name,p_address,p_contact_name,p_contact_email,p_contact_phone
  );
$$;

revoke all on function public.admin_create_contractor(text,text,text,text,text,text,text) from public,anon;
grant execute on function public.admin_create_contractor(text,text,text,text,text,text,text) to authenticated;

create or replace function private.list_available_contractors_for_project_impl(p_project_key text)
returns table(
  contractor_key text,
  contractor_name text,
  contractor_rut text,
  contact_name text,
  contact_email text,
  contact_phone text
)
language plpgsql
stable
security definer
set search_path=''
as $$
declare
  v_project_id uuid;
  v_project_status text;
begin
  if (select auth.uid()) is null then
    raise exception 'Debes iniciar sesión';
  end if;

  select p.id,p.status
    into v_project_id,v_project_status
  from public.projects p
  where p.integration_key=p_project_key;

  if v_project_id is null then
    raise exception 'Proyecto no encontrado';
  end if;
  if v_project_status is distinct from 'active' then
    raise exception 'El proyecto no está operativo';
  end if;
  if not ((select private.is_acredita_staff()) or (select private.can_manage_project(v_project_id))) then
    raise exception 'No tienes permisos para incorporar contratistas a este proyecto';
  end if;

  return query
  select
    c.integration_key,
    c.name,
    coalesce(c.rut,''),
    coalesce(c.primary_contact_name,''),
    coalesce(c.primary_contact_email,''),
    coalesce(c.primary_contact_phone,'')
  from public.contratistas c
  where c.is_active=true
    and c.integration_key is not null
    and not exists (
      select 1
      from public.accreditations a
      where a.project_id=v_project_id
        and a.contratista_id=c.id
    )
  order by c.name,c.rut;
end;
$$;

create or replace function private.create_registered_contractor_invitation_impl(
  p_project_key text,
  p_contractor_key text,
  p_message text default null
)
returns table(invitation_id uuid, token text, expires_at timestamptz)
language plpgsql
security definer
set search_path=''
as $$
declare
  v_project_id uuid;
  v_contractor_id uuid;
  v_email text;
begin
  select p.id into v_project_id
  from public.projects p
  where p.integration_key=p_project_key
    and p.status='active';

  if v_project_id is null then
    raise exception 'Proyecto no encontrado o no operativo';
  end if;

  if not ((select private.is_acredita_staff()) or (select private.can_manage_project(v_project_id))) then
    raise exception 'No tienes permisos para incorporar contratistas a este proyecto';
  end if;

  select c.id, lower(trim(coalesce(c.primary_contact_email,'')))
    into v_contractor_id,v_email
  from public.contratistas c
  where c.integration_key=p_contractor_key
    and c.is_active=true;

  if v_contractor_id is null then
    raise exception 'Contratista no disponible';
  end if;

  if exists(
    select 1
    from public.accreditations a
    where a.project_id=v_project_id
      and a.contratista_id=v_contractor_id
  ) then
    raise exception 'Ese contratista ya tiene historial en este proyecto. Usa la opción Reactivar.';
  end if;

  if v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    raise exception 'El contratista no tiene un correo responsable válido. Administración debe completar sus datos.';
  end if;

  return query
  select *
  from private.create_contractor_invitation_impl(
    v_project_id,
    v_email,
    v_contractor_id,
    null,
    null,
    p_message
  );
end;
$$;
