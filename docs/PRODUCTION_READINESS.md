# Acredita — Production Readiness

Última revisión técnica: 2026-09-16/17 (Chile).

## Estado verificado

- Supabase productivo: `Backend de Acredita` (`jwlscxbmttpicwljozwf`), región `sa-east-1`, estado `ACTIVE_HEALTHY`.
- RLS habilitado en todas las tablas de aplicación expuestas en `public` y en Storage.
- Buckets documentales privados: `acredita-documents`, `asset-documents`, `document-library` y `operation-files`.
- Los buckets restringen tamaño y MIME.
- No existen privilegios directos de tablas `public` para `anon`.
- La única RPC de `public` ejecutable por `anon` es `get_contractor_invitation_preview(text)`, necesaria para mostrar una invitación válida antes del inicio de sesión.
- `audit_logs` no tiene privilegios directos para `anon` ni `authenticated`; la lectura autorizada se controla por RLS y las escrituras de auditoría se realizan desde funciones/triggers controlados.
- `production_security_and_audit_hardening_v1` aplicado en producción y versionado en `supabase/migrations/20260917021643_production_security_and_audit_hardening_v1.sql`.
- RPC de sincronización y pago no admiten ejecución anónima.
- Política de `asset-documents` corregida para autorizar usando el UUID del activo presente en la ruta real del objeto.
- Auditoría ampliada para pagos, aprobaciones, evaluaciones, planes de acción, tickets y mensajes de soporte. El log guarda metadatos operacionales y evita copiar textos libres como descripción, mensaje, evidencia o comentario.
- Política de Storage de `operation-files` endurecida en `tighten_operation_file_storage_access`: ya no basta con que exista un registro de adjunto; el usuario debe tener acceso al pago, ticket o plan de acción relacionado.

## Advertencias de Security Advisor

### Pendiente de plataforma

- **Leaked Password Protection** está desactivado en Supabase Auth y debe activarse antes del go-live con documentación real.

### Advertencias revisadas y aceptadas provisionalmente

Supabase marca tres RPC de auditoría porque usan `SECURITY DEFINER` y pueden ser ejecutadas por `authenticated`:

- `register_document_access(uuid,text)`
- `register_asset_document_access(uuid,text)`
- `register_storage_access(text,text,text)`

Se mantienen por ahora porque:

- requieren `auth.uid()`;
- rechazan acciones distintas de `view`/`download`;
- vuelven a comprobar autorización al recurso mediante helpers privados;
- no son ejecutables por `anon` ni `PUBLIC`;
- su finalidad es registrar trazabilidad sin devolver datos sensibles.

Antes de una auditoría externa conviene evaluar mover la implementación privilegiada a `private` y conservar wrappers públicos mínimos.

## Bloqueos antes de cargar documentación sensible real

1. **Backups y continuidad.** La organización `ACREDITA` está actualmente en plan Free. Antes de un piloto con documentación real, subir a un plan con backups automáticos o implementar y probar un backup externo. Según la documentación vigente de Supabase, Pro/Team/Enterprise cuentan con backups automáticos diarios; Pro retiene 7 días. PITR permite un RPO mucho menor, pero es un add-on. Importante: el backup de base de datos no restaura archivos eliminados de Supabase Storage, por lo que los documentos críticos requieren una estrategia separada de respaldo/retención.
2. **Auth: contraseñas filtradas.** Activar Leaked Password Protection en Supabase Auth.
3. **Correo transaccional.** Configurar SMTP propio para recuperación, invitaciones y activación antes de abrir el onboarding a clientes reales.
4. **Datos demo.** Separar o retirar los perfiles/datos ficticios de `El Boliche` y `Terrible de Pollo` antes de considerar este mismo entorno como producción comercial definitiva. No borrar datos demo hasta tener una copia/criterio de limpieza validado.
5. **Recuperación.** Definir RPO/RTO y ejecutar al menos una prueba controlada de restauración antes del piloto real.
6. **Acceso administrativo.** Exigir MFA en las cuentas que administran Supabase, GitHub y Vercel y limitar el número de personas con permisos destructivos.

## Protección de datos — Ley 21.719

La Ley 21.719 entra en vigencia general el **1 de diciembre de 2026**. Antes de esa fecha Acredita debe cerrar, como mínimo:

- inventario de datos personales tratados y finalidad/base de tratamiento;
- definición contractual de roles y responsabilidades en cada relación Mandante–Acredita–Contratista;
- política de retención y eliminación por tipo documental;
- procedimiento para acceso, rectificación, supresión, oposición, portabilidad y bloqueo cuando corresponda;
- procedimiento de incidentes y trazabilidad de accesos/cambios;
- revisión de transferencias internacionales y proveedores que procesan datos;
- privacidad desde el diseño y minimización: no almacenar datos que no sean necesarios para acreditar;
- controles reforzados para datos sensibles cuando un requisito documental pueda contenerlos.

Referencia oficial: Biblioteca del Congreso Nacional, Ley 21.719.

## Criterio de go-live

No considerar el entorno listo para documentación real sensible mientras los puntos de **backups** y **Leaked Password Protection** sigan abiertos. El frontend, RLS y flujos completos pueden seguir probándose con datos ficticios mientras se resuelven esos controles de plataforma.
