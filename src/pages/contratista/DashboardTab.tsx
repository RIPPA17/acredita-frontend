import { CheckCircle, X, AlertCircle, XCircle, AlertTriangle, Clock, Users, ArrowRight } from 'lucide-react';
import { calcularEstadoAcreditacion } from '../../data/localStorageDb';
import { Contratista, Proyecto, Documento } from '../../types';

export default function DashboardTab({
  contratistaLogueado,
  selectedProyectoId,
  setSelectedProyectoId,
  misProyectos,
  allMandantes,
  showWelcomeAlert,
  setShowWelcomeAlert,
  documentosData,
  trabajadoresData,
  numAprobados,
  numRechazados,
  numPendientes,
  numPorVencer,
  approvedWorkers,
  totalWorkers,
  pendingWorkers,
  setActiveTab,
  setSelectedDocumentForPanel,
  setFichaTipo,
  setFichaTrabajador,
  setShowFichaAcreditacion,
}: {
  contratistaLogueado: Contratista;
  selectedProyectoId: string;
  setSelectedProyectoId: (id: string) => void;
  misProyectos: Proyecto[];
  allMandantes: any[];
  showWelcomeAlert: boolean;
  setShowWelcomeAlert: (v: boolean) => void;
  documentosData: Documento[];
  trabajadoresData: any[];
  numAprobados: number;
  numRechazados: number;
  numPendientes: number;
  numPorVencer: number;
  approvedWorkers: number;
  totalWorkers: number;
  pendingWorkers: number;
  setActiveTab: (v: string) => void;
  setSelectedDocumentForPanel: (d: Documento | null) => void;
  setFichaTipo: (v: 'empresa' | 'trabajador') => void;
  setFichaTrabajador: (v: any) => void;
  setShowFichaAcreditacion: (v: boolean) => void;
}) {
  return (
    <div className="fade-in flex flex-col gap-6">
      <div className="page-header">
        <div>
          <h2 className="page-title">Mi dashboard - {contratistaLogueado.nombre}</h2>
          <div className="flex items-center gap-3 mt-1 text-[12.5px]">
            <span className="text-gray-500 font-medium">RUT: {contratistaLogueado.rut}</span>
            <span className="text-gray-300">|</span>
            <select
              value={selectedProyectoId}
              onChange={(e) => setSelectedProyectoId(e.target.value)}
              className="text-[12.5px] border border-cream3 rounded-md px-2 py-0.5 bg-white text-navy focus:outline-none focus:border-brown font-semibold cursor-pointer"
            >
              {misProyectos.map(p => (
                <option key={p.id} value={p.id}>Proyecto: {p.nombre}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {showWelcomeAlert && (
        <div className="alert alert-success fade-in mb-2 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <CheckCircle size={18} className="shrink-0" />
            <span><strong>Bienvenido al proyecto</strong> — revisa los requisitos de acreditación abajo.</span>
          </div>
          <button onClick={() => setShowWelcomeAlert(false)} className="text-[#2a6a3a] hover:opacity-70">
            <X size={16} />
          </button>
        </div>
      )}

      {/* Tu Acreditación Card */}
      <div className="card bg-cream border border-cream3 p-5">
        {(() => {
          const status = calcularEstadoAcreditacion(contratistaLogueado);
          const isAprobado = status === 'Aprobado';
          const isBloqueado = status === 'Vencido/Bloqueado';
          // The icon has to agree with the badge: a green check next to a red
          // "Bloqueado" badge reads as "everything is fine" at a glance.
          const StatusIcon = isAprobado ? CheckCircle : isBloqueado ? XCircle : Clock;
          const iconColor = isAprobado ? 'text-green-600' : isBloqueado ? 'text-red-600' : 'text-yellow-600';
          const badgeClass = isAprobado ? 'b-green' : isBloqueado ? 'b-red' : 'b-yellow';
          return (
            <h3 className="section-title text-[15px] font-bold text-navy mb-4 flex items-center justify-between gap-2 w-full">
              <span className="flex items-center gap-2">
                <StatusIcon size={18} className={iconColor} />
                Tu acreditación
              </span>
              <span className={`badge ${badgeClass} text-[11px]`}>
                {isAprobado ? 'Acreditado' : isBloqueado ? 'Bloqueado' : status}
              </span>
            </h3>
          );
        })()}

        <div className="flex flex-col md:flex-row gap-6 items-center">
          {/* Left side: indicators */}
          <div className="flex-1 w-full flex flex-col gap-4">
            <div>
              <div className="flex justify-between items-center text-[13.2px] font-semibold text-navy mb-1.5">
                <span>Requisitos de empresa</span>
                <span className="text-gray-500 font-medium">{numAprobados} / {documentosData.length} aprobados</span>
              </div>
              <div className="prog-wrap"><div className="prog-fill" style={{ width: `${documentosData.length > 0 ? Math.round((numAprobados / documentosData.length) * 100) : 100}%` }}></div></div>
            </div>
            <div>
              <div className="flex justify-between items-center text-[13.2px] font-semibold text-navy mb-1.5">
                <span>Acreditación de personal</span>
                <span className="text-gray-500 font-medium">{approvedWorkers} / {totalWorkers} trabajadores acreditados</span>
              </div>
              <div className="prog-wrap"><div className="prog-fill" style={{ width: `${totalWorkers > 0 ? Math.round((approvedWorkers / totalWorkers) * 100) : 100}%`, backgroundColor: '#2a6a3a' }}></div></div>
            </div>
          </div>

          {/* Right side: Payment Status secondary info */}
          <div className="w-full md:w-56 bg-white border border-cream3 rounded-2xl p-4 flex flex-col items-center justify-center text-center">
            <span className="text-xs text-gray-400 font-semibold uppercase tracking-wider mb-1">Estado de pago</span>
            {(() => {
              const status = calcularEstadoAcreditacion(contratistaLogueado, selectedProyectoId);
              const isAprobado = status === 'Aprobado';
              return (
                <span className={`badge ${isAprobado ? 'b-green' : 'b-red'} text-xs font-bold py-1 px-3 mb-3`}>
                  {isAprobado ? 'Pago habilitado' : 'Pago retenido'}
                </span>
              );
            })()}
            <button
              className="btn btn-secondary btn-sm w-full py-1 text-[11px] font-semibold"
              onClick={() => {
                setFichaTipo('empresa');
                setFichaTrabajador(null);
                setShowFichaAcreditacion(true);
              }}
            >
              Ver ficha
            </button>
          </div>
        </div>
      </div>

      {/* Te Faltan Section */}
      <div className="card">
        <div className="flex justify-between items-center mb-4 border-b border-cream3 pb-3">
          <h3 className="section-title mb-0 flex items-center gap-2">
            <AlertCircle size={18} className="text-red-600" />
            Requisitos por completar
          </h3>
          <span className="badge b-red font-semibold">{numRechazados + numPendientes + numPorVencer} pendientes</span>
        </div>

        {numRechazados + numPendientes + numPorVencer > 0 ? (
           <div className="flex flex-col gap-3">
             {/* Rejected company documents */}
             {documentosData.filter(d => d.estado === 'rechazado').map(d => (
               <div key={d.id} className="p-3 border border-red-100 bg-red-50/50 rounded-xl flex justify-between items-center gap-3">
                 <div className="flex-1">
                   <div className="text-[13.8px] font-bold text-red-800 flex items-center gap-1.5">
                     <XCircle size={15} /> Empresa: {d.nombre} (Rechazado)
                   </div>
                   <p className="text-[12.1px] text-red-600 mt-1"><strong>Motivo:</strong> {d.motivo || d.observacion || 'Rechazado por auditoría'}</p>
                 </div>
                  <button className="btn btn-primary btn-sm shrink-0" onClick={() => { setActiveTab('subir'); setSelectedDocumentForPanel(d); }}>
                    Corregir
                  </button>
               </div>
             ))}

             {/* Rejected worker statuses */}
             {trabajadoresData.filter(t => t.estado === 'rechazado').map((t, idx) => (
               <div key={idx} className="p-3 border border-red-100 bg-red-50/50 rounded-xl flex justify-between items-center gap-3">
                 <div className="flex-1">
                   <div className="text-[13.8px] font-bold text-red-800 flex items-center gap-1.5">
                     <XCircle size={15} /> Trabajador: {t.nombre} (Rechazado)
                   </div>
                   <p className="text-[12.1px] text-red-600 mt-1"><strong>Observación:</strong> {t.detalle || 'Documentación rechazada o vencida'}</p>
                 </div>
                 <button className="btn btn-primary btn-sm shrink-0" onClick={() => setActiveTab('trabajadores')}>
                   Ver trabajador
                 </button>
               </div>
             ))}

             {/* Pending or expiring company documents */}
             {documentosData.filter(d => d.estado === 'pendiente' || d.estado === 'por_vencer').map(d => (
               <div key={d.id} className="p-3 border border-cream3 bg-gray-50/50 rounded-xl flex justify-between items-center gap-3">
                 <div className="flex-1">
                   <div className="text-[13.8px] font-semibold text-navy flex items-center gap-1.5">
                     {d.estado === 'por_vencer' ? <AlertTriangle size={15} className="text-yellow-600" /> : <Clock size={15} className="text-gray-400" />}
                     Empresa: {d.nombre} ({d.estado === 'por_vencer' ? 'Por vencer' : 'Pendiente subir'})
                   </div>
                   <p className="text-[12.1px] text-gray-500 mt-0.5">{d.vencimiento && d.vencimiento !== '-' ? `Vence: ${d.vencimiento}` : 'Pendiente de subir'}</p>
                 </div>
                 <button className="btn btn-primary btn-sm shrink-0" onClick={() => setActiveTab('subir')}>
                   Subir
                 </button>
               </div>
             ))}

             <div className="mt-2">
               <button className="btn btn-primary w-full justify-center" onClick={() => setActiveTab('subir')}>
                 Continuar acreditación
               </button>
             </div>
           </div>
        ) : (
           <div className="py-8 flex flex-col items-center justify-center text-center text-gray-500">
             <CheckCircle size={36} className="text-green-500 mb-2" />
             <p className="font-semibold text-navy">¡Acreditación al día!</p>
             <p className="text-sm">No tienes requisitos pendientes ni rechazados en tu portal.</p>
           </div>
        )}
      </div>

      {/* Workers Summary Card */}
      <div className="card">
        <div className="flex justify-between items-center mb-4 border-b border-cream3 pb-3">
          <h3 className="section-title mb-0 flex items-center gap-2">
            <Users size={18} className="text-navy" />
            Personal acreditado
          </h3>
          <span className="badge b-gray font-semibold">{totalWorkers} trabajadores</span>
        </div>

        <p className="text-sm text-gray-600 mb-4 leading-relaxed">
          Tienes <strong>{approvedWorkers}</strong> trabajadores acreditados y listos para ingresar a faena de un total de {totalWorkers} ({pendingWorkers} pendientes o con observaciones).
        </p>

        <button className="btn btn-secondary w-full justify-center flex items-center gap-1.5" onClick={() => setActiveTab('trabajadores')}>
          <Users size={14} /> Ver trabajadores
        </button>
      </div>

      {/* Estado por proyecto */}
      <div className="flex justify-between items-center mb-1">
        <h3 className="section-title mb-0">Estado por proyecto</h3>
        <button className="btn btn-ghost btn-sm" onClick={() => setActiveTab('proyectos')}>Ver todos <ArrowRight size={14} /></button>
      </div>

      <div className="card-grid">
        {misProyectos.map(p => {
          const mandante = allMandantes.find(m => m.id === p.mandanteId);
          let badgeType = 'b-green';
          let statusText = 'Al día';
          let percent = 100;
          let detailText = 'Pago habilitado';

          if (p.id === 'mackenna') {
            badgeType = 'b-yellow';
            statusText = 'Atención';
            percent = 85;
            detailText = '85% · 1 por vencer · pago habilitado';
          } else if (p.id === 'solar') {
            badgeType = 'b-red';
            statusText = 'Crítico';
            percent = 50;
            detailText = '50% · 1 rechazado · pago retenido';
          } else if (p.id === 'bodega') {
            badgeType = 'b-green';
            statusText = 'Al día';
            percent = 100;
            detailText = '100% · pago habilitado';
          }

          return (
            <div key={p.id} className="proj-card" onClick={() => setActiveTab('subir')}>
              <div className="flex justify-between items-start mb-2">
                <h4 className="text-[15.4px] font-medium">{mandante?.nombre || 'Mandante'}</h4>
                <span className={`badge ${badgeType}`}>{statusText}</span>
              </div>
              <p className="text-[13.2px] text-gray-500 mb-2">Proyecto {p.nombre}</p>
              <div className="prog-wrap"><div className="prog-fill" style={{ width: `${percent}%`, backgroundColor: badgeType === 'b-red' ? '#c02020' : badgeType === 'b-yellow' ? '#c08000' : '#2a6a3a' }}></div></div>
              <p className="text-[13.2px] text-gray-600 mt-2">{detailText}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
