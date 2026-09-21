# Runbook de backup y recuperación — Acredita

Estado: preparado para ejecución al contratar los controles de producción necesarios.

## Alcance

Se deben respaldar y recuperar por separado:

- Base PostgreSQL de Supabase.
- Objetos de Supabase Storage (documentos y evidencias).
- Código, migraciones y configuración versionada en GitHub.
- Variables/secretos de producción mediante inventario seguro, sin almacenarlos en el repositorio.

## Objetivos que deben aprobarse antes del go-live

- **RPO:** pérdida máxima de datos tolerable, expresada en tiempo.
- **RTO:** tiempo máximo aceptable para recuperar el servicio.
- Responsable de autorizar una restauración.
- Responsable de validar integridad documental después de restaurar.

## Prueba de restauración obligatoria

1. Elegir un respaldo no productivo o mecanismo de recuperación permitido por el plan contratado.
2. Restaurar en un entorno aislado.
3. Verificar conteos e integridad de proyectos, acreditaciones, trabajadores, requisitos, documentos y versiones.
4. Verificar que los objetos de Storage referenciados por versiones existan.
5. Ejecutar pruebas de autenticación, RLS y descarga autorizada.
6. Registrar fecha, duración, resultado, RPO observado y RTO observado.
7. No reemplazar producción durante el ejercicio.

## Evidencia de cierre

La prueba sólo se considera cerrada cuando exista un registro con resultado exitoso y los valores RPO/RTO aprobados. La existencia de este runbook no equivale a haber ejecutado la restauración.
