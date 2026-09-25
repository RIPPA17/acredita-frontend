
create or replace function private.admin_create_contractor_impl(
  p_name text,
  p_rut text,
  p_legal_name text default null,
  p_address text default null,
  p_contact_name text default null,
  p_contact_email text default null,
  p_contact_phone text default null
)
returns table(
  contractor_id uuid,
  contractor_key text,
  contractor_name text,
  contractor_rut text
)
language plpgsql
security definer
set search_path=''
as $$
declare
  v_name text := nullif(btrim(coalesce(p_name,'')),'');
  v_rut text := nullif(btrim(coalesce(p_rut,'')),'');
  v_normalized_rut text := private.normalize_rut(p_rut);
  v_id uuid;
  v_key text;
begin
  if (select auth.uid()) is null or not (select private.is_acredita_staff()) then
    raise exception using errcode='42501',message='Solo Administración Acredita puede crear empresas contratistas.';
  end if;
  if v_name is null then
    raise exception using errcode='22023',message='Ingresa el nombre del contratista.';
  end if;
  if v_rut is null or not private.is_valid_rut(v_rut) then
    raise exception using errcode='22023',message='Ingresa un RUT chileno válido para el contratista.';
  end if;
  if exists(
    select 1
    from public.contratistas c
    where private.normalize_rut(c.rut)=v_normalized_rut
  ) then
    raise exception using errcode='23505',message='Ya existe un contratista registrado con ese RUT.';
  end if;

  v_key := 'contratista_' || substr(replace(extensions.gen_random_uuid()::text,'-',''),1,16);

  insert into public.contratistas(
    name,rut,legal_name,is_active,integration_key,address,
    primary_contact_name,primary_contact_email,primary_contact_phone
  )
  values (
    v_name,v_rut,coalesce(nullif(btrim(p_legal_name),''),v_name),true,v_key,
    nullif(btrim(p_address),''),
    nullif(btrim(p_contact_name),''),
    nullif(lower(btrim(p_contact_email)),''),
    nullif(btrim(p_contact_phone),'')
  )
  returning id into v_id;

  insert into public.audit_logs(actor_profile_id,action,entity_type,entity_id,details)
  values (
    (select auth.uid()),
    'creacion_contratista',
    'contratista',
    v_id,
    jsonb_build_object(
      'integration_key',v_key,
      'name',v_name,
      'rut',v_rut,
      'primary_contact_email',nullif(lower(btrim(p_contact_email)),'')
    )
  );

  return query select v_id,v_key,v_name,v_rut;
end;
$$;
