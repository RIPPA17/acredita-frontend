drop policy if exists workers_select_authorized on public.workers;

create policy workers_select_authorized
on public.workers
for select
to authenticated
using (
  (select private.is_acredita_staff())
  or (select private.has_contratista_access(workers.contratista_id))
  or (select private.can_access_worker(workers.id))
);
