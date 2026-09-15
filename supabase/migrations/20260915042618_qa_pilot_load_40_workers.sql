begin;

do $$
declare
  suffix text := replace(gen_random_uuid()::text, '-', '');
  reviewer uuid := gen_random_uuid();
  m_id uuid := gen_random_uuid();
  p_id uuid := gen_random_uuid();
  c_a uuid := gen_random_uuid();
  c_b uuid := gen_random_uuid();
  a_a uuid := gen_random_uuid();
  a_b uuid := gen_random_uuid();
  s_a uuid := gen_random_uuid();
  s_b uuid := gen_random_uuid();
  req_company uuid := gen_random_uuid();
  req_odi uuid := gen_random_uuid();
  req_bg uuid := gen_random_uuid();
  w_id uuid;
  asg_id uuid;
  doc_id uuid;
  asset_ids uuid[] := array[gen_random_uuid(),gen_random_uuid(),gen_random_uuid(),gen_random_uuid(),gen_random_uuid()];
  pay_id uuid := gen_random_uuid();
  i int;
  blocked_direct boolean := false;
  worker_count int;
  assignment_count int;
  obligation_count int;
begin
  insert into auth.users(id,aud,role,email,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
  values(reviewer,'authenticated','authenticated','qa-reviewer-'||suffix||'@invalid.test',now(),'{}','{}',now(),now());
  insert into public.acredita_memberships(profile_id,role) values(reviewer,'admin_acredita');
  insert into public.mandantes(id,name,integration_key) values(m_id,'QA Piloto Carga','qa_load_m_'||suffix);
  insert into public.projects(id,mandante_id,name,code,status,integration_key,location,starts_at)
  values(p_id,m_id,'QA Piloto 40 trabajadores','QA-LOAD','active','qa_load_p_'||suffix,'Santiago',current_date);
  insert into public.contratistas(id,name,integration_key) values
    (c_a,'QA Contratista A','qa_load_ca_'||suffix),
    (c_b,'QA Contratista B','qa_load_cb_'||suffix);
  insert into public.accreditations(id,project_id,contratista_id) values(a_a,p_id,c_a),(a_b,p_id,c_b);
  insert into public.services(id,accreditation_id,integration_key,code,name) values
    (s_a,a_a,'qa_srv_a_'||suffix,'QA-A','Servicio QA A'),
    (s_b,a_b,'qa_srv_b_'||suffix,'QA-B','Servicio QA B');

  insert into public.requirements(id,project_id,integration_key,name,category,target,is_required,frequency,validity_days,alert_days,criticality,sort_order,blocks_work,blocks_assignment,due_days)
  values
    (req_company,p_id,'qa_f30_'||suffix,'F30 / F31 SII','Laboral','empresa',true,'mensual',30,7,'bloquea_pago',1,false,false,5),
    (req_odi,p_id,'qa_odi_'||suffix,'Certificado ODI','Seguridad','trabajador',true,'un_ano',365,30,'bloquea_acceso',2,true,true,5),
    (req_bg,p_id,'qa_bg_'||suffix,'Certificado Antecedentes','Laboral','trabajador',true,'seis_meses',180,15,'advertencia',3,false,false,5);

  for i in 1..40 loop
    w_id := gen_random_uuid();
    asg_id := gen_random_uuid();
    insert into public.workers(id,contratista_id,rut,full_name,job_title)
    values(w_id,case when i <= 20 then c_a else c_b end,'99'||lpad(i::text,6,'0')||'-'||(i%10)::text,'QA Trabajador '||i,case when i%2=0 then 'Operador' else 'Ayudante' end);
    insert into public.worker_assignments(id,accreditation_id,worker_id,service_id,job_title,categories,assignment_status,access_status,assigned_at)
    values(asg_id,case when i <= 20 then a_a else a_b end,w_id,case when i <= 20 then s_a else s_b end,case when i%2=0 then 'Operador' else 'Ayudante' end,array['general'],'activa','pendiente',now());

    if i <= 3 then
      doc_id := gen_random_uuid();
      insert into public.documents(id,accreditation_id,requirement_id,worker_id)
      values(doc_id,case when i <= 20 then a_a else a_b end,req_odi,w_id);
      if i = 1 then
        insert into public.document_versions(document_id,version_number,workflow_status,issued_at,expires_at,reviewed_by,reviewed_at,metadata)
        values(doc_id,1,'aprobado',current_date-30,current_date+335,reviewer,now(),'{}');
      elsif i = 2 then
        insert into public.document_versions(document_id,version_number,workflow_status,issued_at,expires_at,reviewed_by,reviewed_at,rejection_reason,rejection_explanation,metadata)
        values(doc_id,1,'rechazado',current_date-10,current_date+355,reviewer,now(),'Firma inválida','Debe volver a firmarse','{}');
      else
        insert into public.document_versions(document_id,version_number,workflow_status,issued_at,expires_at,reviewed_by,reviewed_at,metadata)
        values(doc_id,1,'aprobado',current_date-400,current_date-35,reviewer,now(),'{}');
        insert into public.document_versions(document_id,version_number,workflow_status,issued_at,expires_at,reviewed_by,reviewed_at,metadata)
        values(doc_id,2,'aprobado',current_date-5,current_date+360,reviewer,now(),'{}');
      end if;
    end if;
  end loop;

  select count(*) into worker_count from public.workers where contratista_id in(c_a,c_b);
  select count(*) into assignment_count from public.worker_assignments where accreditation_id in(a_a,a_b);
  select count(*) into obligation_count from public.document_obligations where accreditation_id in(a_a,a_b);
  if worker_count <> 40 then raise exception 'QA carga: se esperaban 40 trabajadores y hay %', worker_count; end if;
  if assignment_count <> 40 then raise exception 'QA carga: se esperaban 40 asignaciones y hay %', assignment_count; end if;
  if obligation_count < 80 then raise exception 'QA carga: se esperaban al menos 80 obligaciones y hay %', obligation_count; end if;

  insert into public.asset_requirement_templates(project_id,asset_type,document_type,validity_days,blocks_access,is_required) values
    (p_id,'vehiculo','Permiso circulación',365,true,true),
    (p_id,'vehiculo','Revisión técnica',365,true,true),
    (p_id,'maquinaria','Certificado técnico',365,true,true),
    (p_id,'maquinaria','Mantención vigente',180,true,true);

  insert into public.assets(id,accreditation_id,integration_key,asset_type,identifier,name) values
    (asset_ids[1],a_a,'qa_asset_1_'||suffix,'vehiculo','QA-V1','Camioneta QA 1'),
    (asset_ids[2],a_a,'qa_asset_2_'||suffix,'vehiculo','QA-V2','Camioneta QA 2'),
    (asset_ids[3],a_a,'qa_asset_3_'||suffix,'vehiculo','QA-V3','Camioneta QA 3'),
    (asset_ids[4],a_b,'qa_asset_4_'||suffix,'maquinaria','QA-M1','Excavadora QA 1'),
    (asset_ids[5],a_b,'qa_asset_5_'||suffix,'maquinaria','QA-M2','Excavadora QA 2');

  perform set_config('request.jwt.claims',jsonb_build_object('sub',reviewer,'role','authenticated')::text,true);

  insert into public.asset_documents(asset_id,document_type,document_name,status,issued_at,expires_at) values
    (asset_ids[1],'Permiso circulación','permiso.pdf','en_revision',current_date-30,current_date+335),
    (asset_ids[1],'Revisión técnica','revision.pdf','en_revision',current_date-30,current_date+335),
    (asset_ids[2],'Permiso circulación','permiso.pdf','en_revision',current_date-30,current_date+335),
    (asset_ids[2],'Revisión técnica','revision.pdf','en_revision',current_date-30,current_date+335),
    (asset_ids[3],'Permiso circulación','permiso.pdf','en_revision',current_date-30,current_date+335),
    (asset_ids[3],'Revisión técnica','revision.pdf','en_revision',current_date-400,current_date-35),
    (asset_ids[4],'Certificado técnico','cert.pdf','en_revision',current_date-30,current_date+335),
    (asset_ids[5],'Certificado técnico','cert.pdf','en_revision',current_date-30,current_date+335),
    (asset_ids[5],'Mantención vigente','mant.pdf','en_revision',current_date-200,current_date-20);

  update public.asset_documents set status='aprobado',reviewed_by=reviewer,reviewed_at=now() where asset_id=asset_ids[1];
  update public.asset_documents set status='aprobado',reviewed_by=reviewer,reviewed_at=now() where asset_id=asset_ids[2] and document_type='Permiso circulación';
  update public.asset_documents set status='rechazado',rejection_reason='QA rechazo',reviewed_by=reviewer,reviewed_at=now() where asset_id=asset_ids[2] and document_type='Revisión técnica';
  update public.asset_documents set status='aprobado',reviewed_by=reviewer,reviewed_at=now() where asset_id=asset_ids[3];
  update public.asset_documents set status='aprobado',reviewed_by=reviewer,reviewed_at=now() where asset_id=asset_ids[4];
  update public.asset_documents set status='aprobado',reviewed_by=reviewer,reviewed_at=now() where asset_id=asset_ids[5];

  if not exists(select 1 from public.assets where id=asset_ids[1] and status='habilitado' and access_allowed) then raise exception 'QA activo 1 debió quedar habilitado'; end if;
  if not exists(select 1 from public.assets where id=asset_ids[2] and status='bloqueado' and not access_allowed) then raise exception 'QA activo 2 debió quedar bloqueado por rechazo'; end if;
  if not exists(select 1 from public.assets where id=asset_ids[3] and status='bloqueado' and not access_allowed) then raise exception 'QA activo 3 debió quedar bloqueado por vencimiento'; end if;
  if not exists(select 1 from public.assets where id=asset_ids[4] and status='en_revision' and not access_allowed) then raise exception 'QA activo 4 debió seguir en revisión por documento faltante'; end if;
  if not exists(select 1 from public.assets where id=asset_ids[5] and status='bloqueado' and not access_allowed) then raise exception 'QA activo 5 debió quedar bloqueado antes de renovar'; end if;

  update public.asset_documents set status='en_revision',issued_at=current_date,expires_at=current_date+180,reviewed_by=null,reviewed_at=null,rejection_reason=null where asset_id=asset_ids[5] and document_type='Mantención vigente';
  update public.asset_documents set status='aprobado',reviewed_by=reviewer,reviewed_at=now() where asset_id=asset_ids[5] and document_type='Mantención vigente';
  if not exists(select 1 from public.assets where id=asset_ids[5] and status='habilitado' and access_allowed) then raise exception 'QA activo 5 debió habilitarse tras renovación'; end if;

  insert into public.payment_cases(id,accreditation_id,period_start,period_end,amount,status,block_reason,invoice_number,submitted_by,submitted_at)
  values(pay_id,a_a,date_trunc('month',current_date)::date,(date_trunc('month',current_date)+interval '1 month - 1 day')::date,2500000,'observado','Pendiente aprobación','QA-100',reviewer,now());

  begin
    update public.payment_cases set status='liberado' where id=pay_id;
  exception when others then
    blocked_direct := true;
  end;
  if not blocked_direct then raise exception 'QA pago: la liberación directa no fue bloqueada'; end if;

  insert into public.payment_approvals(payment_case_id,decision,comment,decided_by)
  values(pay_id,'aprobado','QA aprobación',reviewer);
  if not exists(select 1 from public.payment_cases where id=pay_id and status='liberado') then raise exception 'QA pago: aprobación no liberó el pago'; end if;

  perform set_config('app.payment_transition_source','mark_paid',true);
  update public.payment_cases set status='pagado',paid_at=now(),updated_at=now() where id=pay_id and status='liberado';
  if not exists(select 1 from public.payment_cases where id=pay_id and status='pagado' and paid_at is not null) then raise exception 'QA pago: no se pudo completar el estado pagado'; end if;

  perform set_config('request.jwt.claims','{}',true);
  delete from public.audit_logs where project_id=p_id or accreditation_id in(a_a,a_b) or actor_profile_id=reviewer;
  delete from public.projects where id=p_id;
  delete from public.contratistas where id in(c_a,c_b);
  delete from public.mandantes where id=m_id;
  delete from auth.users where id=reviewer;

  if exists(select 1 from public.projects where id=p_id) then raise exception 'QA cleanup: proyecto residual'; end if;
  if exists(select 1 from public.workers where contratista_id in(c_a,c_b)) then raise exception 'QA cleanup: trabajadores residuales'; end if;
  if exists(select 1 from public.assets where id=any(asset_ids)) then raise exception 'QA cleanup: activos residuales'; end if;
end $$;

commit;
