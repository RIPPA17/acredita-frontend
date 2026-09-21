# Estado de go-live — 21 septiembre 2026

## Cerrado técnicamente

- Flujo Contratista auditado 14/14.
- Navegación y módulos críticos Mandante/Acredita cubiertos por E2E.
- Revisión humana de bloqueos conectada entre Contratista y Admin.
- RLS/Storage privado y hardening previos conservados.
- Edge Functions históricas de diagnóstico/reset inspeccionadas: las utilidades antiguas permanecen neutralizadas con respuesta 410.
- Índice FK de privacy_impact_assessments.created_by presente en producción y versionado.
- CI exige audit de dependencias, TypeScript, dominio, build y E2E.

## Gates externos/manuales

- GitHub: cambiar el repositorio a privado y revisar colaboradores.
- GitHub: proteger main para exigir PR + CI.
- Confirmar MFA de administradores en GitHub, Supabase y Vercel.
- Supabase: pasar a plan de producción antes de operar comercialmente y habilitar controles/backups requeridos.
- Vercel: validar/contratar plan apto para uso comercial.
- Auth: habilitar Leaked Password Protection cuando el plan/configuración lo permita.
- Correo: configurar RESEND_API_KEY y NOTIFICATION_FROM_EMAIL para notificaciones; configurar SMTP de Auth y probar correos externos.
- Backup: ejecutar realmente una restauración aislada y aprobar RPO/RTO.

## Gates jurídicos / Ley 21.719

- EIPD de trabajadores permanece en revisión; no debe marcarse aprobada sin validación.
- Retenciones permanecen en borrador y requieren aprobación jurídica.
- Cerrar DPA/contrato Mandante–Acredita y subencargados.
- Completar inventario y garantías de transferencias internacionales.
- Completar identidad societaria/canal de contacto de la política pública.
- Ejecutar simulacro de derechos del titular e incidente con evidencia.

## Regla de lanzamiento

Hasta cerrar los gates externos y jurídicos, usar datos ficticios/demo. No cargar documentación sensible real ni declarar go-live comercial.
