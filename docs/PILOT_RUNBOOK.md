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

La auditoría directa de Supabase confirmó 1 proyecto, 1 Mandante, 1 Contratista, 1 acreditación activa, 5 trabajadores activos asignados, 4 requisitos activos y 0 documentos. Proyecto, Contratista y trabajadores están clasificados como `demo` y no se detectaron relaciones huérfanas en asignaciones, acreditaciones, requisitos, documentos o versiones.

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
- [ ] Repositorio privado y accesos administrativos revisados.
- [ ] `main` protegida con PR + CI verde.
- [ ] Responsable operativo del piloto real definido.
- [ ] Procedimiento de incidente y contacto de privacidad disponible.

## Ensayo funcional automatizado — completado

El flujo previo al upgrade ya está cubierto por tests de dominio y E2E permanentes:

- [x] 5/5 trabajadores del entorno piloto verificados en Supabase.
- [x] Carga de documento ficticio desde el requisito exacto.
- [x] Revisión desde Admin/Acredita.
- [x] Rechazo con motivo, explicación y solución.
- [x] Visualización del rechazo por Contratista.
- [x] Acción `Corregir` abre selector de archivo y carga un PDF corregido.
- [x] La corrección genera versión 2 en estado de revisión.
- [x] Aprobación de la versión corregida con checklist mínimo.
- [x] La empresa solo queda `Aprobado` cuando empresa y 100% de trabajadores cumplen.
- [x] Un segundo trabajador pendiente mantiene la acreditación global `En proceso`.
- [x] Un requisito `bloquea_pago` vencido bloquea el pago sin bloquear el acceso si los controles de acceso siguen vigentes.
- [x] Un documento obligatorio del trabajador vencido inhabilita al trabajador y deja la acreditación global `Vencido/Bloqueado`.
- [x] Separación de roles y navegación Mandante/Contratista cubierta por E2E.
- [x] Admin, Mandante y Contratista cubiertos en 1366×768 y 390×844 sin desborde horizontal global.
- [x] Recuperación de contraseña, activación/invitación y solicitudes públicas forman parte de la suite E2E.

Estos ensayos utilizan datos y archivos ficticios controlados. No requieren cargar documentación sensible real en el proyecto productivo.

## Ensayo manual opcional antes del primer cliente

Cuando las cuentas administrativas estén listas, puede repetirse el mismo guion en `PILOTO INTERNO - Acredita` usando exclusivamente PDFs ficticios. Esta repetición manual sirve como aceptación operativa, no como sustituto de los gates de infraestructura.

## Ensayo de onboarding

La lógica de invitación, activación y recuperación está cubierta por pruebas automatizadas. Antes de invitar un cliente real todavía debe comprobarse la entrega externa con el correo transaccional definitivo:
- probar invitación Mandante con un correo controlado;
- probar invitación Contratista con un correo controlado;
- validar link de activación, contraseña fuerte y recuperación;
- comprobar que los enlaces redirigen a `https://acredita-frontend.vercel.app`;
- comprobar entrega real y spam con Custom SMTP.

## Backups y recuperación

Objetivo inicial recomendado para piloto:
- RPO: máximo 24 horas mientras se usen backups diarios; menor si se habilita PITR.
- RTO inicial: 4 horas para restaurar servicio o declarar contingencia manual.

La prueba de restauración debe registrar fecha, responsable, origen del backup, tiempo de restauración, pérdida máxima observada y validación posterior de Auth, RLS, documentos y Storage.

Los backups de PostgreSQL no restauran por sí solos archivos borrados de Supabase Storage. La estrategia de archivos debe probarse separadamente.

## Funciones de prueba

Las utilidades Edge de E2E/debug desplegadas durante desarrollo deben permanecer neutralizadas en producción. Las funciones productivas de invitación/onboarding permanecen separadas de esas utilidades y deben conservar sus controles de autenticación o token.

## Criterio de aprobación del piloto

El desarrollo y el ensayo automatizado previo al upgrade están cerrados. El paso a un piloto con datos reales limitados requiere cerrar los gates de infraestructura y cuenta indicados arriba. El go-live comercial exige además prueba de recuperación, correo transaccional real, repositorio privado/protegido y cero fallas críticas abiertas.
