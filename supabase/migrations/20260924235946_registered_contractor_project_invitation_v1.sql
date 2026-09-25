
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

revoke all on function private.create_registered_contractor_invitation_impl(text,text,text) from public,anon;
grant execute on function private.create_registered_contractor_invitation_impl(text,text,text) to authenticated;

create or replace function public.create_registered_contractor_invitation(
  p_project_key text,
  p_contractor_key text,
  p_message text default null
)
returns table(invitation_id uuid, token text, expires_at timestamptz)
language sql
security invoker
set search_path=''
as $$
  select *
  from private.create_registered_contractor_invitation_impl(
    p_project_key,p_contractor_key,p_message
  );
$$;

revoke all on function public.create_registered_contractor_invitation(text,text,text) from public,anon;
grant execute on function public.create_registered_contractor_invitation(text,text,text) to authenticated;
