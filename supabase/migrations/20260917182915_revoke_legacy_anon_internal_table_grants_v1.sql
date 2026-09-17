-- Revoca privilegios anónimos heredados de migraciones antiguas.
-- Las políticas RLS de estas tablas son exclusivamente para usuarios autenticados.
revoke all privileges on table public.business_sync_control from anon;
revoke all privileges on table public.compliance_periods from anon;
revoke all privileges on table public.document_obligations from anon;
revoke all privileges on table public.services from anon;

-- access_requests es un canal público de entrada, no una tabla administrable por anon.
-- Los grants de INSERT por columna se restauran en la migración siguiente.
revoke all privileges on table public.access_requests from anon;
