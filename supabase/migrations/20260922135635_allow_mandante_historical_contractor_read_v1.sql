create or replace function private.can_access_contratista(p_contratista_id uuid)
returns boolean
language sql
stable
security definer
set search_path to ''
as $function$
  select (select auth.uid()) is not null
    and (
      (select private.is_acredita_staff())
      or (select private.has_contratista_access(p_contratista_id))
      or exists (
        select 1
        from public.accreditations a
        where a.contratista_id = p_contratista_id
          and (select private.has_mandante_project_access(a.project_id))
      )
    );
$function$;
