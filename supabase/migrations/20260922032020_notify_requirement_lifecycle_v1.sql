create or replace function private.notify_requirement_change()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_acc uuid;
  v_project_name text;
  v_key text;
  v_title text;
  v_body text;
begin
  if tg_op = 'UPDATE'
     and not old.is_active
     and not new.is_active then
    return new;
  end if;

  if tg_op = 'UPDATE'
     and old.is_active
     and new.is_active
     and new.name is not distinct from old.name
     and new.is_required is not distinct from old.is_required
     and new.frequency is not distinct from old.frequency
     and new.validity_days is not distinct from old.validity_days
     and new.alert_days is not distinct from old.alert_days
     and new.criticality is not distinct from old.criticality
     and new.applicability is not distinct from old.applicability
     and new.service_id is not distinct from old.service_id then
    return new;
  end if;

  select name into v_project_name
  from public.projects
  where id = new.project_id;

  if tg_op = 'INSERT' then
    v_title := 'Nuevo requisito documental';
    v_body := coalesce(new.name,'Requisito') || ' · ' || coalesce(v_project_name,'Proyecto') ||
      '. Revisa obligatoriedad, vigencia y alcance antes de tu próxima carga.';
  elsif old.is_active and not new.is_active then
    v_title := 'Requisito documental retirado';
    v_body := coalesce(new.name,'Requisito') || ' · ' || coalesce(v_project_name,'Proyecto') ||
      '. Ya no genera obligaciones activas. Su historial se conserva.';
  elsif not old.is_active and new.is_active then
    v_title := 'Requisito documental reactivado';
    v_body := coalesce(new.name,'Requisito') || ' · ' || coalesce(v_project_name,'Proyecto') ||
      '. Vuelve a formar parte de la matriz documental activa.';
  else
    v_title := 'Requisito documental actualizado';
    v_body := coalesce(new.name,'Requisito') || ' · ' || coalesce(v_project_name,'Proyecto') ||
      '. Revisa obligatoriedad, vigencia y alcance antes de tu próxima carga.';
  end if;

  v_key := 'requirement_changed:' || new.id::text || ':' ||
    coalesce(to_char(new.updated_at at time zone 'UTC','YYYYMMDDHH24MISSUS'), to_char(clock_timestamp(),'YYYYMMDDHH24MISSUS'));

  for v_acc in
    select a.id
    from public.accreditations a
    where a.project_id = new.project_id
      and a.is_active
  loop
    perform private.emit_contractor_notification(
      v_acc,
      v_key,
      'requirement_changed','informativa','action',
      v_title,
      v_body,
      'Ver documentos','documentos',
      null,new.id,null,null,null,null,null,true
    );
    perform private.sync_accreditation_notification_state(v_acc);
  end loop;

  return new;
end;
$function$;
