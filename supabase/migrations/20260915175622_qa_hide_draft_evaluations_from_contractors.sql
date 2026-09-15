begin;

select set_config('app.qa_eval_user',gen_random_uuid()::text,true),
       set_config('app.qa_eval_mandante',gen_random_uuid()::text,true),
       set_config('app.qa_eval_project',gen_random_uuid()::text,true),
       set_config('app.qa_eval_contractor',gen_random_uuid()::text,true),
       set_config('app.qa_eval_accreditation',gen_random_uuid()::text,true),
       set_config('app.qa_eval_published',gen_random_uuid()::text,true),
       set_config('app.qa_eval_draft',gen_random_uuid()::text,true),
       set_config('app.qa_eval_plan_published',gen_random_uuid()::text,true),
       set_config('app.qa_eval_plan_draft',gen_random_uuid()::text,true),
       set_config('app.qa_eval_suffix',replace(gen_random_uuid()::text,'-',''),true);

insert into auth.users(id,aud,role,email,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
values (current_setting('app.qa_eval_user')::uuid,'authenticated','authenticated','qa-eval-'||current_setting('app.qa_eval_suffix')||'@invalid.test',now(),'{}','{}',now(),now());

insert into public.mandantes(id,name,rut,integration_key,is_active)
values (current_setting('app.qa_eval_mandante')::uuid,'QA Mandante Evaluación','99.200.001-5','qa_em_'||current_setting('app.qa_eval_suffix'),true);

insert into public.projects(id,mandante_id,name,code,status,integration_key)
values (current_setting('app.qa_eval_project')::uuid,current_setting('app.qa_eval_mandante')::uuid,'QA Proyecto Evaluación','QA-EVAL','active','qa_ep_'||current_setting('app.qa_eval_suffix'));

insert into public.contratistas(id,name,rut,integration_key,is_active)
values (current_setting('app.qa_eval_contractor')::uuid,'QA Contratista Evaluación','99.200.002-3','qa_ec_'||current_setting('app.qa_eval_suffix'),true);

insert into public.accreditations(id,project_id,contratista_id,is_active)
values (current_setting('app.qa_eval_accreditation')::uuid,current_setting('app.qa_eval_project')::uuid,current_setting('app.qa_eval_contractor')::uuid,true);

insert into public.contratista_memberships(profile_id,contratista_id,role,is_active)
values (current_setting('app.qa_eval_user')::uuid,current_setting('app.qa_eval_contractor')::uuid,'contratista_admin',true);

insert into public.contractor_evaluations(id,accreditation_id,period_start,period_end,status,safety_score,quality_score,labor_score,compliance_score)
values
(current_setting('app.qa_eval_published')::uuid,current_setting('app.qa_eval_accreditation')::uuid,current_date-60,current_date-31,'publicada',80,80,80,80),
(current_setting('app.qa_eval_draft')::uuid,current_setting('app.qa_eval_accreditation')::uuid,current_date-30,current_date,'borrador',90,90,90,90);

insert into public.evaluation_action_plans(id,evaluation_id,title,description,status,created_by)
values
(current_setting('app.qa_eval_plan_published')::uuid,current_setting('app.qa_eval_published')::uuid,'QA plan publicado','Visible y actualizable','pendiente',current_setting('app.qa_eval_user')::uuid),
(current_setting('app.qa_eval_plan_draft')::uuid,current_setting('app.qa_eval_draft')::uuid,'QA plan borrador','No visible ni actualizable','pendiente',current_setting('app.qa_eval_user')::uuid);

set local role authenticated;
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('app.qa_eval_user'),'role','authenticated')::text,true);

do $$ declare v_count integer; begin
  select count(*) into v_count from public.contractor_evaluations where accreditation_id=current_setting('app.qa_eval_accreditation')::uuid;
  if v_count <> 1 then raise exception 'QA evaluation visibility: contractor saw draft evaluation'; end if;
end $$;

do $$ declare v_count integer; begin
  select count(*) into v_count from public.evaluation_action_plans where evaluation_id in (current_setting('app.qa_eval_published')::uuid,current_setting('app.qa_eval_draft')::uuid);
  if v_count <> 1 then raise exception 'QA action plan visibility: contractor saw draft plan'; end if;
end $$;

select public.update_contractor_action_plan(current_setting('app.qa_eval_plan_published')::uuid,'en_progreso','Evidencia permitida');

do $$ declare blocked boolean := false; begin
  begin
    perform public.update_contractor_action_plan(current_setting('app.qa_eval_plan_draft')::uuid,'en_progreso','No debe aplicar');
  exception when others then blocked := true;
  end;
  if not blocked then raise exception 'QA draft action plan: contractor updated draft plan'; end if;
end $$;

reset role;
select set_config('request.jwt.claims','{}',true);

delete from public.accreditations where id=current_setting('app.qa_eval_accreditation')::uuid;
delete from public.projects where id=current_setting('app.qa_eval_project')::uuid;
delete from public.contratistas where id=current_setting('app.qa_eval_contractor')::uuid;
delete from public.mandantes where id=current_setting('app.qa_eval_mandante')::uuid;
delete from auth.users where id=current_setting('app.qa_eval_user')::uuid;

do $$ begin
  if exists(select 1 from auth.users where email like 'qa-eval-%@invalid.test')
     or exists(select 1 from public.contractor_evaluations where id in (current_setting('app.qa_eval_published')::uuid,current_setting('app.qa_eval_draft')::uuid)) then
    raise exception 'QA evaluation visibility cleanup failed';
  end if;
end $$;

commit;
