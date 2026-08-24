import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { restoreSupabaseSession, type AppRole, type SupabaseUserSession } from '../data/supabaseAuth';

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

    restoreSupabaseSession()
      .then((restored) => {
        if (active) setSession(restored);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#faf9f8] text-navy">
        <div className="text-center">
          <div className="text-[20px] font-semibold mb-2">Acredita</div>
          <div className="text-[13px] text-gray-500">Verificando sesión segura…</div>
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
