begin;

create table public.contractor_evaluations (
  id uuid primary key default gen_random_uuid(), accreditation_id uuid not null references public.accreditations(id) on delete cascade,
  period_start date not null, period_end date not null, status text not null default 'borrador' check (status in ('borrador','publicada','cerrada')),
  safety_score numeric(5,2) not null default 0 check (safety_score between 0 and 100), quality_score numeric(5,2) not null default 0 check (quality_score between 0 and 100),
  labor_score numeric(5,2) not null default 0 check (labor_score between 0 and 100), compliance_score numeric(5,2) not null default 0 check (compliance_score between 0 and 100),
  total_score numeric(5,2) generated always as (round((safety_score + quality_score + labor_score + compliance_score) / 4, 2)) stored,
  risk_level text generated always as (case when (safety_score + quality_score + labor_score + compliance_score) / 4 >= 80 then 'bajo' when (safety_score + quality_score + labor_score + compliance_score) / 4 >= 60 then 'medio' else 'alto' end) stored,
  observations text, evaluated_by uuid references public.profiles(id) on delete set null, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  check (period_end >= period_start), unique(accreditation_id, period_start, period_end)
);

create table public.payment_cases (
  id uuid primary key default gen_random_uuid(), accreditation_id uuid not null references public.accreditations(id) on delete cascade,
  compliance_period_id uuid references public.compliance_periods(id) on delete set null, period_start date not null, period_end date not null,
  amount numeric(16,2) check (amount is null or amount >= 0), currency char(3) not null default 'CLP',
  status text not null default 'observado' check (status in ('observado','retenido','liberado','pagado','anulado')),
  block_reason text, released_by uuid references public.profiles(id) on delete set null, released_at timestamptz, paid_at timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), check (period_end >= period_start), unique(accreditation_id, period_start, period_end)
);

create table public.support_tickets (
  id uuid primary key default gen_random_uuid(), project_id uuid not null references public.projects(id) on delete cascade,
  accreditation_id uuid references public.accreditations(id) on delete set null, created_by uuid not null references public.profiles(id) on delete restrict,
  assigned_to uuid references public.profiles(id) on delete set null, category text not null default 'operacion', priority text not null default 'normal' check (priority in ('baja','normal','alta','critica')),
  status text not null default 'abierto' check (status in ('abierto','en_progreso','esperando_usuario','resuelto','cerrado')),
  subject text not null, description text not null, resolution text, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), closed_at timestamptz
);

create table public.access_credentials (
  id uuid primary key default gen_random_uuid(), project_id uuid not null references public.projects(id) on delete cascade,
  worker_assignment_id uuid references public.worker_assignments(id) on delete cascade, asset_id uuid references public.assets(id) on delete cascade,
  token uuid not null default gen_random_uuid() unique, status text not null default 'activa' check (status in ('activa','suspendida','revocada','vencida')),
  valid_from timestamptz not null default now(), expires_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  check ((worker_assignment_id is not null)::int + (asset_id is not null)::int = 1), check (expires_at is null or expires_at > valid_from)
);

create table public.access_events (
  id bigint generated always as identity primary key, credential_id uuid references public.access_credentials(id) on delete set null,
  project_id uuid not null references public.projects(id) on delete cascade, decision text not null check (decision in ('permitido','denegado')),
  reason text, checkpoint text, occurred_at timestamptz not null default now(), recorded_by uuid references public.profiles(id) on delete set null
);

create table public.integration_configs (
  id uuid primary key default gen_random_uuid(), project_id uuid not null references public.projects(id) on delete cascade,
  integration_type text not null check (integration_type in ('control_acceso','erp','previred','webhook')),
  provider text not null, enabled boolean not null default false, endpoint_url text, settings jsonb not null default '{}'::jsonb,
  last_sync_at timestamptz, last_sync_status text, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique(project_id, integration_type, provider)
);

create index contractor_evaluations_accreditation_idx on public.contractor_evaluations(accreditation_id, period_end desc);
create index contractor_evaluations_evaluated_by_idx on public.contractor_evaluations(evaluated_by) where evaluated_by is not null;
create index payment_cases_accreditation_idx on public.payment_cases(accreditation_id, period_end desc);
create index payment_cases_period_idx on public.payment_cases(compliance_period_id) where compliance_period_id is not null;
create index payment_cases_released_by_idx on public.payment_cases(released_by) where released_by is not null;
create index support_tickets_project_status_idx on public.support_tickets(project_id, status, priority);
create index support_tickets_accreditation_idx on public.support_tickets(accreditation_id) where accreditation_id is not null;
create index support_tickets_created_by_idx on public.support_tickets(created_by);
create index support_tickets_assigned_to_idx on public.support_tickets(assigned_to) where assigned_to is not null;
create index access_credentials_project_idx on public.access_credentials(project_id, status);
create index access_credentials_worker_idx on public.access_credentials(worker_assignment_id) where worker_assignment_id is not null;
create index access_credentials_asset_idx on public.access_credentials(asset_id) where asset_id is not null;
create index access_events_project_time_idx on public.access_events(project_id, occurred_at desc);
create index access_events_credential_idx on public.access_events(credential_id) where credential_id is not null;
create index access_events_recorded_by_idx on public.access_events(recorded_by) where recorded_by is not null;
create index integration_configs_project_idx on public.integration_configs(project_id, integration_type);

alter table public.contractor_evaluations enable row level security; alter table public.payment_cases enable row level security;
alter table public.support_tickets enable row level security; alter table public.access_credentials enable row level security;
alter table public.access_events enable row level security; alter table public.integration_configs enable row level security;

create policy evaluations_select on public.contractor_evaluations for select to authenticated using ((select private.can_access_accreditation(accreditation_id)));
create policy evaluations_manage on public.contractor_evaluations for all to authenticated using ((select private.is_acredita_staff()) or exists(select 1 from public.accreditations a where a.id=accreditation_id and (select private.can_manage_project(a.project_id)))) with check ((select private.is_acredita_staff()) or exists(select 1 from public.accreditations a where a.id=accreditation_id and (select private.can_manage_project(a.project_id))));
create policy payments_select on public.payment_cases for select to authenticated using ((select private.can_access_accreditation(accreditation_id)));
create policy payments_manage on public.payment_cases for all to authenticated using ((select private.is_acredita_staff()) or exists(select 1 from public.accreditations a where a.id=accreditation_id and (select private.can_manage_project(a.project_id)))) with check ((select private.is_acredita_staff()) or exists(select 1 from public.accreditations a where a.id=accreditation_id and (select private.can_manage_project(a.project_id))));
create policy tickets_select on public.support_tickets for select to authenticated using ((select private.can_access_project(project_id)));
create policy tickets_insert on public.support_tickets for insert to authenticated with check (created_by=(select auth.uid()) and (select private.can_access_project(project_id)));
create policy tickets_update on public.support_tickets for update to authenticated using (created_by=(select auth.uid()) or (select private.is_acredita_staff()) or (select private.can_manage_project(project_id))) with check ((select private.can_access_project(project_id)));
create policy credentials_select on public.access_credentials for select to authenticated using ((select private.can_access_project(project_id)));
create policy credentials_manage on public.access_credentials for all to authenticated using ((select private.is_acredita_staff()) or (select private.can_manage_project(project_id))) with check ((select private.is_acredita_staff()) or (select private.can_manage_project(project_id)));
create policy access_events_select on public.access_events for select to authenticated using ((select private.can_access_project(project_id)));
create policy access_events_insert on public.access_events for insert to authenticated with check ((select private.is_acredita_staff()) or (select private.can_manage_project(project_id)));
create policy integrations_manage on public.integration_configs for all to authenticated using ((select private.is_acredita_staff()) or (select private.can_manage_project(project_id))) with check ((select private.is_acredita_staff()) or (select private.can_manage_project(project_id)));

create trigger evaluations_touch before update on public.contractor_evaluations for each row execute function private.touch_operational_updated_at();
create trigger payments_touch before update on public.payment_cases for each row execute function private.touch_operational_updated_at();
create trigger tickets_touch before update on public.support_tickets for each row execute function private.touch_operational_updated_at();
create trigger credentials_touch before update on public.access_credentials for each row execute function private.touch_operational_updated_at();
create trigger integrations_touch before update on public.integration_configs for each row execute function private.touch_operational_updated_at();

grant select,insert,update,delete on public.contractor_evaluations,public.payment_cases,public.support_tickets,public.access_credentials,public.integration_configs to authenticated;
grant select,insert on public.access_events to authenticated;
revoke all on public.contractor_evaluations,public.payment_cases,public.support_tickets,public.access_credentials,public.access_events,public.integration_configs from anon;

commit;
