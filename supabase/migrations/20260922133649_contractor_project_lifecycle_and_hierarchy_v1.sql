alter table public.accreditations
  add column if not exists parent_accreditation_id uuid
  references public.accreditations(id) on delete set null;

alter table public.accreditations
  drop constraint if exists accreditations_parent_not_self;
alter table public.accreditations
  add constraint accreditations_parent_not_self
  check (parent_accreditation_id is null or parent_accreditation_id <> id);

update public.accreditations child
set parent_accreditation_id = parent.id,
    updated_at = now()
from public.contratistas c,
     public.accreditations parent
where child.contratista_id = c.id
  and c.parent_contratista_id is not null
  and parent.contratista_id = c.parent_contratista_id
  and parent.project_id = child.project_id
  and parent.id <> child.id
  and child.parent_accreditation_id is null;

create or replace function private.validate_accreditation_parent()
returns trigger
language plpgsql
security invoker
set search_path to ''
as $function$
declare
  v_parent_project uuid;
  v_parent_active boolean;
  v_cycle boolean;
begin
  if new.parent_accreditation_id is null then return new; end if;
  if new.id is not null and new.parent_accreditation_id = new.id then
    raise exception 'Un contratista no puede depender de sí mismo';
  end if;
  select project_id, is_active into v_parent_project, v_parent_active
  from public.accreditations where id = new.parent_accreditation_id;
  if v_parent_project is null then raise exception 'La acreditación principal no existe'; end if;
  if v_parent_project <> new.project_id then raise exception 'La relación de subcontratación debe pertenecer al mismo proyecto'; end if;
  if new.is_active and not v_parent_active then raise exception 'El contratista principal debe estar activo en el proyecto'; end if;
  if new.id is not null then
    with recursive chain as (
      select a.id, a.parent_accreditation_id
      from public.accreditations a
      where a.id = new.parent_accreditation_id
      union all
      select a.id, a.parent_accreditation_id
      from public.accreditations a
      join chain c on a.id = c.parent_accreditation_id
      where c.parent_accreditation_id is not null
    )
    select exists(select 1 from chain where id = new.id) into v_cycle;
    if v_cycle then raise exception 'La relación de subcontratación formaría un ciclo'; end if;
  end if;
  return new;
end;
$function$;

drop trigger if exists trg_validate_accreditation_parent on public.accreditations;
create trigger trg_validate_accreditation_parent
before insert or update of parent_accreditation_id, project_id, is_active
on public.accreditations
for each row execute function private.validate_accreditation_parent();

create or replace function private.validate_active_accreditation_project()
returns trigger
language plpgsql
security invoker
set search_path to ''
as $function$
declare v_status text;
begin
  if new.is_active then
    select status into v_status from public.projects where id = new.project_id;
    if v_status is distinct from 'active' then
      raise exception 'El proyecto debe estar activo para incorporar o reactivar contratistas';
    end if;
  end if;
  return new;
end;
$function$;

drop trigger if exists trg_validate_active_accreditation_project on public.accreditations;
create trigger trg_validate_active_accreditation_project
before insert or update of is_active, project_id
on public.accreditations
for each row execute function private.validate_active_accreditation_project();

create or replace function private.set_contractor_parent(
  p_project_key text,
  p_contractor_key text,
  p_parent_contractor_key text default null
)
returns void
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_project_id uuid;
  v_accreditation_id uuid;
  v_parent_accreditation_id uuid;
begin
  select p.id into v_project_id from public.projects p where p.integration_key = p_project_key;
  select a.id into v_accreditation_id
  from public.accreditations a
  join public.contratistas c on c.id = a.contratista_id
  where a.project_id = v_project_id and c.integration_key = p_contractor_key and a.is_active;
  if p_parent_contractor_key is not null then
    select a.id into v_parent_accreditation_id
    from public.accreditations a
    join public.contratistas c on c.id = a.contratista_id
    where a.project_id = v_project_id and c.integration_key = p_parent_contractor_key and a.is_active;
  end if;
  if v_project_id is null or v_accreditation_id is null
     or (p_parent_contractor_key is not null and v_parent_accreditation_id is null) then
    raise exception 'Proyecto o contratista activo no encontrado';
  end if;
  if not ((select private.is_acredita_staff()) or (select private.can_manage_project(v_project_id))) then
    raise exception 'No tienes permisos para administrar este proyecto';
  end if;
  update public.accreditations
  set parent_accreditation_id = v_parent_accreditation_id, updated_at = now()
  where id = v_accreditation_id;
end;
$function$;

create or replace function public.set_contractor_parent(
  p_project_key text,
  p_contractor_key text,
  p_parent_contractor_key text default null
)
returns void
language sql
set search_path to ''
as $function$
  select private.set_contractor_parent(p_project_key, p_contractor_key, p_parent_contractor_key);
$function$;

create or replace function private.set_contractor_project_active(
  p_project_key text,
  p_contractor_key text,
  p_active boolean
)
returns void
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_project_id uuid;
  v_accreditation_id uuid;
  v_current boolean;
begin
  select p.id into v_project_id from public.projects p where p.integration_key = p_project_key;
  select a.id, a.is_active into v_accreditation_id, v_current
  from public.accreditations a
  join public.contratistas c on c.id = a.contratista_id
  where a.project_id = v_project_id and c.integration_key = p_contractor_key;
  if v_project_id is null or v_accreditation_id is null then
    raise exception 'La relación Contratista + Proyecto no existe';
  end if;
  if not ((select private.is_acredita_staff()) or (select private.can_manage_project(v_project_id))) then
    raise exception 'No tienes permisos para administrar este proyecto';
  end if;
  if v_current = p_active then return; end if;

  if not p_active then
    update public.accreditations
    set parent_accreditation_id = null
    where project_id = v_project_id and parent_accreditation_id = v_accreditation_id;

    update public.document_obligations
    set is_active = false, updated_at = now()
    where accreditation_id = v_accreditation_id and is_active;

    update public.worker_assignments
    set is_active = false,
        assignment_status = 'baja',
        access_status = 'bloqueado',
        unassigned_at = coalesce(unassigned_at, now())
    where accreditation_id = v_accreditation_id and is_active;

    update public.services
    set is_active = false,
        status = 'finalizado',
        ends_at = case
          when starts_at is null then coalesce(ends_at, current_date)
          when ends_at is not null and ends_at < starts_at then starts_at
          when ends_at is null or ends_at > greatest(starts_at, current_date) then greatest(starts_at, current_date)
          else ends_at
        end,
        updated_at = now()
    where accreditation_id = v_accreditation_id and is_active;

    update public.accreditations
    set is_active = false, parent_accreditation_id = null, updated_at = now()
    where id = v_accreditation_id;
  else
    update public.accreditations
    set is_active = true, parent_accreditation_id = null, updated_at = now()
    where id = v_accreditation_id;
  end if;
end;
$function$;

create or replace function public.set_contractor_project_active(
  p_project_key text,
  p_contractor_key text,
  p_active boolean
)
returns void
language sql
set search_path to ''
as $function$
  select private.set_contractor_project_active(p_project_key, p_contractor_key, p_active);
$function$;

revoke all on function public.set_contractor_project_active(text,text,boolean) from public;
grant execute on function public.set_contractor_project_active(text,text,boolean) to authenticated;

create or replace function private.notify_accreditation_lifecycle()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_project_name text;
  v_title text;
  v_body text;
  v_key text;
begin
  if tg_op <> 'UPDATE' or old.is_active is not distinct from new.is_active then return new; end if;
  select name into v_project_name from public.projects where id = new.project_id;
  if new.is_active then
    v_title := 'Participación reactivada';
    v_body := coalesce(v_project_name,'Proyecto') || '. La empresa vuelve a participar en este proyecto. Revisa servicios, trabajadores y documentos antes de operar.';
  else
    v_title := 'Participación finalizada';
    v_body := coalesce(v_project_name,'Proyecto') || '. La relación con este proyecto fue finalizada. El historial permanece disponible para consulta.';
  end if;
  v_key := 'accreditation_lifecycle:' || new.id::text || ':' || to_char(clock_timestamp(),'YYYYMMDDHH24MISSUS');
  perform private.emit_contractor_notification(
    new.id, v_key, 'accreditation_changed', 'informativa', 'action',
    v_title, v_body, 'Ver proyecto', 'proyectos',
    null, null, null, null, null, null, null, true
  );
  perform private.sync_accreditation_notification_state(new.id);
  return new;
end;
$function$;

drop trigger if exists trg_notify_accreditation_lifecycle on public.accreditations;
create trigger trg_notify_accreditation_lifecycle
after update of is_active on public.accreditations
for each row execute function private.notify_accreditation_lifecycle();

alter table public.services
  drop constraint if exists services_finalized_active_consistency;
alter table public.services
  add constraint services_finalized_active_consistency
  check (
    (status = 'finalizado' and is_active = false)
    or (status <> 'finalizado' and is_active = true)
  );
