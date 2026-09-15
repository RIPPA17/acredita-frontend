begin;

select set_config('app.qa_ops2_user', gen_random_uuid()::text, true),
       set_config('app.qa_ops2_mandante', gen_random_uuid()::text, true),
       set_config('app.qa_ops2_project', gen_random_uuid()::text, true),
       set_config('app.qa_ops2_contractor', gen_random_uuid()::text, true),
       set_config('app.qa_ops2_accreditation', gen_random_uuid()::text, true),
       set_config('app.qa_ops2_evaluation', gen_random_uuid()::text, true),
       set_config('app.qa_ops2_plan', gen_random_uuid()::text, true),
       set_config('app.qa_ops2_suffix', replace(gen_random_uuid()::text, '-', ''), true);

-- Guard the public RPC surface itself.
do $$
declare
  v_security_definer boolean;
begin
  select p.prosecdef into v_security_definer
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname = 'update_contractor_action_plan'
    and pg_get_function_identity_arguments(p.oid) = 'p_plan_id uuid, p_status text, p_evidence text';

  if coalesce(v_security_definer, true) then
    raise exception 'QA hardened action plan: RPC must be SECURITY INVOKER';
  end if;

  if has_function_privilege('anon', 'public.update_contractor_action_plan(uuid,text,text)', 'EXECUTE') then
    raise exception 'QA hardened action plan: anon can execute RPC';
  end if;
end $$;

insert into auth.users(id,aud,role,email,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
values (
  current_setting('app.qa_ops2_user')::uuid,
  'authenticated','authenticated',
  'qa-ops2-'||current_setting('app.qa_ops2_suffix')||'@invalid.test',
  now(),'{}','{}',now(),now()
);

insert into public.mandantes(id,name,rut,integration_key,is_active)
values (current_setting('app.qa_ops2_mandante')::uuid,'QA Mandante Ops 2','99.000.011-9','qa_m2_'||current_setting('app.qa_ops2_suffix'),true);

insert into public.projects(id,mandante_id,name,code,status,integration_key)
values (current_setting('app.qa_ops2_project')::uuid,current_setting('app.qa_ops2_mandante')::uuid,'QA Proyecto Ops 2','QA-OPS2','active','qa_p2_'||current_setting('app.qa_ops2_suffix'));

insert into public.contratistas(id,name,rut,integration_key,is_active)
values (current_setting('app.qa_ops2_contractor')::uuid,'QA Contratista Ops 2','99.000.012-7','qa_c2_'||current_setting('app.qa_ops2_suffix'),true);

insert into public.accreditations(id,project_id,contratista_id,is_active)
values (current_setting('app.qa_ops2_accreditation')::uuid,current_setting('app.qa_ops2_project')::uuid,current_setting('app.qa_ops2_contractor')::uuid,true);

insert into public.contratista_memberships(profile_id,contratista_id,role,is_active)
values (current_setting('app.qa_ops2_user')::uuid,current_setting('app.qa_ops2_contractor')::uuid,'contratista_admin',true);

insert into public.contractor_evaluations(id,accreditation_id,period_start,period_end,status,safety_score,quality_score,labor_score,compliance_score)
values (current_setting('app.qa_ops2_evaluation')::uuid,current_setting('app.qa_ops2_accreditation')::uuid,current_date-30,current_date,'publicada',85,86,87,88);

insert into public.evaluation_action_plans(id,evaluation_id,title,description,status,created_by)
values (current_setting('app.qa_ops2_plan')::uuid,current_setting('app.qa_ops2_evaluation')::uuid,'QA Acción protegida','Validar avance limitado','pendiente',current_setting('app.qa_ops2_user')::uuid);

set local role authenticated;
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('app.qa_ops2_user'),'role','authenticated')::text,true);

select public.update_contractor_action_plan(current_setting('app.qa_ops2_plan')::uuid,'en_progreso','Evidencia inicial');
select public.update_contractor_action_plan(current_setting('app.qa_ops2_plan')::uuid,'completado','Evidencia final QA');

do $$
declare
  v_status text;
  v_evidence text;
  v_completed timestamptz;
begin
  select status,evidence,completed_at into v_status,v_evidence,v_completed
  from public.evaluation_action_plans
  where id=current_setting('app.qa_ops2_plan')::uuid;
  if v_status <> 'completado' or v_evidence <> 'Evidencia final QA' or v_completed is null then
    raise exception 'QA hardened action plan: allowed progress update failed';
  end if;
end $$;

do $$
declare blocked boolean := false; begin
  begin
    update public.evaluation_action_plans
    set title='Intento de cambio administrativo'
    where id=current_setting('app.qa_ops2_plan')::uuid;
  exception when others then blocked := true;
  end;
  if not blocked then
    raise exception 'QA hardened action plan: contractor changed administrative title';
  end if;
end $$;

do $$
declare blocked boolean := false; begin
  begin
    perform public.update_contractor_action_plan(current_setting('app.qa_ops2_plan')::uuid,'cancelado','No permitido');
  exception when others then blocked := true;
  end;
  if not blocked then
    raise exception 'QA hardened action plan: contractor cancelled plan';
  end if;
end $$;

reset role;
select set_config('request.jwt.claims','{}',true);

delete from public.accreditations where id=current_setting('app.qa_ops2_accreditation')::uuid;
delete from public.projects where id=current_setting('app.qa_ops2_project')::uuid;
delete from public.contratistas where id=current_setting('app.qa_ops2_contractor')::uuid;
delete from public.mandantes where id=current_setting('app.qa_ops2_mandante')::uuid;
delete from auth.users where id=current_setting('app.qa_ops2_user')::uuid;

do $$ begin
  if exists(select 1 from auth.users where email like 'qa-ops2-%@invalid.test')
     or exists(select 1 from public.contratistas where name='QA Contratista Ops 2')
     or exists(select 1 from public.mandantes where name='QA Mandante Ops 2')
     or exists(select 1 from public.projects where name='QA Proyecto Ops 2') then
    raise exception 'QA hardened action plan cleanup failed';
  end if;
end $$;

commit;
