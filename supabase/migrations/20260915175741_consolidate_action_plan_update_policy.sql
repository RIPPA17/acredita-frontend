drop policy if exists action_plans_update on public.evaluation_action_plans;
drop policy if exists action_plans_contractor_progress_update on public.evaluation_action_plans;

create policy action_plans_update
on public.evaluation_action_plans
for update
to authenticated
using (
  exists (
    select 1
    from public.contractor_evaluations e
    join public.accreditations a on a.id = e.accreditation_id
    where e.id = evaluation_action_plans.evaluation_id
      and (
        (select private.is_acredita_staff())
        or (select private.can_manage_project(a.project_id))
        or (
          e.status in ('publicada','cerrada')
          and exists (
            select 1
            from public.contratista_memberships cm
            where cm.contratista_id = a.contratista_id
              and cm.profile_id = (select auth.uid())
              and cm.is_active = true
              and a.is_active = true
          )
        )
      )
  )
)
with check (
  exists (
    select 1
    from public.contractor_evaluations e
    join public.accreditations a on a.id = e.accreditation_id
    where e.id = evaluation_action_plans.evaluation_id
      and (
        (select private.is_acredita_staff())
        or (select private.can_manage_project(a.project_id))
        or (
          e.status in ('publicada','cerrada')
          and exists (
            select 1
            from public.contratista_memberships cm
            where cm.contratista_id = a.contratista_id
              and cm.profile_id = (select auth.uid())
              and cm.is_active = true
              and a.is_active = true
          )
        )
      )
  )
);
