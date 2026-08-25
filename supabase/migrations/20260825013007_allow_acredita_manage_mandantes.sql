grant insert, update on table public.mandantes to authenticated;

drop policy if exists mandantes_insert_acredita on public.mandantes;
create policy mandantes_insert_acredita
on public.mandantes
for insert
to authenticated
with check ((select private.is_acredita_staff()));

drop policy if exists mandantes_update_acredita on public.mandantes;
create policy mandantes_update_acredita
on public.mandantes
for update
to authenticated
using ((select private.is_acredita_staff()))
with check ((select private.is_acredita_staff()));
