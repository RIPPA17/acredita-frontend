begin;

select set_config('app.qa_sync_u1',gen_random_uuid()::text,true),
       set_config('app.qa_sync_u2',gen_random_uuid()::text,true),
       set_config('app.qa_sync_suffix',replace(gen_random_uuid()::text,'-',''),true),
       set_config('app.qa_sync_revision',(select revision::text from public.business_sync_control where id=1),true);

insert into auth.users(id,aud,role,email,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
values
 (current_setting('app.qa_sync_u1')::uuid,'authenticated','authenticated','qa-sync-1-'||current_setting('app.qa_sync_suffix')||'@invalid.test',now(),'{}','{}',now(),now()),
 (current_setting('app.qa_sync_u2')::uuid,'authenticated','authenticated','qa-sync-2-'||current_setting('app.qa_sync_suffix')||'@invalid.test',now(),'{}','{}',now(),now());

set local role authenticated;
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('app.qa_sync_u1'),'role','authenticated')::text,true);
do $$ begin
  if not public.claim_business_sync(current_setting('app.qa_sync_revision')::bigint,60) then
    raise exception 'QA sync: usuario 1 no pudo adquirir lock';
  end if;
end $$;

select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('app.qa_sync_u2'),'role','authenticated')::text,true);
do $$ begin
  if public.claim_business_sync(current_setting('app.qa_sync_revision')::bigint,60) then
    raise exception 'QA sync: usuario 2 adquirió lock mientras estaba ocupado';
  end if;
end $$;

select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('app.qa_sync_u1'),'role','authenticated')::text,true);
select public.release_business_sync();

select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('app.qa_sync_u2'),'role','authenticated')::text,true);
do $$ declare blocked boolean := false; begin
  if not public.claim_business_sync(current_setting('app.qa_sync_revision')::bigint,60) then
    raise exception 'QA sync: usuario 2 no pudo adquirir lock liberado';
  end if;
  begin
    update public.business_sync_control set revision=revision+100 where id=1;
  exception when others then blocked := true;
  end;
  if not blocked then raise exception 'QA sync: revisión pudo ser manipulada por cliente'; end if;
end $$;
select public.release_business_sync();

reset role;
select set_config('request.jwt.claims','{}',true);
delete from auth.users where id in(current_setting('app.qa_sync_u1')::uuid,current_setting('app.qa_sync_u2')::uuid);

do $$ begin
  if exists(select 1 from auth.users where email like 'qa-sync-%@invalid.test') then
    raise exception 'QA sync cleanup: usuario residual';
  end if;
end $$;

commit;
