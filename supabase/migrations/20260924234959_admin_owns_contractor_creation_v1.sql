
alter table public.contratistas
  add column if not exists primary_contact_name text,
  add column if not exists primary_contact_email text,
  add column if not exists primary_contact_phone text;

with contacts as (
  select distinct on (cm.contratista_id)
    cm.contratista_id,
    u.email,
    p.full_name,
    p.phone
  from public.contratista_memberships cm
  join auth.users u on u.id=cm.profile_id
  left join public.profiles p on p.id=cm.profile_id
  where cm.is_active=true
    and cm.role='contratista_admin'
  order by cm.contratista_id, cm.created_at asc
)
update public.contratistas c
set primary_contact_email=coalesce(c.primary_contact_email,contacts.email),
    primary_contact_name=coalesce(c.primary_contact_name,contacts.full_name),
    primary_contact_phone=coalesce(c.primary_contact_phone,contacts.phone),
    updated_at=now()
from contacts
where contacts.contratista_id=c.id;

create unique index if not exists contratistas_normalized_rut_unique
on public.contratistas ((private.normalize_rut(rut)))
where nullif(private.normalize_rut(rut),'') is not null;

drop policy if exists contratistas_insert_manager on public.contratistas;
create policy contratistas_insert_staff
on public.contratistas
for insert to authenticated
with check ((select private.is_acredita_staff()));

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
        and a.is_active=true
    )
  order by c.name,c.rut;
end;
$$;

revoke all on function private.list_available_contractors_for_project_impl(text) from public,anon;
grant execute on function private.list_available_contractors_for_project_impl(text) to authenticated;

create or replace function public.list_available_contractors_for_project(p_project_key text)
returns table(
  contractor_key text,
  contractor_name text,
  contractor_rut text,
  contact_name text,
  contact_email text,
  contact_phone text
)
language sql
security invoker
set search_path=''
as $$
  select * from private.list_available_contractors_for_project_impl(p_project_key);
$$;

revoke all on function public.list_available_contractors_for_project(text) from public,anon;
grant execute on function public.list_available_contractors_for_project(text) to authenticated;

create or replace function private.create_contractor_invitation_impl(
  p_project_id uuid,
  p_email text,
  p_contractor_id uuid default null,
  p_contractor_name text default null,
  p_contractor_rut text default null,
  p_message text default null
)
returns table(invitation_id uuid, token text, expires_at timestamptz)
language plpgsql
security definer
set search_path=''
as $$
declare
  v_uid uuid := auth.uid();
  v_email text;
  v_name text;
  v_rut text;
  v_token text;
  v_invitation_id uuid;
  v_expires_at timestamptz := now() + interval '7 days';
  v_project_status text;
begin
  if v_uid is null then raise exception 'Debes iniciar sesión para invitar contratistas'; end if;
  if not private.can_manage_project(p_project_id) then raise exception 'No tienes permisos para invitar contratistas a este proyecto'; end if;

  select status into v_project_status from public.projects where id=p_project_id;
  if v_project_status is distinct from 'active' then
    raise exception 'El proyecto no está operativo';
  end if;

  if p_contractor_id is null then
    raise exception 'La empresa debe ser creada primero por Administración de Acredita.';
  end if;

  select
    c.name,
    c.rut,
    lower(trim(coalesce(c.primary_contact_email,'')))
  into v_name,v_rut,v_email
  from public.contratistas c
  where c.id=p_contractor_id
    and c.is_active=true;

  if v_name is null then raise exception 'Contratista no disponible'; end if;
  if v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    raise exception 'El contratista no tiene un correo responsable válido. Administración debe completar sus datos.';
  end if;
  if nullif(trim(coalesce(p_email,'')),'') is not null
     and lower(trim(p_email))<>v_email then
    raise exception 'El correo responsable del contratista es administrado por Acredita.';
  end if;
  if length(coalesce(p_message,''))>2000 then
    raise exception 'El mensaje de invitación es demasiado largo';
  end if;

  if exists (
    select 1 from public.accreditations a
    where a.project_id=p_project_id
      and a.contratista_id=p_contractor_id
      and a.is_active=true
  ) then
    raise exception 'Este contratista ya participa en el proyecto';
  end if;

  update public.invitations
  set status='cancelled',responded_at=now()
  where project_id=p_project_id
    and contratista_id=p_contractor_id
    and status='pending';

  v_token := encode(extensions.gen_random_bytes(32),'hex');

  insert into public.invitations(
    project_id,contratista_id,invited_email,status,invited_by,invited_at,expires_at,
    contractor_name,contractor_rut,message,token_hash
  )
  values(
    p_project_id,p_contractor_id,v_email,'pending',v_uid,now(),v_expires_at,
    v_name,v_rut,nullif(trim(coalesce(p_message,'')),''),
    encode(extensions.digest(v_token,'sha256'),'hex')
  )
  returning id into v_invitation_id;

  insert into public.audit_logs(actor_profile_id,action,entity_type,entity_id,project_id,details)
  values(
    v_uid,'creacion_invitacion','invitation',v_invitation_id,p_project_id,
    jsonb_build_object(
      'invited_email',v_email,
      'contractor_name',v_name,
      'contractor_rut',v_rut,
      'existing_contractor',true
    )
  );

  return query select v_invitation_id,v_token,v_expires_at;
end;
$$;

update public.invitations
set status='cancelled',
    responded_at=coalesce(responded_at,now()),
    send_error=coalesce(send_error,'Cancelada: la empresa debe ser creada por Administración de Acredita.')
where status='pending'
  and contratista_id is null;

create or replace function private.accept_contractor_invitation_impl(p_token text)
returns table(
  invitation_id uuid,
  contractor_id uuid,
  contractor_integration_key text,
  project_id uuid,
  project_integration_key text
)
language plpgsql
security definer
set search_path=''
as $$
declare
  v_uid uuid := auth.uid();
  v_user_email text;
  v_inv public.invitations%rowtype;
  v_contractor_id uuid;
  v_existing_membership uuid;
  v_contractor_key text;
  v_project_key text;
  v_project_status text;
begin
  if v_uid is null then raise exception 'Debes iniciar sesión para aceptar la invitación'; end if;

  select lower(email) into v_user_email from auth.users where id=v_uid;
  if v_user_email is null then raise exception 'No se pudo validar el correo de la cuenta'; end if;

  select * into v_inv
  from public.invitations i
  where i.token_hash=encode(extensions.digest(coalesce(p_token,''),'sha256'),'hex')
  for update;

  if v_inv.id is null then raise exception 'Invitación inválida'; end if;
  if v_inv.status<>'pending' then raise exception 'La invitación ya no está disponible'; end if;
  if v_inv.expires_at is not null and v_inv.expires_at<=now() then
    update public.invitations set status='expired',responded_at=now() where id=v_inv.id;
    raise exception 'La invitación venció';
  end if;

  select p.status,p.integration_key
    into v_project_status,v_project_key
  from public.projects p
  where p.id=v_inv.project_id;

  if v_project_status is distinct from 'active' then
    raise exception 'El proyecto ya no está operativo. La invitación quedó solo como historial.';
  end if;

  if lower(coalesce(v_inv.invited_email,''))<>v_user_email then
    raise exception 'Esta invitación pertenece a otro correo';
  end if;

  v_contractor_id := v_inv.contratista_id;
  if v_contractor_id is null then
    raise exception 'La empresa de esta invitación no fue creada por Administración de Acredita.';
  end if;

  select c.integration_key into v_contractor_key
  from public.contratistas c
  where c.id=v_contractor_id
    and c.is_active=true;

  if v_contractor_key is null then
    raise exception 'El contratista ya no está disponible';
  end if;

  select cm.contratista_id into v_existing_membership
  from public.contratista_memberships cm
  where cm.profile_id=v_uid
    and cm.is_active=true
  order by cm.created_at
  limit 1;

  if v_existing_membership is not null and v_existing_membership<>v_contractor_id then
    raise exception 'Tu cuenta ya está asociada a otra empresa. Usa la cuenta del contratista invitado.';
  end if;

  insert into public.contratista_memberships(profile_id,contratista_id,role,is_active)
  values(v_uid,v_contractor_id,'contratista_admin',true)
  on conflict(profile_id,contratista_id,role)
  do update set is_active=true;

  insert into public.accreditations(project_id,contratista_id,is_active)
  values(v_inv.project_id,v_contractor_id,true)
  on conflict on constraint accreditations_project_contractor_unique
  do update set is_active=true,parent_accreditation_id=null,updated_at=now();

  update public.invitations
  set status='accepted',
      accepted_by=v_uid,
      responded_at=now()
  where id=v_inv.id;

  insert into public.audit_logs(actor_profile_id,action,entity_type,entity_id,project_id,details)
  values(
    v_uid,'aceptacion_invitacion','invitation',v_inv.id,v_inv.project_id,
    jsonb_build_object('contratista_id',v_contractor_id,'invited_email',v_user_email)
  );

  return query
  select v_inv.id,v_contractor_id,v_contractor_key,v_inv.project_id,v_project_key;
end;
$$;
