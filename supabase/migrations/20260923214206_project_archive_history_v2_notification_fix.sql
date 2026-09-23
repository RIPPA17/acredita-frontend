
create or replace function private.notify_accreditation_lifecycle()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
declare
  v_project_name text;
  v_title text;
  v_body text;
  v_key text;
begin
  if tg_op <> 'UPDATE' or old.is_active is not distinct from new.is_active then
    return new;
  end if;

  select name into v_project_name from public.projects where id=new.project_id;
  if new.is_active then
    v_title := 'Participación reactivada';
    v_body := coalesce(v_project_name,'Proyecto') || '. La empresa vuelve a participar en este proyecto. Revisa servicios, trabajadores y documentos antes de operar.';
  else
    v_title := 'Participación finalizada';
    v_body := coalesce(v_project_name,'Proyecto') || '. La relación con este proyecto fue finalizada. El historial permanece disponible para consulta.';
  end if;
  v_key := 'accreditation_lifecycle:' || new.id::text || ':' || to_char(clock_timestamp(),'YYYYMMDDHH24MISSUS');

  perform private.emit_contractor_notification(
    new.id, v_key, 'accreditation_changed', 'informativa', 'action',
    v_title, v_body, 'Ver proyecto', 'proyecto',
    null, null, null, null, null, null, null, true
  );
  perform private.sync_accreditation_notification_state(new.id);
  return new;
end;
$$;

revoke all on function private.notify_accreditation_lifecycle() from public,anon,authenticated;
