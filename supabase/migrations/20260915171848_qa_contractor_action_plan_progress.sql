begin;

select set_config('app.qa_ops_user', gen_random_uuid()::text, true),
       set_config('app.qa_ops_mandante', gen_random_uuid()::text, true),
       set_config('app.qa_ops_project', gen_random_uuid()::text, true),
       set_config('app.qa_ops_contractor', gen_random_uuid()::text, true),
       set_config('app.qa_ops_accreditation', gen_random_uuid()::text, true),
       set_config('app.qa_ops_evaluation', gen_random_uuid()::text, true),
       set_config('app.qa_ops_plan', gen_random_uuid()::text, true),
       set_config('app.qa_ops_suffix', replace(gen_random_uuid()::text, '-', ''), true);

insert into auth.users(id,aud,role,email,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
values (
  current_setting('app.qa_ops_user')::uuid,
  'authenticated','authenticated',
  'qa-ops-'||current_setting('app.qa_ops_suffix')||'@invalid.test',
  now(),'{}','{}',now(),now()
);

insert into public.mandantes(id,name,rut,integration_key,is_active)
values (current_setting('app.qa_ops_mandante')::uuid,'QA Mandante Ops','99.000.001-1','qa_m_'||current_setting('app.qa_ops_suffix'),true);

insert into public.projects(id,mandante_id,name,code,status,integration_key)
values (current_setting('app.qa_ops_project')::uuid,current_setting('app.qa_ops_mandante')::uuid,'QA Proyecto Ops','QA-OPS','active','qa_p_'||current_setting('app.qa_ops_suffix'));

insert into public.contratistas(id,name,rut,integration_key,is_active)
values (current_setting('app.qa_ops_contractor')::uuid,'QA Contratista Ops','99.000.002-K','qa_c_'||current_setting('app.qa_ops_suffix'),true);

insert into public.accreditations(id,project_id,contratista_id,is_active)
values (current_setting('app.qa_ops_accreditation')::uuid,current_setting('app.qa_ops_project')::uuid,current_setting('app.qa_ops_contractor')::uuid,true);

insert into public.contratista_memberships(profile_id,contratista_id,role,is_active)
values (current_setting('app.qa_ops_user')::uuid,current_setting('app.qa_ops_contractor')::uuid,'contratista_admin',true);

insert into public.contractor_evaluations(id,accreditation_id,period_start,period_end,status,safety_score,quality_score,labor_score,compliance_score)
values (current_setting('app.qa_ops_evaluation')::uuid,current_setting('app.qa_ops_accreditation')::uuid,current_date-30,current_date,'publicada',80,80,80,80);

insert into public.evaluation_action_plans(id,evaluation_id,title,description,status,created_by)
values (current_setting('app.qa_ops_plan')::uuid,current_setting('app.qa_ops_evaluation')::uuid,'QA Acción','Corregir hallazgo','pendiente',current_setting('app.qa_ops_user')::uuid);

set local role authenticated;
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('app.qa_ops_user'),'role','authenticated')::text,true);

select public.update_contractor_action_plan(current_setting('app.qa_ops_plan')::uuid,'en_progreso',null);

do $$
declare v_status text; begin
  select status into v_status from public.evaluation_action_plans where id=current_setting('app.qa_ops_plan')::uuid;
  if v_status <> 'en_progreso' then raise exception 'QA contractor action plan: en_progreso failed'; end if;
end $$;

select public.update_contractor_action_plan(current_setting('app.qa_ops_plan')::uuid,'completado','Evidencia QA de cierre');

do $$
declare v_status text; v_evidence text; v_completed timestamptz; begin
  select status,evidence,completed_at into v_status,v_evidence,v_completed
  from public.evaluation_action_plans where id=current_setting('app.qa_ops_plan')::uuid;
  if v_status <> 'completado' or v_evidence <> 'Evidencia QA de cierre' or v_completed is null then
    raise exception 'QA contractor action plan: completion failed';
  end if;
end $$;

do $$
declare blocked boolean := false; begin
  begin
    perform public.update_contractor_action_plan(current_setting('app.qa_ops_plan')::uuid,'cancelado','No permitido');
  exception when others then blocked := true;
  end;
  if not blocked then raise exception 'QA contractor action plan: cancelado was allowed'; end if;
end $$;

reset role;
select set_config('request.jwt.claims','{}',true);

delete from public.accreditations where id=current_setting('app.qa_ops_accreditation')::uuid;
delete from public.projects where id=current_setting('app.qa_ops_project')::uuid;
delete from public.contratistas where id=current_setting('app.qa_ops_contractor')::uuid;
delete from public.mandantes where id=current_setting('app.qa_ops_mandante')::uuid;
delete from auth.users where id=current_setting('app.qa_ops_user')::uuid;

do $$ begin
  if exists(select 1 from auth.users where email like 'qa-ops-%@invalid.test')
     or exists(select 1 from public.contratistas where name='QA Contratista Ops')
     or exists(select 1 from public.mandantes where name='QA Mandante Ops')
     or exists(select 1 from public.projects where name='QA Proyecto Ops') then
    raise exception 'QA contractor action plan cleanup failed';
  end if;
end $$;

commit;
