-- Tighten Storage access for operational attachments.
-- Prevents an authenticated user from reading an operation file solely because
-- an operation_attachments row exists for the storage path.
-- Access now follows the same parent-resource authorization as the table RLS.

drop policy if exists operation_files_select on storage.objects;

create policy operation_files_select
on storage.objects
for select
to authenticated
using (
  bucket_id = 'operation-files'
  and exists (
    select 1
    from public.operation_attachments oa
    where oa.storage_path = storage.objects.name
      and oa.storage_bucket = storage.objects.bucket_id
      and (
        (
          oa.payment_case_id is not null
          and exists (
            select 1
            from public.payment_cases pc
            where pc.id = oa.payment_case_id
              and private.can_access_accreditation(pc.accreditation_id)
          )
        )
        or (
          oa.support_ticket_id is not null
          and private.can_access_support_ticket(oa.support_ticket_id)
        )
        or (
          oa.action_plan_id is not null
          and exists (
            select 1
            from public.evaluation_action_plans ap
            join public.contractor_evaluations ce on ce.id = ap.evaluation_id
            where ap.id = oa.action_plan_id
              and private.can_access_accreditation(ce.accreditation_id)
          )
        )
      )
  )
);
