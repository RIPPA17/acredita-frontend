/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import LandingPage from './pages/Landing';
import AdminPortal from './pages/Admin';
import MandantePortal from './pages/Mandante';
import ContratistaPortal from './pages/Contratista';
import LoginPage from './pages/Login';
import RegistroPage from './pages/Registro';
import ActivacionPage from './pages/Activacion';
import InvitacionPage from './pages/Invitacion';

export default function App() {
  document.documentElement.setAttribute('data-theme', 'palette');

  return (
    <BrowserRouter>
      {(import.meta as any).env.DEV && (
        <div className="fixed bottom-4 right-4 z-[999] flex flex-col gap-2 p-3 bg-white/90 backdrop-blur-sm border border-cream3 rounded-xl shadow-xl shadow-navy/10 text-[15.4px] max-w-[220px]">
          <div className="text-[13.2px] font-semibold text-gray-500 mb-1 tracking-wider uppercase">Vistas del Sistema</div>
          <Link to="/" className="text-navy hover:text-brown transition-colors">1. Landing Page</Link>
          <Link to="/admin" className="text-navy hover:text-brown transition-colors">2. Panel Admin</Link>
          <Link to="/mandante" className="text-navy hover:text-brown transition-colors">3. Portal Mandante</Link>
          <Link to="/contratista" className="text-navy hover:text-brown transition-colors">4. Portal Contratista</Link>
        </div>
      )}

      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/registro" element={<RegistroPage />} />
        <Route path="/activacion" element={<ActivacionPage />} />
        <Route path="/invitacion" element={<InvitacionPage />} />
        <Route path="/admin/*" element={<AdminPortal />} />
        <Route path="/mandante/*" element={<MandantePortal />} />
        <Route path="/contratista/*" element={<ContratistaPortal />} />
      </Routes>
    </BrowserRouter>
  );
}
