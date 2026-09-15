begin;

create or replace function private.validate_operational_context()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  context_valid boolean;
begin
  if tg_table_name = 'requirements' then
    if new.service_id is null then return new; end if;
    select exists (
      select 1
      from public.services s
      join public.accreditations a on a.id = s.accreditation_id
      where s.id = new.service_id and a.project_id = new.project_id
    ) into context_valid;
  elsif tg_table_name = 'worker_assignments' then
    if new.service_id is null then return new; end if;
    select exists (
      select 1 from public.services s
      where s.id = new.service_id and s.accreditation_id = new.accreditation_id
    ) into context_valid;
  elsif tg_table_name = 'documents' then
    if new.obligation_id is null then return new; end if;
    select exists (
      select 1
      from public.document_obligations o
      left join public.worker_assignments wa on wa.id = o.worker_assignment_id
      where o.id = new.obligation_id
        and o.accreditation_id = new.accreditation_id
        and o.requirement_id = new.requirement_id
        and (
          (new.worker_id is null and o.worker_assignment_id is null)
          or (new.worker_id is not null and wa.worker_id = new.worker_id)
        )
    ) into context_valid;
  else
    return new;
  end if;

  if not coalesce(context_valid, false) then
    raise exception 'La relación operacional no pertenece al mismo contexto de acreditación';
  end if;
  return new;
end;
$$;
revoke all on function private.validate_operational_context() from public, anon, authenticated;

commit;
