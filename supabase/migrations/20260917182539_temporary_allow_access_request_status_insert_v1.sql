-- Compatibilidad con los formularios actuales, que envían explícitamente status='pending'.
-- RLS mantiene status restringido a 'pending'; no se otorgan otros campos internos.

grant insert (status) on table public.access_requests to anon, authenticated;
