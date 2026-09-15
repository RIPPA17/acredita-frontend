begin;

create index if not exists business_sync_control_lock_owner_idx
on public.business_sync_control(lock_owner)
where lock_owner is not null;

drop policy if exists business_sync_control_update on public.business_sync_control;
create policy business_sync_control_update on public.business_sync_control
for update to authenticated
using (
  lock_owner is null
  or lock_owner = (select auth.uid())
  or lock_until is null
  or lock_until < now()
)
with check (
  lock_owner is null
  or lock_owner = (select auth.uid())
);

commit;
