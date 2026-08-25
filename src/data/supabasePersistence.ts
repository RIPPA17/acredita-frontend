import type { SupabaseUserSession } from './supabaseAuth';
import { getStoredSupabaseSession, getSupabaseSessionForRequest } from './supabaseAuth';
import { hydrateCoreDataFromSupabase, pushCoreDataToSupabase } from './supabaseCoreData';
import { hydrateOperationalDataFromSupabase, pushOperationalDataToSupabase } from './supabaseOperationalData';
import { refreshDerivedStateCache } from './supabaseDerivedState';

export type BusinessPersistenceScope = 'core' | 'operational' | 'all';

let wantsCore = false;
let wantsOperational = false;
let scheduled = false;
let pendingSession: SupabaseUserSession | null = null;
let writeChain: Promise<void> = Promise.resolve();
let lastPersistenceError: unknown = null;

async function persistBatch(core: boolean, operational: boolean, sessionHint: SupabaseUserSession | null): Promise<void> {
  const session = await getSupabaseSessionForRequest(sessionHint);
  if (!session) throw new Error('La sesión expiró antes de guardar los cambios.');
  if (core) await pushCoreDataToSupabase(session);
  if (operational) await pushOperationalDataToSupabase(session);
  if (core || operational) await refreshDerivedStateCache(session);
}

function enqueuePendingBatch(): void {
  const core = wantsCore;
  const operational = wantsOperational;
  const session = pendingSession;
  wantsCore = false;
  wantsOperational = false;
  pendingSession = null;
  if (!core && !operational) return;
  writeChain = writeChain
    .then(() => persistBatch(core, operational, session))
    .catch((error) => {
      lastPersistenceError = error;
      console.error('Error persistiendo cambio de negocio en Supabase.', error);
    });
}

export function requestBusinessPersistence(scope: BusinessPersistenceScope): void {
  if (typeof window === 'undefined') return;
  const session = getStoredSupabaseSession();
  if (!session) return;
  if (pendingSession && pendingSession.profileId !== session.profileId) {
    scheduled = false;
    enqueuePendingBatch();
  }
  pendingSession = session;
  if (scope === 'core' || scope === 'all') wantsCore = true;
  if (scope === 'operational' || scope === 'all') wantsOperational = true;
  if (scheduled) return;
  scheduled = true;
  Promise.resolve().then(() => {
    if (!scheduled) return;
    scheduled = false;
    enqueuePendingBatch();
  });
}

export async function flushBusinessPersistence(): Promise<void> {
  if (scheduled || wantsCore || wantsOperational) {
    scheduled = false;
    enqueuePendingBatch();
  }
  await writeChain;
  if (lastPersistenceError) {
    const error = lastPersistenceError;
    lastPersistenceError = null;
    throw error;
  }
}

async function restoreBusinessState(scope: BusinessPersistenceScope, session: SupabaseUserSession): Promise<void> {
  if (scope === 'core' || scope === 'all') await hydrateCoreDataFromSupabase(session);
  if (scope === 'operational' || scope === 'all') await hydrateOperationalDataFromSupabase(session);
  await refreshDerivedStateCache(session);
}

/**
 * Espera a que los cambios ya encolados lleguen a Supabase antes de que la UI
 * informe éxito. Si la escritura falla, vuelve a hidratar desde el backend para
 * retirar cualquier estado optimista que solo existía en memoria.
 */
export async function confirmBusinessPersistence(scope: BusinessPersistenceScope): Promise<void> {
  const session = await getSupabaseSessionForRequest(getStoredSupabaseSession());
  if (!session) throw new Error('Tu sesión expiró. Vuelve a iniciar sesión para guardar cambios.');

  requestBusinessPersistence(scope);
  try {
    await flushBusinessPersistence();
  } catch (error) {
    try {
      await restoreBusinessState(scope, session);
    } catch (recoveryError) {
      console.error('No fue posible restaurar el estado desde Supabase tras un fallo de persistencia.', recoveryError);
    }
    throw error;
  }
}
