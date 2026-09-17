-- Reduce la superficie del formulario público de acceso/demo.
-- La lectura pública se elimina y el INSERT queda limitado a campos de entrada.

revoke select, insert on table public.access_requests from anon;
revoke insert on table public.access_requests from authenticated;

grant insert (
  requested_role,
  full_name,
  company_name,
  rut,
  industry,
  email,
  phone,
  request_type,
  company_size,
  message
) on table public.access_requests to anon, authenticated;
