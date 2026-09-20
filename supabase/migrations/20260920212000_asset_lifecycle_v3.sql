create or replace function private.guard_asset_context()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_acc_active boolean;
  v_project_status text;
  v_service_acc uuid;
  v_service_active boolean;
  v_service_status text;
begin
  new.identifier := upper(btrim(new.identifier));
  new.name := btrim(new.name);
  new.brand := nullif(btrim(coalesce(new.brand,'')),'');
  new.model := nullif(btrim(coalesce(new.model,'')),'');
  new.owner_name := nullif(btrim(coalesce(new.owner_name,'')),'');
  new.operator_name := nullif(btrim(coalesce(new.operator_name,'')),'');
  new.notes := nullif(btrim(coalesce(new.notes,'')),'');

  select ac.is_active, p.status
    into v_acc_active, v_project_status
  from public.accreditations ac
  join public.projects p on p.id = ac.project_id
  where ac.id = new.accreditation_id;

  if tg_op = 'UPDATE' then
    if not old.is_active and row(new.*) is distinct from row(old.*) then
      raise exception 'Un activo retirado es histórico y no puede modificarse';
    end if;

    if new.accreditation_id is distinct from old.accreditation_id then
      raise exception 'La acreditación de un activo no puede cambiarse; retíralo y crea un nuevo registro';
    end if;

    if old.is_active and (coalesce(v_acc_active,false)=false or v_project_status <> 'active') then
      raise exception 'El proyecto o la relación del contratista está en modo histórico y el activo no puede modificarse';
    end if;

    if old.is_active and not new.is_active then
      if nullif(btrim(coalesce(new.retirement_reason,'')),'') is null then
        raise exception 'Debes indicar el motivo de retiro del activo';
      end if;
      new.retired_at := coalesce(new.retired_at, now());
      new.retired_by := coalesce(new.retired_by, (select auth.uid()));
      new.status := 'inactivo';
      new.access_allowed := false;
    elsif not old.is_active and new.is_active then
      raise exception 'Un activo histórico no puede reactivarse; registra un nuevo ingreso';
    end if;
  end if;

  if new.is_active and (coalesce(v_acc_active,false)=false or v_project_status <> 'active') then
    raise exception 'El activo solo puede operar dentro de una acreditación y proyecto activos';
  end if;

  if new.service_id is not null then
    select s.accreditation_id, s.is_active, s.status
      into v_service_acc, v_service_active, v_service_status
    from public.services s
    where s.id = new.service_id;

    if v_service_acc is null or v_service_acc <> new.accreditation_id then
      raise exception 'El servicio seleccionado no pertenece a la misma acreditación del activo';
    end if;
    if new.is_active and (not coalesce(v_service_active,false) or v_service_status <> 'activo') then
      raise exception 'El activo no puede asociarse a un servicio inactivo o finalizado';
    end if;
  end if;

  return new;
end
$$;

create or replace function private.guard_asset_template_lifecycle()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_project_status text;
begin
  new.document_type := btrim(new.document_type);

  select p.status into v_project_status
  from public.projects p
  where p.id = new.project_id;

  if v_project_status is distinct from 'active' then
    raise exception 'La matriz de activos solo puede modificarse mientras el proyecto está activo';
  end if;

  if tg_op = 'UPDATE' then
    if not old.is_active and row(new.*) is distinct from row(old.*) then
      raise exception 'Un requisito retirado es histórico y no puede modificarse';
    end if;
    if new.project_id is distinct from old.project_id or new.asset_type is distinct from old.asset_type then
      raise exception 'El contexto del requisito no puede cambiarse; retíralo y crea uno nuevo';
    end if;
    if old.is_active and not new.is_active then
      if nullif(btrim(coalesce(new.retirement_reason,'')),'') is null then
        raise exception 'Debes indicar el motivo de retiro del requisito';
      end if;
      new.retired_at := coalesce(new.retired_at, now());
      new.retired_by := coalesce(new.retired_by, (select auth.uid()));
    elsif not old.is_active and new.is_active then
      raise exception 'Un requisito histórico no puede reactivarse; crea una nueva versión';
    end if;
  end if;

  return new;
end
$$;

create or replace function private.guard_asset_event_dates()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_table_name = 'asset_maintenance' then
    new.maintenance_type := btrim(new.maintenance_type);
    if nullif(new.maintenance_type,'') is null then
      raise exception 'Debes indicar el tipo de mantención';
    end if;
    if new.performed_at > current_date then
      raise exception 'La mantención no puede registrarse con una fecha futura';
    end if;
  elsif tg_table_name = 'asset_inspections' then
    if new.inspection_date > current_date then
      raise exception 'La inspección no puede registrarse con una fecha futura';
    end if;
  end if;
  return new;
end
$$;

drop trigger if exists asset_maintenance_guard_dates on public.asset_maintenance;
create trigger asset_maintenance_guard_dates
before insert on public.asset_maintenance
for each row execute function private.guard_asset_event_dates();

drop trigger if exists asset_inspections_guard_dates on public.asset_inspections;
create trigger asset_inspections_guard_dates
before insert on public.asset_inspections
for each row execute function private.guard_asset_event_dates();
