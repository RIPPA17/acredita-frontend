
create or replace function public.archive_project(p_project_key text,p_reason text)
returns public.projects
language sql
security definer
set search_path=''
as $$
  select private.archive_project_impl(p_project_key,p_reason);
$$;

revoke all on function public.archive_project(text,text) from public,anon;
grant execute on function public.archive_project(text,text) to authenticated;
