
drop policy if exists integrations_manage on public.integration_configs;
drop policy if exists integrations_select on public.integration_configs;
drop policy if exists integrations_insert on public.integration_configs;
drop policy if exists integrations_update on public.integration_configs;
drop policy if exists integrations_delete on public.integration_configs;

create policy integrations_select on public.integration_configs
for select to authenticated
using (
  (select private.is_acredita_staff())
  or (select private.can_manage_project(project_id))
);

create policy integrations_insert on public.integration_configs
for insert to authenticated
with check (
  ((select private.is_acredita_staff()) or (select private.can_manage_project(project_id)))
  and (select private.project_is_operational(project_id))
);

create policy integrations_update on public.integration_configs
for update to authenticated
using (
  ((select private.is_acredita_staff()) or (select private.can_manage_project(project_id)))
  and (select private.project_is_operational(project_id))
)
with check (
  ((select private.is_acredita_staff()) or (select private.can_manage_project(project_id)))
  and (select private.project_is_operational(project_id))
);

create policy integrations_delete on public.integration_configs
for delete to authenticated
using (
  ((select private.is_acredita_staff()) or (select private.can_manage_project(project_id)))
  and (select private.project_is_operational(project_id))
);

drop policy if exists sync_runs_insert on public.integration_sync_runs;
drop policy if exists sync_runs_update on public.integration_sync_runs;
drop policy if exists sync_runs_delete on public.integration_sync_runs;

create policy sync_runs_insert on public.integration_sync_runs
for insert to authenticated
with check (
  exists (
    select 1 from public.integration_configs i
    where i.id=integration_sync_runs.integration_config_id
      and ((select private.is_acredita_staff()) or (select private.can_manage_project(i.project_id)))
      and (select private.project_is_operational(i.project_id))
  )
);

create policy sync_runs_update on public.integration_sync_runs
for update to authenticated
using (
  exists (
    select 1 from public.integration_configs i
    where i.id=integration_sync_runs.integration_config_id
      and ((select private.is_acredita_staff()) or (select private.can_manage_project(i.project_id)))
      and (select private.project_is_operational(i.project_id))
  )
)
with check (
  exists (
    select 1 from public.integration_configs i
    where i.id=integration_sync_runs.integration_config_id
      and ((select private.is_acredita_staff()) or (select private.can_manage_project(i.project_id)))
      and (select private.project_is_operational(i.project_id))
  )
);

create policy sync_runs_delete on public.integration_sync_runs
for delete to authenticated
using (
  exists (
    select 1 from public.integration_configs i
    where i.id=integration_sync_runs.integration_config_id
      and ((select private.is_acredita_staff()) or (select private.can_manage_project(i.project_id)))
      and (select private.project_is_operational(i.project_id))
  )
);
