begin;

create or replace function private.guard_business_sync_control()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  bumping boolean := coalesce(current_setting('app.business_revision_bump', true), '') = '1';
begin
  if new.revision is distinct from old.revision and not bumping then
    raise exception 'La revisión de sincronización es administrada por Acredita';
  end if;

  if not bumping then
    if new.lock_owner is not null and new.lock_owner is distinct from auth.uid() then
      raise exception 'No puedes adquirir un bloqueo para otro usuario';
    end if;
    if new.lock_until is not null and new.lock_until > now() + interval '120 seconds' then
      raise exception 'El bloqueo de sincronización no puede exceder 120 segundos';
    end if;
  end if;
  return new;
end;
$$;
revoke all on function private.guard_business_sync_control() from public, anon, authenticated;

drop trigger if exists business_sync_control_guard on public.business_sync_control;
create trigger business_sync_control_guard
before update on public.business_sync_control
for each row execute function private.guard_business_sync_control();

create or replace function private.bump_business_sync_revision()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform set_config('app.business_revision_bump', '1', true);
  update public.business_sync_control
  set revision = revision + 1,
      updated_at = now()
  where id = 1;
  perform set_config('app.business_revision_bump', '', true);
  return coalesce(new, old);
end;
$$;
revoke all on function private.bump_business_sync_revision() from public, anon, authenticated;

commit;
