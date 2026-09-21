
alter table public.privacy_decision_reviews
  drop constraint if exists privacy_decision_reviews_override_guard;

alter table public.privacy_decision_reviews
  add constraint privacy_decision_reviews_override_guard
  check (
    status <> 'overridden'
    or (
      nullif(btrim(override_value), '') is not null
      and nullif(btrim(override_reason), '') is not null
      and override_until is not null
      and reviewed_by is not null
      and reviewed_at is not null
    )
  );

create unique index if not exists privacy_decision_reviews_open_company_unique
  on public.privacy_decision_reviews(accreditation_id, decision_type)
  where worker_id is null and status in ('requested','in_review');

create unique index if not exists privacy_decision_reviews_open_worker_unique
  on public.privacy_decision_reviews(accreditation_id, worker_id, decision_type)
  where worker_id is not null and status in ('requested','in_review');
