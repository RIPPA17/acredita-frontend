create or replace function private.guard_contractor_evaluation_lifecycle()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
declare
  v_acc_active boolean;
  v_project_status text;
  v_open_plans integer;
  v_uid uuid := auth.uid();
begin
  if tg_op='DELETE' then
    if old.status <> 'borrador' then
      raise exception using errcode='42501', message='Solo se puede eliminar una evaluación que aún está en borrador.';
    end if;
    return old;
  end if;

  select a.is_active,p.status into v_acc_active,v_project_status
  from public.accreditations a
  join public.projects p on p.id=a.project_id
  where a.id=new.accreditation_id;

  if v_acc_active is distinct from true or v_project_status is distinct from 'active' then
    raise exception using errcode='42501', message='La evaluación solo puede modificarse mientras el proyecto y la relación del contratista estén activos.';
  end if;

  if new.period_end < new.period_start then
    raise exception using errcode='22023', message='La fecha de término no puede ser anterior al inicio.';
  end if;

  new.observations := nullif(btrim(coalesce(new.observations,'')),'');
  new.total_score := round((new.safety_score+new.quality_score+new.labor_score+new.compliance_score)/4,2);
  new.risk_level := case when new.total_score>=80 then 'bajo' when new.total_score>=60 then 'medio' else 'alto' end;

  if tg_op='INSERT' then
    if new.status='cerrada' then
      raise exception using errcode='22023', message='Una evaluación nueva no puede crearse cerrada.';
    end if;
    new.evaluated_by := coalesce(new.evaluated_by,v_uid);
    if new.status='publicada' then
      new.published_at := coalesce(new.published_at,now());
      new.published_by := coalesce(new.published_by,v_uid);
    end if;
    return new;
  end if;

  if new.accreditation_id is distinct from old.accreditation_id then
    raise exception using errcode='42501', message='La acreditación de una evaluación no puede cambiarse.';
  end if;

  if old.status='cerrada' then
    if new.status='cerrada' then
      if row(new.period_start,new.period_end,new.safety_score,new.quality_score,new.labor_score,new.compliance_score,new.observations)
         is distinct from
         row(old.period_start,old.period_end,old.safety_score,old.quality_score,old.labor_score,old.compliance_score,old.observations) then
        raise exception using errcode='42501', message='Una evaluación cerrada es histórica y no puede editarse.';
      end if;
      return new;
    end if;
    if new.status <> 'publicada' then
      raise exception using errcode='22023', message='Una evaluación cerrada solo puede reabrirse a estado publicada.';
    end if;
    if row(new.period_start,new.period_end,new.safety_score,new.quality_score,new.labor_score,new.compliance_score,new.observations)
       is distinct from
       row(old.period_start,old.period_end,old.safety_score,old.quality_score,old.labor_score,old.compliance_score,old.observations) then
      raise exception using errcode='42501', message='Reabrir una evaluación no permite alterar sus resultados publicados.';
    end if;
    if nullif(btrim(coalesce(new.reopen_reason,'')),'') is null or char_length(btrim(new.reopen_reason)) < 3 then
      raise exception using errcode='22023', message='Indica el motivo de reapertura de la evaluación.';
    end if;
    new.reopen_reason := btrim(new.reopen_reason);
    new.reopened_at := now();
    new.reopened_by := v_uid;
    new.closed_at := null;
    new.closed_by := null;
    return new;
  end if;

  if old.status='publicada' then
    if row(new.period_start,new.period_end,new.safety_score,new.quality_score,new.labor_score,new.compliance_score,new.observations)
       is distinct from
       row(old.period_start,old.period_end,old.safety_score,old.quality_score,old.labor_score,old.compliance_score,old.observations) then
      raise exception using errcode='42501', message='Los resultados de una evaluación publicada son inmutables. Corrige el borrador antes de publicarlo.';
    end if;
    if new.status='borrador' then
      raise exception using errcode='22023', message='Una evaluación publicada no puede volver a borrador.';
    elsif new.status='cerrada' then
      select count(*) into v_open_plans
      from public.evaluation_action_plans ap
      where ap.evaluation_id=old.id and ap.status not in ('completado','cancelado');
      if v_open_plans > 0 then
        raise exception using errcode='22023', message='No puedes cerrar la evaluación mientras existan planes de acción pendientes, en progreso o en revisión.';
      end if;
      new.closed_at := now();
      new.closed_by := v_uid;
      new.reopen_reason := null;
    elsif new.status<>'publicada' then
      raise exception using errcode='22023', message='Estado de evaluación inválido.';
    end if;
    return new;
  end if;

  if old.status='borrador' and new.status='cerrada' then
    raise exception using errcode='22023', message='Publica la evaluación antes de cerrarla.';
  end if;
  if old.status='borrador' and new.status='publicada' then
    new.published_at := coalesce(new.published_at,now());
    new.published_by := coalesce(new.published_by,v_uid);
    new.reopen_reason := null;
  elsif new.status not in ('borrador','publicada') then
    raise exception using errcode='22023', message='Estado de evaluación inválido.';
  end if;

  return new;
end;
$$;

create index if not exists contractor_evaluations_published_by_idx
  on public.contractor_evaluations(published_by) where published_by is not null;
create index if not exists contractor_evaluations_closed_by_idx
  on public.contractor_evaluations(closed_by) where closed_by is not null;
create index if not exists contractor_evaluations_reopened_by_idx
  on public.contractor_evaluations(reopened_by) where reopened_by is not null;
create index if not exists evaluation_action_plans_reviewed_by_idx
  on public.evaluation_action_plans(reviewed_by) where reviewed_by is not null;