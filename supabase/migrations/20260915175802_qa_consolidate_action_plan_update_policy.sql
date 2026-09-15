begin;

select set_config('app.qa_ap_contractor_user',gen_random_uuid()::text,true),
       set_config('app.qa_ap_mandante_user',gen_random_uuid()::text,true),
       set_config('app.qa_ap_mandante',gen_random_uuid()::text,true),
       set_config('app.qa_ap_project',gen_random_uuid()::text,true),
       set_config('app.qa_ap_contractor',gen_random_uuid()::text,true),
       set_config('app.qa_ap_accreditation',gen_random_uuid()::text,true),
       set_config('app.qa_ap_evaluation',gen_random_uuid()::text,true),
       set_config('app.qa_ap_plan',gen_random_uuid()::text,true),
       set_config('app.qa_ap_suffix',replace(gen_random_uuid()::text,'-',''),true);

insert into auth.users(id,aud,role,email,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
values
(current_setting('app.qa_ap_contractor_user')::uuid,'authenticated','authenticated','qa-ap-c-'||current_setting('app.qa_ap_suffix')||'@invalid.test',now(),'{}','{}',now(),now()),
(current_setting('app.qa_ap_mandante_user')::uuid,'authenticated','authenticated','qa-ap-m-'||current_setting('app.qa_ap_suffix')||'@invalid.test',now(),'{}','{}',now(),now());

insert into public.mandantes(id,name,rut,integration_key,is_active)
values (current_setting('app.qa_ap_mandante')::uuid,'QA Mandante AP','99.300.001-2','qa_ap_m_'||current_setting('app.qa_ap_suffix'),true);

insert into public.projects(id,mandante_id,name,code,status,integration_key)
values (current_setting('app.qa_ap_project')::uuid,current_setting('app.qa_ap_mandante')::uuid,'QA Proyecto AP','QA-AP','active','qa_ap_p_'||current_setting('app.qa_ap_suffix'));

insert into public.contratistas(id,name,rut,integration_key,is_active)
values (current_setting('app.qa_ap_contractor')::uuid,'QA Contratista AP','99.300.002-0','qa_ap_c_'||current_setting('app.qa_ap_suffix'),true);

insert into public.accreditations(id,project_id,contratista_id,is_active)
values (current_setting('app.qa_ap_accreditation')::uuid,current_setting('app.qa_ap_project')::uuid,current_setting('app.qa_ap_contractor')::uuid,true);

insert into public.contratista_memberships(profile_id,contratista_id,role,is_active)
values (current_setting('app.qa_ap_contractor_user')::uuid,current_setting('app.qa_ap_contractor')::uuid,'contratista_admin',true);

insert into public.mandante_memberships(profile_id,mandante_id,role,is_active)
values (current_setting('app.qa_ap_mandante_user')::uuid,current_setting('app.qa_ap_mandante')::uuid,'mandante_admin',true);

insert into public.contractor_evaluations(id,accreditation_id,period_start,period_end,status,safety_score,quality_score,labor_score,compliance_score)
values (current_setting('app.qa_ap_evaluation')::uuid,current_setting('app.qa_ap_accreditation')::uuid,current_date-30,current_date,'publicada',80,80,80,80);

insert into public.evaluation_action_plans(id,evaluation_id,title,description,status,created_by)
values (current_setting('app.qa_ap_plan')::uuid,current_setting('app.qa_ap_evaluation')::uuid,'QA plan original','Validar permisos consolidados','pendiente',current_setting('app.qa_ap_mandante_user')::uuid);

set local role authenticated;
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('app.qa_ap_mandante_user'),'role','authenticated')::text,true);
update public.evaluation_action_plans set title='QA plan editado por mandante' where id=current_setting('app.qa_ap_plan')::uuid;

do $$ declare v_title text; begin
  select title into v_title from public.evaluation_action_plans where id=current_setting('app.qa_ap_plan')::uuid;
  if v_title <> 'QA plan editado por mandante' then raise exception 'QA consolidated action plan: mandante update failed'; end if;
end $$;

select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('app.qa_ap_contractor_user'),'role','authenticated')::text,true);
select public.update_contractor_action_plan(current_setting('app.qa_ap_plan')::uuid,'en_progreso','Evidencia del contratista');

do $$ declare blocked boolean := false; begin
  begin
    update public.evaluation_action_plans set title='Intento contratista' where id=current_setting('app.qa_ap_plan')::uuid;
  exception when others then blocked := true;
  end;
  if not blocked then raise exception 'QA consolidated action plan: contractor changed title'; end if;
end $$;

reset role;
select set_config('request.jwt.claims','{}',true);

delete from public.accreditations where id=current_setting('app.qa_ap_accreditation')::uuid;
delete from public.projects where id=current_setting('app.qa_ap_project')::uuid;
delete from public.contratistas where id=current_setting('app.qa_ap_contractor')::uuid;
delete from public.mandantes where id=current_setting('app.qa_ap_mandante')::uuid;
delete from auth.users where id in (current_setting('app.qa_ap_contractor_user')::uuid,current_setting('app.qa_ap_mandante_user')::uuid);

do $$ begin
  if exists(select 1 from auth.users where email like 'qa-ap-%@invalid.test') then
    raise exception 'QA consolidated action plan cleanup failed';
  end if;
end $$;

commit;
