begin;

create table if not exists public.business_sync_control (
  id smallint primary key default 1 check (id = 1),
  revision bigint not null default 0,
  lock_owner uuid references public.profiles(id) on delete set null,
  lock_until timestamptz,
  updated_at timestamptz not null default now()
);

insert into public.business_sync_control(id, revision)
values (1, 0)
on conflict (id) do nothing;

alter table public.business_sync_control enable row level security;

drop policy if exists business_sync_control_select on public.business_sync_control;
create policy business_sync_control_select on public.business_sync_control
for select to authenticated
using (true);

drop policy if exists business_sync_control_update on public.business_sync_control;
create policy business_sync_control_update on public.business_sync_control
for update to authenticated
using (
  lock_owner is null
  or lock_owner = auth.uid()
  or lock_until is null
  or lock_until < now()
)
with check (
  lock_owner is null
  or lock_owner = auth.uid()
);

grant select, update on public.business_sync_control to authenticated;

create or replace function public.claim_business_sync(p_expected_revision bigint, p_seconds integer default 45)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  affected integer := 0;
begin
  if auth.uid() is null then
    return false;
  end if;
  update public.business_sync_control
  set lock_owner = auth.uid(),
      lock_until = now() + make_interval(secs => greatest(10, least(coalesce(p_seconds, 45), 120))),
      updated_at = now()
  where id = 1
    and revision = p_expected_revision
    and (
      lock_owner is null
      or lock_owner = auth.uid()
      or lock_until is null
      or lock_until < now()
    );
  get diagnostics affected = row_count;
  return affected = 1;
end;
$$;

grant execute on function public.claim_business_sync(bigint, integer) to authenticated;

create or replace function public.release_business_sync()
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  update public.business_sync_control
  set lock_owner = null,
      lock_until = null,
      updated_at = now()
  where id = 1
    and lock_owner = auth.uid();
end;
$$;

grant execute on function public.release_business_sync() to authenticated;

create or replace function private.bump_business_sync_revision()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.business_sync_control
  set revision = revision + 1,
      updated_at = now()
  where id = 1;
  return coalesce(new, old);
end;
$$;
revoke all on function private.bump_business_sync_revision() from public, anon, authenticated;

do $$
declare
  t text;
begin
  foreach t in array array[
    'mandantes','projects','contratistas','accreditations','requirements','services',
    'workers','worker_assignments','documents','document_versions','compliance_periods'
  ] loop
    execute format('drop trigger if exists %I on public.%I', 'business_revision_' || t, t);
    execute format(
      'create trigger %I after insert or update or delete on public.%I for each statement execute function private.bump_business_sync_revision()',
      'business_revision_' || t,
      t
    );
  end loop;
end $$;

commit;
