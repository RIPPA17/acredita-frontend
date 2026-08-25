import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { restoreSupabaseSession, type AppRole, type SupabaseUserSession } from '../data/supabaseAuth';
import { prepareCoreDataForSession, startCoreDataAutoSync } from '../data/supabaseCoreData';
import { prepareOperationalDataForSession, startOperationalDataAutoSync } from '../data/supabaseOperationalData';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles: AppRole[];
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, allowedRoles }) => {
  const location = useLocation();
  const [loading, setLoading] = React.useState(true);
  const [session, setSession] = React.useState<SupabaseUserSession | null>(null);

  React.useEffect(() => {
    let active = true;
    let stopCoreSync = () => {};
    let stopOperationalSync = () => {};
    let refreshTimer: number | undefined;

    const startSyncForSession = (current: SupabaseUserSession) => {
      stopCoreSync();
      stopOperationalSync();
      stopCoreSync = startCoreDataAutoSync(current);
      stopOperationalSync = startOperationalDataAutoSync(current);
    };

    const loadSession = async () => {
      try {
        const restored = await restoreSupabaseSession();
        if (!restored || !active) {
          if (active) setSession(null);
          return;
        }


        await prepareCoreDataForSession(restored);
        await prepareOperationalDataForSession(restored);
        if (!active) return;

        startSyncForSession(restored);
        setSession(restored);

        // Mantiene viva la sesión en jornadas largas. Cuando cambia el token,
        // reiniciamos ambos watchers para que todas las escrituras sigan
        // pasando por RLS con el JWT vigente.
        refreshTimer = window.setInterval(async () => {
          const refreshed = await restoreSupabaseSession();
          if (!active) return;
          if (!refreshed) {
            stopCoreSync();
            stopOperationalSync();
            setSession(null);
            return;
          }
          startSyncForSession(refreshed);
          setSession(refreshed);
        }, 15 * 60 * 1000);
      } catch (error) {
        console.error('No fue posible preparar la sesión de Acredita.', error);
        if (active) setSession(null);
      } finally {
        if (active) setLoading(false);
      }
    };

    void loadSession();

    return () => {
      active = false;
      stopCoreSync();
      stopOperationalSync();
      if (refreshTimer !== undefined) window.clearInterval(refreshTimer);
    };
  }, []);

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

  return <>{children}</>;
};
