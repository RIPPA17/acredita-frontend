import { restoreSupabaseSession, type SupabaseUserSession } from './supabaseAuth';
import { prepareCoreDataForSession } from './supabaseCoreData';
import { prepareOperationalDataForSession } from './supabaseOperationalData';
import { prepareReviewOperationsForSession } from './supabaseReviewOperations';
import { captureBusinessRevision, clearBusinessRevisionBaseline } from './supabaseBusinessSync';
import { clearDerivedStateCache } from './supabaseDerivedState';

/**
 * Orquesta una sincronización completa de la sesión.
 *
 * Las pantallas no deben conocer el orden de hidratación de cada repositorio.
 * Supabase es la fuente de verdad; el runtime store es solo una proyección de UI.
 */
export async function synchronizeBusinessSession(): Promise<SupabaseUserSession | null> {
  const restored = await restoreSupabaseSession();
  if (!restored) {
    clearBusinessRuntimeSession();
    return null;
  }

  await prepareCoreDataForSession(restored);
  await prepareOperationalDataForSession(restored);
  await prepareReviewOperationsForSession(restored);
  await captureBusinessRevision(restored);
  return restored;
}

export function clearBusinessRuntimeSession(): void {
  clearBusinessRevisionBaseline();
  clearDerivedStateCache();
}
