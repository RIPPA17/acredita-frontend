import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

type PortalName = 'admin' | 'mandante' | 'contratista';

type PortalConfig = {
  defaultTab: string;
  routes: Record<string, string>;
};

const PORTAL_CONFIG: Record<PortalName, PortalConfig> = {
  admin: {
    defaultTab: 'dashboard',
    routes: {
      dashboard: '',
      cola: 'cola',
      acreditaciones: 'acreditaciones',
      mandantes: 'mandantes',
      contratistas: 'contratistas',
      proyectos: 'proyectos',
      verificadores: 'verificadores',
      auditoria: 'auditoria',
      configuracion: 'configuracion',
    },
  },
  mandante: {
    defaultTab: 'dashboard',
    routes: {
      dashboard: '',
      proyectos: 'proyectos',
      contratistas: 'contratistas',
      config: 'configuracion',
    },
  },
  contratista: {
    defaultTab: 'dashboard',
    routes: {
      dashboard: '',
      proyectos: 'proyectos',
      subir: 'documentos',
      trabajadores: 'trabajadores',
      config: 'configuracion',
    },
  },
};

export function usePortalTab(portal: PortalName): [string, React.Dispatch<React.SetStateAction<string>>] {
  const location = useLocation();
  const navigate = useNavigate();
  const config = PORTAL_CONFIG[portal];

  const pathParts = location.pathname.split('/').filter(Boolean);
  const segment = pathParts[0] === portal ? (pathParts[1] || '') : '';
  const matchingEntry = Object.entries(config.routes).find(([, routeSegment]) => routeSegment === segment);
  const activeTab = matchingEntry?.[0] || config.defaultTab;
  const validSegment = matchingEntry !== undefined;

  React.useEffect(() => {
    if (validSegment) return;
    navigate({ pathname: `/${portal}`, search: location.search }, { replace: true });
  }, [location.search, navigate, portal, validSegment]);

  const setActiveTab = React.useCallback<React.Dispatch<React.SetStateAction<string>>>((nextValue) => {
    const nextTab = typeof nextValue === 'function' ? nextValue(activeTab) : nextValue;
    const nextSegment = config.routes[nextTab] ?? config.routes[config.defaultTab];
    const pathname = nextSegment ? `/${portal}/${nextSegment}` : `/${portal}`;
    navigate({ pathname, search: location.search });
  }, [activeTab, config, location.search, navigate, portal]);

  return [activeTab, setActiveTab];
}
