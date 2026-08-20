import { ArrowLeft, Clock, FileCheck, AlertTriangle, X, Eye, Upload, Users, Search, FolderOpen, Briefcase, UserPlus } from 'lucide-react';
import { getContratistas, calcularEstadoTrabajador, getMotivoBloqueoTrabajador, getRequisitos, esVencidoPorFecha } from '../../data/localStorageDb';
import { Contratista, Proyecto, Documento } from '../../types';

export default function TrabajadoresTab({
  selectedWorkerForDocs,
  setSelectedWorkerForDocs,
  contratistaLogueado,
  selectedProyectoId,
  setSelectedProyectoId,
  setFichaTipo,
  setFichaTrabajador,
  setShowFichaAcreditacion,
  setSelectedDocumentForPanel,
  misProyectos,
  trabajadoresData,
  setShowAddWorkerModal,
}: {
  selectedWorkerForDocs: any | null;
  setSelectedWorkerForDocs: (v: any | null) => void;
  contratistaLogueado: Contratista;
  selectedProyectoId: string;
  setSelectedProyectoId: (id: string) => void;
  setFichaTipo: (v: 'empresa' | 'trabajador') => void;
  setFichaTrabajador: (v: any) => void;
  setShowFichaAcreditacion: (v: boolean) => void;
  setSelectedDocumentForPanel: (d: Documento | null) => void;
  misProyectos: Proyecto[];
  trabajadoresData: any[];
  setShowAddWorkerModal: (v: boolean) => void;
}) {
  return selectedWorkerForDocs ? (
    <div className="fade-in flex flex-col gap-5">
      <div className="page-header mb-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setSelectedWorkerForDocs(null)}
            className="btn btn-ghost p-2 hover:bg-gray-100 rounded-lg text-gray-500 hover:text-navy transition-colors"
            title="Volver al Directorio"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h2 className="page-title flex items-center gap-2">
              Carpeta de Documentos: {selectedWorkerForDocs.nombre}
            </h2>
            <p className="page-sub">RUT: {selectedWorkerForDocs.rut} · Cargo: {selectedWorkerForDocs.cargo || 'Operario'}</p>
          </div>
        </div>
        {(() => {
          const list = getContratistas();
          const cObj = list.find(c => c.id === contratistaLogueado.id);
          const freshWorker = cObj?.trabajadores?.find(w => w.rut === selectedWorkerForDocs.rut);
          const statusVal = freshWorker ? calcularEstadoTrabajador(freshWorker, selectedProyectoId) : 'pendiente';
          const badgeClass = statusVal === 'aprobado' ? 'b-green' : statusVal === 'rechazado' ? 'b-red' : 'b-yellow';
          return (
            <div className="flex items-center gap-2">
              <span className={`badge ${badgeClass} text-xs font-bold py-1.5 px-3`}>
                {statusVal === 'aprobado' ? 'Habilitado' : statusVal === 'rechazado' ? 'Bloqueado' : 'Pendiente'}
              </span>
              <button
                className="btn btn-secondary btn-sm px-2.5 py-1 text-[11px] font-semibold"
                onClick={() => {
                  setFichaTipo('trabajador');
                  setFichaTrabajador(freshWorker);
                  setShowFichaAcreditacion(true);
                }}
              >
                Ver ficha
              </button>
            </div>
          );
        })()}
      </div>

      <div className="card">
        <h3 className="section-title mb-4">Checklist de Requisitos</h3>
        <div className="flex flex-col gap-3">
          {(() => {
            const list = getContratistas();
            const cObj = list.find(c => c.id === contratistaLogueado.id);
            const freshWorker = cObj?.trabajadores?.find(w => w.rut === selectedWorkerForDocs.rut);
            const docsList = (freshWorker?.documentos || []).filter(d => d.proyectoId === selectedProyectoId);

            if (docsList.length === 0) {
              return <p className="text-gray-500 text-[13.5px] p-4 text-center">No hay requisitos configurados para este trabajador en este proyecto.</p>;
            }

            return docsList.map(doc => {
              let RowIcon = Clock;
              let iconColorClass = 'text-gray-400';
              let rowBgClass = '';
              let badgeClass = 'b-gray';
              let badgeLabel = 'Pendiente';
              let subtext = `Sin subir · Requisito Obligatorio`;
              let actionBtn = (
                <button className="btn btn-secondary btn-sm" onClick={() => setSelectedDocumentForPanel(doc)}>
                  <Upload size={14} /> Subir
                </button>
              );

              if (doc.estado === 'aprobado') {
                RowIcon = FileCheck;
                iconColorClass = 'text-[#2a6a3a]';
                badgeClass = 'b-green';
                badgeLabel = 'Aprobado';
                subtext = 'Subido · Validación automática';
                actionBtn = (
                  <button className="btn btn-ghost btn-sm" onClick={() => setSelectedDocumentForPanel(doc)}>
                    <Eye size={14}/>
                  </button>
                );
              } else if (doc.estado === 'por_vencer') {
                RowIcon = AlertTriangle;
                iconColorClass = 'text-[#c08000]';
                rowBgClass = 'bg-[#fffdf5] -mx-4 px-4 py-3 border-y border-cream3 rounded-md';
                badgeClass = 'b-yellow';
                badgeLabel = 'Por vencer';
                subtext = doc.observacion || `Vence el ${doc.vencimiento}`;
                actionBtn = (
                  <button className="btn btn-primary btn-sm" onClick={() => setSelectedDocumentForPanel(doc)}>
                    <Upload size={14} /> Renovar
                  </button>
                );
              } else if (doc.estado === 'rechazado') {
                RowIcon = X;
                iconColorClass = 'text-[#c02020]';
                rowBgClass = 'bg-[#fff8f8] -mx-4 px-4 py-3 border-b border-cream3 rounded-md';
                badgeClass = 'b-red';
                badgeLabel = 'Rechazado';
                subtext = doc.observacion || 'Documento rechazado.';
                actionBtn = (
                  <button className="btn btn-danger btn-sm" onClick={() => setSelectedDocumentForPanel(doc)}>
                    <Upload size={14} /> Corregir
                  </button>
                );
              } else if (doc.estado === 'revision') {
                RowIcon = Clock;
                iconColorClass = 'text-blue-500';
                badgeClass = 'b-blue';
                badgeLabel = 'En revisión';
                subtext = 'Enviado para revisión por auditoría';
                actionBtn = (
                  <button className="btn btn-ghost btn-sm" onClick={() => setSelectedDocumentForPanel(doc)}>
                    <Eye size={14}/>
                  </button>
                );
              }

              return (
                <div
                  key={doc.id}
                  className={`doc-row cursor-pointer hover:bg-cream/40 ${rowBgClass} transition-colors`}
                  onClick={() => setSelectedDocumentForPanel(doc)}
                >
                  <RowIcon size={20} className={`${iconColorClass} shrink-0`} />
                  <div className="flex-1 font-sans">
                    <div className="text-[15.4px] font-medium text-navy">{doc.nombre}</div>
                    <div className={`text-[13.2px] ${doc.estado === 'por_vencer' ? 'text-[#a07000]' : doc.estado === 'rechazado' ? 'text-[#c03030]' : 'text-gray-400'}`}>
                      {subtext}
                    </div>
                  </div>
                  <span className={`badge ${badgeClass}`}>{badgeLabel}</span>
                  <div className="doc-meta font-sans">{doc.vencimiento && doc.vencimiento !== '—' ? doc.vencimiento : ''}</div>
                  <div onClick={(e) => e.stopPropagation()}>
                    {actionBtn}
                  </div>
                </div>
              );
            });
          })()}
        </div>
      </div>
    </div>
  ) : (
    <div className="fade-in">
      <div className="page-header mb-6">
        <div>
          <h2 className="page-title flex items-center gap-2">
            <Users className="text-brown" size={22} /> Directorio de trabajadores
          </h2>
          <p className="page-sub">Gestiona la documentación y habilitación de tu personal en terreno</p>
        </div>
        <button className="btn btn-primary shadow-sm hover:shadow-md" onClick={() => setShowAddWorkerModal(true)}>
          <UserPlus size={16} className="mr-2" /> Agregar Trabajador
        </button>
      </div>

      {/* BARRA DE BÚSQUEDA Y FILTROS */}
      <div className="flex flex-col md:flex-row gap-3 mb-6 bg-white p-3 rounded-xl border border-cream3 shadow-sm">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
          <input
            type="text"
            placeholder="Buscar por nombre, RUT o cargo..."
            className="form-input w-full pl-9 py-2 border-none bg-cream2/50 focus:bg-white text-[14.3px]"
          />
        </div>
        <div className="flex gap-2">
          <select className="form-input py-2 text-[13.2px] border-none bg-cream2/50 cursor-pointer">
            <option>Todos los estados</option>
            <option>Habilitados (Al día)</option>
            <option>Con problemas (Rojo)</option>
          </select>
          <select
            value={selectedProyectoId}
            onChange={(e) => setSelectedProyectoId(e.target.value)}
            className="form-input py-2 text-[13.2px] border-none bg-cream2/50 cursor-pointer"
          >
            {misProyectos.map(p => (
              <option key={p.id} value={p.id}>{p.nombre}</option>
            ))}
          </select>
        </div>
      </div>

      {/* GRID DE PERFILES DE TRABAJADORES */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
        {trabajadoresData.map((worker: any) => {
          const workerEstado = calcularEstadoTrabajador(worker, selectedProyectoId);
          let statusColor = 'border-t-[#2a6a3a]';
          let badge = <span className="badge b-green" title="Habilitado para ingreso">Al día</span>;
          let cardBg = 'bg-[#f4fbf6]';
          let cardBorder = 'border-[#d4f0de]/50';
          let textColor = 'text-[#1a6030]';
          let barColor = 'bg-[#2a6a3a]';
          let barBg = 'bg-[#f4fbf6]';
          let actionBtn = (
            <button
              onClick={() => setSelectedWorkerForDocs(worker)}
              className="btn btn-ghost w-full border border-cream3 text-gray-600 hover:text-navy"
            >
              <FolderOpen size={16} className="mr-2" /> Ver carpeta
            </button>
          );

          if (workerEstado === 'rechazado') {
            statusColor = 'border-t-[#c02020]';
            badge = <span className="badge bg-[#fde8e8] text-[#c02020] border border-[#fde8e8]" title="Acceso bloqueado">Bloqueado</span>;
            cardBg = 'bg-[#fff8f8]';
            cardBorder = 'border-[#fde8e8]';
            textColor = 'text-[#c02020]';
            barColor = 'bg-[#c02020]';
            barBg = 'bg-[#fde8e8]';
            actionBtn = (
              <button
                onClick={() => setSelectedWorkerForDocs(worker)}
                className="btn btn-primary w-full bg-[#c02020] hover:bg-[#a01515] border-none"
              >
                Solucionar ahora
              </button>
            );
          } else if (workerEstado === 'por_vencer') {
            statusColor = 'border-t-[#d4a000]';
            badge = <span className="badge b-yellow">Advertencia</span>;
            cardBg = 'bg-[#fffdf5]';
            cardBorder = 'border-[#fdf0d0]';
            textColor = 'text-[#a07000]';
            barColor = 'bg-[#d4a000]';
            barBg = 'bg-[#fdf0d0]';
            actionBtn = (
              <button
                onClick={() => setSelectedWorkerForDocs(worker)}
                className="btn btn-secondary w-full"
              >
                Actualizar documento
              </button>
            );
          } else if (workerEstado === 'pendiente') {
            statusColor = 'border-t-gray-400';
            badge = <span className="badge b-gray">Pendiente</span>;
            cardBg = 'bg-gray-50';
            cardBorder = 'border-gray-200';
            textColor = 'text-gray-500';
            barColor = 'bg-gray-400';
            barBg = 'bg-gray-200';
            actionBtn = (
              <button
                onClick={() => setSelectedWorkerForDocs(worker)}
                className="btn btn-secondary w-full"
              >
                Subir carpeta
              </button>
            );
          }

          const initials = worker.nombre
            .split(' ')
            .map((n: string) => n[0])
            .join('')
            .substring(0, 2)
            .toUpperCase();

          const projObj = misProyectos.find(p => p.id === selectedProyectoId);
          const projectName = projObj ? projObj.nombre : 'Proyecto';

          const motive = workerEstado !== 'aprobado' ? getMotivoBloqueoTrabajador(worker, selectedProyectoId) : '';

          const workerReqs = getRequisitos().filter(r =>
            r.proyectoId === selectedProyectoId &&
            r.destino === 'trabajador' &&
            r.activo !== false &&
            r.obligatorio === true
          );
          const approvedReqsCount = workerReqs.filter(req => {
            const doc = worker.documentos?.find(d =>
              d.proyectoId === selectedProyectoId &&
              (d.nombre.toLowerCase().includes(req.nombre.toLowerCase()) ||
               req.nombre.toLowerCase().includes(d.nombre.toLowerCase()))
            );
            return doc && doc.estado === 'aprobado' && !esVencidoPorFecha(doc.vencimiento);
          }).length;

          const dynamicCompliance = workerReqs.length > 0
            ? Math.round((approvedReqsCount / workerReqs.length) * 100)
            : 0;

          return (
            <div key={worker.rut} className={`card hover:shadow-md transition-shadow group border-t-4 ${statusColor}`}>
              <div className="flex justify-between items-start mb-3">
                <div className="flex gap-3">
                  <div className="avatar w-11 h-11 text-[14.3px] bg-navy text-cream flex items-center justify-center font-bold">{initials}</div>
                  <div>
                    <div className="font-semibold text-[15.4px] text-navy group-hover:text-brown transition-colors">{worker.nombre}</div>
                    <div className="text-[12.1px] text-gray-500 font-mono mt-0.5">{worker.rut}</div>
                  </div>
                </div>
                {badge}
              </div>

              <div className="flex items-center gap-1.5 text-[13.2px] text-gray-600 mb-2">
                <Briefcase size={14} className="text-gray-400" /> {worker.cargo || 'Operario'}
              </div>

              <div className="space-y-1.5 mb-4 text-[12.5px] text-gray-600 border-t border-cream pt-2">
                <div><strong>Proyecto:</strong> {projectName}</div>
                <div><strong>Asignación:</strong> <span className="text-green-700 font-semibold">✓ Asignado</span></div>
                <div><strong>Puede trabajar:</strong> <span className={workerEstado === 'aprobado' ? 'text-green-700 font-semibold' : 'text-red-600 font-semibold'}>{workerEstado === 'aprobado' ? 'Sí' : 'No'}</span></div>
                {motive && <div className="text-red-600 font-medium"><strong>Motivo:</strong> {motive}</div>}
              </div>

              <div className={`rounded-lg p-3 mb-4 border ${cardBg} ${cardBorder}`}>
                <div className="flex justify-between items-center text-[12.1px] mb-1.5">
                  <span className={`${textColor} font-medium`}>Cumplimiento General</span>
                  <span className={`font-bold ${textColor}`}>{dynamicCompliance}%</span>
                </div>
                <div className={`prog-wrap h-1.5 ${barBg}`}>
                  <div className={`prog-fill ${barColor}`} style={{ width: `${dynamicCompliance}%` }}></div>
                </div>
              </div>

              {actionBtn}
            </div>
          );
        })}
      </div>
    </div>
  );
}
