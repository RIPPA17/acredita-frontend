/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Link, Navigate } from 'react-router-dom';
import ErrorBoundary from './components/ErrorBoundary';
import { ProtectedRoute } from './components/ProtectedRoute';

const LandingPage = lazy(() => import('./pages/Landing'));
const AdminPortal = lazy(() => import('./pages/Admin'));
const ContratistaPortal = lazy(() => import('./pages/Contratista'));
const LoginPage = lazy(() => import('./pages/Login'));
const RegistroPage = lazy(() => import('./pages/Registro'));
const InvitacionPage = lazy(() => import('./pages/Invitacion'));
const RecuperarPasswordPage = lazy(() => import('./pages/RecuperarPassword'));
const NotFoundPage = lazy(() => import('./pages/NotFound'));
const MandanteRoute = lazy(() => import('./components/MandanteRoute'));

export default function App() {
  document.documentElement.setAttribute('data-theme', 'palette');
  const authHashType = typeof window !== 'undefined'
    ? new URLSearchParams(window.location.hash.replace(/^#/, '')).get('type')
    : null;
  const passwordSetupLink = authHashType === 'recovery' || authHashType === 'invite';
  const passwordSetupTarget = typeof window !== 'undefined' ? `/recuperar${window.location.hash}` : '/recuperar';

  return (
    <BrowserRouter>
      {(import.meta as any).env.DEV && typeof navigator !== 'undefined' && !navigator.webdriver && (
        <div className="fixed bottom-4 right-4 z-[999] flex flex-col gap-2 p-3 bg-white/90 backdrop-blur-sm border border-cream3 rounded-xl shadow-xl shadow-navy/10 text-[15.4px] max-w-[220px]">
          <div className="text-[13.2px] font-semibold text-gray-500 mb-1 tracking-wider uppercase">Vistas del Sistema</div>
          <Link to="/" className="text-navy hover:text-brown transition-colors">1. Landing Page</Link>
          <Link to="/admin" className="text-navy hover:text-brown transition-colors">2. Panel Admin</Link>
          <Link to="/mandante" className="text-navy hover:text-brown transition-colors">3. Portal Mandante</Link>
          <Link to="/contratista" className="text-navy hover:text-brown transition-colors">4. Portal Contratista</Link>
        </div>
      )}

      <ErrorBoundary>
        <Suspense fallback={<div className="min-h-screen grid place-items-center bg-cream2 text-navy" role="status">Cargando Acredita…</div>}>
          <Routes>
          <Route path="/" element={passwordSetupLink ? <Navigate to={passwordSetupTarget} replace /> : <LandingPage />} />
          <Route path="/login" element={passwordSetupLink ? <Navigate to={passwordSetupTarget} replace /> : <LoginPage />} />
          <Route path="/registro" element={<RegistroPage />} />
          <Route path="/invitacion" element={<InvitacionPage />} />
          <Route path="/recuperar" element={<RecuperarPasswordPage />} />

          <Route path="/admin/*" element={
            <ProtectedRoute allowedRoles={['admin']}>
              <AdminPortal />
            </ProtectedRoute>
          } />
          <Route path="/mandante/*" element={
            <ProtectedRoute allowedRoles={['mandante']}>
              <MandanteRoute />
            </ProtectedRoute>
          } />
          <Route path="/contratista/*" element={
            <ProtectedRoute allowedRoles={['contratista']}>
              <ContratistaPortal />
            </ProtectedRoute>
          } />
          <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </Suspense>
      </ErrorBoundary>
    </BrowserRouter>
  );
}
