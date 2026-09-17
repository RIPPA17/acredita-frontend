# Acredita — Runbook de piloto cerrado

Última revisión: 2026-09-17 (Chile).

## Objetivo

Validar Acredita con un piloto controlado antes de operar con documentación sensible real. El piloto debe probar Mandante → Contratista → trabajadores → carga → revisión → rechazo/corrección → aprobación → acreditación, manteniendo trazabilidad y separación entre datos demo y datos reales.

## Entorno de ensayo disponible

Proyecto demo interno existente:
- Proyecto: `PILOTO INTERNO - Acredita`.
- Mandante demo: `Constructora Andina SA`.
- Contratista demo: `Servicios Norte`.
- 5 trabajadores asignados.
- 4 requisitos activos.
- 0 documentos cargados al momento de esta revisión.

Este entorno es adecuado para ensayar el flujo sin usar información real.

## Separación de datos

Las tablas `mandantes`, `contratistas`, `projects` y `workers` incluyen `data_environment` con valores permitidos:
- `demo`
- `pilot`
- `production`

Todo el dataset existente al aplicar la migración `20260917030839_classify_demo_and_production_data` quedó marcado como `demo`. Los registros nuevos nacen como `production` por defecto. Cuando se cree un piloto real, debe etiquetarse explícitamente como `pilot` hasta que el go-live sea aprobado.

## Gate de entrada para datos reales

No cargar documentos sensibles reales hasta cumplir todos estos puntos:

- [ ] Plan de Supabase con backups recuperables o backup externo probado.
- [ ] Estrategia separada de respaldo/retención para archivos de Storage.
- [ ] Custom SMTP configurado y probado con dominios externos reales.
- [ ] Leaked Password Protection habilitado o control compensatorio formalmente aceptado.
- [ ] MFA habilitado para administradores de Supabase, GitHub y Vercel.
- [ ] Repositorio y accesos administrativos revisados.
- [ ] Responsable operativo del piloto definido.
- [ ] Procedimiento de incidente y contacto de privacidad disponible.

## Ensayo funcional previo

Usar exclusivamente el proyecto `PILOTO INTERNO - Acredita`.

1. Confirmar 5/5 trabajadores asignados.
2. Cargar documentos ficticios de empresa y trabajador.
3. Revisar desde Admin/Acredita.
4. Rechazar al menos un documento con motivo y solución.
5. Corregir desde Contratista.
6. Aprobar la nueva versión.
7. Confirmar cambio de estado del trabajador y de la acreditación global.
8. Confirmar bloqueo por vencimiento/rechazo obligatorio.
9. Confirmar que Mandante solo ve sus proyectos y Contratista solo sus recursos.
10. Confirmar auditoría de vista/descarga/revisión.

## Ensayo de onboarding

Antes de invitar un cliente real:
- probar invitación Mandante con un correo controlado;
- probar invitación Contratista con un correo controlado;
- validar link de activación, contraseña fuerte y recuperación;
- comprobar que los enlaces redirigen a `https://acredita-frontend.vercel.app`;
- comprobar entrega real y spam con custom SMTP.

## Backups y recuperación

Objetivo inicial recomendado para piloto:
- RPO: máximo 24 horas mientras se usen backups diarios; menor si se habilita PITR.
- RTO inicial: 4 horas para restaurar servicio o declarar contingencia manual.

La prueba de restauración debe registrar fecha, responsable, origen del backup, tiempo de restauración, pérdida máxima observada y validación posterior de Auth, RLS, documentos y Storage.

Los backups de PostgreSQL no restauran por sí solos archivos borrados de Supabase Storage. La estrategia de archivos debe probarse separadamente.

## Funciones de prueba

Las utilidades Edge de E2E/debug desplegadas durante desarrollo deben permanecer neutralizadas en producción (respuesta 410 y JWT cuando corresponda). Las únicas funciones operativas que deben seguir activas son las necesarias para onboarding/invitaciones y otros flujos productivos versionados.

## Criterio de aprobación del piloto

El piloto puede comenzar con datos reales limitados solo cuando los gates de infraestructura estén cerrados. El paso a producción comercial requiere además una ejecución completa del ensayo funcional, cero fallas críticas abiertas, revisión de permisos y una prueba de recuperación documentada.
