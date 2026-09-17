# Acredita — Cierre pre-upgrade

Fecha de verificación: 17-09-2026.

Este documento registra el cierre de todo el trabajo técnico que puede completarse antes de contratar infraestructura de producción. No sustituye los gates de go-live comercial definidos en `PRODUCTION_READINESS.md` y `PILOT_RUNBOOK.md`.

## Estado cerrado sin gasto

### Producto y flujos

- Portales Admin, Mandante y Contratista operativos.
- Flujo documental automatizado: carga → revisión → rechazo → corrección → nueva versión → aprobación.
- La corrección real desde UI está cubierta por E2E: el Contratista pulsa `Corregir`, selecciona un PDF y se exige la creación de la versión 2 en revisión.
- La acreditación global exige empresa conforme y 100% de trabajadores asignados conformes.
- Un trabajador pendiente mantiene la acreditación global `En proceso`.
- Un documento obligatorio vencido lleva la acreditación a `Vencido/Bloqueado`.
- Un requisito `bloquea_pago` vencido bloquea pago sin bloquear acceso cuando los requisitos de acceso siguen vigentes.
- Un requisito obligatorio de acceso del trabajador vencido inhabilita al trabajador y bloquea la acreditación global.
- Invitación, recuperación de contraseña, solicitud pública de acceso y Centro de Privacidad están cubiertos por pruebas.

### Responsive

Pruebas permanentes verifican Admin, Mandante y Contratista en:

- escritorio: 1366×768;
- móvil: 390×844.

Se valida render del portal correcto y ausencia de desborde horizontal global.

### Dataset de piloto

`PILOTO INTERNO - Acredita` fue auditado directamente en Supabase:

- 1 proyecto;
- 1 Mandante;
- 1 Contratista;
- 1 acreditación activa;
- 5 trabajadores activos asignados;
- 4 requisitos activos;
- 0 documentos cargados;
- proyecto, Contratista y trabajadores clasificados como `demo`.

Integridad referencial verificada:

- 0 asignaciones con trabajador inexistente;
- 0 asignaciones con acreditación inexistente;
- 0 requisitos con proyecto inexistente;
- 0 documentos con acreditación inexistente;
- 0 documentos con requisito inexistente;
- 0 versiones con documento inexistente.

### Seguridad

Verificación final gratuita:

- tablas `public` sin RLS: 0;
- políticas anónimas distintas de `INSERT`: 0;
- políticas anónimas de Storage: 0;
- buckets públicos: 0;
- columnas con `SELECT`, `UPDATE` o `DELETE` para `anon`: 0;
- funciones `public` ejecutables por `anon`: 1, `get_contractor_invitation_preview`, intencional para onboarding;
- funciones `SECURITY DEFINER` ejecutables por `anon`: 0;
- Security Advisor: solo permanece `Leaked Password Protection Disabled`, dependiente del upgrade final;
- búsqueda del repositorio sin hallazgos de `SUPABASE_SERVICE_ROLE_KEY`, `service_role`, claves privadas o patrones críticos revisados.

Los `unused_index` que informa Performance Advisor se mantienen deliberadamente: la base aún tiene poco tráfico y sus estadísticas no justifican eliminar índices preventivos.

### CI y mantenimiento

Cada PR ejecuta:

1. `npm ci`;
2. `npm audit --audit-level=high`;
3. TypeScript;
4. tests de dominio;
5. build;
6. E2E completos en Chromium.

Dependabot queda activo semanalmente para mantenimiento, pero los upgrades mayores se posponen durante el piloto. Las propuestas automáticas previas fueron cerradas para congelar el stack validado.

### Producción actual

Tras el cierre del piloto automatizado:

- despliegue de `main` en Vercel: READY;
- `https://acredita-frontend.vercel.app/`: HTTP 200;
- headers de seguridad, incluida CSP, activos;
- errores runtime detectados durante la revisión final: 0.

## Pendiente gratuito que requiere una acción manual de cuenta

La integración disponible no expone administración de estas configuraciones de GitHub/cuenta:

1. Cambiar `RIPPA17/acredita-frontend` de público a privado y revisar colaboradores.
2. Proteger `main` para exigir PR + CI verde. GitHub reporta actualmente `protected=false`.
3. Confirmar MFA en las cuentas administrativas de GitHub, Supabase y Vercel.

Estos pasos no requieren contratar Supabase Pro ni Vercel Pro.

## Pendiente deliberadamente postergado hasta el go-live comercial

- infraestructura de continuidad/backups de Supabase;
- Vercel para uso comercial;
- respaldo separado de objetos de Storage;
- Leaked Password Protection;
- Custom SMTP y entrega real de invitaciones/recuperaciones externas;
- controles adicionales de red/SSL según arquitectura final;
- prueba documentada de restauración y RPO/RTO.

## Resultado

El desarrollo, hardening y piloto automatizado que pueden completarse sin pagar quedan cerrados. El siguiente gasto debe ocurrir recién cuando se decida abrir Acredita a documentación sensible y operación comercial real.
