
drop policy if exists accreditations_insert_manager on public.accreditations;
create policy accreditations_insert_manager on public.accreditations
for insert to authenticated
with check (
  (select private.can_manage_project(project_id))
  and (select private.project_is_operational(project_id))
);

drop policy if exists accreditations_update_manager on public.accreditations;
create policy accreditations_update_manager on public.accreditations
for update to authenticated
using (
  (select private.can_manage_project(project_id))
  and (select private.project_is_operational(project_id))
)
with check (
  (select private.can_manage_project(project_id))
  and (select private.project_is_operational(project_id))
);

drop policy if exists invitations_insert_manager on public.invitations;
create policy invitations_insert_manager on public.invitations
for insert to authenticated
with check (
  (select private.can_manage_project(project_id))
  and (select private.project_is_operational(project_id))
  and invited_by = (select auth.uid())
);

drop policy if exists invitations_update_manager on public.invitations;
create policy invitations_update_manager on public.invitations
for update to authenticated
using (
  (select private.can_manage_project(project_id))
  and (select private.project_is_operational(project_id))
)
with check (
  (select private.can_manage_project(project_id))
  and (select private.project_is_operational(project_id))
);

create or replace function private.accept_contractor_invitation_impl(p_token text)
returns table(invitation_id uuid, contractor_id uuid, contractor_integration_key text, project_id uuid, project_integration_key text)
language plpgsql
security definer
set search_path=''
as $$
declare
  v_uid uuid := auth.uid();
  v_user_email text;
  v_inv public.invitations%rowtype;
  v_contractor_id uuid;
  v_existing_membership uuid;
  v_contractor_key text;
  v_project_key text;
  v_project_status text;
begin
  if v_uid is null then raise exception 'Debes iniciar sesión para aceptar la invitación'; end if;
  select lower(email) into v_user_email from auth.users where id=v_uid;
  if v_user_email is null then raise exception 'No se pudo validar el correo de la cuenta'; end if;

  select * into v_inv from public.invitations i
  where i.token_hash=encode(extensions.digest(coalesce(p_token,''),'sha256'),'hex') for update;
  if v_inv.id is null then raise exception 'Invitación inválida'; end if;
  if v_inv.status<>'pending' then raise exception 'La invitación ya no está disponible'; end if;
  if v_inv.expires_at is not null and v_inv.expires_at<=now() then
    update public.invitations set status='expired',responded_at=now() where id=v_inv.id;
    raise exception 'La invitación venció';
  end if;

  select p.status,p.integration_key into v_project_status,v_project_key
  from public.projects p
  where p.id=v_inv.project_id;

  if v_project_status is distinct from 'active' then
    raise exception 'El proyecto ya no está operativo. La invitación quedó solo como historial.';
  end if;

  if lower(coalesce(v_inv.invited_email,''))<>v_user_email then raise exception 'Esta invitación pertenece a otro correo'; end if;

  v_contractor_id := v_inv.contratista_id;
  if v_contractor_id is null and v_inv.contractor_rut is not null then
    select c.id into v_contractor_id from public.contratistas c
    where private.normalize_rut(c.rut)=private.normalize_rut(v_inv.contractor_rut)
    order by c.created_at limit 1;
  end if;

  select cm.contratista_id into v_existing_membership
  from public.contratista_memberships cm
  where cm.profile_id=v_uid and cm.is_active=true
  order by cm.created_at
  limit 1;

  if v_existing_membership is not null and (v_contractor_id is null or v_existing_membership<>v_contractor_id) then
    raise exception 'Tu cuenta ya está asociada a otra empresa. Usa una cuenta del contratista invitado.';
  end if;

  if v_contractor_id is null then
    v_contractor_key := 'contratista_' || substr(replace(extensions.gen_random_uuid()::text,'-',''),1,12);
    insert into public.contratistas(name,rut,legal_name,is_active,integration_key)
    values (coalesce(nullif(trim(v_inv.contractor_name),''),'Contratista'),nullif(trim(v_inv.contractor_rut),''),coalesce(nullif(trim(v_inv.contractor_name),''),'Contratista'),true,v_contractor_key)
    returning id into v_contractor_id;
  else
    update public.contratistas set is_active=true,updated_at=now() where id=v_contractor_id;
    select integration_key into v_contractor_key from public.contratistas where id=v_contractor_id;
    if v_contractor_key is null then
      v_contractor_key := 'contratista_' || substr(replace(extensions.gen_random_uuid()::text,'-',''),1,12);
      update public.contratistas set integration_key=v_contractor_key where id=v_contractor_id;
    end if;
  end if;

  insert into public.contratista_memberships(profile_id,contratista_id,role,is_active)
  values (v_uid,v_contractor_id,'contratista_admin',true)
  on conflict (profile_id,contratista_id,role) do update set is_active=true;

  insert into public.accreditations(project_id,contratista_id,is_active)
  values (v_inv.project_id,v_contractor_id,true)
  on conflict on constraint accreditations_project_contractor_unique do update set is_active=true,updated_at=now();

  update public.invitations set contratista_id=v_contractor_id,status='accepted',accepted_by=v_uid,responded_at=now() where id=v_inv.id;
  insert into public.audit_logs(actor_profile_id,action,entity_type,entity_id,project_id,details)
  values (v_uid,'aceptacion_invitacion','invitation',v_inv.id,v_inv.project_id,jsonb_build_object('contratista_id',v_contractor_id,'invited_email',v_user_email));
  return query select v_inv.id,v_contractor_id,v_contractor_key,v_inv.project_id,v_project_key;
end;
$$;

create or replace function private.cancel_contractor_invitation_impl(p_invitation_id uuid)
returns boolean
language plpgsql
security definer
set search_path=''
as $$
declare
  v_project_id uuid;
  v_status text;
begin
  select project_id, status
    into v_project_id, v_status
  from public.invitations
  where id = p_invitation_id
  for update;

  if v_project_id is null then
    raise exception 'Invitación no encontrada';
  end if;
  if not (select private.project_is_operational(v_project_id)) then
    raise exception 'El proyecto ya no está operativo. Sus invitaciones se conservan solo como historial.';
  end if;
  if not ((select private.is_acredita_staff()) or (select private.can_manage_project(v_project_id))) then
    raise exception 'No tienes permisos para administrar esta invitación';
  end if;
  if v_status <> 'pending' then
    raise exception 'Solo se pueden cancelar invitaciones pendientes';
  end if;

  update public.invitations
  set status = 'cancelled',
      responded_at = now()
  where id = p_invitation_id;

  insert into public.audit_logs(actor_profile_id, action, entity_type, entity_id, project_id, details)
  values ((select auth.uid()), 'cancelacion_invitacion', 'invitation', p_invitation_id, v_project_id, '{}'::jsonb);

  return true;
end;
$$;

create or replace function public.claim_document_review(p_document_key text, p_document_version_id uuid)
returns jsonb
language plpgsql
set search_path=''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_claim public.review_claims%rowtype;
begin
  if v_uid is null or not (select private.is_acredita_staff()) then
    raise exception 'No autorizado para tomar revisiones';
  end if;

  if p_document_key is null or char_length(trim(p_document_key)) = 0 then
    raise exception 'Falta identificar el documento de la revisión';
  end if;

  if not exists (
    select 1
    from public.document_versions dv
    join public.documents d on d.id=dv.document_id
    join public.accreditations a on a.id=d.accreditation_id
    join public.projects p on p.id=a.project_id
    where dv.id = p_document_version_id
      and dv.workflow_status = 'revision'
      and a.is_active
      and p.status='active'
  ) then
    raise exception 'La versión ya no está disponible para revisión';
  end if;

  delete from public.review_claims
  where expires_at <= now()
    and (document_key = p_document_key or document_version_id = p_document_version_id);

  insert into public.review_claims(document_key, document_version_id, claimed_by)
  values (p_document_key, p_document_version_id, v_uid)
  on conflict do nothing;

  select * into v_claim
  from public.review_claims
  where document_key = p_document_key
     or document_version_id = p_document_version_id
  order by claimed_at asc
  limit 1;

  if v_claim.document_key is null then
    raise exception 'No fue posible tomar la revisión';
  end if;

  return jsonb_build_object(
    'document_key', v_claim.document_key,
    'document_version_id', v_claim.document_version_id,
    'claimed_by', v_claim.claimed_by,
    'claimed_at', v_claim.claimed_at,
    'expires_at', v_claim.expires_at,
    'owned', v_claim.claimed_by = v_uid
  );
end;
$$;

create or replace function public.review_document_version(
  p_document_version_id uuid,
  p_action text,
  p_reason text default null,
  p_explanation text default null,
  p_solution text default null,
  p_reviewer_name text default null,
  p_issued_at date default null,
  p_expires_at date default null
)
returns jsonb
language plpgsql
set search_path=''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_claim public.review_claims%rowtype;
  v_status text;
  v_count integer;
  v_reviewed_at timestamptz := now();
  v_validity_days integer;
  v_existing_issued_at date;
  v_existing_expires_at date;
  v_storage_path text;
  v_metadata jsonb;
  v_issued_at date;
  v_expires_at date;
  v_project_status text;
  v_accreditation_active boolean;
begin
  if v_uid is null or not (select private.is_acredita_staff()) then
    raise exception 'Solo Acredita puede aprobar o rechazar documentos';
  end if;

  if p_action not in ('approve','reject') then
    raise exception 'Decisión de revisión inválida';
  end if;

  if p_action = 'reject' and coalesce(trim(p_reason), '') = '' then
    raise exception 'Debes indicar un motivo de rechazo';
  end if;

  if p_action = 'reject' and coalesce(trim(p_explanation), '') = '' then
    raise exception 'Debes indicar qué debe corregir el contratista';
  end if;

  select r.validity_days, dv.issued_at, dv.expires_at, dv.storage_path, dv.metadata,
         p.status, a.is_active
    into v_validity_days, v_existing_issued_at, v_existing_expires_at, v_storage_path, v_metadata,
         v_project_status, v_accreditation_active
  from public.document_versions dv
  join public.documents d on d.id = dv.document_id
  join public.requirements r on r.id = d.requirement_id
  join public.accreditations a on a.id=d.accreditation_id
  join public.projects p on p.id=a.project_id
  where dv.id = p_document_version_id;

  if not found then
    raise exception 'La versión documental no existe';
  end if;

  if v_project_status is distinct from 'active' or not coalesce(v_accreditation_active,false) then
    raise exception 'El proyecto o la relación ya no están operativos. El documento se conserva solo como historial.';
  end if;

  select * into v_claim
  from public.review_claims
  where document_version_id = p_document_version_id
    and claimed_by = v_uid
    and expires_at > now()
  limit 1;

  if v_claim.document_key is null then
    raise exception 'Debes tomar esta revisión antes de decidirla';
  end if;

  v_status := case when p_action = 'approve' then 'aprobado' else 'rechazado' end;

  if p_action = 'approve' then
    if v_storage_path is null and coalesce((v_metadata ->> 'legacy_import')::boolean, false) is not true then
      raise exception 'No puedes aprobar una versión sin archivo almacenado';
    end if;

    v_issued_at := coalesce(p_issued_at, v_existing_issued_at);
    if v_validity_days is not null and v_validity_days > 0 and v_issued_at is null then
      raise exception 'Debes confirmar la fecha de emisión antes de aprobar este documento';
    end if;

    v_expires_at := coalesce(
      p_expires_at,
      v_existing_expires_at,
      case
        when v_validity_days is not null and v_validity_days > 0 and v_issued_at is not null
          then v_issued_at + v_validity_days
        else null
      end
    );

    if v_issued_at is not null and v_expires_at is not null and v_expires_at < v_issued_at then
      raise exception 'La fecha de vencimiento no puede ser anterior a la fecha de emisión';
    end if;
  else
    v_issued_at := v_existing_issued_at;
    v_expires_at := v_existing_expires_at;
  end if;

  update public.document_versions
  set workflow_status = v_status,
      issued_at = v_issued_at,
      expires_at = v_expires_at,
      reviewed_by = v_uid,
      reviewed_at = v_reviewed_at,
      rejection_reason = case when p_action = 'reject' then trim(p_reason) else null end,
      rejection_explanation = case when p_action = 'reject' then trim(p_explanation) else null end,
      rejection_solution = case when p_action = 'reject' then coalesce(nullif(trim(p_solution), ''), trim(p_explanation)) else null end,
      metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
        'reviewer_name', coalesce(nullif(trim(p_reviewer_name), ''), 'Acredita'),
        'backend_review_decision', true,
        'reviewed_at', v_reviewed_at,
        'validity_days', v_validity_days,
        'validity_confirmed', p_action = 'approve'
      )
  where id = p_document_version_id
    and workflow_status = 'revision';

  get diagnostics v_count = row_count;
  if v_count <> 1 then
    raise exception 'La versión cambió mientras la revisabas. Recarga la cola';
  end if;

  insert into public.review_activity(reviewer_id, document_version_id, document_key, action)
  values (v_uid, p_document_version_id, v_claim.document_key, v_status);

  delete from public.review_claims
  where document_key = v_claim.document_key
    and claimed_by = v_uid;

  return jsonb_build_object(
    'version_id', p_document_version_id,
    'status', v_status,
    'reviewed_at', v_reviewed_at,
    'document_key', v_claim.document_key,
    'issued_at', v_issued_at,
    'expires_at', v_expires_at
  );
end;
$$;

drop policy if exists document_versions_update_staff on public.document_versions;
create policy document_versions_update_staff on public.document_versions
for update to authenticated
using (
  (select private.is_acredita_staff())
  and exists (
    select 1
    from public.documents d
    where d.id=document_versions.document_id
      and (select private.accreditation_is_operational(d.accreditation_id))
  )
)
with check (
  (select private.is_acredita_staff())
  and exists (
    select 1
    from public.documents d
    where d.id=document_versions.document_id
      and (select private.accreditation_is_operational(d.accreditation_id))
  )
);

create or replace function private.clear_project_review_claims_on_archive()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
begin
  if old.status is distinct from 'archived' and new.status='archived' then
    delete from public.review_claims rc
    using public.document_versions dv, public.documents d, public.accreditations a
    where rc.document_version_id=dv.id
      and dv.document_id=d.id
      and d.accreditation_id=a.id
      and a.project_id=new.id;
  end if;
  return new;
end;
$$;

revoke all on function private.clear_project_review_claims_on_archive() from public,anon,authenticated;

drop trigger if exists projects_clear_review_claims_on_archive on public.projects;
create trigger projects_clear_review_claims_on_archive
after update of status on public.projects
for each row execute function private.clear_project_review_claims_on_archive();
