import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldCheck } from 'lucide-react';

export default function ActivacionPage() {
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errorPassword, setErrorPassword] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      setErrorPassword(true);
      return;
    }
    setErrorPassword(false);
    navigate('/mandante');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-cream2 p-4">
      <div className="card w-full max-w-[440px] p-8 text-center flex flex-col items-center">
        <div className="text-[28px] text-navy tracking-[2px] font-medium mb-6">
          Acre<b className="text-brown font-normal">dita</b>
        </div>
        
        <div className="badge b-green bg-green-100 text-green-800 mb-6 flex items-center gap-1">
          <ShieldCheck size={14} /> Cuenta verificada por Acredita
        </div>
        
        <h2 className="text-[24px] text-navy font-semibold mb-1">Activa tu cuenta</h2>
        <p className="text-sm text-gray-500 mb-8">jorge@constructora.cl</p>

        <form onSubmit={handleSubmit} className="w-full flex flex-col gap-4 text-left">
          <div>
            <label className="block text-[13.2px] font-medium text-gray-700 mb-1.5">Contraseña</label>
            <input 
              type="password" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="form-input w-full p-2.5 border border-cream3 rounded-lg focus:border-brown focus:ring-1 focus:ring-brown outline-none transition-all" 
              placeholder="••••••••" 
              required 
            />
          </div>
          <div>
            <label className="block text-[13.2px] font-medium text-gray-700 mb-1.5">Repetir contraseña</label>
            <input 
              type="password" 
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="form-input w-full p-2.5 border border-cream3 rounded-lg focus:border-brown focus:ring-1 focus:ring-brown outline-none transition-all" 
              placeholder="••••••••" 
              required 
            />
            {errorPassword && (
              <div className="text-red-500 text-xs mt-1">Las contraseñas no coinciden</div>
            )}
          </div>
          
          <button type="submit" className="btn btn-primary w-full justify-center py-2.5 text-[15.4px] mt-4">
            Activar y entrar
          </button>
        </form>
      </div>
    </div>
  );
}
