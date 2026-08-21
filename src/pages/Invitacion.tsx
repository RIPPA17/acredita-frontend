import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle } from 'lucide-react';
import { getInvitaciones } from '../data/localStorageDb';

export default function InvitacionPage() {
  const navigate = useNavigate();
  const [tieneCuenta, setTieneCuenta] = useState<boolean | null>(null);

  const searchParams = new URLSearchParams(window.location.search);
  const invId = searchParams.get('id');
  
  const allInvs = getInvitaciones();
  const activeInv = invId 
    ? allInvs.find(i => i.id === invId && i.estado === 'pendiente') 
    : allInvs.find(i => i.estado === 'pendiente');

  const mandanteNombre = activeInv ? activeInv.mandanteNombre : 'Constructora Andina SA';
  const proyectoNombre = activeInv ? activeInv.proyectoNombre : 'Proyecto Costanera Norte';

  return (
    <div className="min-h-screen flex items-center justify-center bg-cream2 p-4">
      <div className="card w-full max-w-[480px] p-8">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="text-[22px] tracking-[2px] text-navy mb-1">Acre<b className="text-brown font-normal">dita</b></div>
          <span className="badge b-blue">Nueva invitación</span>
        </div>

        {/* Detalle del proyecto */}
        <div className="bg-cream2 rounded-xl p-4 mb-6">
          <p className="text-sm text-gray-500 mb-1">Te invita</p>
          <p className="font-semibold text-navy">{mandanteNombre}</p>
          <p className="text-sm text-gray-500 mt-3 mb-1">Proyecto</p>
          <p className="font-medium">{proyectoNombre}</p>
          <p className="text-sm text-gray-500 mt-3 mb-2">Documentos requeridos</p>
          <div className="flex flex-col gap-1.5">
            {['Contrato de trabajo', 'Seguro de accidentes', 'Certificado antecedentes'].map(doc => (
              <div key={doc} className="flex items-center gap-2 text-sm">
                <CheckCircle size={14} className="text-green-500 shrink-0"/> {doc}
              </div>
            ))}
          </div>
        </div>

        {tieneCuenta === null && (
          <>
            <p className="text-center text-sm text-gray-500 mb-4">¿Ya tienes cuenta en Acredita?</p>
            <div className="flex gap-3 mb-6">
              <button className="btn btn-secondary flex-1" onClick={() => setTieneCuenta(false)}>No, crear cuenta</button>
              <button className="btn btn-primary flex-1" onClick={() => setTieneCuenta(true)}>Sí, ingresar</button>
            </div>
          </>
        )}

        {tieneCuenta === true && (
          <form className="flex flex-col gap-4 mb-6" onSubmit={(e) => { e.preventDefault(); navigate('/contratista'); }}>
            <div>
              <label className="block text-[13.2px] font-medium text-gray-700 mb-1.5">Correo</label>
              <input type="email" required className="form-input w-full p-2.5 border border-cream3 rounded-lg outline-none focus:border-brown focus:ring-1 focus:ring-brown" placeholder="tu@empresa.cl" />
            </div>
            <div>
              <label className="block text-[13.2px] font-medium text-gray-700 mb-1.5">Contraseña</label>
              <input type="password" required className="form-input w-full p-2.5 border border-cream3 rounded-lg outline-none focus:border-brown focus:ring-1 focus:ring-brown" placeholder="••••••••" />
            </div>
            <button type="submit" className="btn btn-primary w-full justify-center mt-2">Entrar y aceptar invitación</button>
          </form>
        )}

        {tieneCuenta === false && (
          <form className="flex flex-col gap-4 mb-6" onSubmit={(e) => { e.preventDefault(); navigate('/contratista'); }}>
            <div>
              <label className="block text-[13.2px] font-medium text-gray-700 mb-1.5">Nombre completo</label>
              <input type="text" required className="form-input w-full p-2.5 border border-cream3 rounded-lg outline-none focus:border-brown focus:ring-1 focus:ring-brown" placeholder="Tu nombre" />
            </div>
            <div>
              <label className="block text-[13.2px] font-medium text-gray-700 mb-1.5">Correo</label>
              <input type="email" required className="form-input w-full p-2.5 border border-cream3 rounded-lg outline-none focus:border-brown focus:ring-1 focus:ring-brown" placeholder="tu@empresa.cl" />
            </div>
            <div>
              <label className="block text-[13.2px] font-medium text-gray-700 mb-1.5">Contraseña</label>
              <input type="password" required className="form-input w-full p-2.5 border border-cream3 rounded-lg outline-none focus:border-brown focus:ring-1 focus:ring-brown" placeholder="••••••••" />
            </div>
            <div>
              <label className="block text-[13.2px] font-medium text-gray-700 mb-1.5">Repetir contraseña</label>
              <input type="password" required className="form-input w-full p-2.5 border border-cream3 rounded-lg outline-none focus:border-brown focus:ring-1 focus:ring-brown" placeholder="••••••••" />
            </div>
            <button type="submit" className="btn btn-primary w-full justify-center mt-2">Crear cuenta y aceptar</button>
          </form>
        )}

        <div className="text-center mt-4">
          <button onClick={() => navigate('/')} className="text-xs text-gray-400 hover:text-gray-600 font-medium tracking-wide">Rechazar invitación</button>
        </div>
      </div>
    </div>
  );
}
