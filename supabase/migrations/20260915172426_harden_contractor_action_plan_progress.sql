-- Allow contractors to update only progress/evidence on action plans they can access.
-- The public RPC remains SECURITY INVOKER so table RLS is authoritative.

create or replace function private.guard_contractor_action_plan_progress()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_uid uuid := auth.uid();
  v_is_contractor boolean := false;
  v_is_privileged boolean := false;
begin
  if v_uid is null then
    return new;
  end if;

  select (
    private.is_acredita_staff()
    or exists (
      select 1
      from public.contractor_evaluations e
      join public.accreditations a on a.id = e.accreditation_id
      where e.id = old.evaluation_id
        and private.can_manage_project(a.project_id)
    )
  ) into v_is_privileged;

  if v_is_privileged then
    return new;
  end if;

  select exists (
    select 1
    from public.contractor_evaluations e
    join public.accreditations a on a.id = e.accreditation_id
    join public.contratista_memberships cm on cm.contratista_id = a.contratista_id
    where e.id = old.evaluation_id
      and cm.profile_id = v_uid
      and cm.is_active = true
      and a.is_active = true
  ) into v_is_contractor;

  if not v_is_contractor then
    return new;
  end if;

  if new.evaluation_id is distinct from old.evaluation_id
     or new.title is distinct from old.title
     or new.description is distinct from old.description
     or new.owner_name is distinct from old.owner_name
     or new.due_date is distinct from old.due_date
     or new.created_by is distinct from old.created_by
     or new.created_at is distinct from old.created_at then
    raise exception using errcode = '42501', message = 'El contratista solo puede actualizar avance y evidencia del plan.';
  end if;

  if new.status not in ('pendiente', 'en_progreso', 'completado') then
    raise exception using errcode = '22023', message = 'Estado de plan no permitido para el contratista.';
  end if;

  new.evidence := nullif(btrim(coalesce(new.evidence, '')), '');
  if new.evidence is not null and char_length(new.evidence) > 4000 then
    raise exception using errcode = '22023', message = 'La evidencia supera el largo permitido.';
  end if;

  if new.status = 'completado' and (new.evidence is null or char_length(new.evidence) < 3) then
    raise exception using errcode = '22023', message = 'Agrega evidencia o un comentario de cierre para completar el plan.';
  end if;

  new.completed_at := case when new.status = 'completado' then coalesce(old.completed_at, now()) else null end;
  new.updated_at := now();
  return new;
end;
$$;

revoke all on function private.guard_contractor_action_plan_progress() from public, anon, authenticated;

drop trigger if exists guard_contractor_action_plan_progress on public.evaluation_action_plans;
create trigger guard_contractor_action_plan_progress
before update on public.evaluation_action_plans
for each row execute function private.guard_contractor_action_plan_progress();

drop policy if exists action_plans_contractor_progress_update on public.evaluation_action_plans;
create policy action_plans_contractor_progress_update
on public.evaluation_action_plans
for update
to authenticated
using (
  exists (
    select 1
    from public.contractor_evaluations e
    join public.accreditations a on a.id = e.accreditation_id
    join public.contratista_memberships cm on cm.contratista_id = a.contratista_id
    where e.id = evaluation_action_plans.evaluation_id
      and cm.profile_id = (select auth.uid())
      and cm.is_active = true
      and a.is_active = true
  )
)
with check (
  exists (
    select 1
    from public.contractor_evaluations e
    join public.accreditations a on a.id = e.accreditation_id
    join public.contratista_memberships cm on cm.contratista_id = a.contratista_id
    where e.id = evaluation_action_plans.evaluation_id
      and cm.profile_id = (select auth.uid())
      and cm.is_active = true
      and a.is_active = true
  )
);

create or replace function public.update_contractor_action_plan(
  p_plan_id uuid,
  p_status text,
  p_evidence text default null
)
returns void
language plpgsql
security invoker
set search_path = pg_catalog, public, private
as $$
declare
  v_evidence text := nullif(btrim(coalesce(p_evidence, '')), '');
begin
  if auth.uid() is null then
    raise exception using errcode = '28000', message = 'Sesión inválida.';
  end if;
  if p_status not in ('pendiente', 'en_progreso', 'completado') then
    raise exception using errcode = '22023', message = 'Estado de plan no permitido para el contratista.';
  end if;
  if v_evidence is not null and char_length(v_evidence) > 4000 then
    raise exception using errcode = '22023', message = 'La evidencia supera el largo permitido.';
  end if;
  if p_status = 'completado' and (v_evidence is null or char_length(v_evidence) < 3) then
    raise exception using errcode = '22023', message = 'Agrega evidencia o un comentario de cierre para completar el plan.';
  end if;

  update public.evaluation_action_plans
  set status = p_status,
      evidence = case when v_evidence is not null then v_evidence else evidence end,
      completed_at = case when p_status = 'completado' then now() else null end,
      updated_at = now()
  where id = p_plan_id;

  if not found then
    raise exception using errcode = '42501', message = 'No tienes permisos para actualizar este plan de acción.';
  end if;
end;
$$;

revoke execute on function public.update_contractor_action_plan(uuid, text, text) from public, anon;
grant execute on function public.update_contractor_action_plan(uuid, text, text) to authenticated, service_role;
