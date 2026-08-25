drop policy if exists projects_select_authorized on public.projects;

create policy projects_select_authorized
on public.projects
for select
to authenticated
using (
  (select private.is_acredita_staff())
  or (select private.has_mandante_access(projects.mandante_id))
  or (select private.can_access_project(projects.id))
);
