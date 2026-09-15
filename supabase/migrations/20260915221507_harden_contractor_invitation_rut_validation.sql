create or replace function private.is_valid_rut(p_rut text)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_rut text := upper(regexp_replace(coalesce(p_rut, ''), '[^0-9kK]', '', 'g'));
  v_body text;
  v_dv text;
  v_sum integer := 0;
  v_multiplier integer := 2;
  v_expected text;
  i integer;
  v_remainder integer;
begin
  if v_rut !~ '^[0-9]{7,8}[0-9K]$' then
    return false;
  end if;

  v_body := left(v_rut, length(v_rut) - 1);
  v_dv := right(v_rut, 1);

  for i in reverse length(v_body)..1 loop
    v_sum := v_sum + substr(v_body, i, 1)::integer * v_multiplier;
    v_multiplier := case when v_multiplier = 7 then 2 else v_multiplier + 1 end;
  end loop;

  v_remainder := 11 - (v_sum % 11);
  v_expected := case v_remainder when 11 then '0' when 10 then 'K' else v_remainder::text end;
  return v_dv = v_expected;
end;
$$;

do $$
begin
  if not private.is_valid_rut('77.321.654-1') then
    raise exception 'RUT válido rechazado por la nueva regla';
  end if;
  if private.is_valid_rut('76.111.222-3') then
    raise exception 'RUT inválido aceptado por la nueva regla';
  end if;
end;
$$;

revoke all on function private.is_valid_rut(text) from public, anon, authenticated;

create or replace function private.create_contractor_invitation_impl(
  p_project_id uuid,
  p_email text,
  p_contractor_id uuid default null,
  p_contractor_name text default null,
  p_contractor_rut text default null,
  p_message text default null
)
returns table(invitation_id uuid, token text, expires_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_email text := lower(trim(coalesce(p_email, '')));
  v_name text;
  v_rut text;
  v_token text;
  v_invitation_id uuid;
  v_expires_at timestamptz := now() + interval '7 days';
begin
  if v_uid is null then raise exception 'Debes iniciar sesión para invitar contratistas'; end if;
  if not private.can_manage_project(p_project_id) then raise exception 'No tienes permisos para invitar contratistas a este proyecto'; end if;
  if v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then raise exception 'Correo de invitación inválido'; end if;
  if length(coalesce(p_message, '')) > 2000 then raise exception 'El mensaje de invitación es demasiado largo'; end if;

  if p_contractor_id is not null then
    select c.name, c.rut into v_name, v_rut
    from public.contratistas c
    where c.id = p_contractor_id and c.is_active = true;
    if v_name is null then raise exception 'Contratista no disponible'; end if;
  else
    v_name := nullif(trim(coalesce(p_contractor_name, '')), '');
    v_rut := nullif(trim(coalesce(p_contractor_rut, '')), '');
    if v_name is null or v_rut is null then raise exception 'Nombre y RUT son obligatorios para un contratista nuevo'; end if;
    if length(v_name) > 200 then raise exception 'El nombre del contratista es demasiado largo'; end if;
    if not private.is_valid_rut(v_rut) then raise exception 'El RUT del contratista no es válido'; end if;
    if exists (
      select 1 from public.contratistas c
      where private.normalize_rut(c.rut) = private.normalize_rut(v_rut)
    ) then
      raise exception 'Este RUT ya está registrado. Selecciona el contratista existente.';
    end if;
  end if;

  if p_contractor_id is not null and exists (
    select 1 from public.accreditations a
    where a.project_id = p_project_id and a.contratista_id = p_contractor_id and a.is_active = true
  ) then raise exception 'Este contratista ya participa en el proyecto'; end if;

  update public.invitations
  set status = 'cancelled', responded_at = now()
  where project_id = p_project_id and lower(invited_email) = v_email and status = 'pending';

  v_token := encode(extensions.gen_random_bytes(32), 'hex');
  insert into public.invitations(
    project_id, contratista_id, invited_email, status, invited_by, invited_at, expires_at,
    contractor_name, contractor_rut, message, token_hash
  )
  values (
    p_project_id, p_contractor_id, v_email, 'pending', v_uid, now(), v_expires_at,
    v_name, v_rut, nullif(trim(coalesce(p_message, '')), ''),
    encode(extensions.digest(v_token, 'sha256'), 'hex')
  )
  returning id into v_invitation_id;

  insert into public.audit_logs(actor_profile_id, action, entity_type, entity_id, project_id, details)
  values (
    v_uid, 'creacion_invitacion', 'invitation', v_invitation_id, p_project_id,
    jsonb_build_object('invited_email', v_email, 'contractor_name', v_name, 'contractor_rut', v_rut)
  );

  return query select v_invitation_id, v_token, v_expires_at;
end;
$$;

revoke all on function private.create_contractor_invitation_impl(uuid, text, uuid, text, text, text) from public, anon, authenticated;
