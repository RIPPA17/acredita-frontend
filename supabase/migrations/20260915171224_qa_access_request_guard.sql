do $$
declare
  normalized_email text;
  normalized_name text;
  normalized_company text;
  normalized_industry text;
  duplicate_blocked boolean := false;
begin
  delete from public.access_requests where email = 'qa-hardening@example.invalid';

  insert into public.access_requests (
    requested_role, full_name, company_name, rut, industry, email, phone, status, request_type
  ) values (
    'mandante', ' QA Lanzamiento ', ' Empresa QA ', '76.000.001-9', ' Construcción ',
    'QA-HARDENING@EXAMPLE.INVALID', ' +56911111111 ', 'pending', 'access'
  );

  select email, full_name, company_name, industry
    into normalized_email, normalized_name, normalized_company, normalized_industry
  from public.access_requests
  where email = 'qa-hardening@example.invalid';

  if normalized_email <> 'qa-hardening@example.invalid'
     or normalized_name <> 'QA Lanzamiento'
     or normalized_company <> 'Empresa QA'
     or normalized_industry <> 'Construcción' then
    raise exception 'QA access request normalization failed';
  end if;

  begin
    insert into public.access_requests (
      requested_role, full_name, company_name, rut, industry, email, status, request_type
    ) values (
      'mandante', 'QA Lanzamiento', 'Empresa QA', '76.000.001-9', 'Construcción',
      'qa-hardening@example.invalid', 'pending', 'access'
    );
  exception when others then
    if sqlerrm like 'Ya recibimos una solicitud reciente%' then
      duplicate_blocked := true;
    else
      raise;
    end if;
  end;

  if not duplicate_blocked then
    raise exception 'QA duplicate access request was not blocked';
  end if;

  delete from public.access_requests where email = 'qa-hardening@example.invalid';
end $$;
