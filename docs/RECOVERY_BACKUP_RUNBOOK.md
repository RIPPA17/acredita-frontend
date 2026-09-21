# Acredita — Runbook de backup y recuperación

Estado: procedimiento técnico previo al go-live. No se considera probado hasta ejecutar una restauración aislada.

## Alcance separado

### PostgreSQL
Respaldar esquema y datos de aplicación, incluyendo Auth/configuración según las capacidades del plan elegido.

### Storage
Los objetos documentales requieren un respaldo separado del backup de PostgreSQL. Mantener inventario por bucket, ruta, tamaño y checksum cuando sea viable.

### Código/configuración
- GitHub: código y migraciones.
- Vercel: configuración de despliegue y variables no secretas documentadas.
- Secretos: inventario de nombres, nunca valores en Git.

## Procedimiento de restauración controlada

1. Crear un proyecto aislado de recuperación; nunca restaurar sobre producción para probar.
2. Registrar hora de inicio.
3. Restaurar base de datos desde el backup seleccionado.
4. Restaurar/copiar objetos de Storage usando el inventario del mismo punto temporal.
5. Reconfigurar secretos únicamente desde el gestor seguro correspondiente.
6. Verificar Auth con cuentas de ensayo.
7. Ejecutar checks de RLS/Advisor.
8. Validar conteos e integridad referencial.
9. Ejecutar CI/E2E contra el entorno aislado cuando sea seguro.
10. Validar un documento ficticio: carga, lectura autorizada, rechazo/corrección/aprobación.
11. Registrar hora de recuperación funcional y pérdida máxima observada.
12. Destruir o aislar el entorno de prueba conforme a la política de retención.

## Evidencia obligatoria

- fecha y responsable;
- backup usado;
- punto de recuperación;
- tiempo observado;
- pérdida máxima observada;
- base de datos: OK/FAIL;
- Auth: OK/FAIL;
- RLS: OK/FAIL;
- Storage: OK/FAIL;
- invitación/recuperación: OK/FAIL;
- piloto ficticio: OK/FAIL;
- incidentes detectados y correcciones.

RPO y RTO deben fijarse después de una prueba real y de conocer las capacidades del plan contratado; no deben prometerse solo desde documentación.
