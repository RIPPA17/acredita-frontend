alter table public.contractor_evaluations
  add column if not exists published_at timestamptz,
  add column if not exists published_by uuid references public.profiles(id) on delete set null,
  add column if not exists closed_at timestamptz,
  add column if not exists closed_by uuid references public.profiles(id) on delete set null,
  add column if not exists reopened_at timestamptz,
  add column if not exists reopened_by uuid references public.profiles(id) on delete set null,
  add column if not exists reopen_reason text;

alter table public.evaluation_action_plans
  add column if not exists submitted_at timestamptz,
  add column if not exists reviewed_at timestamptz,
  add column if not exists reviewed_by uuid references public.profiles(id) on delete set null,
  add column if not exists review_comment text;

alter table public.evaluation_action_plans
  drop constraint if exists evaluation_action_plans_status_check;
alter table public.evaluation_action_plans
  add constraint evaluation_action_plans_status_check
  check (status = any(array['pendiente'::text,'en_progreso'::text,'en_revision'::text,'completado'::text,'cancelado'::text]));

create table if not exists public.contractor_evaluation_events (
  id uuid primary key default gen_random_uuid(),
  evaluation_id uuid not null references public.contractor_evaluations(id) on delete cascade,
  event_type text not null check (event_type = any(array['creada','actualizada','publicada','cerrada','reabierta']::text[])),
  from_status text,
  to_status text,
  reason text,
  snapshot jsonb not null default '{}'::jsonb,
  actor_profile_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists contractor_evaluation_events_evaluation_created_idx
  on public.contractor_evaluation_events(evaluation_id, created_at desc);
create index if not exists contractor_evaluation_events_actor_idx
  on public.contractor_evaluation_events(actor_profile_id) where actor_profile_id is not null;

create table if not exists public.evaluation_action_plan_events (
  id uuid primary key default gen_random_uuid(),
  action_plan_id uuid not null references public.evaluation_action_plans(id) on delete cascade,
  event_type text not null check (event_type = any(array['creado','actualizado','iniciado','enviado_revision','aprobado','devuelto','cancelado','reabierto']::text[])),
  from_status text,
  to_status text,
  comment text,
  evidence_snapshot text,
  actor_profile_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists evaluation_action_plan_events_plan_created_idx
  on public.evaluation_action_plan_events(action_plan_id, created_at desc);
create index if not exists evaluation_action_plan_events_actor_idx
  on public.evaluation_action_plan_events(actor_profile_id) where actor_profile_id is not null;

alter table public.contractor_evaluation_events enable row level security;
alter table public.evaluation_action_plan_events enable row level security;

revoke all on public.contractor_evaluation_events, public.evaluation_action_plan_events from anon, authenticated;
grant select on public.contractor_evaluation_events, public.evaluation_action_plan_events to authenticated;

drop policy if exists contractor_evaluation_events_select on public.contractor_evaluation_events;
create policy contractor_evaluation_events_select
on public.contractor_evaluation_events for select to authenticated
using (
  exists(
    select 1
    from public.contractor_evaluations e
    join public.accreditations a on a.id=e.accreditation_id
    where e.id=contractor_evaluation_events.evaluation_id
      and private.can_access_accreditation(e.accreditation_id)
      and (
        e.status in ('publicada','cerrada')
        or private.is_acredita_staff()
        or private.can_manage_project(a.project_id)
      )
  )
);

drop policy if exists evaluation_action_plan_events_select on public.evaluation_action_plan_events;
create policy evaluation_action_plan_events_select
on public.evaluation_action_plan_events for select to authenticated
using (
  exists(
    select 1
    from public.evaluation_action_plans ap
    join public.contractor_evaluations e on e.id=ap.evaluation_id
    join public.accreditations a on a.id=e.accreditation_id
    where ap.id=evaluation_action_plan_events.action_plan_id
      and private.can_access_accreditation(e.accreditation_id)
      and (
        e.status in ('publicada','cerrada')
        or private.is_acredita_staff()
        or private.can_manage_project(a.project_id)
      )
  )
);

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
      if new.period_start is distinct from old.period_start
         or new.period_end is distinct from old.period_end
         or new.safety_score is distinct from old.safety_score
         or new.quality_score is distinct from old.quality_score
         or new.labor_score is distinct from old.labor_score
         or new.compliance_score is distinct from old.compliance_score
         or new.observations is distinct from old.observations then
        raise exception using errcode='42501', message='Una evaluación cerrada es histórica y no puede editarse.';
      end if;
      return new;
    end if;
    if new.status <> 'publicada' then
      raise exception using errcode='22023', message='Una evaluación cerrada solo puede reabrirse a estado publicada.';
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

  if old.status='borrador' and new.status='cerrada' then
    raise exception using errcode='22023', message='Publica la evaluación antes de cerrarla.';
  end if;
  if old.status='publicada' and new.status='borrador' then
    raise exception using errcode='22023', message='Una evaluación publicada no puede volver a borrador.';
  end if;

  if old.status='borrador' and new.status='publicada' then
    new.published_at := coalesce(new.published_at,now());
    new.published_by := coalesce(new.published_by,v_uid);
    new.reopen_reason := null;
  elsif old.status='publicada' and new.status='cerrada' then
    select count(*) into v_open_plans
    from public.evaluation_action_plans ap
    where ap.evaluation_id=old.id and ap.status not in ('completado','cancelado');
    if v_open_plans > 0 then
      raise exception using errcode='22023', message='No puedes cerrar la evaluación mientras existan planes de acción pendientes, en progreso o en revisión.';
    end if;
    new.closed_at := now();
    new.closed_by := v_uid;
    new.reopen_reason := null;
  elsif new.status not in ('borrador','publicada','cerrada') then
    raise exception using errcode='22023', message='Estado de evaluación inválido.';
  end if;

  return new;
end;
$$;

drop trigger if exists guard_contractor_evaluation_lifecycle on public.contractor_evaluations;
create trigger guard_contractor_evaluation_lifecycle
before insert or update or delete on public.contractor_evaluations
for each row execute function private.guard_contractor_evaluation_lifecycle();

create or replace function private.audit_contractor_evaluation_lifecycle()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
declare
  v_event text;
  v_reason text;
begin
  if tg_op='INSERT' then
    v_event := case when new.status='publicada' then 'publicada' else 'creada' end;
  else
    if new.status is distinct from old.status then
      v_event := case
        when old.status='borrador' and new.status='publicada' then 'publicada'
        when old.status='publicada' and new.status='cerrada' then 'cerrada'
        when old.status='cerrada' and new.status='publicada' then 'reabierta'
        else 'actualizada'
      end;
    elsif new.period_start is distinct from old.period_start
       or new.period_end is distinct from old.period_end
       or new.safety_score is distinct from old.safety_score
       or new.quality_score is distinct from old.quality_score
       or new.labor_score is distinct from old.labor_score
       or new.compliance_score is distinct from old.compliance_score
       or new.observations is distinct from old.observations then
      v_event := 'actualizada';
    else
      return new;
    end if;
  end if;

  v_reason := case when v_event='reabierta' then new.reopen_reason else null end;

  insert into public.contractor_evaluation_events(
    evaluation_id,event_type,from_status,to_status,reason,snapshot,actor_profile_id
  ) values (
    new.id,v_event,case when tg_op='UPDATE' then old.status else null end,new.status,v_reason,
    jsonb_build_object(
      'period_start',new.period_start,
      'period_end',new.period_end,
      'safety_score',new.safety_score,
      'quality_score',new.quality_score,
      'labor_score',new.labor_score,
      'compliance_score',new.compliance_score,
      'total_score',new.total_score,
      'risk_level',new.risk_level,
      'observations',new.observations
    ),
    auth.uid()
  );
  return new;
end;
$$;

drop trigger if exists audit_contractor_evaluation_lifecycle on public.contractor_evaluations;
create trigger audit_contractor_evaluation_lifecycle
after insert or update on public.contractor_evaluations
for each row execute function private.audit_contractor_evaluation_lifecycle();

create or replace function private.guard_evaluation_action_plan_lifecycle()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
declare
  v_eval_status text;
  v_acc_active boolean;
  v_project_status text;
  v_project_id uuid;
  v_contratista_id uuid;
  v_uid uuid := auth.uid();
  v_privileged boolean := false;
  v_contractor boolean := false;
  v_attachment_count integer := 0;
begin
  select e.status,a.is_active,p.status,p.id,a.contratista_id
  into v_eval_status,v_acc_active,v_project_status,v_project_id,v_contratista_id
  from public.contractor_evaluations e
  join public.accreditations a on a.id=e.accreditation_id
  join public.projects p on p.id=a.project_id
  where e.id=coalesce(new.evaluation_id,old.evaluation_id);

  if v_project_id is null then
    raise exception using errcode='23503', message='La evaluación asociada no existe.';
  end if;

  v_privileged := private.is_acredita_staff() or private.can_manage_project(v_project_id);
  v_contractor := exists(
    select 1 from public.contratista_memberships cm
    where cm.contratista_id=v_contratista_id
      and cm.profile_id=v_uid
      and cm.is_active
  );

  if tg_op='INSERT' then
    if not v_privileged then
      raise exception using errcode='42501', message='Solo Mandante o Acredita puede crear planes de acción.';
    end if;
    if v_acc_active is distinct from true or v_project_status is distinct from 'active' then
      raise exception using errcode='42501', message='No se pueden crear planes en una relación o proyecto histórico.';
    end if;
    if v_eval_status not in ('borrador','publicada') then
      raise exception using errcode='22023', message='No se pueden agregar planes a una evaluación cerrada.';
    end if;
    new.title := btrim(new.title);
    new.description := btrim(new.description);
    new.owner_name := nullif(btrim(coalesce(new.owner_name,'')),'');
    if char_length(new.title)<3 or char_length(new.description)<3 then
      raise exception using errcode='22023', message='El plan debe incluir título y descripción válidos.';
    end if;
    if new.owner_name is null then
      raise exception using errcode='22023', message='Define un responsable para el plan de acción.';
    end if;
    if new.due_date is null then
      raise exception using errcode='22023', message='Define una fecha límite para el plan de acción.';
    end if;
    if new.due_date < current_date then
      raise exception using errcode='22023', message='La fecha límite del plan no puede quedar en el pasado.';
    end if;
    new.status := 'pendiente';
    new.created_by := coalesce(new.created_by,v_uid);
    new.completed_at := null;
    new.submitted_at := null;
    new.reviewed_at := null;
    new.reviewed_by := null;
    new.review_comment := null;
    return new;
  end if;

  if new.evaluation_id is distinct from old.evaluation_id then
    raise exception using errcode='42501', message='El plan no puede moverse a otra evaluación.';
  end if;
  if v_acc_active is distinct from true or v_project_status is distinct from 'active' then
    raise exception using errcode='42501', message='El proyecto o la relación del contratista está en modo histórico.';
  end if;
  if v_eval_status='cerrada' then
    raise exception using errcode='42501', message='La evaluación está cerrada. Debes reabrirla antes de modificar sus planes.';
  end if;

  new.title := btrim(new.title);
  new.description := btrim(new.description);
  new.owner_name := nullif(btrim(coalesce(new.owner_name,'')),'');
  new.evidence := nullif(btrim(coalesce(new.evidence,'')),'');
  new.review_comment := nullif(btrim(coalesce(new.review_comment,'')),'');

  if new.evidence is not null and char_length(new.evidence)>4000 then
    raise exception using errcode='22023', message='La evidencia supera el largo permitido.';
  end if;
  if new.review_comment is not null and char_length(new.review_comment)>4000 then
    raise exception using errcode='22023', message='El comentario de revisión supera el largo permitido.';
  end if;

  if v_contractor and not v_privileged then
    if v_eval_status <> 'publicada' then
      raise exception using errcode='42501', message='El contratista solo puede trabajar planes de evaluaciones publicadas.';
    end if;
    if new.title is distinct from old.title
       or new.description is distinct from old.description
       or new.owner_name is distinct from old.owner_name
       or new.due_date is distinct from old.due_date
       or new.created_by is distinct from old.created_by
       or new.created_at is distinct from old.created_at
       or new.reviewed_by is distinct from old.reviewed_by
       or new.reviewed_at is distinct from old.reviewed_at
       or new.review_comment is distinct from old.review_comment then
      raise exception using errcode='42501', message='El contratista solo puede registrar avance y enviar evidencia.';
    end if;

    if old.status='pendiente' and new.status not in ('en_progreso','en_revision') then
      raise exception using errcode='22023', message='El plan pendiente solo puede iniciarse o enviarse a revisión.';
    elsif old.status='en_progreso' and new.status not in ('en_progreso','en_revision') then
      raise exception using errcode='22023', message='El plan en progreso solo puede guardar avance o enviarse a revisión.';
    elsif old.status in ('en_revision','completado','cancelado') then
      raise exception using errcode='42501', message='El plan no admite cambios del contratista en su estado actual.';
    end if;

    if new.status='en_revision' then
      select count(*) into v_attachment_count
      from public.operation_attachments oa
      where oa.action_plan_id=old.id;
      if (new.evidence is null or char_length(new.evidence)<3) and v_attachment_count=0 then
        raise exception using errcode='22023', message='Agrega un comentario o archivo de evidencia antes de enviar el plan a revisión.';
      end if;
      new.submitted_at := now();
      new.reviewed_at := null;
      new.reviewed_by := null;
      new.review_comment := null;
    end if;
    new.completed_at := null;
    return new;
  end if;

  if not v_privileged then
    raise exception using errcode='42501', message='No tienes permisos para modificar este plan de acción.';
  end if;

  if char_length(new.title)<3 or char_length(new.description)<3 or new.owner_name is null or new.due_date is null then
    raise exception using errcode='22023', message='Título, descripción, responsable y fecha límite son obligatorios.';
  end if;

  if new.status is distinct from old.status then
    if old.status='en_revision' and new.status='completado' then
      new.completed_at := now();
      new.reviewed_at := now();
      new.reviewed_by := v_uid;
    elsif old.status='en_revision' and new.status='en_progreso' then
      if new.review_comment is null or char_length(new.review_comment)<3 then
        raise exception using errcode='22023', message='Indica por qué devuelves el plan al contratista.';
      end if;
      new.completed_at := null;
      new.reviewed_at := now();
      new.reviewed_by := v_uid;
    elsif old.status in ('pendiente','en_progreso') and new.status='cancelado' then
      if new.review_comment is null or char_length(new.review_comment)<3 then
        raise exception using errcode='22023', message='Indica el motivo de cancelación del plan.';
      end if;
      new.completed_at := null;
      new.reviewed_at := now();
      new.reviewed_by := v_uid;
    elsif old.status in ('completado','cancelado') and new.status='en_progreso' then
      if new.review_comment is null or char_length(new.review_comment)<3 then
        raise exception using errcode='22023', message='Indica el motivo de reapertura del plan.';
      end if;
      new.completed_at := null;
      new.reviewed_at := now();
      new.reviewed_by := v_uid;
      new.submitted_at := null;
    elsif old.status='pendiente' and new.status='en_progreso' then
      null;
    else
      raise exception using errcode='22023', message='Transición de estado no permitida para el plan de acción.';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists guard_contractor_action_plan_progress on public.evaluation_action_plans;
drop trigger if exists guard_evaluation_action_plan_lifecycle on public.evaluation_action_plans;
create trigger guard_evaluation_action_plan_lifecycle
before insert or update on public.evaluation_action_plans
for each row execute function private.guard_evaluation_action_plan_lifecycle();

create or replace function private.audit_evaluation_action_plan_lifecycle()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
declare
  v_event text;
  v_comment text;
begin
  if tg_op='INSERT' then
    v_event := 'creado';
  elsif new.status is distinct from old.status then
    v_event := case
      when old.status='pendiente' and new.status='en_progreso' then 'iniciado'
      when new.status='en_revision' then 'enviado_revision'
      when old.status='en_revision' and new.status='completado' then 'aprobado'
      when old.status='en_revision' and new.status='en_progreso' then 'devuelto'
      when new.status='cancelado' then 'cancelado'
      when old.status in ('completado','cancelado') and new.status='en_progreso' then 'reabierto'
      else 'actualizado'
    end;
  elsif new.evidence is distinct from old.evidence
     or new.title is distinct from old.title
     or new.description is distinct from old.description
     or new.owner_name is distinct from old.owner_name
     or new.due_date is distinct from old.due_date then
    v_event := 'actualizado';
  else
    return new;
  end if;

  v_comment := case when new.review_comment is distinct from old.review_comment then new.review_comment else null end;

  insert into public.evaluation_action_plan_events(
    action_plan_id,event_type,from_status,to_status,comment,evidence_snapshot,actor_profile_id
  ) values (
    new.id,v_event,case when tg_op='UPDATE' then old.status else null end,new.status,
    v_comment,new.evidence,auth.uid()
  );
  return new;
end;
$$;

drop trigger if exists audit_evaluation_action_plan_lifecycle on public.evaluation_action_plans;
create trigger audit_evaluation_action_plan_lifecycle
after insert or update on public.evaluation_action_plans
for each row execute function private.audit_evaluation_action_plan_lifecycle();

create or replace function private.guard_action_plan_attachment()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
declare
  v_plan_status text;
  v_eval_status text;
  v_acc_active boolean;
  v_project_status text;
  v_project_id uuid;
  v_contratista_id uuid;
  v_uid uuid := auth.uid();
  v_privileged boolean;
  v_contractor boolean;
begin
  if new.action_plan_id is null then return new; end if;

  select ap.status,e.status,a.is_active,p.status,p.id,a.contratista_id
  into v_plan_status,v_eval_status,v_acc_active,v_project_status,v_project_id,v_contratista_id
  from public.evaluation_action_plans ap
  join public.contractor_evaluations e on e.id=ap.evaluation_id
  join public.accreditations a on a.id=e.accreditation_id
  join public.projects p on p.id=a.project_id
  where ap.id=new.action_plan_id;

  if v_project_id is null then
    raise exception using errcode='23503', message='El plan de acción no existe.';
  end if;

  v_privileged := private.is_acredita_staff() or private.can_manage_project(v_project_id);
  v_contractor := exists(
    select 1 from public.contratista_memberships cm
    where cm.contratista_id=v_contratista_id and cm.profile_id=v_uid and cm.is_active
  );

  if v_acc_active is distinct from true or v_project_status is distinct from 'active' then
    raise exception using errcode='42501', message='No puedes agregar evidencia a un proyecto histórico.';
  end if;

  if v_contractor and not v_privileged then
    if v_eval_status<>'publicada' or v_plan_status not in ('pendiente','en_progreso') then
      raise exception using errcode='42501', message='Solo puedes adjuntar evidencia mientras el plan esté abierto.';
    end if;
  elsif v_privileged then
    if v_eval_status='cerrada' or v_plan_status in ('completado','cancelado') then
      raise exception using errcode='42501', message='No puedes adjuntar archivos a un plan cerrado.';
    end if;
  else
    raise exception using errcode='42501', message='No tienes acceso para adjuntar evidencia a este plan.';
  end if;

  return new;
end;
$$;

drop trigger if exists guard_action_plan_attachment on public.operation_attachments;
create trigger guard_action_plan_attachment
before insert on public.operation_attachments
for each row execute function private.guard_action_plan_attachment();

drop policy if exists evaluations_insert on public.contractor_evaluations;
create policy evaluations_insert on public.contractor_evaluations
for insert to authenticated
with check (
  private.is_acredita_staff()
  or exists(
    select 1 from public.accreditations a
    join public.projects p on p.id=a.project_id
    where a.id=contractor_evaluations.accreditation_id
      and a.is_active and p.status='active'
      and private.can_manage_project(a.project_id)
  )
);

drop policy if exists evaluations_update on public.contractor_evaluations;
create policy evaluations_update on public.contractor_evaluations
for update to authenticated
using (
  private.is_acredita_staff()
  or exists(
    select 1 from public.accreditations a
    join public.projects p on p.id=a.project_id
    where a.id=contractor_evaluations.accreditation_id
      and a.is_active and p.status='active'
      and private.can_manage_project(a.project_id)
  )
)
with check (
  private.is_acredita_staff()
  or exists(
    select 1 from public.accreditations a
    join public.projects p on p.id=a.project_id
    where a.id=contractor_evaluations.accreditation_id
      and a.is_active and p.status='active'
      and private.can_manage_project(a.project_id)
  )
);

drop policy if exists evaluations_delete on public.contractor_evaluations;
create policy evaluations_delete on public.contractor_evaluations
for delete to authenticated
using (
  status='borrador'
  and (
    private.is_acredita_staff()
    or exists(
      select 1 from public.accreditations a
      join public.projects p on p.id=a.project_id
      where a.id=contractor_evaluations.accreditation_id
        and a.is_active and p.status='active'
        and private.can_manage_project(a.project_id)
    )
  )
);

drop policy if exists action_plans_insert on public.evaluation_action_plans;
create policy action_plans_insert on public.evaluation_action_plans
for insert to authenticated
with check (
  created_by=auth.uid()
  and exists(
    select 1
    from public.contractor_evaluations e
    join public.accreditations a on a.id=e.accreditation_id
    join public.projects p on p.id=a.project_id
    where e.id=evaluation_action_plans.evaluation_id
      and a.is_active and p.status='active'
      and e.status in ('borrador','publicada')
      and (private.is_acredita_staff() or private.can_manage_project(a.project_id))
  )
);

drop policy if exists action_plans_update on public.evaluation_action_plans;
create policy action_plans_update on public.evaluation_action_plans
for update to authenticated
using (
  exists(
    select 1
    from public.contractor_evaluations e
    join public.accreditations a on a.id=e.accreditation_id
    join public.projects p on p.id=a.project_id
    where e.id=evaluation_action_plans.evaluation_id
      and a.is_active and p.status='active'
      and (
        private.is_acredita_staff()
        or private.can_manage_project(a.project_id)
        or (
          e.status='publicada'
          and exists(
            select 1 from public.contratista_memberships cm
            where cm.contratista_id=a.contratista_id
              and cm.profile_id=auth.uid()
              and cm.is_active
          )
        )
      )
  )
)
with check (
  exists(
    select 1
    from public.contractor_evaluations e
    join public.accreditations a on a.id=e.accreditation_id
    join public.projects p on p.id=a.project_id
    where e.id=evaluation_action_plans.evaluation_id
      and a.is_active and p.status='active'
      and (
        private.is_acredita_staff()
        or private.can_manage_project(a.project_id)
        or (
          e.status='publicada'
          and exists(
            select 1 from public.contratista_memberships cm
            where cm.contratista_id=a.contratista_id
              and cm.profile_id=auth.uid()
              and cm.is_active
          )
        )
      )
  )
);

create or replace function public.update_contractor_action_plan(p_plan_id uuid,p_status text,p_evidence text default null)
returns void
language plpgsql
set search_path='pg_catalog','public','private'
as $$
declare v_evidence text := nullif(btrim(coalesce(p_evidence,'')),'');
begin
  if auth.uid() is null then raise exception using errcode='28000', message='Sesión inválida.'; end if;
  if p_status not in ('en_progreso','en_revision') then
    raise exception using errcode='22023', message='El contratista solo puede iniciar un plan o enviarlo a revisión.';
  end if;
  if v_evidence is not null and char_length(v_evidence)>4000 then
    raise exception using errcode='22023', message='La evidencia supera el largo permitido.';
  end if;
  update public.evaluation_action_plans
  set status=p_status,evidence=case when v_evidence is not null then v_evidence else evidence end
  where id=p_plan_id;
  if not found then raise exception using errcode='42501', message='No tienes permisos para actualizar este plan de acción.'; end if;
end;
$$;

revoke all on function public.update_contractor_action_plan(uuid,text,text) from public,anon;
grant execute on function public.update_contractor_action_plan(uuid,text,text) to authenticated,service_role;

create or replace function public.review_evaluation_action_plan(p_plan_id uuid,p_decision text,p_comment text default null)
returns void
language plpgsql
set search_path='pg_catalog','public','private'
as $$
declare
  v_status text;
  v_comment text := nullif(btrim(coalesce(p_comment,'')),'');
begin
  if auth.uid() is null then raise exception using errcode='28000', message='Sesión inválida.'; end if;
  if p_decision not in ('aprobar','devolver','cancelar','reabrir') then
    raise exception using errcode='22023', message='Decisión de revisión inválida.';
  end if;
  if p_decision in ('devolver','cancelar','reabrir') and (v_comment is null or char_length(v_comment)<3) then
    raise exception using errcode='22023', message='La decisión requiere un fundamento.';
  end if;
  v_status := case when p_decision='aprobar' then 'completado' when p_decision='cancelar' then 'cancelado' else 'en_progreso' end;
  update public.evaluation_action_plans set status=v_status,review_comment=v_comment where id=p_plan_id;
  if not found then raise exception using errcode='42501', message='No tienes permisos para revisar este plan de acción.'; end if;
end;
$$;

revoke all on function public.review_evaluation_action_plan(uuid,text,text) from public,anon;
grant execute on function public.review_evaluation_action_plan(uuid,text,text) to authenticated,service_role;

create or replace function public.set_contractor_evaluation_status(p_evaluation_id uuid,p_status text,p_reason text default null)
returns void
language plpgsql
set search_path='pg_catalog','public','private'
as $$
begin
  if auth.uid() is null then raise exception using errcode='28000', message='Sesión inválida.'; end if;
  if p_status not in ('publicada','cerrada') then raise exception using errcode='22023', message='Estado de evaluación inválido.'; end if;
  update public.contractor_evaluations
  set status=p_status,
      reopen_reason=case when status='cerrada' and p_status='publicada' then nullif(btrim(coalesce(p_reason,'')),'') else reopen_reason end
  where id=p_evaluation_id;
  if not found then raise exception using errcode='42501', message='No tienes permisos para modificar esta evaluación.'; end if;
end;
$$;

revoke all on function public.set_contractor_evaluation_status(uuid,text,text) from public,anon;
grant execute on function public.set_contractor_evaluation_status(uuid,text,text) to authenticated,service_role;

create or replace function private.notify_action_plan_lifecycle()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
declare
  v_acc uuid;
  v_eval_status text;
begin
  select e.accreditation_id,e.status into v_acc,v_eval_status
  from public.contractor_evaluations e where e.id=new.evaluation_id;
  if v_acc is null then return new; end if;

  if tg_op='INSERT' then
    if v_eval_status='publicada' then
      perform private.emit_contractor_notification(
        v_acc,'action_plan_created:'||new.id::text,'action_plan_created:'||new.id::text,'accion','action',
        'Nuevo plan de acción',
        new.title||' · Responsable: '||coalesce(new.owner_name,'Sin responsable')||case when new.due_date is not null then ' · vence '||new.due_date::text else '' end,
        'Ver plan','operacion',null,null,null,null,null,null,null,true
      );
    end if;
    return new;
  end if;

  if new.status is not distinct from old.status then return new; end if;

  if new.status='en_revision' then
    perform private.resolve_contractor_notifications(v_acc,array[
      'action_plan_created:'||new.id::text,'action_plan_due:'||new.id::text,
      'action_plan_overdue:'||new.id::text,'action_plan_returned:'||new.id::text
    ]::text[]);
    perform private.emit_contractor_notification(
      v_acc,'action_plan_submitted:'||new.id::text,'action_plan_submitted:'||new.id::text,'revision','info',
      'Plan de acción enviado a revisión',
      new.title||' fue enviado al Mandante/Acredita para validar su evidencia.',
      'Ver plan','operacion',null,null,null,null,null,null,null,false
    );
  elsif old.status='en_revision' and new.status='en_progreso' then
    perform private.resolve_contractor_notifications(v_acc,array['action_plan_submitted:'||new.id::text]::text[]);
    perform private.emit_contractor_notification(
      v_acc,'action_plan_returned:'||new.id::text,'action_plan_returned:'||new.id::text,'accion','action',
      'Plan de acción devuelto',
      new.title||' requiere ajustes. '||coalesce(new.review_comment,'Revisa las observaciones del revisor.'),
      'Corregir plan','operacion',null,null,null,null,null,null,null,true
    );
  elsif new.status='completado' then
    perform private.resolve_contractor_notifications(v_acc,array[
      'action_plan_created:'||new.id::text,'action_plan_due:'||new.id::text,'action_plan_overdue:'||new.id::text,
      'action_plan_returned:'||new.id::text,'action_plan_submitted:'||new.id::text
    ]::text[]);
    perform private.emit_contractor_notification(
      v_acc,'action_plan_completed:'||new.id::text,'action_plan_completed:'||new.id::text,'positiva','info',
      'Plan de acción aprobado',new.title||' fue validado y quedó completado.',
      'Ver plan','operacion',null,null,null,null,null,null,null,true
    );
  elsif new.status='cancelado' then
    perform private.resolve_contractor_notifications(v_acc,array[
      'action_plan_created:'||new.id::text,'action_plan_due:'||new.id::text,'action_plan_overdue:'||new.id::text,
      'action_plan_returned:'||new.id::text,'action_plan_submitted:'||new.id::text
    ]::text[]);
  elsif old.status in ('completado','cancelado') and new.status='en_progreso' then
    perform private.resolve_contractor_notifications(v_acc,array['action_plan_completed:'||new.id::text]::text[]);
    perform private.emit_contractor_notification(
      v_acc,'action_plan_reopened:'||new.id::text,'action_plan_reopened:'||new.id::text,'accion','action',
      'Plan de acción reabierto',new.title||' fue reabierto. '||coalesce(new.review_comment,'Revisa el nuevo requerimiento.'),
      'Ver plan','operacion',null,null,null,null,null,null,null,true
    );
  end if;
  return new;
end;
$$;

drop trigger if exists notify_action_plan_lifecycle on public.evaluation_action_plans;
create trigger notify_action_plan_lifecycle
after insert or update of status on public.evaluation_action_plans
for each row execute function private.notify_action_plan_lifecycle();

create or replace function private.notify_evaluation_publication()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
declare r record;
begin
  if old.status is distinct from new.status and new.status='publicada' then
    perform private.emit_contractor_notification(
      new.accreditation_id,
      'evaluation_published:'||new.id::text||':'||coalesce(new.reopened_at::text,'initial'),
      'evaluation_published:'||new.id::text,'informativa','info',
      case when old.status='cerrada' then 'Evaluación reabierta' else 'Nueva evaluación publicada' end,
      'Período '||new.period_start::text||' a '||new.period_end::text||' · puntaje '||new.total_score::text||'% · riesgo '||new.risk_level||'.',
      'Ver evaluación','operacion',null,null,null,null,null,null,null,true
    );
    for r in select id,title,owner_name,due_date from public.evaluation_action_plans
      where evaluation_id=new.id and status in ('pendiente','en_progreso')
    loop
      perform private.emit_contractor_notification(
        new.accreditation_id,'action_plan_created:'||r.id::text,'action_plan_created:'||r.id::text,'accion','action',
        'Plan de acción pendiente',
        r.title||' · Responsable: '||coalesce(r.owner_name,'Sin responsable')||case when r.due_date is not null then ' · vence '||r.due_date::text else '' end,
        'Ver plan','operacion',null,null,null,null,null,null,null,true
      );
    end loop;
  end if;
  return new;
end;
$$;

drop trigger if exists notify_evaluation_publication on public.contractor_evaluations;
create trigger notify_evaluation_publication
after update of status on public.contractor_evaluations
for each row execute function private.notify_evaluation_publication();

create or replace function private.sync_action_plan_notifications()
returns void
language plpgsql
security definer
set search_path=''
as $$
declare r record; v_days integer;
begin
  for r in
    select ap.id,ap.title,ap.owner_name,ap.due_date,e.accreditation_id
    from public.evaluation_action_plans ap
    join public.contractor_evaluations e on e.id=ap.evaluation_id
    join public.accreditations a on a.id=e.accreditation_id
    join public.projects p on p.id=a.project_id
    where ap.status in ('pendiente','en_progreso')
      and e.status='publicada' and a.is_active and p.status='active'
      and ap.due_date is not null
  loop
    v_days := r.due_date-current_date;
    if v_days < 0 then
      perform private.resolve_contractor_notifications(r.accreditation_id,array['action_plan_due:'||r.id::text]::text[]);
      perform private.emit_contractor_notification(
        r.accreditation_id,'action_plan_overdue:'||r.id::text,'action_plan_overdue:'||r.id::text,'accion','action',
        'Plan de acción vencido',r.title||' venció el '||r.due_date::text||'. Envía la evidencia para revisión.',
        'Corregir plan','operacion',null,null,null,null,null,null,null,true
      );
    elsif v_days<=7 then
      perform private.emit_contractor_notification(
        r.accreditation_id,'action_plan_due:'||r.id::text,'action_plan_due:'||r.id::text,'preventiva','preventive',
        case when v_days=0 then 'Plan de acción vence hoy' else 'Plan de acción vence en '||v_days||' días' end,
        r.title||' · fecha límite '||r.due_date::text||'.',
        'Ver plan','operacion',null,null,null,null,null,null,null,true
      );
    end if;
  end loop;
end;
$$;

do $$
declare v_job bigint;
begin
  select jobid into v_job from cron.job where jobname='acredita-action-plan-deadline-sync';
  if v_job is not null then perform cron.unschedule(v_job); end if;
  perform cron.schedule('acredita-action-plan-deadline-sync','40 11 * * *','select private.sync_action_plan_notifications();');
end $$;