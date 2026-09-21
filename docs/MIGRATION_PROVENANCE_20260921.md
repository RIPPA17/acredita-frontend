# Acredita — Proveniencia de migraciones Supabase

Fecha de reconciliación: 2026-09-21.

## Qué se corrigió

Se comparó el historial remoto de Supabase con los archivos versionados del repositorio.

- Se renombraron 21 archivos cuyo SQL estaba versionado pero el timestamp del nombre no coincidía con la versión registrada por Supabase.
- Se recuperaron las migraciones de privacidad/revisión humana del PR histórico #70.
- Se recuperaron las migraciones de activos v2 del PR histórico #83.
- Se formalizó como migración remota `worker_lifecycle_v2_reconciled`, cuyos objetos ya existían en producción.
- Se agregó la migración de índice `index_privacy_impact_created_by_v1`.
- No se recreó ningún SQL histórico por inferencia.

## Migraciones remotas cuyo SQL exacto no está disponible en commits accesibles

Estas versiones existen en el historial de Supabase pero no se localizaron en commits/ramas accesibles de GitHub:

- 20260824205928_core_schema_v1.sql
- 20260824210931_core_schema_v2.sql
- 20260824211009_core_schema_v2_policy_cleanup.sql
- 20260824211528_enable_pg_net.sql
- 20260824215858_core_schema_v3_integration_keys.sql
- 20260824221041_core_data_seed_and_requirement_keys.sql
- 20260824223951_document_storage_v1.sql
- 20260824224332_document_storage_metadata_guard_v1.sql
- 20260825022924_review_operations_v1.sql
- 20260825023122_access_requests_v1.sql
- 20260825024126_review_operations_v2.sql
- 20260825165627_access_requests_demo_intent_v1.sql
- 20260825165759_access_requests_demo_rut_optional_v1.sql
- 20260915225448_seed_boliche_terrible_pollo_demo_profiles_v2.sql
- 20260917022405_document_access_audit_v1.sql
- 20260917022458_storage_access_audit_v2.sql
- 20260920235857_payment_state_lifecycle_v1.sql
- 20260921000231_payment_state_lifecycle_v2.sql
- 20260921000324_payment_state_lifecycle_v3.sql
- 20260921000706_payment_state_lifecycle_v4.sql

## Consecuencia

El estado productivo actual sí está verificado por Supabase y por la CI, pero una reconstrucción “desde cero” usando exclusivamente el directorio de migraciones no debe darse por garantizada mientras falte el SQL exacto de esas versiones históricas.

Para una línea base reproducible antes de un cambio mayor de infraestructura:

1. generar un schema dump del entorno productivo;
2. guardar el dump cifrado fuera del repositorio;
3. probar restauración en un proyecto aislado;
4. conservar este listado como evidencia de la etapa histórica;
5. desde esta reconciliación en adelante, versionar cada migración con el timestamp exacto devuelto por Supabase.

Nunca fabricar una migración histórica solo para hacer coincidir la lista.
