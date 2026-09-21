alter table public.assets
  add column if not exists retired_at timestamptz,
  add column if not exists retired_by uuid references public.profiles(id) on delete set null,
  add column if not exists retirement_reason text;

alter table public.asset_requirement_templates
  add column if not exists is_active boolean not null default true,
  add column if not exists retired_at timestamptz,
  add column if not exists retired_by uuid references public.profiles(id) on delete set null,
  add column if not exists retirement_reason text;

do $$
begin
  if not exists (select 1 from pg_constraint where conrelid='public.assets'::regclass and conname='assets_identifier_not_blank') then
    alter table public.assets add constraint assets_identifier_not_blank check (nullif(btrim(identifier),'') is not null);
  end if;
  if not exists (select 1 from pg_constraint where conrelid='public.assets'::regclass and conname='assets_name_not_blank') then
    alter table public.assets add constraint assets_name_not_blank check (nullif(btrim(name),'') is not null);
  end if;
  if not exists (select 1 from pg_constraint where conrelid='public.assets'::regclass and conname='assets_retirement_reason_required') then
    alter table public.assets add constraint assets_retirement_reason_required check (is_active or nullif(btrim(retirement_reason),'') is not null);
  end if;
  if not exists (select 1 from pg_constraint where conrelid='public.asset_requirement_templates'::regclass and conname='asset_templates_document_type_not_blank') then
    alter table public.asset_requirement_templates add constraint asset_templates_document_type_not_blank check (nullif(btrim(document_type),'') is not null);
  end if;
  if not exists (select 1 from pg_constraint where conrelid='public.asset_requirement_templates'::regclass and conname='asset_templates_retirement_reason_required') then
    alter table public.asset_requirement_templates add constraint asset_templates_retirement_reason_required check (is_active or nullif(btrim(retirement_reason),'') is not null);
  end if;
  if not exists (select 1 from pg_constraint where conrelid='public.asset_inspections'::regclass and conname='asset_inspections_dates_valid') then
    alter table public.asset_inspections add constraint asset_inspections_dates_valid check (next_inspection_date is null or next_inspection_date >= inspection_date);
  end if;
  if not exists (select 1 from pg_constraint where conrelid='public.asset_maintenance'::regclass and conname='asset_maintenance_dates_valid') then
    alter table public.asset_maintenance add constraint asset_maintenance_dates_valid check (next_due_at is null or next_due_at >= performed_at);
  end if;
end $$;

alter table public.assets drop constraint if exists assets_accreditation_id_asset_type_identifier_key;
drop index if exists public.assets_active_identifier_ci_unique;
create unique index assets_active_identifier_ci_unique
  on public.assets(accreditation_id,asset_type,lower(btrim(identifier))) where is_active;

alter table public.asset_requirement_templates
  drop constraint if exists asset_requirement_templates_project_id_asset_type_document__key;
drop index if exists public.asset_requirement_templates_document_type_ci_unique;
create unique index asset_requirement_templates_document_type_ci_unique
  on public.asset_requirement_templates(project_id,asset_type,lower(btrim(document_type))) where is_active;

drop index if exists public.asset_documents_document_type_ci_unique;
create unique index asset_documents_document_type_ci_unique
  on public.asset_documents(asset_id,lower(btrim(document_type)));

create index if not exists assets_retired_idx
  on public.assets(accreditation_id,retired_at desc) where not is_active;
create index if not exists asset_templates_retired_idx
  on public.asset_requirement_templates(project_id,asset_type,retired_at desc) where not is_active;

create or replace function private.guard_asset_context()
returns trigger language plpgsql security definer set search_path=''
as $$
declare
  v_acc_active boolean;
  v_project_status text;
  v_service_acc uuid;
  v_service_active boolean;
  v_service_status text;
begin
  new.identifier:=upper(btrim(new.identifier));
  new.name:=btrim(new.name);
  new.brand:=nullif(btrim(coalesce(new.brand,'')),'');
  new.model:=nullif(btrim(coalesce(new.model,'')),'');
  new.owner_name:=nullif(btrim(coalesce(new.owner_name,'')),'');
  new.operator_name:=nullif(btrim(coalesce(new.operator_name,'')),'');
  new.notes:=nullif(btrim(coalesce(new.notes,'')),'');
  if tg_op='UPDATE' then
    if not old.is_active and row(new.*) is distinct from row(old.*) then raise exception 'Un activo retirado es histórico y no puede modificarse'; end if;
    if new.accreditation_id is distinct from old.accreditation_id then raise exception 'La acreditación de un activo no puede cambiarse; retíralo y crea un nuevo registro'; end if;
    if old.is_active and not new.is_active then
      if nullif(btrim(coalesce(new.retirement_reason,'')),'') is null then raise exception 'Debes indicar el motivo de retiro del activo'; end if;
      new.retired_at:=coalesce(new.retired_at,now());
      new.retired_by:=coalesce(new.retired_by,(select auth.uid()));
      new.status:='inactivo'; new.access_allowed:=false;
    elsif not old.is_active and new.is_active then
      raise exception 'Un activo histórico no puede reactivarse; registra un nuevo ingreso';
    end if;
  end if;
  select ac.is_active,p.status into v_acc_active,v_project_status
  from public.accreditations ac join public.projects p on p.id=ac.project_id where ac.id=new.accreditation_id;
  if new.is_active and (coalesce(v_acc_active,false)=false or v_project_status<>'active') then raise exception 'El activo solo puede operar dentro de una acreditación y proyecto activos'; end if;
  if new.service_id is not null then
    select s.accreditation_id,s.is_active,s.status into v_service_acc,v_service_active,v_service_status from public.services s where s.id=new.service_id;
    if v_service_acc is null or v_service_acc<>new.accreditation_id then raise exception 'El servicio seleccionado no pertenece a la misma acreditación del activo'; end if;
    if new.is_active and (not coalesce(v_service_active,false) or v_service_status<>'activo') then raise exception 'El activo no puede asociarse a un servicio inactivo o finalizado'; end if;
  end if;
  return new;
end $$;
revoke all on function private.guard_asset_context() from public,anon,authenticated;
drop trigger if exists assets_guard_context on public.assets;
create trigger assets_guard_context before insert or update on public.assets for each row execute function private.guard_asset_context();

create or replace function private.guard_asset_operational_decision()
returns trigger language plpgsql security definer set search_path=''
as $$
declare v_automated boolean:=pg_trigger_depth()>1; v_retirement boolean:=false;
begin
  if tg_op='INSERT' then
    if new.status<>'pendiente' or new.access_allowed then raise exception 'El estado operacional inicial del activo debe ser pendiente y sin acceso'; end if;
    return new;
  end if;
  v_retirement:=old.is_active and not new.is_active and new.status='inactivo' and not new.access_allowed;
  if not v_automated and not v_retirement and (new.status is distinct from old.status or new.access_allowed is distinct from old.access_allowed) then
    raise exception 'El estado y acceso del activo se calculan automáticamente';
  end if;
  return new;
end $$;
revoke all on function private.guard_asset_operational_decision() from public,anon,authenticated;

create or replace function private.guard_asset_template_lifecycle()
returns trigger language plpgsql security definer set search_path=''
as $$
begin
  new.document_type:=btrim(new.document_type);
  if tg_op='UPDATE' then
    if not old.is_active and row(new.*) is distinct from row(old.*) then raise exception 'Un requisito retirado es histórico y no puede modificarse'; end if;
    if new.project_id is distinct from old.project_id or new.asset_type is distinct from old.asset_type then raise exception 'El contexto del requisito no puede cambiarse; retíralo y crea uno nuevo'; end if;
    if old.is_active and not new.is_active then
      if nullif(btrim(coalesce(new.retirement_reason,'')),'') is null then raise exception 'Debes indicar el motivo de retiro del requisito'; end if;
      new.retired_at:=coalesce(new.retired_at,now()); new.retired_by:=coalesce(new.retired_by,(select auth.uid()));
    elsif not old.is_active and new.is_active then raise exception 'Un requisito histórico no puede reactivarse; crea una nueva versión';
    end if;
  end if;
  return new;
end $$;
revoke all on function private.guard_asset_template_lifecycle() from public,anon,authenticated;
drop trigger if exists asset_templates_guard_lifecycle on public.asset_requirement_templates;
create trigger asset_templates_guard_lifecycle before insert or update on public.asset_requirement_templates for each row execute function private.guard_asset_template_lifecycle();

create or replace function private.guard_asset_document_decision()
returns trigger language plpgsql security definer set search_path=''
as $$
declare
  v_project_id uuid; v_asset_type text; v_asset_active boolean; v_acc_active boolean; v_project_status text;
  v_validity_days integer; v_template_found boolean:=false; v_can_decide boolean;
begin
  select ac.project_id,a.asset_type,a.is_active,ac.is_active,p.status into v_project_id,v_asset_type,v_asset_active,v_acc_active,v_project_status
  from public.assets a join public.accreditations ac on ac.id=a.accreditation_id join public.projects p on p.id=ac.project_id where a.id=new.asset_id;
  if v_project_id is null then raise exception 'Activo no encontrado'; end if;
  if not v_asset_active or not v_acc_active or v_project_status<>'active' then raise exception 'El proyecto o activo está en modo histórico y no admite nuevas decisiones documentales'; end if;
  if tg_op='UPDATE' and (new.asset_id is distinct from old.asset_id or lower(btrim(new.document_type)) is distinct from lower(btrim(old.document_type))) then raise exception 'El requisito asociado al documento no puede cambiarse'; end if;
  new.document_type:=btrim(new.document_type);
  select true,t.validity_days into v_template_found,v_validity_days
  from public.asset_requirement_templates t where t.project_id=v_project_id and t.asset_type=v_asset_type and t.is_active
    and lower(btrim(t.document_type))=lower(btrim(new.document_type)) limit 1;
  if not coalesce(v_template_found,false) then raise exception 'El documento no corresponde a un requisito activo de este tipo de activo'; end if;
  v_can_decide:=(select private.is_acredita_staff()) or (select private.can_manage_project(v_project_id));
  if not v_can_decide then
    if new.status<>'en_revision' or new.reviewed_by is not null or new.reviewed_at is not null then raise exception 'El contratista solo puede enviar o reenviar el documento a revisión'; end if;
    new.rejection_reason:=null;
  end if;
  if new.status='en_revision' then
    new.reviewed_by:=null; new.reviewed_at:=null; new.rejection_reason:=null;
  elsif new.status='rechazado' then
    if not v_can_decide then raise exception 'Solo Mandante o Acredita pueden rechazar documentos'; end if;
    if nullif(btrim(coalesce(new.rejection_reason,'')),'') is null then raise exception 'Debes indicar el motivo del rechazo'; end if;
  elsif new.status='aprobado' then
    if not v_can_decide then raise exception 'Solo Mandante o Acredita pueden aprobar documentos'; end if;
    if new.issued_at is not null and new.issued_at>current_date then raise exception 'La fecha de emisión no puede estar en el futuro'; end if;
    if v_validity_days is not null then
      if new.issued_at is null then raise exception 'Este requisito exige fecha de emisión para calcular su vigencia'; end if;
      new.expires_at:=new.issued_at+v_validity_days;
    end if;
    if new.expires_at is not null and new.expires_at<current_date then raise exception 'No se puede aprobar un documento ya vencido'; end if;
    new.rejection_reason:=null;
  end if;
  return new;
end $$;
revoke all on function private.guard_asset_document_decision() from public,anon,authenticated;

create or replace view public.asset_registry with (security_invoker=true) as
select
  a.id,a.integration_key,p.integration_key as project_key,c.integration_key as contractor_key,s.integration_key as service_key,
  a.accreditation_id,a.service_id,a.asset_type,a.identifier,a.name,a.brand,a.model,a.year,a.owner_name,a.operator_name,
  case
    when not a.is_active or not ac.is_active or p.status<>'active' then 'inactivo'
    when a.service_id is not null and not coalesce(svc.operational,false) then 'bloqueado'
    when coalesce(ins.blocked,false) or coalesce(maint.blocked,false) or coalesce(d.blocked_documents,0)>0 then 'bloqueado'
    when coalesce(ins.pending,false) or coalesce(d.unsatisfied_documents,0)>0 then 'en_revision'
    when coalesce(d.required_documents,0)=0 then 'pendiente'
    else 'habilitado'
  end::text as status,
  (a.is_active and ac.is_active and p.status='active'
    and (a.service_id is null or coalesce(svc.operational,false))
    and coalesce(d.required_documents,0)>0 and coalesce(d.access_unsatisfied_documents,0)=0
    and not coalesce(ins.blocked,false) and not coalesce(ins.pending,false) and not coalesce(maint.blocked,false)) as access_allowed,
  a.notes,a.is_active,
  coalesce(d.required_documents,0)::integer as total_documents,
  coalesce(d.satisfied_documents,0)::integer as approved_documents,
  coalesce(d.blocked_documents,0)::integer as blocking_documents,
  d.next_expiry,a.retired_at,a.retired_by,a.retirement_reason,
  coalesce(d.unsatisfied_documents,0)::integer as pending_documents,
  ins.result as inspection_status,ins.next_inspection_date,maint.next_due_at as next_maintenance_date,
  coalesce(op.active_operators,0)::integer as active_operators,
  (a.service_id is null or coalesce(svc.operational,false)) as service_operational
from public.assets a
join public.accreditations ac on ac.id=a.accreditation_id
join public.projects p on p.id=ac.project_id
join public.contratistas c on c.id=ac.contratista_id
left join public.services s on s.id=a.service_id
left join lateral (
  select (s2.id is not null and s2.accreditation_id=a.accreditation_id and s2.is_active and s2.status='activo'
    and (s2.starts_at is null or s2.starts_at<=current_date) and (s2.ends_at is null or s2.ends_at>=current_date)) operational
  from public.services s2 where s2.id=a.service_id
) svc on true
left join lateral (
  select
    count(*) filter (where t.is_required) required_documents,
    count(*) filter (where t.is_required and ad.id is not null and ad.status='aprobado' and (ad.expires_at is null or ad.expires_at>=current_date)) satisfied_documents,
    count(*) filter (where t.is_required and (ad.id is null or ad.status<>'aprobado' or (ad.expires_at is not null and ad.expires_at<current_date))) unsatisfied_documents,
    count(*) filter (where t.is_required and t.blocks_access and (ad.id is null or ad.status<>'aprobado' or (ad.expires_at is not null and ad.expires_at<current_date))) access_unsatisfied_documents,
    count(*) filter (where t.is_required and t.blocks_access and ad.id is not null and (ad.status in ('rechazado','vencido') or (ad.expires_at is not null and ad.expires_at<current_date))) blocked_documents,
    min(ad.expires_at) filter (where t.is_required and ad.status='aprobado' and ad.expires_at>=current_date) next_expiry
  from public.asset_requirement_templates t
  left join public.asset_documents ad on ad.asset_id=a.id and lower(btrim(ad.document_type))=lower(btrim(t.document_type))
  where t.project_id=ac.project_id and t.asset_type=a.asset_type and t.is_active
) d on true
left join lateral (
  select ai.result,ai.next_inspection_date,
    (ai.result='rechazado' or (ai.next_inspection_date is not null and ai.next_inspection_date<current_date)) blocked,
    (ai.result='observado') pending
  from public.asset_inspections ai where ai.asset_id=a.id order by ai.inspection_date desc,ai.created_at desc limit 1
) ins on true
left join lateral (
  select am.next_due_at,(am.next_due_at is not null and am.next_due_at<current_date) blocked
  from public.asset_maintenance am where am.asset_id=a.id order by am.performed_at desc,am.created_at desc limit 1
) maint on true
left join lateral (
  select count(*) active_operators from public.asset_operator_assignments ao
  where ao.asset_id=a.id and ao.status='activo' and ao.valid_from<=current_date and (ao.valid_until is null or ao.valid_until>=current_date)
) op on true;
revoke all on public.asset_registry from anon;
grant select on public.asset_registry to authenticated,service_role;

create or replace function private.asset_requirements_satisfied(p_asset_id uuid,p_accreditation_id uuid,p_asset_type text)
returns boolean language sql stable security definer set search_path=''
as $$
  with required as (
    select t.id,t.document_type from public.accreditations ac
    join public.asset_requirement_templates t on t.project_id=ac.project_id and t.asset_type=p_asset_type and t.is_required=true and t.is_active=true
    where ac.id=p_accreditation_id
  ), status as (
    select r.id,ad.id document_id,ad.status,ad.expires_at from required r
    left join public.asset_documents ad on ad.asset_id=p_asset_id and lower(btrim(ad.document_type))=lower(btrim(r.document_type))
  )
  select count(*)>0 and count(*) filter (where document_id is null or status<>'aprobado' or (expires_at is not null and expires_at<current_date))=0 from status;
$$;
revoke all on function private.asset_requirements_satisfied(uuid,uuid,text) from public,anon,authenticated;
grant execute on function private.asset_requirements_satisfied(uuid,uuid,text) to service_role;

create or replace function private.refresh_asset_status(p_asset_id uuid)
returns void language plpgsql security definer set search_path=''
as $$
declare v_status text; v_access boolean;
begin
  select r.status,r.access_allowed into v_status,v_access from public.asset_registry r where r.id=p_asset_id;
  if v_status is null then return; end if;
  update public.assets set status=v_status,access_allowed=v_access
  where id=p_asset_id and (status is distinct from v_status or access_allowed is distinct from v_access);
end $$;
revoke all on function private.refresh_asset_status(uuid) from public,anon,authenticated;

create or replace view public.asset_requirement_statuses with (security_invoker=true) as
select a.id asset_id,p.integration_key project_key,c.integration_key contractor_key,a.asset_type,
  t.id template_id,t.document_type,t.validity_days,t.blocks_access,t.is_required,t.review_checklist,
  ad.id document_id,ad.document_name,ad.issued_at,ad.expires_at,ad.rejection_reason,
  case when ad.id is null then 'pendiente' when ad.expires_at is not null and ad.expires_at<current_date then 'vencido' else ad.status end effective_status,
  ad.status='aprobado' and (ad.expires_at is null or ad.expires_at>=current_date) satisfied
from public.assets a join public.accreditations ac on ac.id=a.accreditation_id
join public.projects p on p.id=ac.project_id join public.contratistas c on c.id=ac.contratista_id
join public.asset_requirement_templates t on t.project_id=ac.project_id and t.asset_type=a.asset_type and (t.is_active or not a.is_active)
left join public.asset_documents ad on ad.asset_id=a.id and lower(btrim(ad.document_type))=lower(btrim(t.document_type));
revoke all on public.asset_requirement_statuses from anon;
grant select on public.asset_requirement_statuses to authenticated,service_role;

create or replace view public.asset_operator_candidates with (security_invoker=true) as
select wa.id worker_assignment_id,a.id accreditation_id,p.integration_key project_key,c.integration_key contractor_key,
  w.id worker_id,w.full_name,w.rut,coalesce(wa.job_title,w.job_title) job_title,wa.access_status
from public.worker_assignments wa join public.accreditations a on a.id=wa.accreditation_id
join public.projects p on p.id=a.project_id join public.contratistas c on c.id=a.contratista_id join public.workers w on w.id=wa.worker_id
where wa.is_active and wa.assignment_status='activa' and wa.access_status='habilitado' and a.is_active and p.status='active' and w.is_active
  and (coalesce(wa.contract_start_date_snapshot,w.contract_start_date) is null or coalesce(wa.contract_start_date_snapshot,w.contract_start_date)<=current_date)
  and (coalesce(wa.contract_end_date_snapshot,w.contract_end_date) is null or coalesce(wa.contract_end_date_snapshot,w.contract_end_date)>=current_date);
revoke all on public.asset_operator_candidates from anon;
grant select on public.asset_operator_candidates to authenticated,service_role;

create or replace view public.asset_operator_assignment_details with (security_invoker=true) as
select ao.id,ao.asset_id,ao.worker_assignment_id,w.full_name,w.rut,coalesce(wa.job_title,w.job_title) job_title,
  ao.valid_from,ao.valid_until,ao.status,ao.created_at
from public.asset_operator_assignments ao join public.worker_assignments wa on wa.id=ao.worker_assignment_id join public.workers w on w.id=wa.worker_id;
revoke all on public.asset_operator_assignment_details from anon;
grant select on public.asset_operator_assignment_details to authenticated,service_role;

create or replace function private.validate_asset_operator_context()
returns trigger language plpgsql security definer set search_path=''
as $$
declare
  v_asset_acc uuid; v_asset_active boolean; v_acc_active boolean; v_project_status text;
  v_worker_acc uuid; v_assignment_active boolean; v_assignment_status text; v_access_status text;
  v_worker_active boolean; v_contract_start date; v_contract_end date;
begin
  if tg_op='UPDATE' then
    if new.asset_id is distinct from old.asset_id or new.worker_assignment_id is distinct from old.worker_assignment_id
       or new.valid_from is distinct from old.valid_from or new.created_by is distinct from old.created_by then
      raise exception 'La identidad de una asignación de operador es inmutable';
    end if;
    if old.status='finalizado' and new.status<>'finalizado' then raise exception 'Una asignación de operador finalizada no puede reactivarse'; end if;
    if new.status='finalizado' then new.valid_until:=coalesce(new.valid_until,current_date); return new; end if;
  end if;
  select a.accreditation_id,a.is_active,ac.is_active,p.status into v_asset_acc,v_asset_active,v_acc_active,v_project_status
  from public.assets a join public.accreditations ac on ac.id=a.accreditation_id join public.projects p on p.id=ac.project_id where a.id=new.asset_id;
  select wa.accreditation_id,wa.is_active,wa.assignment_status,wa.access_status,w.is_active,
    coalesce(wa.contract_start_date_snapshot,w.contract_start_date),coalesce(wa.contract_end_date_snapshot,w.contract_end_date)
  into v_worker_acc,v_assignment_active,v_assignment_status,v_access_status,v_worker_active,v_contract_start,v_contract_end
  from public.worker_assignments wa join public.workers w on w.id=wa.worker_id where wa.id=new.worker_assignment_id;
  if v_asset_acc is null or v_worker_acc is null or v_asset_acc<>v_worker_acc then raise exception 'El operador y el activo deben pertenecer a la misma acreditación'; end if;
  if not v_asset_active or not v_acc_active or v_project_status<>'active' then raise exception 'No se pueden asignar operadores a un activo o proyecto histórico'; end if;
  if not v_assignment_active or v_assignment_status<>'activa' or v_access_status<>'habilitado' or not v_worker_active then raise exception 'Solo un trabajador activo y habilitado puede operar el activo'; end if;
  if v_contract_start is not null and new.valid_from<v_contract_start then raise exception 'La vigencia del operador no puede comenzar antes de su contrato'; end if;
  if v_contract_end is not null then
    if new.valid_from>v_contract_end then raise exception 'El contrato del operador ya finalizó'; end if;
    if new.valid_until is null then new.valid_until:=v_contract_end;
    elsif new.valid_until>v_contract_end then raise exception 'La vigencia del operador no puede superar el término de su contrato';
    end if;
  end if;
  return new;
end $$;
revoke all on function private.validate_asset_operator_context() from public,anon,authenticated;
drop trigger if exists asset_operator_context_guard on public.asset_operator_assignments;
create trigger asset_operator_context_guard before insert or update on public.asset_operator_assignments for each row execute function private.validate_asset_operator_context();
drop index if exists public.asset_operator_assignments_active_worker_unique;
create unique index asset_operator_assignments_active_worker_unique on public.asset_operator_assignments(asset_id,worker_assignment_id) where status='activo';

create or replace function private.refresh_asset_after_related_change()
returns trigger language plpgsql security definer set search_path=''
as $$
declare v_asset uuid;
begin
  v_asset:=case when tg_op='DELETE' then old.asset_id else new.asset_id end;
  perform private.refresh_asset_status(v_asset);
  return case when tg_op='DELETE' then old else new end;
end $$;
revoke all on function private.refresh_asset_after_related_change() from public,anon,authenticated;
drop trigger if exists asset_inspections_refresh_asset on public.asset_inspections;
create trigger asset_inspections_refresh_asset after insert on public.asset_inspections for each row execute function private.refresh_asset_after_related_change();
drop trigger if exists asset_maintenance_refresh_asset on public.asset_maintenance;
create trigger asset_maintenance_refresh_asset after insert on public.asset_maintenance for each row execute function private.refresh_asset_after_related_change();

create or replace function private.refresh_assets_after_accreditation_context()
returns trigger language plpgsql security definer set search_path=''
as $$
declare item record;
begin
  if old.is_active is distinct from new.is_active then
    for item in select id from public.assets where accreditation_id=new.id loop perform private.refresh_asset_status(item.id); end loop;
  end if;
  return new;
end $$;
revoke all on function private.refresh_assets_after_accreditation_context() from public,anon,authenticated;
drop trigger if exists accreditations_refresh_assets on public.accreditations;
create trigger accreditations_refresh_assets after update of is_active on public.accreditations for each row execute function private.refresh_assets_after_accreditation_context();

create or replace function private.refresh_assets_after_service_context()
returns trigger language plpgsql security definer set search_path=''
as $$
declare item record;
begin
  if old.is_active is distinct from new.is_active or old.status is distinct from new.status or old.starts_at is distinct from new.starts_at or old.ends_at is distinct from new.ends_at then
    for item in select id from public.assets where service_id=new.id loop perform private.refresh_asset_status(item.id); end loop;
  end if;
  return new;
end $$;
revoke all on function private.refresh_assets_after_service_context() from public,anon,authenticated;
drop trigger if exists services_refresh_assets on public.services;
create trigger services_refresh_assets after update of is_active,status,starts_at,ends_at on public.services for each row execute function private.refresh_assets_after_service_context();

create or replace function private.refresh_assets_after_project_context()
returns trigger language plpgsql security definer set search_path=''
as $$
declare item record;
begin
  if old.status is distinct from new.status then
    for item in select ass.id from public.assets ass join public.accreditations ac on ac.id=ass.accreditation_id where ac.project_id=new.id
    loop perform private.refresh_asset_status(item.id); end loop;
  end if;
  return new;
end $$;
revoke all on function private.refresh_assets_after_project_context() from public,anon,authenticated;
drop trigger if exists projects_refresh_assets on public.projects;
create trigger projects_refresh_assets after update of status on public.projects for each row execute function private.refresh_assets_after_project_context();

drop trigger if exists assets_refresh_context on public.assets;
create trigger assets_refresh_context after insert or update of accreditation_id,service_id,asset_type,is_active on public.assets
for each row execute function private.refresh_asset_after_context_change();

create or replace function private.finalize_asset_operators_after_retirement()
returns trigger language plpgsql security definer set search_path=''
as $$
begin
  if old.is_active and not new.is_active then
    update public.asset_operator_assignments set status='finalizado',valid_until=coalesce(valid_until,current_date)
    where asset_id=new.id and status<>'finalizado';
  end if;
  return new;
end $$;
revoke all on function private.finalize_asset_operators_after_retirement() from public,anon,authenticated;
drop trigger if exists assets_finalize_operators on public.assets;
create trigger assets_finalize_operators after update of is_active on public.assets for each row execute function private.finalize_asset_operators_after_retirement();

create or replace function private.audit_asset_lifecycle()
returns trigger language plpgsql security definer set search_path=''
as $$
declare v_project_id uuid; v_action text;
begin
  select project_id into v_project_id from public.accreditations where id=new.accreditation_id;
  if tg_op='INSERT' then v_action:='asset_created';
  elsif old.is_active and not new.is_active then v_action:='asset_retired';
  elsif new.status is distinct from old.status or new.access_allowed is distinct from old.access_allowed then v_action:='asset_status_changed';
  else v_action:='asset_updated';
  end if;
  insert into public.audit_logs(actor_profile_id,action,entity_type,entity_id,project_id,accreditation_id,details)
  values((select auth.uid()),v_action,'assets',new.id,v_project_id,new.accreditation_id,
    jsonb_build_object('asset_type',new.asset_type,'identifier',new.identifier,'service_id',new.service_id,
      'status',new.status,'access_allowed',new.access_allowed,'is_active',new.is_active,'retirement_reason',new.retirement_reason));
  return new;
end $$;
revoke all on function private.audit_asset_lifecycle() from public,anon,authenticated;
drop trigger if exists assets_audit_lifecycle on public.assets;
create trigger assets_audit_lifecycle after insert or update on public.assets for each row execute function private.audit_asset_lifecycle();

drop policy if exists assets_insert_authorized on public.assets;
create policy assets_insert_authorized on public.assets for insert to authenticated
with check ((select private.can_access_accreditation(assets.accreditation_id))
  and exists(select 1 from public.accreditations ac join public.projects p on p.id=ac.project_id where ac.id=assets.accreditation_id and ac.is_active and p.status='active'));

drop policy if exists asset_documents_insert_authorized on public.asset_documents;
create policy asset_documents_insert_authorized on public.asset_documents for insert to authenticated with check (exists(
  select 1 from public.assets a join public.accreditations ac on ac.id=a.accreditation_id join public.projects p on p.id=ac.project_id
  where a.id=asset_documents.asset_id and a.is_active and ac.is_active and p.status='active' and (select private.can_access_accreditation(a.accreditation_id))));
drop policy if exists asset_documents_update_authorized on public.asset_documents;
create policy asset_documents_update_authorized on public.asset_documents for update to authenticated using (exists(
  select 1 from public.assets a join public.accreditations ac on ac.id=a.accreditation_id join public.projects p on p.id=ac.project_id
  where a.id=asset_documents.asset_id and a.is_active and ac.is_active and p.status='active' and (select private.can_access_accreditation(a.accreditation_id))))
with check (exists(
  select 1 from public.assets a join public.accreditations ac on ac.id=a.accreditation_id join public.projects p on p.id=ac.project_id
  where a.id=asset_documents.asset_id and a.is_active and ac.is_active and p.status='active' and (select private.can_access_accreditation(a.accreditation_id))));
drop policy if exists asset_document_versions_insert on public.asset_document_versions;
create policy asset_document_versions_insert on public.asset_document_versions for insert to authenticated with check (
  uploaded_by=(select auth.uid()) and exists(
    select 1 from public.asset_documents d join public.assets a on a.id=d.asset_id join public.accreditations ac on ac.id=a.accreditation_id join public.projects p on p.id=ac.project_id
    where d.id=asset_document_versions.asset_document_id and a.is_active and ac.is_active and p.status='active' and (select private.can_access_accreditation(a.accreditation_id))));
drop policy if exists asset_inspections_insert on public.asset_inspections;
create policy asset_inspections_insert on public.asset_inspections for insert to authenticated with check (
  inspected_by=(select auth.uid()) and exists(
    select 1 from public.assets x join public.accreditations a on a.id=x.accreditation_id join public.projects p on p.id=a.project_id
    where x.id=asset_inspections.asset_id and x.is_active and a.is_active and p.status='active'
      and ((select private.is_acredita_staff()) or (select private.can_manage_project(a.project_id)))));
drop policy if exists asset_maintenance_insert on public.asset_maintenance;
create policy asset_maintenance_insert on public.asset_maintenance for insert to authenticated with check (
  created_by=(select auth.uid()) and exists(
    select 1 from public.assets x join public.accreditations a on a.id=x.accreditation_id join public.projects p on p.id=a.project_id
    where x.id=asset_maintenance.asset_id and x.is_active and a.is_active and p.status='active' and (select private.can_access_accreditation(x.accreditation_id))));
drop policy if exists asset_operators_insert on public.asset_operator_assignments;
create policy asset_operators_insert on public.asset_operator_assignments for insert to authenticated with check (
  created_by=(select auth.uid()) and exists(
    select 1 from public.assets x join public.accreditations a on a.id=x.accreditation_id join public.projects p on p.id=a.project_id
    where x.id=asset_operator_assignments.asset_id and x.is_active and a.is_active and p.status='active' and (select private.can_access_accreditation(x.accreditation_id))));
drop policy if exists asset_operators_update on public.asset_operator_assignments;
create policy asset_operators_update on public.asset_operator_assignments for update to authenticated using (exists(
  select 1 from public.assets x join public.accreditations a on a.id=x.accreditation_id join public.projects p on p.id=a.project_id
  where x.id=asset_operator_assignments.asset_id and x.is_active and a.is_active and p.status='active' and (select private.can_access_accreditation(x.accreditation_id))))
with check (exists(
  select 1 from public.assets x join public.accreditations a on a.id=x.accreditation_id join public.projects p on p.id=a.project_id
  where x.id=asset_operator_assignments.asset_id and x.is_active and a.is_active and p.status='active' and (select private.can_access_accreditation(x.accreditation_id))));
drop policy if exists asset_operators_delete on public.asset_operator_assignments;
drop policy if exists asset_templates_delete on public.asset_requirement_templates;

drop policy if exists asset_storage_insert on storage.objects;
create policy asset_storage_insert on storage.objects for insert to authenticated with check (
  bucket_id='asset-documents'
  and coalesce((storage.foldername(name))[1],'') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  and exists(select 1 from public.assets a join public.accreditations ac on ac.id=a.accreditation_id join public.projects p on p.id=ac.project_id
    where a.id=((storage.foldername(objects.name))[1])::uuid and a.is_active and ac.is_active and p.status='active'
      and (select private.can_access_accreditation(a.accreditation_id))));

revoke delete on public.assets,public.asset_documents,public.asset_document_versions,public.asset_requirement_templates,public.asset_inspections,public.asset_maintenance,public.asset_operator_assignments from authenticated;
revoke update on public.asset_document_versions,public.asset_inspections,public.asset_maintenance from authenticated;
grant select,insert,update on public.assets,public.asset_documents,public.asset_requirement_templates,public.asset_operator_assignments to authenticated;
grant select,insert on public.asset_document_versions,public.asset_inspections,public.asset_maintenance to authenticated;

create or replace function private.register_storage_access_impl(p_bucket text,p_storage_path text,p_action text)
returns boolean language plpgsql security definer set search_path=''
as $$
declare v_entity_type text; v_entity_id uuid; v_parent_id uuid; v_accreditation_id uuid; v_project_id uuid;
begin
  if (select auth.uid()) is null then raise exception 'Authentication required' using errcode='42501'; end if;
  if p_action not in ('view','download') then raise exception 'Invalid storage access action' using errcode='22023'; end if;
  if p_bucket='acredita-documents' then
    select 'document_versions',dv.id,d.id,d.accreditation_id,a.project_id into v_entity_type,v_entity_id,v_parent_id,v_accreditation_id,v_project_id
    from public.document_versions dv join public.documents d on d.id=dv.document_id join public.accreditations a on a.id=d.accreditation_id
    where dv.storage_bucket=p_bucket and dv.storage_path=p_storage_path limit 1;
    if v_entity_id is null then raise exception 'Stored document not found' using errcode='P0002'; end if;
    if not private.can_access_document(v_parent_id) then raise exception 'Document access denied' using errcode='42501'; end if;
  elsif p_bucket='asset-documents' then
    select 'asset_documents',ad.id,ad.asset_id,ass.accreditation_id,a.project_id into v_entity_type,v_entity_id,v_parent_id,v_accreditation_id,v_project_id
    from public.asset_documents ad join public.assets ass on ass.id=ad.asset_id join public.accreditations a on a.id=ass.accreditation_id
    where ad.storage_bucket=p_bucket and ad.storage_path=p_storage_path limit 1;
    if v_entity_id is null then
      select 'asset_document_versions',adv.id,ad.asset_id,ass.accreditation_id,a.project_id into v_entity_type,v_entity_id,v_parent_id,v_accreditation_id,v_project_id
      from public.asset_document_versions adv join public.asset_documents ad on ad.id=adv.asset_document_id
      join public.assets ass on ass.id=ad.asset_id join public.accreditations a on a.id=ass.accreditation_id
      where adv.storage_bucket=p_bucket and adv.storage_path=p_storage_path limit 1;
    end if;
    if v_entity_id is null then raise exception 'Stored asset document not found' using errcode='P0002'; end if;
    if not private.can_access_accreditation(v_accreditation_id) then raise exception 'Asset document access denied' using errcode='42501'; end if;
  else raise exception 'Unsupported audited storage bucket' using errcode='22023';
  end if;
  insert into public.audit_logs(actor_profile_id,action,entity_type,entity_id,project_id,accreditation_id,details)
  values((select auth.uid()),case when p_action='download' then 'document_downloaded' else 'document_viewed' end,
    v_entity_type,v_entity_id,v_project_id,v_accreditation_id,jsonb_build_object('parent_id',v_parent_id,'bucket',p_bucket,'access',p_action));
  return true;
end $$;
revoke all on function private.register_storage_access_impl(text,text,text) from public,anon,authenticated;
grant execute on function private.register_storage_access_impl(text,text,text) to service_role;

do $$
declare item record;
begin
  for item in select id from public.assets loop perform private.refresh_asset_status(item.id); end loop;
end $$;
