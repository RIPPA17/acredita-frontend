# Acredita — Production Readiness

Última revisión técnica: 2026-09-16 (Chile).

## Estado verificado

- Supabase productivo: `Backend de Acredita` (`jwlscxbmttpicwljozwf`), región `sa-east-1`, estado `ACTIVE_HEALTHY`.
- RLS habilitado en todas las tablas de aplicación expuestas en `public` y en Storage.
- Buckets documentales privados: `acredita-documents`, `asset-documents`, `document-library` y `operation-files`.
- Los buckets restringen tamaño y MIME; no existen objetos cargados en Storage al momento de esta revisión.
- El Security Advisor de Supabase no reporta errores de RLS; queda una advertencia de Auth por protección contra contraseñas filtradas desactivada.
- `production_security_and_audit_hardening_v1` aplicado en producción y versionado en `supabase/migrations/20260917021643_production_security_and_audit_hardening_v1.sql`.
- RPC de sincronización y pago ya no admiten ejecución anónima.
- Política de `asset-documents` corregida para autorizar usando el UUID del activo presente en la ruta real del objeto.
- Auditoría ampliada para pagos, aprobaciones, evaluaciones, planes de acción, tickets y mensajes de soporte. El log guarda metadatos operacionales y evita copiar textos libres como descripción, mensaje, evidencia o comentario.

## Bloqueos antes de cargar documentación sensible real

1. **Backups y continuidad.** La organización `ACREDITA` está actualmente en plan Free. Antes de un piloto con documentación real, subir a un plan con backups automáticos o implementar y probar un backup externo. En la oferta actual de Supabase, Pro incluye backups diarios con 7 días de retención y evita la pausa por inactividad. Referencias: https://supabase.com/pricing y https://supabase.com/docs/guides/platform/backups
2. **Auth: contraseñas filtradas.** Activar Leaked Password Protection en Supabase Auth. El Security Advisor mantiene esta única advertencia. Referencia: https://supabase.com/docs/guides/auth/password-security
3. **Correo transaccional.** Configurar SMTP propio para recuperación, invitaciones y activación antes de abrir el onboarding a clientes reales. Referencia: https://supabase.com/docs/guides/deployment/going-into-prod
4. **Datos demo.** Separar o retirar los perfiles/datos ficticios de `El Boliche` y `Terrible de Pollo` antes de considerar este mismo entorno como producción comercial definitiva. No borrar datos demo hasta tener una copia/criterio de limpieza validado.

## Protección de datos — Ley 21.719

La Ley 21.719 entra en vigencia general el **1 de diciembre de 2026**. Antes de esa fecha Acredita debe cerrar, como mínimo:

- inventario de datos personales tratados y finalidad/base de tratamiento;
- definición contractual de responsable/mandatario según cada relación Mandante–Acredita–Contratista;
- política de retención y eliminación por tipo documental;
- procedimiento para acceso, rectificación, supresión, oposición, portabilidad y bloqueo cuando corresponda;
- procedimiento de incidentes y trazabilidad de accesos/cambios;
- revisión de transferencias internacionales y proveedores que procesan datos;
- privacidad desde el diseño y minimización: no almacenar datos que no sean necesarios para acreditar;
- controles reforzados para datos sensibles cuando un requisito documental pueda contenerlos.

Referencia oficial: https://www.bcn.cl/leychile/navegar?idNorma=1209272

## Criterio de go-live

No considerar el entorno listo para documentación real sensible mientras los puntos de **backups** y **Leaked Password Protection** sigan abiertos. El frontend y las políticas RLS pueden seguir probándose con datos ficticios mientras se resuelven esos dos puntos.
