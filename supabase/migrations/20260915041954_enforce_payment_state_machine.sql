begin;

create or replace function private.guard_payment_case_transition()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  source text := coalesce(current_setting('app.payment_transition_source', true), '');
begin
  if new.status is distinct from old.status then
    if source = 'approval' then
      if new.status not in ('liberado','retenido') then
        raise exception 'Transición de pago inválida desde una aprobación';
      end if;
    elsif source = 'mark_paid' then
      if old.status <> 'liberado' or new.status <> 'pagado' then
        raise exception 'Solo un pago liberado puede marcarse como pagado';
      end if;
    else
      raise exception 'El estado del pago solo puede cambiar mediante el flujo de aprobación o la confirmación de pago';
    end if;
  end if;

  if source = '' and (
    new.released_by is distinct from old.released_by
    or new.released_at is distinct from old.released_at
    or new.paid_at is distinct from old.paid_at
  ) then
    raise exception 'Los campos de liberación/pago son administrados por el state machine';
  end if;
  return new;
end;
$$;
revoke all on function private.guard_payment_case_transition() from public, anon, authenticated;

drop trigger if exists payment_cases_guard_transition on public.payment_cases;
create trigger payment_cases_guard_transition
before update on public.payment_cases
for each row execute function private.guard_payment_case_transition();

create or replace function private.apply_payment_approval_state()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform set_config('app.payment_transition_source', 'approval', true);
  if new.decision = 'aprobado' then
    update public.payment_cases
    set status = case when status = 'pagado' then status else 'liberado' end,
        block_reason = null,
        released_by = new.decided_by,
        released_at = coalesce(released_at, now()),
        updated_at = now()
    where id = new.payment_case_id
      and status <> 'pagado';
  else
    update public.payment_cases
    set status = case when status = 'pagado' then status else 'retenido' end,
        block_reason = coalesce(nullif(new.comment, ''), case when new.decision = 'rechazado' then 'Aprobación de pago rechazada' else 'Pago observado' end),
        released_by = case when status = 'pagado' then released_by else null end,
        released_at = case when status = 'pagado' then released_at else null end,
        updated_at = now()
    where id = new.payment_case_id
      and status <> 'pagado';
  end if;
  return new;
end;
$$;
revoke all on function private.apply_payment_approval_state() from public, anon, authenticated;

drop trigger if exists payment_approvals_apply_state on public.payment_approvals;
create trigger payment_approvals_apply_state
after insert on public.payment_approvals
for each row execute function private.apply_payment_approval_state();

create or replace function public.mark_payment_paid(p_payment_case_id uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  affected integer := 0;
begin
  perform set_config('app.payment_transition_source', 'mark_paid', true);
  update public.payment_cases
  set status = 'pagado',
      paid_at = now(),
      updated_at = now()
  where id = p_payment_case_id
    and status = 'liberado';
  get diagnostics affected = row_count;
  if affected <> 1 then
    raise exception 'El pago debe estar liberado y ser administrable por tu rol antes de marcarlo como pagado';
  end if;
end;
$$;
grant execute on function public.mark_payment_paid(uuid) to authenticated;

commit;
