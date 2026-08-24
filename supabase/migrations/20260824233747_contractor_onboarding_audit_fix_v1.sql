-- Hotfix aplicado en producción después de detectar que audit_logs es de solo lectura
-- para authenticated. El RPC mantiene validación explícita de proyecto y ejecuta
-- su escritura de auditoría con privilegio controlado. La migración de hardening
-- posterior mueve este privilegio al esquema private.
alter function public.create_contractor_invitation(uuid,text,uuid,text,text,text) security definer;
revoke all on function public.create_contractor_invitation(uuid,text,uuid,text,text,text) from public, anon;
grant execute on function public.create_contractor_invitation(uuid,text,uuid,text,text,text) to authenticated;
