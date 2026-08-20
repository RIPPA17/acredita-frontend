import { Download, Key, Banknote, AlertTriangle } from 'lucide-react';
import { calcularEstadoAcreditacion, calcularEstadoTrabajador, calcularAccesoPago } from '../../data/localStorageDb';
import { Contratista, Proyecto } from '../../types';

export default function ReportesTab({
  contractorsData,
  allContratistas,
  activeProjectId,
  misProyectos,
}: {
  contractorsData: any[];
  allContratistas: Contratista[];
  activeProjectId: string;
  misProyectos: Proyecto[];
}) {
  return (
    <div className="fade-in">
      <div className="page-header">
        <div>
          <h2 className="page-title">Reportes de cumplimiento</h2>
          <p className="page-sub">Mayo 2026</p>
        </div>
        <button className="btn btn-secondary cursor-not-allowed opacity-50" disabled title="No disponible en demo">
          <Download size={16} className="mr-2" /> Exportar PDF [Demo]
        </button>
      </div>

      {(() => {
        const totalC = contractorsData.length;
        const okC = contractorsData.filter(c => {
          const statusValues = Object.values(c.status).filter(s => s !== 'na');
          const contractorObj = allContratistas.find(co => co.id === c.id);
          const workers = (contractorObj?.trabajadores || []).filter(w => w.documentos?.some(d => d.proyectoId === activeProjectId));
          const allWOk = workers.length > 0 ? workers.every(w => calcularEstadoTrabajador(w, activeProjectId) === 'aprobado') : true;
          return statusValues.length > 0 && statusValues.every(s => s === 'ok') && allWOk;
        }).length;

        let totalW = 0;
        let approvedW = 0;
        allContratistas.filter(c =>
          c.proyectos.includes(activeProjectId)
        ).forEach(c => {
          const workers = (c.trabajadores || []).filter(w => w.documentos?.some(d => d.proyectoId === activeProjectId));
          totalW += workers.length;
          approvedW += workers.filter(w => calcularEstadoTrabajador(w, activeProjectId) === 'aprobado').length;
        });
        const rate = totalC > 0 ? Math.round((okC / totalC) * 100) : 100;

        return (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              <div className="stat"><div className="stat-n">{totalC}</div><div className="stat-l">Total contratistas</div></div>
              <div className="stat s-green"><div className="stat-n">{okC}</div><div className="stat-l">Empresas Acreditadas</div></div>
              <div className="stat s-green"><div className="stat-n">{approvedW} / {totalW}</div><div className="stat-l">Trabajadores Acreditados</div></div>
              <div className="stat s-green"><div className="stat-n">{rate}%</div><div className="stat-l">Tasa Acreditación General</div></div>
            </div>

            <div className="card p-0 overflow-x-auto mb-6">
              <div className="overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0">
                <table className="table w-full text-left min-w-[600px]">
                <thead>
                  <tr>
                    <th className="px-4 py-3 border-b border-cream3 text-[13.2px] text-gray-600 bg-cream2 font-medium">Contratista</th>
                    <th className="px-4 py-3 border-b border-cream3 text-[13.2px] text-gray-600 bg-cream2 font-medium">Proyecto</th>
                    <th className="px-4 py-3 border-b border-cream3 text-[13.2px] text-gray-600 bg-cream2 font-medium">Requisitos Empresa</th>
                    <th className="px-4 py-3 border-b border-cream3 text-[13.2px] text-gray-600 bg-cream2 font-medium">Personal Acreditado</th>
                    <th className="px-4 py-3 border-b border-cream3 text-[13.2px] text-gray-600 bg-cream2 font-medium">Estado</th>
                    <th className="px-4 py-3 border-b border-cream3 text-[13.2px] text-gray-600 bg-cream2 font-medium text-right">Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {contractorsData.map(c => {
                    const okCount = Object.values(c.status).filter(s => s === 'ok').length;
                    const totalCount = Object.values(c.status).filter(s => s !== 'na').length;

                    const cObj = allContratistas.find(co => co.id === c.id);
                    const workers = (cObj?.trabajadores || []).filter(w => w.documentos?.some(d => d.proyectoId === activeProjectId));
                    const approvedWorkersCount = workers.filter(w => calcularEstadoTrabajador(w, activeProjectId) === 'aprobado').length;

                    const statusTextVal = cObj ? calcularEstadoAcreditacion(cObj, activeProjectId) : 'No acreditado';
                    const statusText = statusTextVal === 'Aprobado' ? 'Acreditado' : statusTextVal === 'Vencido/Bloqueado' ? 'Bloqueado' : statusTextVal;
                    const badgeClass = statusTextVal === 'Aprobado' ? 'b-green' : statusTextVal === 'Vencido/Bloqueado' ? 'b-red' : 'b-yellow';
                    const { accesoBloqueado: accB, pagoBloqueado: pagB } = cObj ? calcularAccesoPago(cObj, activeProjectId) : { accesoBloqueado: false, pagoBloqueado: false };

                    const projName = misProyectos.find(p => p.id === activeProjectId)?.nombre || 'General';

                    return (
                      <tr key={c.id} className="hover:bg-gray-50 border-b border-cream">
                        <td className="px-4 py-3 font-medium text-[14.3px]">{c.name}</td>
                        <td className="px-4 py-3 text-[14.3px]">{projName}</td>
                        <td className="px-4 py-3 text-[14.3px]">{okCount}/{totalCount}</td>
                        <td className="px-4 py-3 text-[14.3px]">{approvedWorkersCount}/{workers.length}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <span className={`badge ${badgeClass}`}>{statusText}</span>
                            <div className="flex items-center gap-1.5 shrink-0">
                              <Key
                                size={14}
                                className={accB ? "text-red-500" : "text-green-600"}
                                title={accB ? "Acceso: Bloqueado" : "Acceso: Habilitado"}
                              />
                              <Banknote
                                size={14}
                                className={pagB ? "text-red-500" : "text-green-600"}
                                title={pagB ? "Pago: Bloqueado" : "Pago: Habilitado"}
                              />
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button className="btn btn-ghost btn-sm text-gray-300 cursor-not-allowed" disabled title="No disponible en demo"><Download size={16} /> PDF [Demo]</button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              </div>
            </div>
          </>
        );
      })()}

      <div className="card">
        <h3 className="section-title mb-4">Documentos por vencer este mes</h3>
        <ul className="flex flex-col gap-3">
          {(() => {
            const docsPorVencer: Array<{ documento: string; contractorName: string; dias: number }> = [];
            allContratistas.filter(c =>
              c.proyectos.some(pId => misProyectos.some(mp => mp.id === pId))
            ).forEach(c => {
              c.documentos.forEach(d => {
                if (d.estado === 'por_vencer') {
                  const mockDays = d.nombre.toLowerCase().includes('mutual') ? 6 : d.nombre.toLowerCase().includes('f30') ? 12 : 15;
                  docsPorVencer.push({
                    documento: d.nombre,
                    contractorName: c.nombre,
                    dias: mockDays
                  });
                }
              });
            });

            if (docsPorVencer.length === 0) {
              return <li className="text-gray-400 py-3 text-center text-sm">No hay documentos por vencer este mes.</li>;
            }

            return docsPorVencer.map((item, idx) => (
              <li key={idx} className="flex items-center justify-between p-3 border border-cream3 rounded-xl bg-gray-50">
                <div className="flex items-center gap-3">
                  <AlertTriangle size={18} className="text-[#d4a000]" />
                  <div>
                    <div className="font-semibold text-navy text-[14.3px]">{item.documento}</div>
                    <div className="text-[12.1px] text-gray-500">{item.contractorName}</div>
                  </div>
                </div>
                <div className="text-[13.2px] font-medium text-[#d4a000] bg-[#fdf5dd] px-2 py-1 rounded-md">Vence en {item.dias} días</div>
              </li>
            ));
          })()}
        </ul>
      </div>
    </div>
  );
}
