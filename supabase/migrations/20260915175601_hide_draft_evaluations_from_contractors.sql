drop policy if exists evaluations_select on public.contractor_evaluations;
create policy evaluations_select
on public.contractor_evaluations
for select
to authenticated
using (
  (select private.can_access_accreditation(contractor_evaluations.accreditation_id))
  and (
    contractor_evaluations.status in ('publicada','cerrada')
    or (select private.is_acredita_staff())
    or exists (
      select 1
      from public.accreditations a
      where a.id = contractor_evaluations.accreditation_id
        and (select private.can_manage_project(a.project_id))
    )
  )
);

drop policy if exists action_plans_select on public.evaluation_action_plans;
create policy action_plans_select
on public.evaluation_action_plans
for select
to authenticated
using (
  exists (
    select 1
    from public.contractor_evaluations e
    join public.accreditations a on a.id = e.accreditation_id
    where e.id = evaluation_action_plans.evaluation_id
      and (select private.can_access_accreditation(e.accreditation_id))
      and (
        e.status in ('publicada','cerrada')
        or (select private.is_acredita_staff())
        or (select private.can_manage_project(a.project_id))
      )
  )
);

drop policy if exists action_plans_contractor_progress_update on public.evaluation_action_plans;
create policy action_plans_contractor_progress_update
on public.evaluation_action_plans
for update
to authenticated
using (
  exists (
    select 1
    from public.contractor_evaluations e
    join public.accreditations a on a.id = e.accreditation_id
    join public.contratista_memberships cm on cm.contratista_id = a.contratista_id
    where e.id = evaluation_action_plans.evaluation_id
      and e.status in ('publicada','cerrada')
      and cm.profile_id = (select auth.uid())
      and cm.is_active = true
      and a.is_active = true
  )
)
with check (
  exists (
    select 1
    from public.contractor_evaluations e
    join public.accreditations a on a.id = e.accreditation_id
    join public.contratista_memberships cm on cm.contratista_id = a.contratista_id
    where e.id = evaluation_action_plans.evaluation_id
      and e.status in ('publicada','cerrada')
      and cm.profile_id = (select auth.uid())
      and cm.is_active = true
      and a.is_active = true
  )
);
