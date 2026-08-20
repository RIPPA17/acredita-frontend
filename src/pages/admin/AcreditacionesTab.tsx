import { calcularEstadoAcreditacion } from '../../data/localStorageDb';
import { Contratista, Proyecto } from '../../types';

export default function AcreditacionesTab({
  GLOBAL_CONTRATISTAS,
  GLOBAL_PROYECTOS,
  setSelectedAcreditacionContratista,
}: {
  GLOBAL_CONTRATISTAS: Contratista[];
  GLOBAL_PROYECTOS: Proyecto[];
  setSelectedAcreditacionContratista: (c: any) => void;
}) {
  return (
    <div className="fade-in space-y-4">
      <div className="page-header">
        <div>
          <h2 className="page-title text-navy font-bold text-[22px]">Estados de Acreditación</h2>
          <p className="page-sub text-gray-500 text-[13.5px]">Monitoreo de contratistas y progreso de cumplimiento</p>
        </div>
      </div>

      <div className="card p-0 overflow-x-auto bg-white shadow-sm border border-cream3">
        <table className="table w-full text-left">
          <thead>
            <tr>
              <th className="px-4 py-3 bg-cream2 text-navy text-[13.2px] font-semibold border-b border-cream3">Contratista</th>
              <th className="px-4 py-3 bg-cream2 text-navy text-[13.2px] font-semibold border-b border-cream3">Proyecto(s)</th>
              <th className="px-4 py-3 bg-cream2 text-navy text-[13.2px] font-semibold border-b border-cream3">Requisitos de Empresa</th>
              <th className="px-4 py-3 bg-cream2 text-navy text-[13.2px] font-semibold border-b border-cream3">Personal acreditado</th>
              <th className="px-4 py-3 bg-cream2 text-navy text-[13.2px] font-semibold border-b border-cream3">Estado Acreditación</th>
            </tr>
          </thead>
          <tbody>
            {GLOBAL_CONTRATISTAS.map(c => {
              const approvedDocs = c.documentos.filter(d => d.estado === 'aprobado').length;
              const totalDocs = c.documentos.length;
              const workers = c.trabajadores || [];
              const approvedWorkers = workers.filter(w => w.estado === 'aprobado').length;

              const stateLabel = calcularEstadoAcreditacion(c);
              const badgeClass = stateLabel === 'Aprobado' ? 'b-green' : stateLabel === 'Vencido/Bloqueado' ? 'b-red' : 'b-yellow';

              return (
                <tr key={c.id} className="border-b border-cream hover:bg-gray-50 last:border-0 font-sans cursor-pointer" onClick={() => setSelectedAcreditacionContratista(c)}>
                  <td className="px-4 py-3">
                    <div className="font-semibold text-navy text-[14px]">{c.nombre}</div>
                    <div className="text-[11.5px] text-gray-500">RUT: {c.rut}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {c.proyectos.map(pId => {
                        const proj = GLOBAL_PROYECTOS.find(p => p.id === pId);
                        return <span key={pId} className="badge b-gray text-[10.5px] font-medium">{proj ? proj.nombre : pId}</span>;
                      })}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-[13px] text-navy font-semibold">{approvedDocs} / {totalDocs}</td>
                  <td className="px-4 py-3 text-[13px] text-navy font-semibold">{approvedWorkers} / {workers.length}</td>
                  <td className="px-4 py-3"><span className={`badge ${badgeClass} text-[11px]`}>{stateLabel}</span></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
