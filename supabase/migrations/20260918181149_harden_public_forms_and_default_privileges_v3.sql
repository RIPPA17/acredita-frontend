-- Harden public form writes and future Data API exposure.
-- Mirrors remote migration 20260918181149_harden_public_forms_and_default_privileges_v3.

revoke insert (status) on table public.access_requests from anon, authenticated;

drop policy if exists privacy_requests_public_insert on public.privacy_requests;
create policy privacy_requests_public_insert
on public.privacy_requests
for insert
to anon, authenticated
with check (
  status = 'received'
  and identity_status = 'pending'
  and assigned_to is null
  and acknowledged_at is null
  and response_sent_at is null
  and resolved_at is null
  and source = 'web'
  and contact_channel = 'web'
  and (
    requester_profile_id is null
    or requester_profile_id = (select auth.uid())
  )
);

alter default privileges for role postgres in schema public
  revoke all privileges on tables from anon, authenticated, service_role;

alter default privileges for role postgres in schema public
  revoke all privileges on sequences from anon, authenticated, service_role;

alter default privileges for role postgres in schema public
  revoke all privileges on functions from anon, authenticated, service_role;

alter default privileges for role postgres in schema public
  revoke execute on functions from public;
