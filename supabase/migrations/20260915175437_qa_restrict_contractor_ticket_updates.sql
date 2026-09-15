begin;

select set_config('app.qa_ticket_user',gen_random_uuid()::text,true),
       set_config('app.qa_ticket_mandante',gen_random_uuid()::text,true),
       set_config('app.qa_ticket_project',gen_random_uuid()::text,true),
       set_config('app.qa_ticket_contractor',gen_random_uuid()::text,true),
       set_config('app.qa_ticket_accreditation',gen_random_uuid()::text,true),
       set_config('app.qa_ticket_ticket',gen_random_uuid()::text,true),
       set_config('app.qa_ticket_suffix',replace(gen_random_uuid()::text,'-',''),true);

insert into auth.users(id,aud,role,email,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
values (current_setting('app.qa_ticket_user')::uuid,'authenticated','authenticated','qa-ticket-'||current_setting('app.qa_ticket_suffix')||'@invalid.test',now(),'{}','{}',now(),now());

insert into public.mandantes(id,name,rut,integration_key,is_active)
values (current_setting('app.qa_ticket_mandante')::uuid,'QA Mandante Ticket','99.100.001-8','qa_tm_'||current_setting('app.qa_ticket_suffix'),true);

insert into public.projects(id,mandante_id,name,code,status,integration_key)
values (current_setting('app.qa_ticket_project')::uuid,current_setting('app.qa_ticket_mandante')::uuid,'QA Proyecto Ticket','QA-TKT','active','qa_tp_'||current_setting('app.qa_ticket_suffix'));

insert into public.contratistas(id,name,rut,integration_key,is_active)
values (current_setting('app.qa_ticket_contractor')::uuid,'QA Contratista Ticket','99.100.002-6','qa_tc_'||current_setting('app.qa_ticket_suffix'),true);

insert into public.accreditations(id,project_id,contratista_id,is_active)
values (current_setting('app.qa_ticket_accreditation')::uuid,current_setting('app.qa_ticket_project')::uuid,current_setting('app.qa_ticket_contractor')::uuid,true);

insert into public.contratista_memberships(profile_id,contratista_id,role,is_active)
values (current_setting('app.qa_ticket_user')::uuid,current_setting('app.qa_ticket_contractor')::uuid,'contratista_admin',true);

insert into public.support_tickets(id,project_id,accreditation_id,created_by,category,priority,status,subject,description)
values (current_setting('app.qa_ticket_ticket')::uuid,current_setting('app.qa_ticket_project')::uuid,current_setting('app.qa_ticket_accreditation')::uuid,current_setting('app.qa_ticket_user')::uuid,'operacion','normal','abierto','QA soporte','Ticket de prueba');

set local role authenticated;
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('app.qa_ticket_user'),'role','authenticated')::text,true);

do $$ declare blocked boolean := false; begin
  begin
    update public.support_tickets
    set status='resuelto', resolution='Intento directo'
    where id=current_setting('app.qa_ticket_ticket')::uuid;
    if found then blocked := false; else blocked := true; end if;
  exception when others then blocked := true;
  end;
  if not blocked then
    raise exception 'QA ticket permissions: contractor updated administrative ticket state';
  end if;
end $$;

insert into public.support_ticket_messages(ticket_id,author_id,body,is_internal)
values (current_setting('app.qa_ticket_ticket')::uuid,current_setting('app.qa_ticket_user')::uuid,'Respuesta permitida del contratista',false);

do $$ begin
  if not exists(
    select 1 from public.support_ticket_messages
    where ticket_id=current_setting('app.qa_ticket_ticket')::uuid
      and author_id=current_setting('app.qa_ticket_user')::uuid
      and body='Respuesta permitida del contratista'
  ) then
    raise exception 'QA ticket permissions: contractor could not send message';
  end if;
end $$;

reset role;
select set_config('request.jwt.claims','{}',true);

delete from public.accreditations where id=current_setting('app.qa_ticket_accreditation')::uuid;
delete from public.projects where id=current_setting('app.qa_ticket_project')::uuid;
delete from public.contratistas where id=current_setting('app.qa_ticket_contractor')::uuid;
delete from public.mandantes where id=current_setting('app.qa_ticket_mandante')::uuid;
delete from auth.users where id=current_setting('app.qa_ticket_user')::uuid;

do $$ begin
  if exists(select 1 from auth.users where email like 'qa-ticket-%@invalid.test')
     or exists(select 1 from public.support_tickets where subject='QA soporte') then
    raise exception 'QA ticket permissions cleanup failed';
  end if;
end $$;

commit;
