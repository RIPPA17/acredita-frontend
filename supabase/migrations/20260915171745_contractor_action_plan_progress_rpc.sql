create or replace function public.update_contractor_action_plan(
  p_plan_id uuid,
  p_status text,
  p_evidence text default null
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_uid uuid := auth.uid();
  v_allowed boolean := false;
  v_evidence text := nullif(btrim(coalesce(p_evidence, '')), '');
begin
  if v_uid is null then
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

  select exists (
    select 1
    from public.evaluation_action_plans ap
    join public.contractor_evaluations e on e.id = ap.evaluation_id
    join public.accreditations a on a.id = e.accreditation_id
    join public.contratista_memberships cm on cm.contratista_id = a.contratista_id
    where ap.id = p_plan_id
      and cm.profile_id = v_uid
      and cm.is_active = true
      and a.is_active = true
  ) into v_allowed;

  if not v_allowed then
    raise exception using errcode = '42501', message = 'No tienes permisos para actualizar este plan de acción.';
  end if;

  update public.evaluation_action_plans
  set status = p_status,
      evidence = case when v_evidence is not null then v_evidence else evidence end,
      completed_at = case when p_status = 'completado' then now() else null end,
      updated_at = now()
  where id = p_plan_id;
end;
$$;

revoke all on function public.update_contractor_action_plan(uuid,text,text) from public;
grant execute on function public.update_contractor_action_plan(uuid,text,text) to authenticated;
