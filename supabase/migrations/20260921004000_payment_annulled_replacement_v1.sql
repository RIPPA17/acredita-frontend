alter table public.payment_cases
  drop constraint if exists payment_cases_accreditation_id_period_start_period_end_key;

drop index if exists public.payment_cases_active_period_unique;
create unique index payment_cases_active_period_unique
  on public.payment_cases(accreditation_id,period_start,period_end)
  where status <> 'anulado';