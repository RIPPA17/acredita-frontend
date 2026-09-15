begin;

create or replace function private.apply_payment_approval_state()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.decision = 'aprobado' then
    update public.payment_cases
    set status = case when status = 'pagado' then status else 'liberado' end,
        block_reason = null,
        released_by = new.decided_by,
        released_at = coalesce(released_at, now()),
        updated_at = now()
    where id = new.payment_case_id;
  else
    update public.payment_cases
    set status = case when status = 'pagado' then status else 'retenido' end,
        block_reason = coalesce(nullif(new.comment, ''), case when new.decision = 'rechazado' then 'Aprobación de pago rechazada' else 'Pago observado' end),
        updated_at = now()
    where id = new.payment_case_id;
  end if;
  return new;
end;
$$;
revoke all on function private.apply_payment_approval_state() from public, anon, authenticated;

drop trigger if exists payment_approvals_apply_state on public.payment_approvals;
create trigger payment_approvals_apply_state
after insert on public.payment_approvals
for each row execute function private.apply_payment_approval_state();

commit;
