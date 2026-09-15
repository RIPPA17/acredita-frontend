drop policy if exists tickets_update on public.support_tickets;

create policy tickets_update
on public.support_tickets
for update
to authenticated
using (
  (select private.is_acredita_staff())
  or (select private.can_manage_project(support_tickets.project_id))
)
with check (
  (select private.is_acredita_staff())
  or (select private.can_manage_project(support_tickets.project_id))
);
