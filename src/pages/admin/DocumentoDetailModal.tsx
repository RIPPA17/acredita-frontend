import { FileText, Download, X, XCircle } from 'lucide-react';

export default function DocumentoDetailModal({
  actividadSeleccionada,
  setActividadSeleccionada,
}: {
  actividadSeleccionada: any;
  setActividadSeleccionada: (v: any) => void;
}) {
  if (!actividadSeleccionada) return null;

  return (
    <>
      <div
        className="fixed inset-0 z-[399] bg-black/20"
        onClick={() => setActividadSeleccionada(null)}
      />
      <div className="fixed left-1/2 top-1/2 z-[400] flex h-[calc(100vh-16px)] sm:h-[90vh] w-[calc(100vw-16px)] sm:w-3/4 max-w-[1000px] -translate-x-1/2 -translate-y-1/2 flex-col overflow-y-auto sm:overflow-hidden rounded-2xl border border-cream3 bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 rounded-t-xl"
          style={{ background: '#1f1f1f' }}>

          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#2e2e2e] flex items-center justify-center shrink-0">
              <FileText size={16} className="text-gray-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-white font-semibold text-[14px]">{actividadSeleccionada.documento}</span>
                <span className="badge b-yellow text-[11px] py-0.5 px-2">{actividadSeleccionada.categoria}</span>
                <span className={`badge text-[11px] py-0.5 px-2 ${
                  actividadSeleccionada.estado === 'aprobado' ? 'b-green' :
                  actividadSeleccionada.estado === 'rechazado' ? 'b-red' :
                  actividadSeleccionada.estado === 'registrado' ? 'b-blue' : 'b-yellow'
                }`}>
                  {actividadSeleccionada.estado === 'revision' ? 'En revisión' :
                   actividadSeleccionada.estado === 'aprobado' ? 'Aprobado' :
                   actividadSeleccionada.estado === 'rechazado' ? 'Rechazado' : 'Registrado'}
                </span>
              </div>
              <p className="text-[12px] text-gray-400 mt-0.5">{actividadSeleccionada.empresa} · {actividadSeleccionada.rut}</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <button className="flex items-center gap-1.5 text-[13px] text-gray-500 cursor-not-allowed opacity-50 font-medium" disabled title="Descargar deshabilitado en demo">
              <Download size={14} /> Descargar [Demo]
            </button>
            <button onClick={() => setActividadSeleccionada(null)} className="text-gray-500 hover:text-white transition-colors">
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Contenido (Scrollable) */}
        <div className="flex-1 overflow-y-auto bg-[#faf9f8] p-6 text-left">

          {/* Preview placeholder */}
          <div className="bg-white border border-cream3 rounded-xl h-64 flex flex-col items-center justify-center gap-3 mb-6 shadow-sm">
            <div className="w-16 h-16 rounded-full bg-cream2 flex items-center justify-center">
              <FileText size={32} className="text-gray-400" />
            </div>
            <p className="text-[14px] text-gray-500 max-w-sm text-center">Vista previa del documento disponible al conectar Supabase Storage</p>
          </div>

          {/* Info del documento */}
          <div className="card p-5 mb-5 shadow-sm">
             <p className="text-[12px] uppercase tracking-wider text-gray-400 mb-4 font-semibold">
                Detalles del Registro
             </p>
             <div className="flex flex-col gap-1">
               {[
                 { label: 'Documento', value: actividadSeleccionada.documento },
                 { label: 'Categoría', value: actividadSeleccionada.categoria },
                 { label: 'Proyecto', value: actividadSeleccionada.proyecto },
                 { label: 'Empresa', value: actividadSeleccionada.empresa },
                 { label: 'RUT', value: actividadSeleccionada.rut },
                 { label: 'Fecha y Hora', value: `${actividadSeleccionada.fecha} · ${actividadSeleccionada.hora}` },
                 { label: 'Revisado por', value: actividadSeleccionada.revisor || 'Pendiente' },
                 { label: 'Evento Registrado', value: actividadSeleccionada.evento },
               ].map(row => (
                 <div key={row.label} className="flex justify-between py-2.5 border-b border-cream3 last:border-0 text-[13.5px]">
                   <span className="text-gray-500">{row.label}</span>
                   <span className="font-medium text-navy">{row.value}</span>
                 </div>
               ))}
              </div>
          </div>

          {actividadSeleccionada.motivo && (
            <div className="card p-4 bg-[#fef2f2] border-[#fecaca] shadow-sm">
              <p className="text-[13.5px] text-red-700 font-semibold flex items-center gap-2 mb-1.5">
                <XCircle size={18} className="text-red-500" /> Motivo del rechazo
              </p>
              <p className="text-[13.5px] text-red-800 ml-6">
                {actividadSeleccionada.motivo}
              </p>
            </div>
          )}
        </div>

        <div className="border-t border-cream3 p-4 flex justify-end bg-white">
           <button className="btn btn-secondary px-6" onClick={() => setActividadSeleccionada(null)}>
             Cerrar
           </button>
        </div>
      </div>
    </>
  );
}
