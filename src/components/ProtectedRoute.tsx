import React from 'react';
import { Navigate } from 'react-router-dom';
import { getCurrentSession } from '../data/localStorageDb';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles: Array<'admin' | 'mandante' | 'contratista'>;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, allowedRoles }) => {
  const session = getCurrentSession();
  
  if (!session) {
    // Redirect to login if not authenticated
    return <Navigate to="/login" replace />;
  }
  
  if (!allowedRoles.includes(session.role)) {
    // Redirige al login si el rol no es el adecuado
    return <Navigate to="/login" replace />;
  }
  
  return <>{children}</>;
};
