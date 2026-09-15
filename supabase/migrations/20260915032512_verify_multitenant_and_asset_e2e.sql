begin;

select
 set_config('app.e2e_u_a',gen_random_uuid()::text,true),
 set_config('app.e2e_u_b',gen_random_uuid()::text,true),
 set_config('app.e2e_u_m',gen_random_uuid()::text,true),
 set_config('app.e2e_u_s',gen_random_uuid()::text,true),
 set_config('app.e2e_m_id',gen_random_uuid()::text,true),
 set_config('app.e2e_p_id',gen_random_uuid()::text,true),
 set_config('app.e2e_c_a',gen_random_uuid()::text,true),
 set_config('app.e2e_c_b',gen_random_uuid()::text,true),
 set_config('app.e2e_a_a',gen_random_uuid()::text,true),
 set_config('app.e2e_a_b',gen_random_uuid()::text,true),
 set_config('app.e2e_asset_a',gen_random_uuid()::text,true),
 set_config('app.e2e_doc1',gen_random_uuid()::text,true),
 set_config('app.e2e_doc2',gen_random_uuid()::text,true),
 set_config('app.e2e_suffix',replace(gen_random_uuid()::text,'-',''),true);

insert into auth.users(id,aud,role,email,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
values
 (current_setting('app.e2e_u_a')::uuid,'authenticated','authenticated','e2e-a-'||current_setting('app.e2e_suffix')||'@invalid.test',now(),'{}','{}',now(),now()),
 (current_setting('app.e2e_u_b')::uuid,'authenticated','authenticated','e2e-b-'||current_setting('app.e2e_suffix')||'@invalid.test',now(),'{}','{}',now(),now()),
 (current_setting('app.e2e_u_m')::uuid,'authenticated','authenticated','e2e-m-'||current_setting('app.e2e_suffix')||'@invalid.test',now(),'{}','{}',now(),now()),
 (current_setting('app.e2e_u_s')::uuid,'authenticated','authenticated','e2e-s-'||current_setting('app.e2e_suffix')||'@invalid.test',now(),'{}','{}',now(),now());

insert into public.mandantes(id,name,integration_key)
values(current_setting('app.e2e_m_id')::uuid,'E2E Mandante','e2e_m_'||current_setting('app.e2e_suffix'));
insert into public.projects(id,mandante_id,name,integration_key)
values(current_setting('app.e2e_p_id')::uuid,current_setting('app.e2e_m_id')::uuid,'E2E Proyecto','e2e_p_'||current_setting('app.e2e_suffix'));
insert into public.contratistas(id,name,integration_key) values
 (current_setting('app.e2e_c_a')::uuid,'E2E Contratista A','e2e_ca_'||current_setting('app.e2e_suffix')),
 (current_setting('app.e2e_c_b')::uuid,'E2E Contratista B','e2e_cb_'||current_setting('app.e2e_suffix'));
insert into public.accreditations(id,project_id,contratista_id) values
 (current_setting('app.e2e_a_a')::uuid,current_setting('app.e2e_p_id')::uuid,current_setting('app.e2e_c_a')::uuid),
 (current_setting('app.e2e_a_b')::uuid,current_setting('app.e2e_p_id')::uuid,current_setting('app.e2e_c_b')::uuid);
insert into public.contratista_memberships(profile_id,contratista_id,role) values
 (current_setting('app.e2e_u_a')::uuid,current_setting('app.e2e_c_a')::uuid,'contratista_admin'),
 (current_setting('app.e2e_u_b')::uuid,current_setting('app.e2e_c_b')::uuid,'contratista_admin');
insert into public.mandante_memberships(profile_id,mandante_id,role)
values(current_setting('app.e2e_u_m')::uuid,current_setting('app.e2e_m_id')::uuid,'mandante_admin');
insert into public.acredita_memberships(profile_id,role)
values(current_setting('app.e2e_u_s')::uuid,'admin_acredita');

insert into public.asset_requirement_templates(project_id,asset_type,document_type,blocks_access,is_required) values
 (current_setting('app.e2e_p_id')::uuid,'maquinaria','Permiso circulación',true,true),
 (current_setting('app.e2e_p_id')::uuid,'maquinaria','Revisión técnica',true,true);
insert into public.assets(id,accreditation_id,integration_key,asset_type,identifier,name)
values(current_setting('app.e2e_asset_a')::uuid,current_setting('app.e2e_a_a')::uuid,'e2e_asset_'||current_setting('app.e2e_suffix'),'maquinaria','E2E-'||left(current_setting('app.e2e_suffix'),8),'Excavadora E2E');

do $$
begin
  if not exists(select 1 from public.assets where id=current_setting('app.e2e_asset_a')::uuid and status='en_revision' and access_allowed=false) then
    raise exception 'E2E asset initial state failed';
  end if;
end $$;

set local role authenticated;
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('app.e2e_u_a'),'role','authenticated')::text,true);
do $$
declare rejected boolean := false;
begin
  if (select count(*) from public.accreditations where id=current_setting('app.e2e_a_a')::uuid) <> 1 then raise exception 'A cannot see own accreditation'; end if;
  if (select count(*) from public.accreditations where id=current_setting('app.e2e_a_b')::uuid) <> 0 then raise exception 'A can see B accreditation'; end if;
  if (select count(*) from public.assets where id=current_setting('app.e2e_asset_a')::uuid) <> 1 then raise exception 'A cannot see own asset'; end if;
  begin
    update public.assets set status='habilitado',access_allowed=true where id=current_setting('app.e2e_asset_a')::uuid;
  exception when others then rejected := true;
  end;
  if not rejected then raise exception 'Contractor auto-enable was not blocked'; end if;
end $$;

select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('app.e2e_u_b'),'role','authenticated')::text,true);
do $$
begin
  if (select count(*) from public.accreditations where id=current_setting('app.e2e_a_a')::uuid) <> 0 then raise exception 'B can see A accreditation'; end if;
  if (select count(*) from public.accreditations where id=current_setting('app.e2e_a_b')::uuid) <> 1 then raise exception 'B cannot see own accreditation'; end if;
  if (select count(*) from public.assets where id=current_setting('app.e2e_asset_a')::uuid) <> 0 then raise exception 'B can see A asset'; end if;
end $$;

select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('app.e2e_u_m'),'role','authenticated')::text,true);
do $$
begin
  if (select count(*) from public.accreditations where id in(current_setting('app.e2e_a_a')::uuid,current_setting('app.e2e_a_b')::uuid)) <> 2 then raise exception 'Mandante cannot see both accreditations'; end if;
end $$;

insert into public.asset_documents(id,asset_id,document_type,document_name,status,expires_at,reviewed_by,reviewed_at)
values(current_setting('app.e2e_doc1')::uuid,current_setting('app.e2e_asset_a')::uuid,'Permiso circulación','permiso.pdf','aprobado',current_date+30,current_setting('app.e2e_u_m')::uuid,now());
do $$ begin
  if not exists(select 1 from public.assets where id=current_setting('app.e2e_asset_a')::uuid and status='en_revision' and access_allowed=false) then raise exception 'E2E one-of-two state failed'; end if;
end $$;

insert into public.asset_documents(id,asset_id,document_type,document_name,status,expires_at,reviewed_by,reviewed_at)
values(current_setting('app.e2e_doc2')::uuid,current_setting('app.e2e_asset_a')::uuid,'Revisión técnica','revision.pdf','aprobado',current_date+30,current_setting('app.e2e_u_m')::uuid,now());
do $$ begin
  if not exists(select 1 from public.assets where id=current_setting('app.e2e_asset_a')::uuid and status='habilitado' and access_allowed=true) then raise exception 'E2E two-of-two state failed'; end if;
end $$;

update public.asset_documents set status='rechazado',rejection_reason='E2E rechazo',reviewed_by=current_setting('app.e2e_u_m')::uuid,reviewed_at=now() where id=current_setting('app.e2e_doc2')::uuid;
do $$ begin
  if not exists(select 1 from public.assets where id=current_setting('app.e2e_asset_a')::uuid and status='bloqueado' and access_allowed=false) then raise exception 'E2E rejected state failed'; end if;
end $$;

update public.asset_documents set status='aprobado',expires_at=current_date-1,rejection_reason=null,reviewed_by=current_setting('app.e2e_u_m')::uuid,reviewed_at=now() where id=current_setting('app.e2e_doc2')::uuid;
do $$ begin
  if not exists(select 1 from public.assets where id=current_setting('app.e2e_asset_a')::uuid and status='bloqueado' and access_allowed=false) then raise exception 'E2E expired state failed'; end if;
end $$;

select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('app.e2e_u_s'),'role','authenticated')::text,true);
do $$ begin
  if (select count(*) from public.accreditations where id in(current_setting('app.e2e_a_a')::uuid,current_setting('app.e2e_a_b')::uuid)) <> 2 then raise exception 'Acredita cannot see both accreditations'; end if;
end $$;

reset role;
select set_config('request.jwt.claims','{}',true);
delete from public.audit_logs
 where project_id=current_setting('app.e2e_p_id')::uuid
    or accreditation_id in(current_setting('app.e2e_a_a')::uuid,current_setting('app.e2e_a_b')::uuid)
    or actor_profile_id in(current_setting('app.e2e_u_a')::uuid,current_setting('app.e2e_u_b')::uuid,current_setting('app.e2e_u_m')::uuid,current_setting('app.e2e_u_s')::uuid);
delete from public.projects where id=current_setting('app.e2e_p_id')::uuid;
delete from public.contratistas where id in(current_setting('app.e2e_c_a')::uuid,current_setting('app.e2e_c_b')::uuid);
delete from public.mandantes where id=current_setting('app.e2e_m_id')::uuid;
delete from auth.users where id in(current_setting('app.e2e_u_a')::uuid,current_setting('app.e2e_u_b')::uuid,current_setting('app.e2e_u_m')::uuid,current_setting('app.e2e_u_s')::uuid);

do $$ begin
  if exists(select 1 from public.projects where id=current_setting('app.e2e_p_id')::uuid) then raise exception 'E2E cleanup failed: project remains'; end if;
  if exists(select 1 from auth.users where id in(current_setting('app.e2e_u_a')::uuid,current_setting('app.e2e_u_b')::uuid,current_setting('app.e2e_u_m')::uuid,current_setting('app.e2e_u_s')::uuid)) then raise exception 'E2E cleanup failed: users remain'; end if;
end $$;

commit;
