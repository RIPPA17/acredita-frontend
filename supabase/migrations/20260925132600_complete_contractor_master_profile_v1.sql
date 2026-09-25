
alter table public.contratistas
  add column if not exists company_type text,
  add column if not exists business_activity text,
  add column if not exists sii_activity_code text,
  add column if not exists company_email text,
  add column if not exists company_phone text,
  add column if not exists website text,
  add column if not exists country text default 'Chile',
  add column if not exists region text,
  add column if not exists commune text,
  add column if not exists legal_representative_name text,
  add column if not exists legal_representative_rut text,
  add column if not exists legal_representative_email text,
  add column if not exists legal_representative_phone text,
  add column if not exists platform_admin_name text,
  add column if not exists platform_admin_rut text,
  add column if not exists platform_admin_email text,
  add column if not exists platform_admin_phone text,
  add column if not exists occupational_insurer text,
  add column if not exists compensation_fund text,
  add column if not exists employee_count integer,
  add column if not exists master_data_version integer not null default 1,
  add column if not exists master_data_completed_at timestamptz;

alter table public.contratistas
  drop constraint if exists contratistas_legal_representative_rut_check,
  add constraint contratistas_legal_representative_rut_check
    check (legal_representative_rut is null or private.is_valid_rut(legal_representative_rut)),
  drop constraint if exists contratistas_platform_admin_rut_check,
  add constraint contratistas_platform_admin_rut_check
    check (platform_admin_rut is null or private.is_valid_rut(platform_admin_rut)),
  drop constraint if exists contratistas_employee_count_check,
  add constraint contratistas_employee_count_check
    check (employee_count is null or employee_count >= 0),
  drop constraint if exists contratistas_master_data_version_check,
  add constraint contratistas_master_data_version_check
    check (master_data_version >= 1);

create index if not exists contratistas_region_idx
  on public.contratistas(region)
  where region is not null;

create index if not exists contratistas_platform_admin_email_idx
  on public.contratistas(lower(platform_admin_email))
  where platform_admin_email is not null;
