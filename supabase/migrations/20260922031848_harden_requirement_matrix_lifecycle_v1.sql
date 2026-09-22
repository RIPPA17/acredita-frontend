alter table public.requirements
  add constraint requirements_alert_days_max
  check (alert_days <= 365);

alter table public.requirements
  add constraint requirements_name_not_blank
  check (length(btrim(name)) > 0);

create unique index requirements_active_scope_name_unique
  on public.requirements (
    project_id,
    lower(btrim(name)),
    target,
    coalesce(service_id, '00000000-0000-0000-0000-000000000000'::uuid)
  )
  where is_active;
