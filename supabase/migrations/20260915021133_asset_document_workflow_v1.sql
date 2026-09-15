begin;

create table public.asset_document_versions (
  id uuid primary key default gen_random_uuid(), asset_document_id uuid not null references public.asset_documents(id) on delete cascade,
  version_number integer not null check (version_number > 0), file_name text not null, mime_type text not null,
  file_size bigint not null check (file_size > 0 and file_size <= 20971520), storage_bucket text not null default 'asset-documents', storage_path text not null,
  uploaded_by uuid not null references public.profiles(id) on delete restrict, uploaded_at timestamptz not null default now(), unique(asset_document_id, version_number), unique(storage_bucket, storage_path)
);
create index asset_document_versions_document_idx on public.asset_document_versions(asset_document_id, version_number desc);
create index asset_document_versions_uploaded_by_idx on public.asset_document_versions(uploaded_by);
alter table public.asset_document_versions enable row level security;
create policy asset_document_versions_select on public.asset_document_versions for select to authenticated using (exists(select 1 from public.asset_documents d join public.assets a on a.id=d.asset_id where d.id=asset_document_id and (select private.can_access_accreditation(a.accreditation_id))));
create policy asset_document_versions_insert on public.asset_document_versions for insert to authenticated with check (uploaded_by=(select auth.uid()) and exists(select 1 from public.asset_documents d join public.assets a on a.id=d.asset_id where d.id=asset_document_id and (select private.can_access_accreditation(a.accreditation_id))));
grant select,insert on public.asset_document_versions to authenticated; revoke all on public.asset_document_versions from anon;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values ('asset-documents','asset-documents',false,20971520,array['application/pdf','image/jpeg','image/png']) on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
create policy asset_storage_select on storage.objects for select to authenticated using (bucket_id='asset-documents' and (storage.foldername(name))[1] ~* '^[0-9a-f-]{36}$' and exists(select 1 from public.assets a where a.id=(storage.foldername(name))[1]::uuid and (select private.can_access_accreditation(a.accreditation_id))));
create policy asset_storage_insert on storage.objects for insert to authenticated with check (bucket_id='asset-documents' and (storage.foldername(name))[1] ~* '^[0-9a-f-]{36}$' and exists(select 1 from public.assets a where a.id=(storage.foldername(name))[1]::uuid and (select private.can_access_accreditation(a.accreditation_id))));

create or replace function private.guard_asset_document_decision() returns trigger language plpgsql security definer set search_path='' as $$
declare project_id uuid; can_decide boolean;
begin
 select ac.project_id into project_id from public.assets a join public.accreditations ac on ac.id=a.accreditation_id where a.id=new.asset_id;
 can_decide:=(select private.is_acredita_staff()) or (select private.can_manage_project(project_id));
 if tg_op='INSERT' and not can_decide and new.status<>'en_revision' then raise exception 'El documento debe ingresar a revisión'; end if;
 if tg_op='UPDATE' and not can_decide and (new.status<>'en_revision' or new.reviewed_by is not null or new.reviewed_at is not null) then raise exception 'El contratista solo puede reenviar el documento a revisión'; end if;
 return new;
end; $$;
create trigger asset_documents_guard_decision before insert or update on public.asset_documents for each row execute function private.guard_asset_document_decision();

create or replace function private.refresh_asset_after_document() returns trigger language plpgsql security definer set search_path='' as $$
declare target_asset uuid; blocked integer; pending integer;
begin
 target_asset:=coalesce(new.asset_id,old.asset_id);
 select count(*) filter(where status in ('rechazado','vencido') or (expires_at is not null and expires_at<current_date)), count(*) filter(where status in ('pendiente','en_revision')) into blocked,pending from public.asset_documents where asset_id=target_asset;
 update public.assets set status=case when blocked>0 then 'bloqueado' when pending>0 then 'en_revision' when exists(select 1 from public.asset_documents where asset_id=target_asset) then 'habilitado' else 'pendiente' end, access_allowed=(blocked=0 and pending=0 and exists(select 1 from public.asset_documents where asset_id=target_asset)) where id=target_asset;
 return coalesce(new,old);
end; $$;
create trigger asset_documents_refresh_asset after insert or update or delete on public.asset_documents for each row execute function private.refresh_asset_after_document();

commit;
