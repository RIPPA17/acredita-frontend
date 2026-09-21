create or replace function public.close_compliance_period(p_period_id uuid)
returns public.compliance_periods
language plpgsql
set search_path=''
as $$
declare
  v_period public.compliance_periods%rowtype;
  v_project_status text;
begin
  if (select auth.uid()) is null then raise exception using errcode='28000', message='Sesión inválida.'; end if;

  select * into v_period from public.compliance_periods where id=p_period_id for update;
  if v_period.id is null then raise exception 'Período no encontrado'; end if;
  select p.status into v_project_status from public.projects p where p.id=v_period.project_id;

  if not (private.is_acredita_staff() or private.can_manage_project(v_period.project_id)) then
    raise exception using errcode='42501', message='No tienes permisos para cerrar este período.';
  end if;
  if v_project_status <> 'active' then
    raise exception using errcode='42501', message='Un proyecto histórico no admite cierres ni reaperturas de períodos.';
  end if;
  if v_period.status='cerrado' then return v_period; end if;
  if v_period.status not in ('abierto','reabierto') then
    raise exception using errcode='22023', message='El período no está en un estado que permita cierre.';
  end if;
  if current_date < v_period.period_end then
    raise exception using errcode='22023', message='El período documental no puede cerrarse antes de su fecha de término.';
  end if;

  update public.compliance_periods cp
  set status='cerrado',
      closed_at=now(),
      closed_by=(select auth.uid()),
      snapshot=(
        select jsonb_build_object(
          'generated_at',now(),
          'accreditations',coalesce((select jsonb_agg(to_jsonb(s)) from public.accreditation_statuses s where s.project_id=v_period.project_id),'[]'::jsonb),
          'obligations',coalesce((select jsonb_agg(to_jsonb(os)) from public.obligation_statuses os join public.accreditations a on a.id=os.accreditation_id
            where a.project_id=v_period.project_id and os.period_start>=v_period.period_start and os.period_end<=v_period.period_end),'[]'::jsonb)
        )
      ),
      updated_at=now()
  where cp.id=p_period_id
  returning * into v_period;

  return v_period;
end;
$$;

revoke all on function public.close_compliance_period(uuid) from public,anon;
grant execute on function public.close_compliance_period(uuid) to authenticated,service_role;

create or replace function public.reopen_compliance_period(p_period_id uuid,p_reason text)
returns public.compliance_periods
language plpgsql
security definer
set search_path=''
as $$
declare
  v_period public.compliance_periods%rowtype;
  v_reason text := nullif(btrim(coalesce(p_reason,'')),'');
  v_uid uuid := (select auth.uid());
  v_project_status text;
begin
  if v_uid is null then raise exception using errcode='28000', message='Sesión inválida.'; end if;

  select * into v_period from public.compliance_periods where id=p_period_id for update;
  if v_period.id is null then raise exception 'Período no encontrado'; end if;
  select p.status into v_project_status from public.projects p where p.id=v_period.project_id;

  if not (private.is_acredita_staff() or private.can_manage_project(v_period.project_id)) then
    raise exception using errcode='42501', message='No tienes permisos para reabrir este período.';
  end if;
  if v_project_status <> 'active' then
    raise exception using errcode='42501', message='Un proyecto histórico no admite cierres ni reaperturas de períodos.';
  end if;
  if v_period.status<>'cerrado' then
    raise exception using errcode='22023', message='Solo un período cerrado puede reabrirse.';
  end if;
  if v_reason is null or char_length(v_reason)<3 then
    raise exception using errcode='22023', message='Indica el motivo de reapertura.';
  end if;

  update public.compliance_periods
  set status='reabierto',reopened_at=now(),reopened_by=v_uid,reopen_reason=v_reason,
      closed_at=null,closed_by=null,updated_at=now()
  where id=p_period_id
  returning * into v_period;

  perform set_config('app.payment_transition_source','period_reopen',true);
  update public.payment_cases
  set status='retenido',
      block_reason='Período documental reabierto: '||v_reason,
      released_by=null,released_at=null,
      compliance_snapshot=private.payment_compliance_context(accreditation_id,compliance_period_id),
      compliance_checked_at=now(),updated_at=now()
  where compliance_period_id=p_period_id and status='liberado';
  perform set_config('app.payment_transition_source','',true);

  return v_period;
end;
$$;

revoke all on function public.reopen_compliance_period(uuid,text) from public,anon;
grant execute on function public.reopen_compliance_period(uuid,text) to authenticated,service_role;
