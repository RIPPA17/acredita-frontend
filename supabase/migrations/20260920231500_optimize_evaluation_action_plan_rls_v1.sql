drop policy if exists action_plans_insert on public.evaluation_action_plans;
create policy action_plans_insert on public.evaluation_action_plans
for insert to authenticated
with check (
  created_by=(select auth.uid())
  and exists(
    select 1
    from public.contractor_evaluations e
    join public.accreditations a on a.id=e.accreditation_id
    join public.projects p on p.id=a.project_id
    where e.id=evaluation_action_plans.evaluation_id
      and a.is_active and p.status='active'
      and e.status in ('borrador','publicada')
      and (private.is_acredita_staff() or private.can_manage_project(a.project_id))
  )
);

drop policy if exists action_plans_update on public.evaluation_action_plans;
create policy action_plans_update on public.evaluation_action_plans
for update to authenticated
using (
  exists(
    select 1
    from public.contractor_evaluations e
    join public.accreditations a on a.id=e.accreditation_id
    join public.projects p on p.id=a.project_id
    where e.id=evaluation_action_plans.evaluation_id
      and a.is_active and p.status='active'
      and (
        private.is_acredita_staff()
        or private.can_manage_project(a.project_id)
        or (
          e.status='publicada'
          and exists(
            select 1 from public.contratista_memberships cm
            where cm.contratista_id=a.contratista_id
              and cm.profile_id=(select auth.uid())
              and cm.is_active
          )
        )
      )
  )
)
with check (
  exists(
    select 1
    from public.contractor_evaluations e
    join public.accreditations a on a.id=e.accreditation_id
    join public.projects p on p.id=a.project_id
    where e.id=evaluation_action_plans.evaluation_id
      and a.is_active and p.status='active'
      and (
        private.is_acredita_staff()
        or private.can_manage_project(a.project_id)
        or (
          e.status='publicada'
          and exists(
            select 1 from public.contratista_memberships cm
            where cm.contratista_id=a.contratista_id
              and cm.profile_id=(select auth.uid())
              and cm.is_active
          )
        )
      )
  )
);