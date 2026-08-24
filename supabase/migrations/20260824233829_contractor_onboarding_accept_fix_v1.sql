create or replace function public.accept_contractor_invitation(p_token text)
returns table(
  invitation_id uuid,
  contractor_id uuid,
  contractor_integration_key text,
  project_id uuid,
  project_integration_key text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_user_email text;
  v_inv public.invitations%rowtype;
  v_contractor_id uuid;
  v_contractor_key text;
  v_project_key text;
begin
  if v_uid is null then raise exception 'Debes iniciar sesión para aceptar la invitación'; end if;
  select lower(email) into v_user_email from auth.users where id = v_uid;
  if v_user_email is null then raise exception 'No se pudo validar el correo de la cuenta'; end if;

  select * into v_inv
  from public.invitations i
  where i.token_hash = encode(extensions.digest(coalesce(p_token, ''), 'sha256'), 'hex')
  for update;

  if v_inv.id is null then raise exception 'Invitación inválida'; end if;
  if v_inv.status <> 'pending' then raise exception 'La invitación ya no está disponible'; end if;
  if v_inv.expires_at is not null and v_inv.expires_at <= now() then
    update public.invitations set status = 'expired', responded_at = now() where id = v_inv.id;
    raise exception 'La invitación venció';
  end if;
  if lower(coalesce(v_inv.invited_email, '')) <> v_user_email then raise exception 'Esta invitación pertenece a otro correo'; end if;

  v_contractor_id := v_inv.contratista_id;
  if v_contractor_id is null and v_inv.contractor_rut is not null then
    select c.id into v_contractor_id
    from public.contratistas c
    where private.normalize_rut(c.rut) = private.normalize_rut(v_inv.contractor_rut)
    order by c.created_at
    limit 1;
  end if;

  if v_contractor_id is null then
    v_contractor_key := 'contratista_' || substr(replace(extensions.gen_random_uuid()::text, '-', ''), 1, 12);
    insert into public.contratistas(name, rut, legal_name, is_active, integration_key)
    values (
      coalesce(nullif(trim(v_inv.contractor_name), ''), 'Contratista'),
      nullif(trim(v_inv.contractor_rut), ''),
      coalesce(nullif(trim(v_inv.contractor_name), ''), 'Contratista'),
      true,
      v_contractor_key
    ) returning id into v_contractor_id;
  else
    update public.contratistas set is_active = true, updated_at = now() where id = v_contractor_id;
    select integration_key into v_contractor_key from public.contratistas where id = v_contractor_id;
    if v_contractor_key is null then
      v_contractor_key := 'contratista_' || substr(replace(extensions.gen_random_uuid()::text, '-', ''), 1, 12);
      update public.contratistas set integration_key = v_contractor_key where id = v_contractor_id;
    end if;
  end if;

  insert into public.contratista_memberships(profile_id, contratista_id, role, is_active)
  values (v_uid, v_contractor_id, 'contratista_admin', true)
  on conflict (profile_id, contratista_id, role) do update set is_active = true;

  insert into public.accreditations(project_id, contratista_id, is_active)
  values (v_inv.project_id, v_contractor_id, true)
  on conflict on constraint accreditations_project_contractor_unique
  do update set is_active = true, updated_at = now();

  update public.invitations
  set contratista_id = v_contractor_id,
      status = 'accepted',
      accepted_by = v_uid,
      responded_at = now()
  where id = v_inv.id;

  select p.integration_key into v_project_key
  from public.projects p
  where p.id = v_inv.project_id;

  insert into public.audit_logs(actor_profile_id, action, entity_type, entity_id, project_id, details)
  values (
    v_uid,
    'aceptacion_invitacion',
    'invitation',
    v_inv.id,
    v_inv.project_id,
    jsonb_build_object('contratista_id', v_contractor_id, 'invited_email', v_user_email)
  );

  return query select v_inv.id, v_contractor_id, v_contractor_key, v_inv.project_id, v_project_key;
end;
$$;

revoke all on function public.accept_contractor_invitation(text) from public, anon;
grant execute on function public.accept_contractor_invitation(text) to authenticated;
