/**
 * Store efímero de proyección para UI.
 *
 * No es una base de datos ni una fuente de verdad. Todo dato de negocio debe
 * hidratarse/persistirse en Supabase; este módulo solo evita prop drilling y
 * mantiene una instantánea en memoria durante la sesión.
 */
const runtimeData = new Map<string, unknown>();

export const CORE_RUNTIME_KEYS = [
  'acredita_mandantes',
  'acredita_proyectos',
  'acredita_contratistas',
  'acredita_requisitos',
  'acredita_decision_overrides',
] as const;

const LEGACY_BUSINESS_KEYS = [
  'acredita_db_initialized',
  'acredita_schema_version',
  'acredita_mandantes',
  'acredita_proyectos',
  'acredita_contratistas',
  'acredita_requisitos',
  'acredita_invitaciones',
  'acredita_audit_logs',
] as const;

export function getRuntimeArray<T>(key: string, fallback: T[] = []): T[] {
  const value = runtimeData.get(key);
  return Array.isArray(value) ? value as T[] : fallback;
}

export function setRuntimeArray<T>(key: string, value: T[]): void {
  runtimeData.set(key, value);
}

export function clearRuntimeBusinessData(): void {
  runtimeData.clear();
}

export function purgeLegacyBusinessStorage(): void {
  if (typeof window === 'undefined') return;
  LEGACY_BUSINESS_KEYS.forEach(key => localStorage.removeItem(key));
  for (let i = localStorage.length - 1; i >= 0; i -= 1) {
    const key = localStorage.key(i);
    if (!key) continue;
    if (key.startsWith('acredita_core_supabase_migrated_v1:') || key.startsWith('acredita_operational_supabase_migrated_v1:')) {
      localStorage.removeItem(key);
    }
  }
}
