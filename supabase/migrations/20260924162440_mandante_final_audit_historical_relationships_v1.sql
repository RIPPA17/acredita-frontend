
create or replace function private.set_contractor_project_active(
  p_project_key text,
  p_contractor_key text,
  p_active boolean
)
returns void
language plpgsql
security definer
set search_path=''
as $$
declare
  v_project_id uuid;
  v_project_status text;
  v_accreditation_id uuid;
  v_current boolean;
begin
  select p.id,p.status into v_project_id,v_project_status
  from public.projects p
  where p.integration_key=p_project_key;

  if v_project_id is null then
    raise exception 'Proyecto no encontrado';
  end if;
  if v_project_status is distinct from 'active' then
    raise exception 'El proyecto no está operativo. Sus relaciones se conservan solo como historial.';
  end if;

  select a.id,a.is_active into v_accreditation_id,v_current
  from public.accreditations a
  join public.contratistas c on c.id=a.contratista_id
  where a.project_id=v_project_id
    and c.integration_key=p_contractor_key;

  if v_accreditation_id is null then
    raise exception 'La relación Contratista + Proyecto no existe';
  end if;
  if not ((select private.is_acredita_staff()) or (select private.can_manage_project(v_project_id))) then
    raise exception 'No tienes permisos para administrar este proyecto';
  end if;
  if v_current=p_active then return; end if;

  if not p_active then
    update public.accreditations
    set parent_accreditation_id=null
    where project_id=v_project_id and parent_accreditation_id=v_accreditation_id;

    update public.document_obligations
    set is_active=false,updated_at=now()
    where accreditation_id=v_accreditation_id and is_active;

    update public.worker_assignments
    set is_active=false,assignment_status='baja',access_status='bloqueado',
        unassigned_at=coalesce(unassigned_at,now())
    where accreditation_id=v_accreditation_id and is_active;

    update public.services
    set is_active=false,status='finalizado',
        ends_at=case
          when starts_at is null then coalesce(ends_at,current_date)
          when ends_at is not null and ends_at<starts_at then starts_at
          when ends_at is null or ends_at>greatest(starts_at,current_date) then greatest(starts_at,current_date)
          else ends_at
        end,
        updated_at=now()
    where accreditation_id=v_accreditation_id and is_active;

    update public.accreditations
    set is_active=false,parent_accreditation_id=null,updated_at=now()
    where id=v_accreditation_id;
  else
    update public.accreditations
    set is_active=true,parent_accreditation_id=null,updated_at=now()
    where id=v_accreditation_id;

    update public.document_obligations o
    set is_active=true,updated_at=now()
    from public.requirements r
    where o.accreditation_id=v_accreditation_id
      and o.requirement_id=r.id
      and o.worker_assignment_id is null
      and o.service_id is null
      and r.project_id=v_project_id
      and r.target='empresa'
      and r.is_active
      and o.period_end>=current_date;

    perform private.refresh_obligations_for_accreditation(
      v_accreditation_id,current_date,current_date+365
    );
  end if;
end;
$$;

create or replace function private.set_contractor_parent(
  p_project_key text,
  p_contractor_key text,
  p_parent_contractor_key text default null
)
returns void
language plpgsql
security definer
set search_path=''
as $$
declare
  v_project_id uuid;
  v_project_status text;
  v_accreditation_id uuid;
  v_parent_accreditation_id uuid;
begin
  select p.id,p.status into v_project_id,v_project_status
  from public.projects p
  where p.integration_key=p_project_key;

  if v_project_id is null then
    raise exception 'Proyecto no encontrado';
  end if;
  if v_project_status is distinct from 'active' then
    raise exception 'El proyecto no está operativo. Su jerarquía se conserva solo como historial.';
  end if;

  select a.id into v_accreditation_id
  from public.accreditations a
  join public.contratistas c on c.id=a.contratista_id
  where a.project_id=v_project_id
    and c.integration_key=p_contractor_key
    and a.is_active;

  if p_parent_contractor_key is not null then
    select a.id into v_parent_accreditation_id
    from public.accreditations a
    join public.contratistas c on c.id=a.contratista_id
    where a.project_id=v_project_id
      and c.integration_key=p_parent_contractor_key
      and a.is_active;
  end if;

  if v_accreditation_id is null
     or (p_parent_contractor_key is not null and v_parent_accreditation_id is null) then
    raise exception 'Contratista activo no encontrado en el proyecto';
  end if;

  if not ((select private.is_acredita_staff()) or (select private.can_manage_project(v_project_id))) then
    raise exception 'No tienes permisos para administrar este proyecto';
  end if;

  update public.accreditations
  set parent_accreditation_id=v_parent_accreditation_id,updated_at=now()
  where id=v_accreditation_id;
end;
$$;
