-- Reconciles Git history with the production migration already applied in Supabase.
-- The index is idempotent and improves FK lookups from privacy impact assessments to profiles.
create index if not exists privacy_impact_assessments_created_by_idx
  on public.privacy_impact_assessments (created_by);
