import { Plus, ChevronRight } from 'lucide-react';
import SeverityBadge from '../../components/SeverityBadge';

export default function MandantesTab({
  setShowInvitarModal,
  mandanteActivo,
  setMandanteActivo,
  proyectoActivo,
  setProyectoActivo,
  ARBOL_MANDANTES,
  setClienteSeleccionado,
}: {
  setShowInvitarModal: (v: boolean) => void;
  mandanteActivo: any;
  setMandanteActivo: (v: any) => void;
  proyectoActivo: any;
  setProyectoActivo: (v: any) => void;
  ARBOL_MANDANTES: any[];
  setClienteSeleccionado: (v: any) => void;
}) {
  return (
    <div className="fade-in">
      <div className="page-header">
        <div>
          <h2 className="page-title">Mandantes</h2>
          <p className="page-sub">Empresas propietarias de proyectos que requieren acreditación de sus contratistas</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowInvitarModal(true)}>
          <Plus size={16} /> Invitar Mandante
        </button>
      </div>

      {/* Breadcrumb */}
      <div className="flex items-center gap-1.5 text-[13px] text-gray-500 mb-4">
        <span
          onClick={() => { setMandanteActivo(null); setProyectoActivo(null); }}
          className={`cursor-pointer hover:text-brown transition-colors ${!mandanteActivo ? "text-navy font-medium" : ""}`}
        >
          Mandantes
        </span>
        {mandanteActivo && (
          <>
            <ChevronRight size={14} className="text-gray-300" />
            <span
              onClick={() => setProyectoActivo(null)}
              className={`cursor-pointer hover:text-brown transition-colors ${!proyectoActivo ? "text-navy font-medium" : ""}`}
            >
              {mandanteActivo.empresa}
            </span>
          </>
        )}
        {proyectoActivo && (
          <>
            <ChevronRight size={14} className="text-gray-300" />
            <span className="text-navy font-medium">{proyectoActivo.nombre}</span>
          </>
        )}
      </div>

      {/* Nivel 1: Lista de mandantes */}
      {!mandanteActivo && (
        <div className="grid grid-cols-2 gap-3">
          {ARBOL_MANDANTES.map((m, i) => (
            <div
              key={i}
              onClick={() => setMandanteActivo(m)}
              className="card p-4 cursor-pointer hover:border-brown hover:shadow-md transition-all"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-[14.5px] font-semibold text-navy">{m.empresa}</h4>
                  <p className="text-[12.5px] text-gray-500 mt-0.5">{m.rut}</p>
                </div>
                <ChevronRight size={18} className="text-gray-300" />
              </div>
              <p className="text-[12px] text-gray-400 mt-3">{m.proyectos.length} proyecto{m.proyectos.length !== 1 ? "s" : ""}</p>
            </div>
          ))}
        </div>
      )}

      {/* Nivel 2: Proyectos del mandante */}
      {mandanteActivo && !proyectoActivo && (
        <div className="grid grid-cols-2 gap-3">
          {mandanteActivo.proyectos.map((p: any, i: number) => (
            <div
              key={i}
              onClick={() => setProyectoActivo(p)}
              className="card p-4 cursor-pointer hover:border-brown hover:shadow-md transition-all"
            >
              <div className="flex items-center justify-between">
                <h4 className="text-[14.5px] font-semibold text-navy">{p.nombre}</h4>
                <span className={`badge ${p.badge}`}>{p.badgeLabel}</span>
              </div>
              <p className="text-[12px] text-gray-400 mt-3">{p.empresas.length} empresa{p.empresas.length !== 1 ? "s" : ""} asignada{p.empresas.length !== 1 ? "s" : ""}</p>
            </div>
          ))}
        </div>
      )}

      {/* Nivel 3: Empresas del proyecto */}
      {proyectoActivo && (
        <div className="flex flex-col gap-2">
          {proyectoActivo.empresas.map((e: any, i: number) => (
            <div
              key={i}
              onClick={() => setClienteSeleccionado(e)}
              className="card p-4 cursor-pointer hover:border-brown hover:shadow-md transition-all flex items-center justify-between"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-brown text-white flex items-center justify-center font-semibold text-[14px] shrink-0">{e.iniciales}</div>
                <div>
                  <h4 className="text-[14.3px] font-medium text-navy">{e.empresa}</h4>
                  <p className="text-[12.3px] text-gray-500">{e.rut} · {e.rol}</p>
                </div>
              </div>
              <SeverityBadge cumplimiento={e.cumplimiento} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
