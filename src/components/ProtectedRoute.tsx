import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { restoreSupabaseSession, type AppRole, type SupabaseUserSession } from '../data/supabaseAuth';
import { prepareCoreDataForSession } from '../data/supabaseCoreData';
import { prepareOperationalDataForSession } from '../data/supabaseOperationalData';
import { prepareReviewOperationsForSession } from '../data/supabaseReviewOperations';
import { DataSyncProvider } from './DataSyncContext';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles: AppRole[];
}

const AUTO_SYNC_THROTTLE_MS = 30 * 1000;

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, allowedRoles }) => {
  const location = useLocation();
  const [loading, setLoading] = React.useState(true);
  const [session, setSession] = React.useState<SupabaseUserSession | null>(null);
  const [revision, setRevision] = React.useState(0);
  const [syncing, setSyncing] = React.useState(false);
  const [lastSyncedAt, setLastSyncedAt] = React.useState<number | null>(null);
  const activeRef = React.useRef(true);
  const syncInFlightRef = React.useRef<Promise<boolean> | null>(null);
  const lastAutoSyncRef = React.useRef(0);

  const synchronizeBusinessData = React.useCallback(async (): Promise<boolean> => {
    if (syncInFlightRef.current) return syncInFlightRef.current;

    const task = (async () => {
      if (activeRef.current) setSyncing(true);
      try {
        const restored = await restoreSupabaseSession();
        if (!restored) {
          if (activeRef.current) setSession(null);
          return false;
        }

        await prepareCoreDataForSession(restored);
        await prepareOperationalDataForSession(restored);
        await prepareReviewOperationsForSession(restored);
        if (!activeRef.current) return false;

        setSession(restored);
        setRevision(value => value + 1);
        setLastSyncedAt(Date.now());
        return true;
      } catch (error) {
        console.error('No fue posible sincronizar los datos de Acredita.', error);
        return false;
      } finally {
        if (activeRef.current) setSyncing(false);
        syncInFlightRef.current = null;
      }
    })();

    syncInFlightRef.current = task;
    return task;
  }, []);

  React.useEffect(() => {
    activeRef.current = true;
    let refreshTimer: number | undefined;

    const loadSession = async () => {
      try {
        await synchronizeBusinessData();
        if (!activeRef.current) return;

        lastAutoSyncRef.current = Date.now();
        refreshTimer = window.setInterval(async () => {
          const refreshed = await restoreSupabaseSession();
          if (!activeRef.current) return;
          if (!refreshed) {
            setSession(null);
            return;
          }
          setSession(refreshed);
        }, 15 * 60 * 1000);
      } finally {
        if (activeRef.current) setLoading(false);
      }
    };

    void loadSession();

    return () => {
      activeRef.current = false;
      if (refreshTimer !== undefined) window.clearInterval(refreshTimer);
    };
  }, [synchronizeBusinessData]);

  React.useEffect(() => {
    const refreshWhenVisible = () => {
      if (!activeRef.current || document.visibilityState !== 'visible') return;
      const now = Date.now();
      if (now - lastAutoSyncRef.current < AUTO_SYNC_THROTTLE_MS) return;
      lastAutoSyncRef.current = now;
      void synchronizeBusinessData();
    };

    window.addEventListener('focus', refreshWhenVisible);
    document.addEventListener('visibilitychange', refreshWhenVisible);
    return () => {
      window.removeEventListener('focus', refreshWhenVisible);
      document.removeEventListener('visibilitychange', refreshWhenVisible);
    };
  }, [synchronizeBusinessData]);

  const syncContextValue = React.useMemo(() => ({
    revision,
    syncing,
    lastSyncedAt,
    refreshNow: synchronizeBusinessData,
  }), [lastSyncedAt, revision, syncing, synchronizeBusinessData]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#faf9f8] text-navy">
        <div className="text-center">
          <div className="text-[20px] font-semibold mb-2">Acredita</div>
          <div className="text-[13px] text-gray-500">Sincronizando datos seguros…</div>
        </div>
      </div>
    );
  }

  if (!session) {
    const next = encodeURIComponent(`${location.pathname}${location.search}`);
    return <Navigate to={`/login?next=${next}`} replace />;
  }

  if (!allowedRoles.includes(session.role)) {
    const home = session.role === 'admin' ? '/admin' : session.role === 'mandante' ? '/mandante' : '/contratista';
    return <Navigate to={home} replace />;
  }

  return <DataSyncProvider value={syncContextValue}>{children}</DataSyncProvider>;
};
