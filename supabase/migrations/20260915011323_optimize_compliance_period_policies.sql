drop policy if exists compliance_periods_write_managers on public.compliance_periods;

drop policy if exists compliance_periods_insert_managers on public.compliance_periods;
create policy compliance_periods_insert_managers
on public.compliance_periods
for insert
to authenticated
with check (
  (select private.is_acredita_staff())
  or (select private.can_manage_project(compliance_periods.project_id))
);

drop policy if exists compliance_periods_update_managers on public.compliance_periods;
create policy compliance_periods_update_managers
on public.compliance_periods
for update
to authenticated
using (
  (select private.is_acredita_staff())
  or (select private.can_manage_project(compliance_periods.project_id))
)
with check (
  (select private.is_acredita_staff())
  or (select private.can_manage_project(compliance_periods.project_id))
);

drop policy if exists compliance_periods_delete_managers on public.compliance_periods;
create policy compliance_periods_delete_managers
on public.compliance_periods
for delete
to authenticated
using (
  (select private.is_acredita_staff())
  or (select private.can_manage_project(compliance_periods.project_id))
);
