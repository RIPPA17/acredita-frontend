-- Restaura únicamente las columnas que usan los formularios públicos.
-- status se mantiene por compatibilidad con el frontend actual; RLS solo admite 'pending'.
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
  message,
  status
) on table public.access_requests to anon, authenticated;
