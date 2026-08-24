import { useState } from 'react';
import { ArrowLeft, Building2, FileText, Folder, ShieldCheck, Users } from 'lucide-react';
import { calcularAccesoPago, calcularEstadoAcreditacion, esTrabajadorAsignado } from '../../data/localStorageDb';
import { Contratista, Proyecto } from '../../types';

type ContractorTab = 'resumen' | 'acreditaciones' | 'trabajadores' | 'documentos';

const estadoLabel = (estado: ReturnType<typeof calcularEstadoAcreditacion>) => {
  if (estado === 'Aprobado') return 'Acreditado';
  if (estado === 'Vencido/Bloqueado') return 'Bloqueado';
  return 'En proceso';
};

export default function ContratistasTab({
  misProyectos,
  allContratistas,
  selectedContratista,
  setSelectedContratista,
  onOpenProject,
}: {
  misProyectos: Proyecto[];
  allContratistas: Contratista[];
  selectedContratista: string | null;
  setSelectedContratista: (id: string | null) => void;
  onOpenProject: (projectId: string) => void;
}) {
  const [activeContractorTab, setActiveContractorTab] = useState<ContractorTab>('resumen');
  const contractorIds = new Set(misProyectos.flatMap(project => project.contratistas));
  const contratistasMandante = allContratistas.filter(contratista => contractorIds.has(contratista.id));
  const selected = contratistasMandante.find(contratista => contratista.id === selectedContratista);

  const selectContractor = (id: string) => {
    setSelectedContratista(id);
    setActiveContractorTab('resumen');
  };

  if (!selected) {
    return (
      <div className="fade-in">
        <div className="page-header">
          <div><h2 className="page-title">Contratistas</h2><p className="page-sub">Empresas asociadas a los proyectos de tu organización.</p></div>
        </div>
        <div className="card-grid">
          {contratistasMandante.map(contratista => {
            const proyectos = misProyectos.filter(project => project.contratistas.includes(contratista.id));
            return (
              <button key={contratista.id} type="button" className="card text-left hover:shadow-md transition-shadow" onClick={() => selectContractor(contratista.id)}>
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg bg-cream2 text-brown flex items-center justify-center"><Building2 size={20} /></div>
                  <div className="min-w-0"><strong className="text-[15px] text-navy">{contratista.nombre}</strong><p className="text-[13px] text-gray-400">RUT {contratista.rut}</p></div>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  {proyectos.map(project => <span key={project.id} className="badge b-gray">{project.nombre} · {estadoLabel(calcularEstadoAcreditacion(contratista, project.id))}</span>)}
                </div>
              </button>
            );
          })}
          {contratistasMandante.length === 0 && <div className="card text-gray-400">No hay contratistas asociados a los proyectos del mandante.</div>}
        </div>
      </div>
    );
  }

  const proyectos = misProyectos.filter(project => project.contratistas.includes(selected.id));
  const tabs: Array<{ id: ContractorTab; label: string; icon: typeof Building2 }> = [
    { id: 'resumen', label: 'Resumen', icon: Building2 },
    { id: 'acreditaciones', label: 'Acreditaciones', icon: ShieldCheck },
    { id: 'trabajadores', label: 'Trabajadores', icon: Users },
    { id: 'documentos', label: 'Documentos', icon: FileText },
  ];

  return (
    <div className="fade-in">
      <button type="button" className="btn btn-ghost mb-4" onClick={() => setSelectedContratista(null)}><ArrowLeft size={16} /> Volver a contratistas</button>
      <div className="page-header"><div><h2 className="page-title">{selected.nombre}</h2><p className="page-sub">RUT {selected.rut} · {proyectos.length} proyecto{proyectos.length === 1 ? '' : 's'} asociado{proyectos.length === 1 ? '' : 's'}</p></div></div>
      <div className="tab-bar mb-6 grid grid-cols-4 w-full sm:flex sm:w-max">
        {tabs.map(({ id, label, icon: Icon }) => <button key={id} type="button" className={`tab min-w-0 justify-center px-1 text-[11px] sm:px-4 sm:text-[13px] ${activeContractorTab === id ? 'active' : ''}`} onClick={() => setActiveContractorTab(id)}><Icon size={15} className="hidden sm:block" /> {label}</button>)}
      </div>

      {(activeContractorTab === 'resumen' || activeContractorTab === 'acreditaciones') && (
        <div className="card-grid">
          {proyectos.map(project => {
            const estado = estadoLabel(calcularEstadoAcreditacion(selected, project.id));
            const accesoPago = calcularAccesoPago(selected, project.id);
            return <div key={project.id} className="card"><div className="flex justify-between gap-3"><div><strong>{project.nombre}</strong><p className="text-[13px] text-gray-400">Acreditación independiente por proyecto</p></div><span className={`badge ${estado === 'Acreditado' ? 'b-green' : estado === 'Bloqueado' ? 'b-red' : 'b-yellow'}`}>{estado}</span></div>{activeContractorTab === 'acreditaciones' && <p className="mt-4 text-[13px] text-gray-500">Acceso: {accesoPago.accesoBloqueado ? 'Bloqueado' : 'Habilitado'} · Pago: {accesoPago.pagoBloqueado ? 'Retenido' : 'Habilitado'}</p>}<button type="button" className="btn btn-ghost btn-sm mt-4" onClick={() => onOpenProject(project.id)}><Folder size={14} /> Ver proyecto</button></div>;
          })}
        </div>
      )}

      {activeContractorTab === 'trabajadores' && <div className="card"><div className="table-wrap"><table><thead><tr><th>Trabajador</th><th>RUT</th><th>Proyecto</th><th>Estado</th></tr></thead><tbody>{proyectos.flatMap(project => (selected.trabajadores || []).filter(worker => esTrabajadorAsignado(worker, project.id)).map(worker => <tr key={`${project.id}:${worker.rut}`}><td>{worker.nombre}</td><td>{worker.rut}</td><td>{project.nombre}</td><td>{worker.estado}</td></tr>))}</tbody></table></div></div>}

      {activeContractorTab === 'documentos' && <div className="card"><div className="table-wrap"><table><thead><tr><th>Documento</th><th>Proyecto</th><th>Estado</th><th>Vencimiento</th></tr></thead><tbody>{selected.documentos.filter(doc => proyectos.some(project => project.id === doc.proyectoId)).map(doc => <tr key={doc.id}><td>{doc.nombre}</td><td>{proyectos.find(project => project.id === doc.proyectoId)?.nombre || '—'}</td><td>{doc.estado}</td><td>{doc.vencimiento}</td></tr>)}</tbody></table></div></div>}
    </div>
  );
}
