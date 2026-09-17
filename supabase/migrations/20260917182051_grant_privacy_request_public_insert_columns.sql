-- Permite registrar solicitudes desde el formulario público de privacidad
-- sin otorgar INSERT general sobre columnas internas de gestión.

revoke insert on table public.privacy_requests from anon, authenticated;

grant insert (
  request_type,
  requester_name,
  requester_email,
  contact_channel,
  scope,
  details,
  source,
  temporary_block_requested
) on table public.privacy_requests to anon, authenticated;
