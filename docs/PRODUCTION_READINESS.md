# Acredita — Production Readiness

Última revisión técnica: 2026-09-17 (Chile).

## Estado técnico verificado

- Supabase productivo: `Backend de Acredita` (`jwlscxbmttpicwljozwf`), región `sa-east-1`, estado `ACTIVE_HEALTHY`.
- RLS habilitado en todas las tablas de aplicación expuestas en `public` y en Storage.
- Buckets documentales privados: `acredita-documents`, `asset-documents`, `document-library` y `operation-files`.
- Los buckets restringen tamaño y MIME.
- No existen privilegios directos de tablas `public` para `anon`.
- La única RPC de `public` ejecutable por `anon` es `get_contractor_invitation_preview(text)`, necesaria para mostrar una invitación válida antes del inicio de sesión.
- `audit_logs` no tiene privilegios directos para `anon` ni `authenticated`; la lectura autorizada se controla por RLS y las escrituras se realizan desde funciones/triggers controlados.
- RPC de sincronización y pago no admiten ejecución anónima.
- Política de `asset-documents` corregida para autorizar usando el UUID real del activo.
- Política de Storage de `operation-files` exige acceso al pago, ticket o plan de acción relacionado.
- Auditoría operacional ampliada para pagos, aprobaciones, evaluaciones, planes de acción, soporte y acceso documental.
- Centro de Privacidad operativo en Admin con solicitudes de titulares, incidentes, retención, legal holds y exportación estructurada.
- Dataset existente separado mediante `data_environment`: los fixtures actuales son `demo` y los registros nuevos nacen como `production`.
- Utilidades Edge E2E/debug y la función temporal de contraseñas demo están neutralizadas en producción. Las funciones productivas de invitación/onboarding permanecen activas.

## Hardening final de base de datos

### RPC de auditoría documental

Las tres RPC públicas de auditoría dejaron de ejecutar con privilegios de definidor:

- `register_document_access(uuid,text)`
- `register_asset_document_access(uuid,text)`
- `register_storage_access(text,text,text)`

La implementación privilegiada vive ahora en `private` con `SECURITY DEFINER`, `search_path=''`, validación de `auth.uid()`, validación de acción y comprobación explícita de acceso al recurso. Los wrappers de `public` son `SECURITY INVOKER`, no son ejecutables por `anon` ni `PUBLIC`, y conservan `authenticated`/`service_role` como únicos consumidores previstos.

Migración productiva: `20260917175307_refactor_access_audit_rpc_security_v1`.

Después del cambio, Security Advisor ya no informa las tres advertencias `authenticated_security_definer_function_executable`.

### Índices y rendimiento

Se agregaron índices de cobertura para las 11 claves foráneas que Performance Advisor marcaba sin índice en las tablas de privacidad, incidentes, retención y legal holds.

Migración productiva: `20260917175445_index_privacy_foreign_keys_v1`.

Después del cambio desapareció el hallazgo `unindexed_foreign_keys`. Permanecen avisos `unused_index` de nivel INFO; no se eliminan índices mientras la aplicación tenga poco tráfico, porque las estadísticas de uso todavía no son representativas.

## Revisión de secretos y repositorio

- `.env` y variantes locales están ignoradas por Git; solo `.env.example` se versiona.
- `.env.example` contiene placeholders y advierte explícitamente que no se agregue `SUPABASE_SERVICE_ROLE_KEY` al frontend.
- Búsquedas sobre la rama principal no encontraron `SUPABASE_SERVICE_ROLE_KEY`, `service_role`, `sb_secret_`, `DATABASE_URL` ni cadenas `postgresql://`.
- La publishable key del frontend no es una credencial privada; la seguridad continúa dependiendo de RLS y de la sesión autenticada.
- El repositorio sigue reportándose como **público** por GitHub/Vercel. Antes de operación comercial debe cambiarse a privado y revisarse colaboradores.
- GitHub reporta cero repository rulesets. Antes del go-live debe protegerse `main` para exigir PR/CI y evitar saltarse los controles mediante push directo.

## CI

El pipeline valida instalación reproducible (`npm ci`), auditoría de dependencias con bloqueo de vulnerabilidades `high`/`critical`, TypeScript, tests de dominio, build y flujos E2E críticos.

## Security Advisor

La única advertencia de seguridad pendiente es **Leaked Password Protection Disabled**. Supabase documenta esta protección como disponible en plan Pro o superior. Acredita ya exige como control compensatorio 12 caracteres, mayúscula, minúscula, número y símbolo para activación/recuperación.

## Bloqueos externos antes de documentación sensible real

1. **Supabase Pro / continuidad.** La organización `ACREDITA` sigue en Free. Para producción comercial se recomienda Pro o superior para backups automáticos y para evitar pausas por inactividad. En Free, Supabase recomienda dumps externos periódicos.
2. **Vercel Pro.** El workspace actual está en Hobby. Los términos vigentes de Vercel reservan Hobby para uso personal/no comercial; Acredita debe pasar a Pro antes de operar como servicio comercial.
3. **Storage backup.** Los backups de Postgres no restauran los archivos de Storage; debe existir un respaldo separado de los objetos documentales y una prueba de recuperación.
4. **Leaked Password Protection.** Activarla después de subir Supabase a Pro.
5. **Correo transaccional.** Configurar Custom SMTP antes de invitar clientes externos. El SMTP incorporado de Supabase es para desarrollo y restringe destinatarios.
6. **MFA administrativo.** Proteger las cuentas administradoras de Supabase, GitHub y Vercel; con Pro también puede exigirse MFA a nivel de organización Supabase.
7. **Repositorio GitHub.** Cambiar a privado, revisar accesos y proteger `main` con ruleset/branch protection que exija CI antes del merge.
8. **Recuperación.** Ejecutar una restauración controlada y documentar RPO/RTO antes del go-live.
9. **Configuración de plataforma.** Revisar/activar SSL Enforcement y Network Restrictions cuando se definan los orígenes administrativos permitidos. No aplicar Network Restrictions sin una lista de IPs válida, porque podría bloquear acceso legítimo.

## Piloto interno disponible

Existe `PILOTO INTERNO - Acredita` con Mandante demo `Constructora Andina SA`, Contratista demo `Servicios Norte`, 5 trabajadores asignados, 4 requisitos activos y sin documentos iniciales. Debe ejecutarse con archivos ficticios siguiendo `docs/PILOT_RUNBOOK.md` antes de cargar información real.

## Protección de datos — Ley 21.719

Acredita ya dispone de inventario técnico, privacidad por diseño, solicitudes de titulares, incidentes, retención configurable, legal holds y portabilidad estructurada. La activación de borrado/anominización automática permanece deliberadamente bloqueada hasta validar jurídicamente los plazos aplicables por categoría documental.

La Ley 21.719 entra en vigencia general el 1 de diciembre de 2026. La revisión legal final debe cerrar roles Mandante–Acredita–Contratista, bases/finalidades, textos contractuales y de privacidad, plazos de retención, transferencias/proveedores y protocolo formal de incidentes.

## Criterio de 100%

**Desarrollo, flujos, backend, RLS, privacidad y hardening técnico:** listo para cierre mediante CI y piloto interno.

**Go-live comercial con documentos sensibles:** no se declara 100% hasta cerrar Supabase Pro/backups, Vercel Pro, Storage backup, SMTP, Leaked Password Protection, MFA/controles administrativos, repositorio privado/protegido y prueba de recuperación.
