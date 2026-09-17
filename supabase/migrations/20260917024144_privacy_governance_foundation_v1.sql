-- Privacy requests foundation.
-- Baseline reconstructed from the production schema applied as privacy_governance_foundation_v1.

create table if not exists public.privacy_requests (
  id uuid primary key default gen_random_uuid(),
  request_type text not null check (request_type in ('access','rectification','deletion','opposition','portability','blocking')),
  requester_profile_id uuid references public.profiles(id) on delete set null,
  requester_name text not null check (char_length(requester_name) between 2 and 200),
  requester_email text not null check (char_length(requester_email) between 3 and 320 and position('@' in requester_email) > 1),
  contact_channel text not null default 'email' check (contact_channel in ('email','web','other')),
  scope text not null default '' check (char_length(scope) <= 1500),
  details text check (details is null or char_length(details) <= 5000),
  source text not null default 'web' check (source in ('web','email','staff','other')),
  status text not null default 'received' check (status in ('received','identity_verification','in_review','blocked','resolved','rejected','withdrawn')),
  identity_status text not null default 'pending' check (identity_status in ('pending','verified','rejected')),
  temporary_block_requested boolean not null default false,
  temporary_block_status text not null default 'not_requested' check (temporary_block_status in ('not_requested','pending','accepted','rejected','released')),
  block_requested_at timestamptz,
  block_responded_at timestamptz,
  assigned_to uuid references public.profiles(id) on delete set null,
  acknowledged_at timestamptz,
  received_at timestamptz not null default now(),
  due_at timestamptz,
  response_sent_at timestamptz,
  resolved_at timestamptz,
  resolution_summary text check (resolution_summary is null or char_length(resolution_summary) <= 5000),
  denial_reason text check (denial_reason is null or char_length(denial_reason) <= 3000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.privacy_requests enable row level security;

grant insert on public.privacy_requests to anon, authenticated;
grant select, update on public.privacy_requests to authenticated;

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
  and (requester_profile_id is null or requester_profile_id = (select auth.uid()))
);

create policy privacy_requests_select_authorized
on public.privacy_requests
for select
to authenticated
using (
  requester_profile_id = (select auth.uid())
  or (select private.is_acredita_staff())
);

create policy privacy_requests_staff_update
on public.privacy_requests
for update
to authenticated
using ((select private.is_acredita_staff()))
with check ((select private.is_acredita_staff()));

create index if not exists privacy_requests_status_received_idx
  on public.privacy_requests(status, received_at desc);
