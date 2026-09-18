alter table public.requirement_privacy_assessments
  drop constraint if exists requirement_privacy_approval_guard;

alter table public.requirement_privacy_assessments
  add constraint requirement_privacy_approval_guard
  check (
    status <> 'approved'
    or (
      minimization_strategy <> 'pending'
      and sensitive_data_possible is not null
      and cardinality(recipients) > 0
      and retention_rule_id is not null
      and human_review_required
      and (
        cardinality(decision_effects) = 0
        or human_override_available
      )
      and btrim(legal_basis) <> ''
      and legal_basis not ilike 'Pendiente%'
      and btrim(necessity_assessment) <> ''
      and necessity_assessment not ilike 'Pendiente%'
    )
  );
