# Acredita — Production Readiness

Última revisión técnica: 2026-09-17 (Chile).

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
- Centro de Privacidad operativo en Admin con solicitudes de titulares, incidentes, retención, legal holds y exportación estructurada.
- Dataset existente separado mediante `data_environment`; todos los registros actuales quedaron marcados como `demo` y los nuevos registros nacen como `production` por defecto.
- Utilidades Edge de E2E/debug y la función temporal de contraseñas demo quedaron neutralizadas en producción con respuesta 410/JWT. Se mantienen activas las funciones productivas de invitación/onboarding.

## Advertencias de Security Advisor

### Pendiente de plataforma

- **Leaked Password Protection** está desactivado en Supabase Auth. La organización `ACREDITA` está en plan Free y esta protección requiere Pro o superior.

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

1. **Backups y continuidad.** La organización `ACREDITA` está en plan Free. Supabase recomienda exportaciones periódicas en Free; Pro/Team/Enterprise cuentan con backups automáticos diarios. El backup de base de datos no restaura objetos eliminados de Storage, por lo que los documentos requieren una estrategia separada.
2. **Auth: contraseñas filtradas.** Leaked Password Protection requiere plan Pro o superior. Como control compensatorio actual, Acredita exige 12 caracteres, mayúscula, minúscula, número y símbolo en activación/recuperación.
3. **Correo transaccional.** El SMTP por defecto de Supabase no es adecuado para producción: está limitado y solo entrega a direcciones autorizadas del equipo. Configurar SMTP propio antes de invitar clientes externos.
4. **Recuperación.** Definir RPO/RTO y ejecutar al menos una prueba controlada de restauración antes del piloto real.
5. **Acceso administrativo.** Exigir MFA en las cuentas que administran Supabase, GitHub y Vercel y limitar permisos destructivos.
6. **Repositorio.** Revisar la visibilidad y los colaboradores del repositorio antes de operar comercialmente; no almacenar secretos ni respaldos de datos personales en GitHub.

## Piloto interno disponible

Existe un proyecto `PILOTO INTERNO - Acredita` con:

- Mandante demo: `Constructora Andina SA`;
- Contratista demo: `Servicios Norte`;
- 5 trabajadores asignados;
- 4 requisitos activos;
- 0 documentos cargados al momento de la revisión.

Debe usarse para el ensayo funcional completo con documentos ficticios antes de cargar información real. El procedimiento está documentado en `docs/PILOT_RUNBOOK.md`.

## Protección de datos — Ley 21.719

La Ley 21.719 entra en vigencia general el **1 de diciembre de 2026**. Antes de esa fecha Acredita debe cerrar, como mínimo:

- inventario de datos personales tratados y finalidad/base de tratamiento;
- definición contractual de roles y responsabilidades en cada relación Mandante–Acredita–Contratista;
- política de retención y eliminación por tipo documental;
- procedimiento para acceso, rectificación, supresión, oposición, portabilidad y bloqueo cuando corresponda;
- procedimiento de incidentes y trazabilidad de accesos/cambios;
- revisión de transferencias internacionales y proveedores que procesan datos;
- privacidad desde el diseño y minimización;
- controles reforzados para datos sensibles cuando un requisito documental pueda contenerlos.

Referencia oficial: Biblioteca del Congreso Nacional, Ley 21.719.

## Criterio de go-live

No considerar el entorno listo para documentación sensible real mientras sigan abiertos **backups/recuperación**, **SMTP propio** y la decisión sobre **Leaked Password Protection/plan Supabase**. El frontend, RLS, privacidad y flujos completos pueden seguir probándose con el entorno demo/piloto interno.
