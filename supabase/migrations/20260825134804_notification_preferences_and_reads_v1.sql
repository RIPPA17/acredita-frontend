create table if not exists public.notification_preferences (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  document_rejected boolean not null default true,
  document_expiring boolean not null default true,
  accreditation_approved boolean not null default true,
  worker_status boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.notification_reads (
  profile_id uuid not null references public.profiles(id) on delete cascade,
  notification_key text not null,
  read_at timestamptz not null default now(),
  primary key (profile_id, notification_key)
);

create index if not exists notification_reads_profile_read_at_idx
  on public.notification_reads(profile_id, read_at desc);

alter table public.notification_preferences enable row level security;
alter table public.notification_reads enable row level security;

grant select, insert, update on table public.notification_preferences to authenticated;
grant select, insert, update on table public.notification_reads to authenticated;

create policy notification_preferences_select_own
on public.notification_preferences
for select to authenticated
using (profile_id = (select auth.uid()));

create policy notification_preferences_insert_own
on public.notification_preferences
for insert to authenticated
with check (profile_id = (select auth.uid()));

create policy notification_preferences_update_own
on public.notification_preferences
for update to authenticated
using (profile_id = (select auth.uid()))
with check (profile_id = (select auth.uid()));

create policy notification_reads_select_own
on public.notification_reads
for select to authenticated
using (profile_id = (select auth.uid()));

create policy notification_reads_insert_own
on public.notification_reads
for insert to authenticated
with check (profile_id = (select auth.uid()));

create policy notification_reads_update_own
on public.notification_reads
for update to authenticated
using (profile_id = (select auth.uid()))
with check (profile_id = (select auth.uid()));

create or replace function private.touch_notification_preferences_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists notification_preferences_touch_updated_at on public.notification_preferences;
create trigger notification_preferences_touch_updated_at
before update on public.notification_preferences
for each row execute function private.touch_notification_preferences_updated_at();
