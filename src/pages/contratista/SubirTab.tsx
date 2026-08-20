import { CheckCircle, Clock, X, Upload, FileCheck, AlertTriangle, Eye, CloudUpload } from 'lucide-react';
import { getRequisitos, esVencidoPorFecha, esPorVencerPorFecha, obtenerDiasRestantes } from '../../data/localStorageDb';
import { Proyecto, Documento } from '../../types';

export default function SubirTab({
  misProyectos,
  numAprobados,
  numPorVencer,
  numRechazados,
  numPendientes,
  documentosData,
  selectedProyectoId,
  setSelectedDocumentForPanel,
}: {
  misProyectos: Proyecto[];
  numAprobados: number;
  numPorVencer: number;
  numRechazados: number;
  numPendientes: number;
  documentosData: any[];
  selectedProyectoId: string;
  setSelectedDocumentForPanel: (d: Documento | null) => void;
}) {
  return (
    <div className="fade-in">
      <div className="page-header">
        <div>
          <h2 className="page-title">Checklist de documentos</h2>
          <p className="page-sub">Proyecto Torre Mackenna · Constructora Andina SA</p>
        </div>
        <select className="form-input py-1.5 min-w-[200px]">
          {misProyectos.map(p => (
            <option key={p.id}>Proyecto {p.nombre}</option>
          ))}
        </select>
      </div>

      <div className="flex gap-2 flex-wrap mb-4">
        <span className="badge b-green px-3 py-1"><CheckCircle size={14} /> Aprobados: {numAprobados}</span>
        <span className="badge b-yellow px-3 py-1"><Clock size={14} /> Por vencer: {numPorVencer}</span>
        <span className="badge b-red px-3 py-1"><X size={14} /> Rechazados: {numRechazados}</span>
        <span className="badge b-gray px-3 py-1"><Upload size={14} /> Pendientes: {numPendientes}</span>
      </div>

      <div className="md:hidden flex flex-col gap-3">
        {documentosData.map(doc => {
          const isVencido = esVencidoPorFecha(doc.vencimiento);
          const req = getRequisitos().find(r => r.proyectoId === selectedProyectoId && (doc.nombre.toLowerCase().includes(r.nombre.toLowerCase()) || r.nombre.toLowerCase().includes(doc.nombre.toLowerCase())));
          const alertaDias = req ? req.alertaDias : 30;
          const isPorVencer = esPorVencerPorFecha(doc.vencimiento, alertaDias);
          const diasRestantes = obtenerDiasRestantes(doc.vencimiento);

          let badgeColor = 'b-gray';
          let statusLabel = doc.estado;
          let subtext = doc.vencimiento && doc.vencimiento !== '—' ? `Vence: ${doc.vencimiento}` : 'Sin vencimiento';

          if (doc.estado === 'aprobado') {
            if (isVencido) {
              badgeColor = 'b-red';
              statusLabel = 'Vencido';
              subtext = 'Tu documento está vencido';
            } else if (isPorVencer) {
              badgeColor = 'b-yellow';
              statusLabel = 'Por vencer';
              subtext = `Tu documento vence en ${diasRestantes} días`;
            } else {
              badgeColor = 'b-green';
              statusLabel = 'Aprobado';
            }
          } else if (doc.estado === 'rechazado') {
            badgeColor = 'b-red';
            statusLabel = 'Rechazado';
          } else if (doc.estado === 'revision') {
            badgeColor = 'b-blue';
            statusLabel = 'En revisión';
          }

          return (
            <div key={doc.id} className="card p-4 flex flex-col gap-2 cursor-pointer hover:shadow-sm transition-all" onClick={() => setSelectedDocumentForPanel(doc)}>
              <div className="flex justify-between items-start">
                <span className="font-medium text-sm text-navy">{doc.nombre}</span>
                <span className={`badge ${badgeColor} text-xs`}>{statusLabel}</span>
              </div>
              <span className="text-xs text-gray-500">{subtext}</span>
              {doc.observacion && <span className="text-xs text-red-500">{doc.observacion}</span>}
            </div>
          );
        })}
      </div>

      <div className="card hidden md:block">
        {documentosData.map(doc => {
          const isVencido = esVencidoPorFecha(doc.vencimiento);
          const req = getRequisitos().find(r => r.proyectoId === selectedProyectoId && (doc.nombre.toLowerCase().includes(r.nombre.toLowerCase()) || r.nombre.toLowerCase().includes(doc.nombre.toLowerCase())));
          const alertaDias = req ? req.alertaDias : 30;
          const isPorVencer = esPorVencerPorFecha(doc.vencimiento, alertaDias);
          const diasRestantes = obtenerDiasRestantes(doc.vencimiento);

          let RowIcon = Clock;
          let iconColorClass = 'text-gray-400';
          let rowBgClass = '';
          let badgeClass = 'b-gray';
          let badgeLabel = 'Pendiente';
          let subtext = `Sin subir · Vence el ${doc.vencimiento}`;
          let actionBtn = (
            <button className="btn btn-secondary btn-sm" onClick={() => setSelectedDocumentForPanel(doc)}>
              <Upload size={14} /> Subir
            </button>
          );

          let effectiveEstado = doc.estado;
          if (doc.estado === 'aprobado') {
            if (isVencido) effectiveEstado = 'vencido';
            else if (isPorVencer) effectiveEstado = 'por_vencer';
          }

          if (effectiveEstado === 'aprobado') {
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
          } else if (effectiveEstado === 'por_vencer') {
            RowIcon = AlertTriangle;
            iconColorClass = 'text-[#c08000]';
            rowBgClass = 'bg-[#fffdf5] -mx-4 px-4 py-3 border-y border-cream3 rounded-md';
            badgeClass = 'b-yellow';
            badgeLabel = 'Por vencer';
            subtext = `Tu documento vence en ${diasRestantes} días`;
            actionBtn = (
              <button className="btn btn-primary btn-sm" onClick={() => setSelectedDocumentForPanel(doc)}>
                <Upload size={14} /> Renovar
              </button>
            );
          } else if (effectiveEstado === 'rechazado' || effectiveEstado === 'vencido') {
            RowIcon = X;
            iconColorClass = 'text-[#c02020]';
            rowBgClass = 'bg-[#fff8f8] -mx-4 px-4 py-3 border-b border-cream3 rounded-md';
            badgeClass = 'b-red';
            badgeLabel = effectiveEstado === 'vencido' ? 'Vencido' : 'Rechazado';
            subtext = effectiveEstado === 'vencido' ? 'Tu documento está vencido' : (doc.observacion || 'Documento rechazado.');
            actionBtn = (
              <button className="btn btn-danger btn-sm" onClick={() => setSelectedDocumentForPanel(doc)}>
                <Upload size={14} /> Corregir
              </button>
            );
          } else if (effectiveEstado === 'revision') {
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
            <div key={doc.id} className={`doc-row cursor-pointer hover:bg-cream/40 ${rowBgClass} transition-colors`} onClick={() => setSelectedDocumentForPanel(doc)}>
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
        })}
      </div>

      <div className="card mt-4">
        <h3 className="section-title">Subir nuevo documento</h3>
        <div className="border-2 border-dashed border-cream3 rounded-xl p-8 flex flex-col items-center justify-center bg-cream2 hover:bg-[#faf5f0] hover:border-brown transition-colors cursor-pointer text-center">
          <CloudUpload size={32} className="text-brown mb-2" />
          <div className="text-[15.4px] font-medium text-navy mb-1">Arrastra el archivo aquí o haz clic para seleccionar</div>
          <div className="text-[13.2px] text-gray-500">PDF, JPG o PNG · máx. 10 MB</div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
          <div className="form-group">
            <label className="form-label">Tipo de documento</label>
            <select className="form-input">
              <option>Liquidación de sueldo</option>
              <option>Contrato de trabajo</option>
              <option>F30 SII</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Trabajador (si aplica)</label>
            <select className="form-input">
              <option>— Empresa general —</option>
              <option>Juan Pérez González</option>
            </select>
          </div>
        </div>
        <button className="btn btn-primary w-full py-2.5 mt-2 cursor-not-allowed opacity-55" disabled title="Usa la sección 'Mis proyectos' o la Ficha para subir documentos de forma interactiva"><Upload size={16} /> Subir y validar [Demo]</button>
      </div>
    </div>
  );
}
