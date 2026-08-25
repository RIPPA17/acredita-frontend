const runtimeData = new Map<string, unknown>();

export const CORE_RUNTIME_KEYS = [
  'acredita_mandantes',
  'acredita_proyectos',
  'acredita_contratistas',
  'acredita_requisitos',
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
  CORE_RUNTIME_KEYS.forEach(key => runtimeData.delete(key));
}

export function runtimeFingerprint(keys: readonly string[]): string {
  return keys.map(key => `${key}:${JSON.stringify(runtimeData.get(key) ?? null)}`).join('|');
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
