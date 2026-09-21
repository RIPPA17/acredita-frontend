# Arquitectura frontend de Acredita

## Principios

1. **Supabase es la fuente de verdad operacional.**
   Los estados de acreditación, acceso, pago, trabajadores y obligaciones se derivan en backend. Una sesión autenticada nunca debe reconstruir un estado alternativo en el navegador.

2. **`businessStore.ts` es la fachada de datos de negocio del frontend.**
   Mantiene el cache efímero utilizado por la UI y coordina persistencia. No debe transformarse en un segundo backend.

3. **`businessRuntimeCache.ts` es memoria temporal.**
   No representa persistencia. Se hidrata desde Supabase y puede descartarse al cerrar sesión o resincronizar.

4. **`localStorageDb.ts` y `runtimeDataStore.ts` son shims de compatibilidad.**
   No deben recibir nuevas dependencias. Se eliminarán cuando los últimos imports legados hayan migrado.

5. **localStorage se reserva para preferencias de UI o sesión cuando corresponda.**
   No se deben guardar allí documentos, acreditaciones, trabajadores, requisitos, pagos u otros datos de negocio.

6. **Reglas puras viven fuera de los portales.**
   Ejemplo: fechas, vigencias y comparación documental están en `src/domain/documentRules.ts`.

## Flujo de lectura

```
Supabase / vistas derivadas
        ↓
prepare*DataForSession
        ↓
businessRuntimeCache
        ↓
businessStore / módulos de dominio
        ↓
componentes React
```

## Flujo de escritura

```
UI
 ↓
businessStore / módulo especializado
 ↓
supabasePersistence o API específica
 ↓
Supabase
 ↓
refresh / derived state
 ↓
businessRuntimeCache
```

## Estados de acreditación

Durante una sesión autenticada:

- `accreditation_statuses` define el estado global.
- `worker_accreditation_statuses` define el estado del trabajador.
- Las compuertas de acceso/pago utilizan el estado derivado backend.
- Si el estado backend no está disponible, la UI debe quedar **pendiente**, nunca asumir aprobación.

El cálculo local heredado solo se conserva temporalmente para pruebas sin sesión autenticada.

## Reglas para nuevos cambios

- No importar desde `localStorageDb.ts` en código nuevo.
- No importar desde `runtimeDataStore.ts` en código nuevo.
- Preferir módulos especializados a ampliar `businessStore.ts`.
- No duplicar reglas SQL del backend en componentes React.
- Los cambios operacionales deben quedar persistidos antes de presentarse como definitivos.
- Las excepciones humanas no deben alterar el estado documental original.

## Próxima fragmentación

Los siguientes archivos deben seguir reduciéndose progresivamente:

- `src/pages/Contratista.tsx`
- `src/pages/Admin.tsx`
- `src/pages/Mandante.tsx`
- `src/data/businessStore.ts`
- `src/data/supabaseOperationalData.ts`
- `src/pages/admin/configuracion/PrivacyAdminConfig.tsx`

La fragmentación debe hacerse por dominio y con CI/E2E verde después de cada grupo de cambios.
