-- Production hardening for Acredita.
-- Applied to Supabase production as production_security_and_audit_hardening_v1.
-- 1) Remove unintended anonymous RPC execution.
-- 2) Fix asset Storage authorization to validate the asset id from the object path.
-- 3) Extend operational audit coverage without copying free-text/sensitive content.

revoke all on function public.claim_business_sync(bigint, integer) from public, anon;
revoke all on function public.release_business_sync() from public, anon;
revoke all on function public.mark_payment_paid(uuid) from public, anon;
grant execute on function public.claim_business_sync(bigint, integer) to authenticated, service_role;
grant execute on function public.release_business_sync() to authenticated, service_role;
grant execute on function public.mark_payment_paid(uuid) to authenticated, service_role;

revoke all on function private.guard_asset_document_decision() from public, anon;
revoke all on function private.touch_notification_preferences_updated_at() from public, anon;

-- The frontend stores asset files as <asset_uuid>/<random>-<filename>.
drop policy if exists asset_storage_insert on storage.objects;
create policy asset_storage_insert
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'asset-documents'
  and coalesce((storage.foldername(name))[1], '') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  and exists (
    select 1
    from public.assets a
    where a.id = ((storage.foldername(storage.objects.name))[1])::uuid
      and private.can_access_accreditation(a.accreditation_id)
  )
);

drop policy if exists asset_storage_select on storage.objects;
create policy asset_storage_select
on storage.objects
for select
to authenticated
using (
  bucket_id = 'asset-documents'
  and coalesce((storage.foldername(name))[1], '') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  and exists (
    select 1
    from public.assets a
    where a.id = ((storage.foldername(storage.objects.name))[1])::uuid
      and private.can_access_accreditation(a.accreditation_id)
  )
);

create or replace function private.audit_sensitive_operation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_project_id uuid;
  v_accreditation_id uuid;
  v_actor uuid := (select auth.uid());
  v_action text;
  v_details jsonb := '{}'::jsonb;
begin
  if tg_table_name = 'payment_cases' then
    v_accreditation_id := new.accreditation_id;
    select a.project_id into v_project_id
    from public.accreditations a
    where a.id = new.accreditation_id;

    if tg_op = 'INSERT' then
      v_action := 'payment_case_created';
    elsif old.status is distinct from new.status then
      v_action := 'payment_status_changed';
    else
      v_action := 'payment_case_updated';
    end if;

    v_actor := coalesce(v_actor, new.submitted_by, new.released_by);
    v_details := jsonb_build_object(
      'old_status', case when tg_op = 'UPDATE' then old.status else null end,
      'new_status', new.status,
      'period_start', new.period_start,
      'period_end', new.period_end,
      'invoice_present', new.invoice_number is not null
    );

  elsif tg_table_name = 'payment_approvals' then
    select pc.accreditation_id, a.project_id
      into v_accreditation_id, v_project_id
    from public.payment_cases pc
    join public.accreditations a on a.id = pc.accreditation_id
    where pc.id = new.payment_case_id;

    v_action := 'payment_approval_recorded';
    v_actor := coalesce(v_actor, new.decided_by);
    v_details := jsonb_build_object('decision', new.decision);

  elsif tg_table_name = 'contractor_evaluations' then
    v_accreditation_id := new.accreditation_id;
    select a.project_id into v_project_id
    from public.accreditations a
    where a.id = new.accreditation_id;

    if tg_op = 'INSERT' then
      v_action := 'evaluation_created';
    elsif old.status is distinct from new.status then
      v_action := 'evaluation_status_changed';
    else
      v_action := 'evaluation_updated';
    end if;

    v_actor := coalesce(v_actor, new.evaluated_by);
    v_details := jsonb_build_object(
      'old_status', case when tg_op = 'UPDATE' then old.status else null end,
      'new_status', new.status,
      'period_start', new.period_start,
      'period_end', new.period_end,
      'risk_level', new.risk_level,
      'total_score', new.total_score
    );

  elsif tg_table_name = 'evaluation_action_plans' then
    select e.accreditation_id, a.project_id
      into v_accreditation_id, v_project_id
    from public.contractor_evaluations e
    join public.accreditations a on a.id = e.accreditation_id
    where e.id = new.evaluation_id;

    if tg_op = 'INSERT' then
      v_action := 'action_plan_created';
    elsif old.status is distinct from new.status then
      v_action := 'action_plan_status_changed';
    else
      v_action := 'action_plan_updated';
    end if;

    v_actor := coalesce(v_actor, new.created_by);
    v_details := jsonb_build_object(
      'old_status', case when tg_op = 'UPDATE' then old.status else null end,
      'new_status', new.status,
      'due_date', new.due_date,
      'completed_at', new.completed_at,
      'evidence_present', coalesce(length(trim(new.evidence)), 0) > 0
    );

  elsif tg_table_name = 'support_tickets' then
    v_project_id := new.project_id;
    v_accreditation_id := new.accreditation_id;

    if tg_op = 'INSERT' then
      v_action := 'support_ticket_created';
    elsif old.status is distinct from new.status then
      v_action := 'support_ticket_status_changed';
    else
      v_action := 'support_ticket_updated';
    end if;

    v_actor := coalesce(v_actor, new.created_by, new.assigned_to);
    v_details := jsonb_build_object(
      'category', new.category,
      'priority', new.priority,
      'old_status', case when tg_op = 'UPDATE' then old.status else null end,
      'new_status', new.status,
      'assigned', new.assigned_to is not null,
      'due_at', new.due_at,
      'resolved_at', new.resolved_at,
      'closed_at', new.closed_at
    );

  elsif tg_table_name = 'support_ticket_messages' then
    select t.project_id, t.accreditation_id
      into v_project_id, v_accreditation_id
    from public.support_tickets t
    where t.id = new.ticket_id;

    v_action := 'support_message_added';
    v_actor := coalesce(v_actor, new.author_id);
    v_details := jsonb_build_object('is_internal', new.is_internal);

  else
    return new;
  end if;

  insert into public.audit_logs(
    actor_profile_id,
    action,
    entity_type,
    entity_id,
    project_id,
    accreditation_id,
    details
  ) values (
    v_actor,
    v_action,
    tg_table_name,
    new.id,
    v_project_id,
    v_accreditation_id,
    v_details
  );

  return new;
end;
$$;

revoke all on function private.audit_sensitive_operation() from public, anon, authenticated;

drop trigger if exists trg_audit_payment_case on public.payment_cases;
create trigger trg_audit_payment_case
after insert or update of status, invoice_number, submitted_at, released_at, paid_at
on public.payment_cases
for each row execute function private.audit_sensitive_operation();

drop trigger if exists trg_audit_payment_approval on public.payment_approvals;
create trigger trg_audit_payment_approval
after insert on public.payment_approvals
for each row execute function private.audit_sensitive_operation();

drop trigger if exists trg_audit_contractor_evaluation on public.contractor_evaluations;
create trigger trg_audit_contractor_evaluation
after insert or update of status, total_score, risk_level
on public.contractor_evaluations
for each row execute function private.audit_sensitive_operation();

drop trigger if exists trg_audit_evaluation_action_plan on public.evaluation_action_plans;
create trigger trg_audit_evaluation_action_plan
after insert or update of status, due_date, completed_at, evidence
on public.evaluation_action_plans
for each row execute function private.audit_sensitive_operation();

drop trigger if exists trg_audit_support_ticket on public.support_tickets;
create trigger trg_audit_support_ticket
after insert or update of status, priority, assigned_to, due_at, resolved_at, closed_at
on public.support_tickets
for each row execute function private.audit_sensitive_operation();

drop trigger if exists trg_audit_support_ticket_message on public.support_ticket_messages;
create trigger trg_audit_support_ticket_message
after insert on public.support_ticket_messages
for each row execute function private.audit_sensitive_operation();
