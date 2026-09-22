create or replace function private.validate_pending_invitation_project()
returns trigger
language plpgsql
security invoker
set search_path to ''
as $function$
declare v_status text;
begin
  if new.status = 'pending' then
    select status into v_status from public.projects where id = new.project_id;
    if v_status is distinct from 'active' then
      raise exception 'El proyecto debe estar activo para invitar contratistas';
    end if;
  end if;
  return new;
end;
$function$;

drop trigger if exists trg_validate_pending_invitation_project on public.invitations;
create trigger trg_validate_pending_invitation_project
before insert or update of status, project_id
on public.invitations
for each row execute function private.validate_pending_invitation_project();

create or replace function private.cancel_contractor_invitation_impl(p_invitation_id uuid)
returns boolean
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_project_id uuid;
  v_status text;
begin
  select project_id, status into v_project_id, v_status
  from public.invitations
  where id = p_invitation_id
  for update;
  if v_project_id is null then raise exception 'Invitación no encontrada'; end if;
  if not ((select private.is_acredita_staff()) or (select private.can_manage_project(v_project_id))) then
    raise exception 'No tienes permisos para administrar esta invitación';
  end if;
  if v_status <> 'pending' then raise exception 'Solo se pueden cancelar invitaciones pendientes'; end if;
  update public.invitations set status = 'cancelled', responded_at = now() where id = p_invitation_id;
  insert into public.audit_logs(actor_profile_id, action, entity_type, entity_id, project_id, details)
  values ((select auth.uid()), 'cancelacion_invitacion', 'invitation', p_invitation_id, v_project_id, '{}'::jsonb);
  return true;
end;
$function$;

create or replace function public.cancel_contractor_invitation(p_invitation_id uuid)
returns boolean
language sql
set search_path to ''
as $function$
  select private.cancel_contractor_invitation_impl(p_invitation_id);
$function$;

revoke all on function public.cancel_contractor_invitation(uuid) from public;
grant execute on function public.cancel_contractor_invitation(uuid) to authenticated;

create or replace function private.cancel_pending_invitations_for_project_status()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
begin
  if old.status = 'active' and new.status <> 'active' then
    update public.invitations
    set status = 'cancelled', responded_at = coalesce(responded_at, now())
    where project_id = new.id and status = 'pending';
  end if;
  return new;
end;
$function$;

drop trigger if exists trg_cancel_pending_invitations_project_status on public.projects;
create trigger trg_cancel_pending_invitations_project_status
after update of status on public.projects
for each row execute function private.cancel_pending_invitations_for_project_status();
