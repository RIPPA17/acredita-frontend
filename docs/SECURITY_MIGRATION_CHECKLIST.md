# Acredita — Checklist de seguridad para migraciones

Este checklist es obligatorio para cualquier cambio futuro de Supabase que cree o exponga tablas, vistas, funciones RPC, buckets o políticas.

## Por qué existe

En la revisión de producción del 17-09-2026 se detectó que los privilegios por defecto del esquema `public` pueden conceder permisos amplios a roles cliente. La integración actual no tiene permisos para cambiar los `ALTER DEFAULT PRIVILEGES` del propietario de los objetos, por lo que Acredita adopta un modelo **secure-by-explicit-grant**: cada migración debe retirar permisos heredados y volver a conceder únicamente lo necesario.

## Tabla nueva en `public`

1. Crear la tabla y sus constraints.
2. Habilitar RLS inmediatamente: `alter table ... enable row level security`.
3. No considerar RLS suficiente por sí solo. Ejecutar `revoke all privileges on table ... from anon, authenticated` antes de los grants de aplicación.
4. Conceder únicamente los verbos que el cliente necesita (`select`, `insert`, `update`, `delete`) y, cuando sea posible, limitar INSERT/UPDATE por columna.
5. No conceder a roles cliente `truncate`, `references`, `trigger` ni `maintain`.
6. Crear políticas RLS específicas por operación y tenant. Evitar políticas `using (true)` salvo un caso público documentado.
7. Para UPDATE, verificar tanto `USING` como `WITH CHECK` y confirmar que existe el SELECT necesario.
8. Indexar las claves foráneas y columnas usadas de forma recurrente en autorización/filtros.
9. Ejecutar Security Advisor y Performance Advisor después de aplicar la migración.

## RPC o función nueva

1. Preferir `SECURITY INVOKER`.
2. Si una operación privilegiada necesita `SECURITY DEFINER`, mover la implementación a `private`, fijar `search_path = ''`, validar `auth.uid()` y comprobar autorización al recurso dentro de la función.
3. Un wrapper expuesto en `public` debe ser `SECURITY INVOKER` siempre que sea posible.
4. Después de crear una función en `public`, revocar ejecución heredada: `revoke all on function ... from public, anon` y conceder explícitamente solo el rol que corresponda.
5. No usar `user_metadata` como fuente de autorización.
6. Las RPC anónimas deben estar justificadas por un flujo público concreto y devolver el mínimo de datos posible.

## Storage

1. Crear buckets privados por defecto.
2. Restringir MIME y tamaño de archivos.
3. Una política de objetos debe comprobar autorización contra el recurso padre real, no solo confiar en que el usuario conozca una ruta o UUID.
4. Separar lectura de carga cuando sus condiciones sean distintas.
5. Recordar que el backup de PostgreSQL no equivale al backup de objetos de Storage.

## Canal público legítimo

Si un formulario debe funcionar sin login:

- conceder únicamente `INSERT` sobre las columnas de entrada necesarias;
- no conceder `SELECT`, `UPDATE` ni `DELETE` a `anon`;
- impedir que el cliente establezca campos internos como estado, asignación, resolución o timestamps, salvo compatibilidad explícita y acotada por RLS;
- validar formato, tamaño y valores permitidos mediante constraints/triggers/RLS;
- nunca confiar en ocultar un campo en el frontend como control de seguridad.

## Verificación obligatoria

Después de cada migración nueva:

- confirmar que todas las tablas `public` siguen con RLS;
- listar privilegios efectivos de `anon` y comprobar que solo existen los canales públicos previstos;
- listar funciones `public` ejecutables por `anon`;
- revisar buckets y políticas de `storage.objects`;
- ejecutar Security Advisor y Performance Advisor;
- sincronizar la migración exacta en `supabase/migrations/` del repositorio;
- ejecutar CI completo antes de fusionar.

## Estado base esperado de Acredita

Al cierre de esta revisión:

- ninguna tabla de aplicación en `public` está sin RLS;
- `anon` no dispone de lectura ni actualización de datos internos;
- los únicos canales anónimos de escritura son las columnas públicas de `access_requests` y `privacy_requests`;
- la única RPC pública anónima prevista es la previsualización de invitación del contratista;
- los cuatro buckets documentales son privados;
- los roles cliente no conservan privilegios `TRUNCATE`, `REFERENCES`, `TRIGGER` ni `MAINTAIN` sobre las tablas de `public`.
