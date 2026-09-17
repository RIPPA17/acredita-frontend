-- Privacy governance foundation v2.
-- Adds internal-only incident, retention and legal hold registries.
-- No automatic deletion/anonymization is performed by this migration.

create table public.security_incidents (
  id uuid primary key default gen_random_uuid(),
  severity text not null check (severity in ('S1','S2','S3','S4')),
  status text not null default 'detected' check (status in ('detected','investigating','contained','resolved','closed')),
  title text not null check (char_length(title) between 3 and 250),
  detected_at timestamptz not null default now(),
  estimated_started_at timestamptz,
  affected_systems text[] not null default '{}',
  data_categories text[] not null default '{}',
  affected_subjects_estimate integer check (affected_subjects_estimate is null or affected_subjects_estimate >= 0),
  risk_assessment text check (risk_assessment is null or char_length(risk_assessment) <= 5000),
  notification_decision text check (notification_decision is null or char_length(notification_decision) <= 3000),
  agency_notified_at timestamptz,
  subjects_notified_at timestamptz,
  containment_summary text check (containment_summary is null or char_length(containment_summary) <= 5000),
  remediation_summary text check (remediation_summary is null or char_length(remediation_summary) <= 5000),
  owner_profile_id uuid references public.profiles(id) on delete set null,
  created_by uuid not null default auth.uid() references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.retention_policies (
  id uuid primary key default gen_random_uuid(),
  data_category text not null check (char_length(data_category) between 2 and 200),
  purpose text not null check (char_length(purpose) between 2 and 2000),
  trigger_event text not null check (char_length(trigger_event) between 2 and 200),
  retention_days integer check (retention_days is null or retention_days >= 0),
  final_action text not null check (final_action in ('delete','anonymize','review_hold')),
  legal_basis_notes text check (legal_basis_notes is null or char_length(legal_basis_notes) <= 5000),
  legal_review_status text not null default 'draft' check (legal_review_status in ('draft','approved','rejected')),
  active boolean not null default false,
  dry_run_required boolean not null default true,
  version integer not null default 1 check (version > 0),
  created_by uuid not null default auth.uid() references public.profiles(id) on delete restrict,
  updated_by uuid not null default auth.uid() references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (data_category, version),
  check (active = false or legal_review_status = 'approved')
);

create table public.legal_holds (
  id uuid primary key default gen_random_uuid(),
  scope_type text not null check (scope_type in ('profile','worker','project','accreditation','document','document_version','contractor','other')),
  scope_id uuid not null,
  reason text not null check (char_length(reason) between 3 and 3000),
  active boolean not null default true,
  released_at timestamptz,
  created_by uuid not null default auth.uid() references public.profiles(id) on delete restrict,
  released_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((active = true and released_at is null and released_by is null) or (active = false and released_at is not null))
);

alter table public.security_incidents enable row level security;
alter table public.retention_policies enable row level security;
alter table public.legal_holds enable row level security;

revoke all on public.security_incidents from public, anon, authenticated;
revoke all on public.retention_policies from public, anon, authenticated;
revoke all on public.legal_holds from public, anon, authenticated;

grant select, insert, update on public.security_incidents to authenticated;
grant select, insert, update on public.retention_policies to authenticated;
grant select, insert, update on public.legal_holds to authenticated;

create policy security_incidents_staff_select on public.security_incidents for select to authenticated using ((select private.is_acredita_staff()));
create policy security_incidents_staff_insert on public.security_incidents for insert to authenticated with check ((select private.is_acredita_staff()) and created_by = (select auth.uid()));
create policy security_incidents_staff_update on public.security_incidents for update to authenticated using ((select private.is_acredita_staff())) with check ((select private.is_acredita_staff()));

create policy retention_policies_staff_select on public.retention_policies for select to authenticated using ((select private.is_acredita_staff()));
create policy retention_policies_staff_insert on public.retention_policies for insert to authenticated with check ((select private.is_acredita_staff()) and created_by = (select auth.uid()) and updated_by = (select auth.uid()));
create policy retention_policies_staff_update on public.retention_policies for update to authenticated using ((select private.is_acredita_staff())) with check ((select private.is_acredita_staff()) and updated_by = (select auth.uid()));

create policy legal_holds_staff_select on public.legal_holds for select to authenticated using ((select private.is_acredita_staff()));
create policy legal_holds_staff_insert on public.legal_holds for insert to authenticated with check ((select private.is_acredita_staff()) and created_by = (select auth.uid()));
create policy legal_holds_staff_update on public.legal_holds for update to authenticated using ((select private.is_acredita_staff())) with check ((select private.is_acredita_staff()));

create or replace function private.touch_privacy_governance_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

revoke all on function private.touch_privacy_governance_updated_at() from public, anon, authenticated;

create trigger trg_security_incidents_updated_at
before update on public.security_incidents
for each row execute function private.touch_privacy_governance_updated_at();

create trigger trg_retention_policies_updated_at
before update on public.retention_policies
for each row execute function private.touch_privacy_governance_updated_at();

create trigger trg_legal_holds_updated_at
before update on public.legal_holds
for each row execute function private.touch_privacy_governance_updated_at();

create index security_incidents_status_detected_idx on public.security_incidents(status, detected_at desc);
create index retention_policies_active_category_idx on public.retention_policies(active, data_category);
create index legal_holds_active_scope_idx on public.legal_holds(active, scope_type, scope_id);
create index if not exists privacy_requests_status_received_idx on public.privacy_requests(status, received_at desc);
