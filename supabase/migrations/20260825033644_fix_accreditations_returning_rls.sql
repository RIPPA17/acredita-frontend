drop policy if exists accreditations_select_authorized on public.accreditations;

create policy accreditations_select_authorized
on public.accreditations
for select
to authenticated
using (
  (select private.is_acredita_staff())
  or (select private.has_contratista_access(accreditations.contratista_id))
  or (select private.can_access_project(accreditations.project_id))
  or (select private.can_access_accreditation(accreditations.id))
);
