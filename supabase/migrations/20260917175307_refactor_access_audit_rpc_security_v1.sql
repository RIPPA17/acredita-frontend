create or replace function private.register_document_access_impl(p_document_version_id uuid, p_action text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_document_id uuid;
  v_accreditation_id uuid;
  v_project_id uuid;
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if p_action not in ('view', 'download') then
    raise exception 'Invalid document access action' using errcode = '22023';
  end if;
  select dv.document_id, d.accreditation_id, a.project_id
    into v_document_id, v_accreditation_id, v_project_id
  from public.document_versions dv
  join public.documents d on d.id = dv.document_id
  join public.accreditations a on a.id = d.accreditation_id
  where dv.id = p_document_version_id;
  if v_document_id is null then
    raise exception 'Document version not found' using errcode = 'P0002';
  end if;
  if not private.can_access_document(v_document_id) then
    raise exception 'Document access denied' using errcode = '42501';
  end if;
  insert into public.audit_logs(actor_profile_id, action, entity_type, entity_id, project_id, accreditation_id, details)
  values ((select auth.uid()), case when p_action = 'download' then 'document_downloaded' else 'document_viewed' end,
          'document_versions', p_document_version_id, v_project_id, v_accreditation_id,
          jsonb_build_object('document_id', v_document_id, 'access', p_action));
  return true;
end;
$$;

create or replace function private.register_asset_document_access_impl(p_asset_document_id uuid, p_action text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_asset_id uuid;
  v_accreditation_id uuid;
  v_project_id uuid;
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if p_action not in ('view', 'download') then
    raise exception 'Invalid asset document access action' using errcode = '22023';
  end if;
  select ad.asset_id, ass.accreditation_id, a.project_id
    into v_asset_id, v_accreditation_id, v_project_id
  from public.asset_documents ad
  join public.assets ass on ass.id = ad.asset_id
  join public.accreditations a on a.id = ass.accreditation_id
  where ad.id = p_asset_document_id;
  if v_asset_id is null then
    raise exception 'Asset document not found' using errcode = 'P0002';
  end if;
  if not private.can_access_accreditation(v_accreditation_id) then
    raise exception 'Asset document access denied' using errcode = '42501';
  end if;
  insert into public.audit_logs(actor_profile_id, action, entity_type, entity_id, project_id, accreditation_id, details)
  values ((select auth.uid()), case when p_action = 'download' then 'asset_document_downloaded' else 'asset_document_viewed' end,
          'asset_documents', p_asset_document_id, v_project_id, v_accreditation_id,
          jsonb_build_object('asset_id', v_asset_id, 'access', p_action));
  return true;
end;
$$;

create or replace function private.register_storage_access_impl(p_bucket text, p_storage_path text, p_action text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_entity_type text;
  v_entity_id uuid;
  v_parent_id uuid;
  v_accreditation_id uuid;
  v_project_id uuid;
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if p_action not in ('view', 'download') then
    raise exception 'Invalid storage access action' using errcode = '22023';
  end if;
  if p_bucket = 'acredita-documents' then
    select 'document_versions', dv.id, d.id, d.accreditation_id, a.project_id
      into v_entity_type, v_entity_id, v_parent_id, v_accreditation_id, v_project_id
    from public.document_versions dv
    join public.documents d on d.id = dv.document_id
    join public.accreditations a on a.id = d.accreditation_id
    where dv.storage_bucket = p_bucket and dv.storage_path = p_storage_path
    limit 1;
    if v_entity_id is null then
      raise exception 'Stored document not found' using errcode = 'P0002';
    end if;
    if not private.can_access_document(v_parent_id) then
      raise exception 'Document access denied' using errcode = '42501';
    end if;
  elsif p_bucket = 'asset-documents' then
    select 'asset_documents', ad.id, ad.asset_id, ass.accreditation_id, a.project_id
      into v_entity_type, v_entity_id, v_parent_id, v_accreditation_id, v_project_id
    from public.asset_documents ad
    join public.assets ass on ass.id = ad.asset_id
    join public.accreditations a on a.id = ass.accreditation_id
    where ad.storage_bucket = p_bucket and ad.storage_path = p_storage_path
    limit 1;
    if v_entity_id is null then
      raise exception 'Stored asset document not found' using errcode = 'P0002';
    end if;
    if not private.can_access_accreditation(v_accreditation_id) then
      raise exception 'Asset document access denied' using errcode = '42501';
    end if;
  else
    raise exception 'Unsupported audited storage bucket' using errcode = '22023';
  end if;
  insert into public.audit_logs(actor_profile_id, action, entity_type, entity_id, project_id, accreditation_id, details)
  values ((select auth.uid()), case when p_action = 'download' then 'document_downloaded' else 'document_viewed' end,
          v_entity_type, v_entity_id, v_project_id, v_accreditation_id,
          jsonb_build_object('parent_id', v_parent_id, 'bucket', p_bucket, 'access', p_action));
  return true;
end;
$$;

revoke all on function private.register_document_access_impl(uuid,text) from public, anon;
revoke all on function private.register_asset_document_access_impl(uuid,text) from public, anon;
revoke all on function private.register_storage_access_impl(text,text,text) from public, anon;
grant execute on function private.register_document_access_impl(uuid,text) to authenticated, service_role;
grant execute on function private.register_asset_document_access_impl(uuid,text) to authenticated, service_role;
grant execute on function private.register_storage_access_impl(text,text,text) to authenticated, service_role;

create or replace function public.register_document_access(p_document_version_id uuid, p_action text default 'view')
returns boolean language sql security invoker set search_path = ''
as $$ select private.register_document_access_impl(p_document_version_id, p_action); $$;

create or replace function public.register_asset_document_access(p_asset_document_id uuid, p_action text default 'view')
returns boolean language sql security invoker set search_path = ''
as $$ select private.register_asset_document_access_impl(p_asset_document_id, p_action); $$;

create or replace function public.register_storage_access(p_bucket text, p_storage_path text, p_action text default 'view')
returns boolean language sql security invoker set search_path = ''
as $$ select private.register_storage_access_impl(p_bucket, p_storage_path, p_action); $$;

revoke all on function public.register_document_access(uuid,text) from public, anon;
revoke all on function public.register_asset_document_access(uuid,text) from public, anon;
revoke all on function public.register_storage_access(text,text,text) from public, anon;
grant execute on function public.register_document_access(uuid,text) to authenticated, service_role;
grant execute on function public.register_asset_document_access(uuid,text) to authenticated, service_role;
grant execute on function public.register_storage_access(text,text,text) to authenticated, service_role;