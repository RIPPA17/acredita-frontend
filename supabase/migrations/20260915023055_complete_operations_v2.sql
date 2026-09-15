begin;

alter table public.support_tickets
  add column if not exists due_at timestamptz,
  add column if not exists resolved_at timestamptz;

alter table public.payment_cases
  add column if not exists invoice_number text,
  add column if not exists submitted_by uuid references public.profiles(id) on delete set null,
  add column if not exists submitted_at timestamptz,
  add column if not exists paid_at timestamptz;

create table public.evaluation_action_plans (
  id uuid primary key default gen_random_uuid(),
  evaluation_id uuid not null references public.contractor_evaluations(id) on delete cascade,
  title text not null,
  description text not null,
  owner_name text,
  due_date date,
  status text not null default 'pendiente' check (status in ('pendiente','en_progreso','completado','cancelado')),
  evidence text,
  created_by uuid not null references public.profiles(id) on delete restrict,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.payment_approvals (
  id uuid primary key default gen_random_uuid(),
  payment_case_id uuid not null references public.payment_cases(id) on delete cascade,
  decision text not null check (decision in ('aprobado','observado','rechazado')),
  comment text,
  decided_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now()
);

create table public.operation_attachments (
  id uuid primary key default gen_random_uuid(),
  payment_case_id uuid references public.payment_cases(id) on delete cascade,
  support_ticket_id uuid references public.support_tickets(id) on delete cascade,
  action_plan_id uuid references public.evaluation_action_plans(id) on delete cascade,
  file_name text not null,
  mime_type text not null,
  file_size bigint not null check (file_size between 1 and 20971520),
  storage_bucket text not null default 'operation-files',
  storage_path text not null unique,
  uploaded_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  check ((payment_case_id is not null)::int + (support_ticket_id is not null)::int + (action_plan_id is not null)::int = 1)
);

create table public.support_ticket_messages (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.support_tickets(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete restrict,
  body text not null check (char_length(body) between 1 and 5000),
  is_internal boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.document_library (
  id uuid primary key default gen_random_uuid(),
  contratista_id uuid not null references public.contratistas(id) on delete cascade,
  document_type text not null,
  document_name text not null,
  issued_at date,
  expires_at date,
  status text not null default 'vigente' check (status in ('vigente','vencido','revocado')),
  storage_bucket text not null default 'document-library',
  storage_path text not null unique,
  mime_type text not null,
  file_size bigint not null check (file_size between 1 and 20971520),
  uploaded_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (expires_at is null or issued_at is null or expires_at >= issued_at)
);

create table public.document_library_links (
  id uuid primary key default gen_random_uuid(),
  library_document_id uuid not null references public.document_library(id) on delete cascade,
  document_obligation_id uuid not null references public.document_obligations(id) on delete cascade,
  linked_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique(document_obligation_id)
);

create table public.asset_requirement_templates (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  asset_type text not null check (asset_type in ('vehiculo','maquinaria','equipo')),
  document_type text not null,
  validity_days integer check (validity_days is null or validity_days > 0),
  blocks_access boolean not null default true,
  is_required boolean not null default true,
  review_checklist jsonb not null default '[]'::jsonb check (jsonb_typeof(review_checklist)='array'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(project_id,asset_type,document_type)
);

create table public.asset_inspections (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid not null references public.assets(id) on delete cascade,
  inspection_date date not null default current_date,
  result text not null check (result in ('aprobado','observado','rechazado')),
  checklist jsonb not null default '[]'::jsonb check (jsonb_typeof(checklist)='array'),
  observations text,
  next_inspection_date date,
  inspected_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now()
);

create table public.asset_maintenance (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid not null references public.assets(id) on delete cascade,
  maintenance_type text not null,
  performed_at date not null,
  next_due_at date,
  provider text,
  notes text,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now()
);

create table public.asset_operator_assignments (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid not null references public.assets(id) on delete cascade,
  worker_assignment_id uuid not null references public.worker_assignments(id) on delete cascade,
  valid_from date not null default current_date,
  valid_until date,
  status text not null default 'activo' check (status in ('activo','suspendido','finalizado')),
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  check (valid_until is null or valid_until >= valid_from),
  unique(asset_id,worker_assignment_id,valid_from)
);

create table public.integration_sync_runs (
  id uuid primary key default gen_random_uuid(),
  integration_config_id uuid not null references public.integration_configs(id) on delete cascade,
  direction text not null check (direction in ('entrada','salida','bidireccional')),
  status text not null check (status in ('pendiente','ejecutando','exitoso','fallido')),
  records_processed integer not null default 0 check (records_processed >= 0),
  error_message text,
  started_at timestamptz not null default now(),
  finished_at timestamptz
);

create index evaluation_action_plans_evaluation_idx on public.evaluation_action_plans(evaluation_id,status,due_date);
create index payment_approvals_case_idx on public.payment_approvals(payment_case_id,created_at desc);
create index operation_attachments_payment_idx on public.operation_attachments(payment_case_id) where payment_case_id is not null;
create index operation_attachments_ticket_idx on public.operation_attachments(support_ticket_id) where support_ticket_id is not null;
create index support_ticket_messages_ticket_idx on public.support_ticket_messages(ticket_id,created_at);
create index document_library_contractor_idx on public.document_library(contratista_id,status,expires_at);
create index document_library_links_obligation_idx on public.document_library_links(document_obligation_id);
create index asset_requirement_templates_project_idx on public.asset_requirement_templates(project_id,asset_type);
create index asset_inspections_asset_idx on public.asset_inspections(asset_id,inspection_date desc);
create index asset_maintenance_asset_idx on public.asset_maintenance(asset_id,performed_at desc);
create index asset_operator_assignments_asset_idx on public.asset_operator_assignments(asset_id,status);
create index integration_sync_runs_config_idx on public.integration_sync_runs(integration_config_id,started_at desc);

alter table public.evaluation_action_plans enable row level security;
alter table public.payment_approvals enable row level security;
alter table public.operation_attachments enable row level security;
alter table public.support_ticket_messages enable row level security;
alter table public.document_library enable row level security;
alter table public.document_library_links enable row level security;
alter table public.asset_requirement_templates enable row level security;
alter table public.asset_inspections enable row level security;
alter table public.asset_maintenance enable row level security;
alter table public.asset_operator_assignments enable row level security;
alter table public.integration_sync_runs enable row level security;

create policy action_plans_select on public.evaluation_action_plans for select to authenticated
using (exists(select 1 from public.contractor_evaluations e where e.id=evaluation_id and (select private.can_access_accreditation(e.accreditation_id))));
create policy action_plans_insert on public.evaluation_action_plans for insert to authenticated
with check (created_by=(select auth.uid()) and exists(select 1 from public.contractor_evaluations e join public.accreditations a on a.id=e.accreditation_id where e.id=evaluation_id and ((select private.is_acredita_staff()) or (select private.can_manage_project(a.project_id)))));
create policy action_plans_update on public.evaluation_action_plans for update to authenticated
using (exists(select 1 from public.contractor_evaluations e join public.accreditations a on a.id=e.accreditation_id where e.id=evaluation_id and ((select private.is_acredita_staff()) or (select private.can_manage_project(a.project_id)))))
with check (exists(select 1 from public.contractor_evaluations e join public.accreditations a on a.id=e.accreditation_id where e.id=evaluation_id and ((select private.is_acredita_staff()) or (select private.can_manage_project(a.project_id)))));

create policy payment_approvals_select on public.payment_approvals for select to authenticated
using (exists(select 1 from public.payment_cases p where p.id=payment_case_id and (select private.can_access_accreditation(p.accreditation_id))));
create policy payment_approvals_insert on public.payment_approvals for insert to authenticated
with check (decided_by=(select auth.uid()) and exists(select 1 from public.payment_cases pc join public.accreditations a on a.id=pc.accreditation_id where pc.id=payment_case_id and ((select private.is_acredita_staff()) or (select private.can_manage_project(a.project_id)))));

create policy operation_attachments_select on public.operation_attachments for select to authenticated using (
  (payment_case_id is not null and exists(select 1 from public.payment_cases p where p.id=payment_case_id and (select private.can_access_accreditation(p.accreditation_id)))) or
  (support_ticket_id is not null and exists(select 1 from public.support_tickets t where t.id=support_ticket_id and (select private.can_access_project(t.project_id)))) or
  (action_plan_id is not null and exists(select 1 from public.evaluation_action_plans ap join public.contractor_evaluations e on e.id=ap.evaluation_id where ap.id=action_plan_id and (select private.can_access_accreditation(e.accreditation_id))))
);
create policy operation_attachments_insert on public.operation_attachments for insert to authenticated with check (uploaded_by=(select auth.uid()) and (
  (payment_case_id is not null and exists(select 1 from public.payment_cases p where p.id=payment_case_id and (select private.can_access_accreditation(p.accreditation_id)))) or
  (support_ticket_id is not null and exists(select 1 from public.support_tickets t where t.id=support_ticket_id and (select private.can_access_project(t.project_id)))) or
  (action_plan_id is not null and exists(select 1 from public.evaluation_action_plans ap join public.contractor_evaluations e on e.id=ap.evaluation_id where ap.id=action_plan_id and (select private.can_access_accreditation(e.accreditation_id))))
));

create policy ticket_messages_select on public.support_ticket_messages for select to authenticated
using (exists(select 1 from public.support_tickets t where t.id=ticket_id and (select private.can_access_project(t.project_id)) and (not is_internal or (select private.is_acredita_staff()) or (select private.can_manage_project(t.project_id)))));
create policy ticket_messages_insert on public.support_ticket_messages for insert to authenticated
with check (author_id=(select auth.uid()) and exists(select 1 from public.support_tickets t where t.id=ticket_id and (select private.can_access_project(t.project_id)) and (not is_internal or (select private.is_acredita_staff()) or (select private.can_manage_project(t.project_id)))));

create policy library_select on public.document_library for select to authenticated using ((select private.can_access_contratista(contratista_id)));
create policy library_insert on public.document_library for insert to authenticated with check (uploaded_by=(select auth.uid()) and (select private.can_access_contratista(contratista_id)));
create policy library_update on public.document_library for update to authenticated using ((select private.can_access_contratista(contratista_id))) with check ((select private.can_access_contratista(contratista_id)));
create policy library_links_select on public.document_library_links for select to authenticated using (exists(select 1 from public.document_library d where d.id=library_document_id and (select private.can_access_contratista(d.contratista_id))));
create policy library_links_insert on public.document_library_links for insert to authenticated with check (linked_by=(select auth.uid()) and exists(select 1 from public.document_library d where d.id=library_document_id and (select private.can_access_contratista(d.contratista_id))));

create policy asset_templates_select on public.asset_requirement_templates for select to authenticated using ((select private.can_access_project(project_id)));
create policy asset_templates_insert on public.asset_requirement_templates for insert to authenticated with check ((select private.is_acredita_staff()) or (select private.can_manage_project(project_id)));
create policy asset_templates_update on public.asset_requirement_templates for update to authenticated using ((select private.is_acredita_staff()) or (select private.can_manage_project(project_id))) with check ((select private.is_acredita_staff()) or (select private.can_manage_project(project_id)));
create policy asset_templates_delete on public.asset_requirement_templates for delete to authenticated using ((select private.is_acredita_staff()) or (select private.can_manage_project(project_id)));
create policy asset_inspections_select on public.asset_inspections for select to authenticated using (exists(select 1 from public.assets x where x.id=asset_id and (select private.can_access_accreditation(x.accreditation_id))));
create policy asset_inspections_insert on public.asset_inspections for insert to authenticated with check (inspected_by=(select auth.uid()) and exists(select 1 from public.assets x join public.accreditations a on a.id=x.accreditation_id where x.id=asset_id and ((select private.is_acredita_staff()) or (select private.can_manage_project(a.project_id)))));
create policy asset_maintenance_select on public.asset_maintenance for select to authenticated using (exists(select 1 from public.assets x where x.id=asset_id and (select private.can_access_accreditation(x.accreditation_id))));
create policy asset_maintenance_insert on public.asset_maintenance for insert to authenticated with check (created_by=(select auth.uid()) and exists(select 1 from public.assets x where x.id=asset_id and (select private.can_access_accreditation(x.accreditation_id))));
create policy asset_operators_select on public.asset_operator_assignments for select to authenticated using (exists(select 1 from public.assets x where x.id=asset_id and (select private.can_access_accreditation(x.accreditation_id))));
create policy asset_operators_insert on public.asset_operator_assignments for insert to authenticated with check (created_by=(select auth.uid()) and exists(select 1 from public.assets x where x.id=asset_id and (select private.can_access_accreditation(x.accreditation_id))));
create policy asset_operators_update on public.asset_operator_assignments for update to authenticated using (exists(select 1 from public.assets x where x.id=asset_id and (select private.can_access_accreditation(x.accreditation_id)))) with check (exists(select 1 from public.assets x where x.id=asset_id and (select private.can_access_accreditation(x.accreditation_id))));
create policy asset_operators_delete on public.asset_operator_assignments for delete to authenticated using (exists(select 1 from public.assets x where x.id=asset_id and (select private.can_access_accreditation(x.accreditation_id))));
create policy sync_runs_select on public.integration_sync_runs for select to authenticated using (exists(select 1 from public.integration_configs i where i.id=integration_config_id and (select private.can_access_project(i.project_id))));
create policy sync_runs_insert on public.integration_sync_runs for insert to authenticated with check (exists(select 1 from public.integration_configs i where i.id=integration_config_id and ((select private.is_acredita_staff()) or (select private.can_manage_project(i.project_id)))));
create policy sync_runs_update on public.integration_sync_runs for update to authenticated using (exists(select 1 from public.integration_configs i where i.id=integration_config_id and ((select private.is_acredita_staff()) or (select private.can_manage_project(i.project_id))))) with check (exists(select 1 from public.integration_configs i where i.id=integration_config_id and ((select private.is_acredita_staff()) or (select private.can_manage_project(i.project_id)))));
create policy sync_runs_delete on public.integration_sync_runs for delete to authenticated using (exists(select 1 from public.integration_configs i where i.id=integration_config_id and ((select private.is_acredita_staff()) or (select private.can_manage_project(i.project_id)))));

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values
('operation-files','operation-files',false,20971520,array['application/pdf','image/jpeg','image/png','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']),
('document-library','document-library',false,20971520,array['application/pdf','image/jpeg','image/png'])
on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

create policy operation_files_select on storage.objects for select to authenticated using (bucket_id='operation-files' and exists(select 1 from public.operation_attachments a where a.storage_path=name));
create policy operation_files_insert on storage.objects for insert to authenticated with check (bucket_id='operation-files' and (storage.foldername(name))[1]=(select auth.uid())::text);
create policy library_files_select on storage.objects for select to authenticated using (bucket_id='document-library' and exists(select 1 from public.document_library d where d.storage_path=name and (select private.can_access_contratista(d.contratista_id))));
create policy library_files_insert on storage.objects for insert to authenticated with check (bucket_id='document-library' and (storage.foldername(name))[1]=(select auth.uid())::text);

create trigger action_plans_touch before update on public.evaluation_action_plans for each row execute function private.touch_operational_updated_at();
create trigger document_library_touch before update on public.document_library for each row execute function private.touch_operational_updated_at();
create trigger asset_templates_touch before update on public.asset_requirement_templates for each row execute function private.touch_operational_updated_at();

grant select,insert,update on public.evaluation_action_plans,public.document_library,public.asset_requirement_templates,public.asset_operator_assignments to authenticated;
grant select,insert on public.payment_approvals,public.operation_attachments,public.support_ticket_messages,public.document_library_links,public.asset_inspections,public.asset_maintenance to authenticated;
grant select,insert,update,delete on public.integration_sync_runs to authenticated;
revoke all on public.evaluation_action_plans,public.payment_approvals,public.operation_attachments,public.support_ticket_messages,public.document_library,public.document_library_links,public.asset_requirement_templates,public.asset_inspections,public.asset_maintenance,public.asset_operator_assignments,public.integration_sync_runs from anon;

commit;
