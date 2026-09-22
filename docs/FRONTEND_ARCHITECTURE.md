# Arquitectura frontend de Acredita

## Principios

1. **Supabase es la fuente de verdad operacional.**
   Los estados de acreditación, acceso, pago, trabajadores y obligaciones se derivan en backend. Una sesión autenticada nunca debe reconstruir un estado alternativo en el navegador.

2. **`businessStore.ts` es la fachada de datos de negocio del frontend.**
   Mantiene el cache efímero utilizado por la UI y coordina persistencia. No debe transformarse en un segundo backend.

3. **`businessRuntimeCache.ts` es memoria temporal.**
   No representa persistencia. Se hidrata desde Supabase y puede descartarse al cerrar sesión o resincronizar.

4. **Los shims legacy ya fueron retirados.**
   `localStorageDb.ts` y `runtimeDataStore.ts` no existen en la arquitectura vigente. El código de negocio importa desde `businessStore.ts` y el cache efímero desde `businessRuntimeCache.ts`.

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

- No reintroducir `localStorageDb.ts` ni `runtimeDataStore.ts`.
- Importar negocio desde `businessStore.ts` y memoria efímera desde `businessRuntimeCache.ts`.
- Preferir módulos especializados a ampliar `businessStore.ts`.
- No duplicar reglas SQL del backend en componentes React.
- Los cambios operacionales deben quedar persistidos antes de presentarse como definitivos.
- Las excepciones humanas no deben alterar el estado documental original.

## Fragmentación por dominio

La segunda fase de limpieza ya separó responsabilidades concretas:

- privacidad: `PrivacyAdminConfig.tsx` quedó como orquestador y los paneles viven en `PrivacyAdminPanels.tsx`;
- datos operacionales: acceso REST/tipos/fetch viven en `supabaseOperationalApi.ts`;
- Mandante: la matriz de contratistas vive en `pages/mandante/contractorsData.ts`;
- Admin: el índice y filtrado de búsqueda viven en `pages/admin/globalSearch.ts`;
- Contratista: composición de notificaciones y validación del formulario de trabajadores viven en módulos propios;
- negocio: las alertas de vigencia viven en `domain/accreditationAlerts.ts`;
- pruebas de dominio: viven fuera de `src`, bajo `tests/domain`.

Los portales y stores todavía pueden reducirse en iteraciones posteriores, pero las nuevas reglas son obligatorias: no agregar lógica de dominio a los componentes de portal, preferir módulos especializados y exigir CI/E2E verde después de cada grupo de cambios.
