alter table public.invitations
  add column if not exists contractor_name text,
  add column if not exists contractor_rut text,
  add column if not exists message text,
  add column if not exists token_hash text,
  add column if not exists sent_at timestamptz,
  add column if not exists send_error text;

create unique index if not exists invitations_token_hash_uq
  on public.invitations(token_hash)
  where token_hash is not null;

create index if not exists invitations_pending_email_idx
  on public.invitations(lower(invited_email), project_id)
  where status = 'pending';

create or replace function private.normalize_rut(p_rut text)
returns text
language sql
immutable
set search_path = ''
as $$
  select upper(regexp_replace(coalesce(p_rut, ''), '[^0-9kK]', '', 'g'));
$$;

revoke all on function private.normalize_rut(text) from public, anon, authenticated;
grant execute on function private.normalize_rut(text) to authenticated;

create or replace function public.create_contractor_invitation(
  p_project_id uuid,
  p_email text,
  p_contractor_id uuid default null,
  p_contractor_name text default null,
  p_contractor_rut text default null,
  p_message text default null
)
returns table(invitation_id uuid, token text, expires_at timestamptz)
language plpgsql
security invoker
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
  if v_email = '' or position('@' in v_email) < 2 then raise exception 'Correo de invitación inválido'; end if;
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
    project_id, contratista_id, invited_email, status, invited_by,
    invited_at, expires_at, contractor_name, contractor_rut, message, token_hash
  ) values (
    p_project_id, p_contractor_id, v_email, 'pending', v_uid,
    now(), v_expires_at, v_name, v_rut, nullif(trim(coalesce(p_message, '')), ''),
    encode(extensions.digest(v_token, 'sha256'), 'hex')
  ) returning id into v_invitation_id;

  insert into public.audit_logs(actor_profile_id, action, entity_type, entity_id, project_id, details)
  values (v_uid, 'creacion_invitacion', 'invitation', v_invitation_id, p_project_id,
    jsonb_build_object('invited_email', v_email, 'contractor_name', v_name, 'contractor_rut', v_rut));

  return query select v_invitation_id, v_token, v_expires_at;
end;
$$;

revoke all on function public.create_contractor_invitation(uuid,text,uuid,text,text,text) from public, anon;
grant execute on function public.create_contractor_invitation(uuid,text,uuid,text,text,text) to authenticated;

create or replace function public.get_contractor_invitation_preview(p_token text)
returns table(
  invitation_id uuid,
  invited_email text,
  contractor_name text,
  contractor_rut text,
  project_id uuid,
  project_name text,
  mandante_name text,
  message text,
  expires_at timestamptz,
  requirement_names text[]
)
language sql
stable
security definer
set search_path = ''
as $$
  select i.id, i.invited_email, coalesce(i.contractor_name, c.name), coalesce(i.contractor_rut, c.rut),
    p.id, p.name, m.name, i.message, i.expires_at,
    coalesce(array_agg(r.name order by r.sort_order, r.name) filter (where r.id is not null and r.is_required), '{}'::text[])
  from public.invitations i
  join public.projects p on p.id = i.project_id
  join public.mandantes m on m.id = p.mandante_id
  left join public.contratistas c on c.id = i.contratista_id
  left join public.requirements r on r.project_id = p.id and r.is_active = true
  where i.token_hash = encode(extensions.digest(coalesce(p_token, ''), 'sha256'), 'hex')
    and i.status = 'pending'
    and (i.expires_at is null or i.expires_at > now())
  group by i.id, i.invited_email, i.contractor_name, i.contractor_rut, c.name, c.rut,
    p.id, p.name, m.name, i.message, i.expires_at;
$$;

revoke all on function public.get_contractor_invitation_preview(text) from public;
grant execute on function public.get_contractor_invitation_preview(text) to anon, authenticated;

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

  select * into v_inv from public.invitations i
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
    select c.id into v_contractor_id from public.contratistas c
    where private.normalize_rut(c.rut) = private.normalize_rut(v_inv.contractor_rut)
    order by c.created_at limit 1;
  end if;

  if v_contractor_id is null then
    v_contractor_key := 'contratista_' || substr(replace(extensions.gen_random_uuid()::text, '-', ''), 1, 12);
    insert into public.contratistas(name, rut, legal_name, is_active, integration_key)
    values (coalesce(nullif(trim(v_inv.contractor_name), ''), 'Contratista'), nullif(trim(v_inv.contractor_rut), ''),
      coalesce(nullif(trim(v_inv.contractor_name), ''), 'Contratista'), true, v_contractor_key)
    returning id into v_contractor_id;
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
  on conflict (project_id, contratista_id) do update set is_active = true, updated_at = now();

  update public.invitations
  set contratista_id = v_contractor_id, status = 'accepted', accepted_by = v_uid, responded_at = now()
  where id = v_inv.id;

  select integration_key into v_project_key from public.projects where id = v_inv.project_id;

  insert into public.audit_logs(actor_profile_id, action, entity_type, entity_id, project_id, details)
  values (v_uid, 'aceptacion_invitacion', 'invitation', v_inv.id, v_inv.project_id,
    jsonb_build_object('contratista_id', v_contractor_id, 'invited_email', v_user_email));

  return query select v_inv.id, v_contractor_id, v_contractor_key, v_inv.project_id, v_project_key;
end;
$$;

revoke all on function public.accept_contractor_invitation(text) from public, anon;
grant execute on function public.accept_contractor_invitation(text) to authenticated;

create or replace function public.reject_contractor_invitation(p_token text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_email text;
  v_id uuid;
  v_project_id uuid;
begin
  if v_uid is null then raise exception 'Debes iniciar sesión'; end if;
  select lower(email) into v_email from auth.users where id = v_uid;
  select i.id, i.project_id into v_id, v_project_id
  from public.invitations i
  where i.token_hash = encode(extensions.digest(coalesce(p_token, ''), 'sha256'), 'hex')
    and i.status = 'pending'
    and lower(coalesce(i.invited_email, '')) = v_email
    and (i.expires_at is null or i.expires_at > now())
  for update;
  if v_id is null then raise exception 'Invitación no disponible'; end if;
  update public.invitations set status='rejected', accepted_by=v_uid, responded_at=now() where id=v_id;
  insert into public.audit_logs(actor_profile_id, action, entity_type, entity_id, project_id, details)
  values (v_uid, 'rechazo_invitacion', 'invitation', v_id, v_project_id, '{}'::jsonb);
  return true;
end;
$$;

revoke all on function public.reject_contractor_invitation(text) from public, anon;
grant execute on function public.reject_contractor_invitation(text) to authenticated;
