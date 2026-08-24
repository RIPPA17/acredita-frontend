import {
  AlertCircle, AlertTriangle, Archive, ArrowLeft, Banknote, Briefcase, Calendar, CalendarDays,
  Check, CheckCircle, ClipboardList, Clock, Download, Eye, Key, MapPin, Pencil, Plus, Save,
  SlidersHorizontal, Trash2, UserPlus, Users, X, XCircle
} from 'lucide-react';
import { getRequisitos, saveRequisitos, getProyectos, saveProyectos, calcularEstadoAcreditacion, calcularAccesoPago } from '../../data/localStorageDb';
import { Contratista, Proyecto } from '../../types';
import FichaAcreditacion from '../../components/FichaAcreditacion';

export default function ProyectosTab({
  activeProjectTab,
  setActiveProjectTab,
  vistaContratistas,
  setVistaContratistas,
  misProyectos,
  allContratistas,
  selectedContratista,
  setSelectedContratista,
  proyectoSeleccionadoAjustes,
  setProyectoSeleccionadoAjustes,
  PROYECTOS_AJUSTES,
  ajustesEditando,
  setAjustesEditando,
  showToast,
  newDocForm,
  setNewDocForm,
  isAddDocModalOpen,
  setIsAddDocModalOpen,
  proyectoArchivado,
  setProyectoArchivado,
  selectedProjectId,
  setShowInvitarModal,
  contractorsData,
  documentRequirements,
  editingContractorId,
  setEditingContractorId,
  handleCellEdit,
  handleAddRequirement,
  setDocumentRequirements,
}: {
  activeProjectTab: string;
  setActiveProjectTab: (v: string) => void;
  vistaContratistas: string;
  setVistaContratistas: (v: string) => void;
  misProyectos: Proyecto[];
  allContratistas: Contratista[];
  selectedContratista: string | null;
  setSelectedContratista: (v: string | null) => void;
  proyectoSeleccionadoAjustes: string | null;
  setProyectoSeleccionadoAjustes: (v: string | null) => void;
  PROYECTOS_AJUSTES: any[];
  ajustesEditando: boolean;
  setAjustesEditando: (v: boolean) => void;
  showToast: (msg: string, type?: 'success' | 'error' | 'warning') => void;
  newDocForm: any;
  setNewDocForm: (v: any) => void;
  isAddDocModalOpen: boolean;
  setIsAddDocModalOpen: (v: boolean) => void;
  proyectoArchivado: boolean;
  setProyectoArchivado: (v: boolean) => void;
  selectedProjectId: string | null;
  setShowInvitarModal: (v: boolean) => void;
  contractorsData: any[];
  documentRequirements: any[];
  editingContractorId: string | null;
  setEditingContractorId: (v: string | null) => void;
  handleCellEdit: () => void;
  handleAddRequirement: () => void;
  setDocumentRequirements: (v: any[]) => void;
}) {
  return (
    <div className="fade-in flex flex-col h-full">
      <div className="tab-bar mb-6 shrink-0">
        <button className={`tab ${activeProjectTab === 'resumen' ? 'active' : ''}`} onClick={() => setActiveProjectTab('resumen')}>Resumen</button>
        <button className={`tab ${activeProjectTab === 'contratistas' ? 'active' : ''}`} onClick={() => setActiveProjectTab('contratistas')}>Contratistas</button>
        <button className={`tab ${activeProjectTab === 'requisitos' ? 'active' : ''}`} onClick={() => setActiveProjectTab('requisitos')}>Requisitos</button>
        <button className={`tab ${activeProjectTab === 'acreditaciones' ? 'active' : ''}`} onClick={() => setActiveProjectTab('acreditaciones')}>Acreditaciones</button>
      </div>

      {/* PAGOS TAB (Complex example) */}
      {activeProjectTab === 'acreditaciones' && (
        <div className="fade-in">
          <div className="page-header">
            <div>
              <h2 className="page-title">Estado de pago — Mayo 2026</h2>
              <p className="page-sub">Habilitación de pago por contratista · Torre Mackenna</p>
            </div>
            <button className="btn btn-secondary cursor-not-allowed opacity-50 font-medium" disabled title="No disponible en demo">
              <Download size={16} /> Exportar todos [Demo]
            </button>
          </div>

          <div className="card-grid">
            {(() => {
              const activePaymentProjectId = (vistaContratistas && vistaContratistas !== 'proyectos') ? vistaContratistas : 'mackenna';
              const paymentProjectObj = misProyectos.find(p => p.id === activePaymentProjectId) || misProyectos[0];
              const paymentContractors = allContratistas.filter(c => paymentProjectObj?.contratistas.includes(c.id));

              if (paymentContractors.length === 0) {
                return <div className="text-gray-400 py-4 col-span-2 text-center text-sm">No hay contratistas asignados a este proyecto.</div>;
              }

              return paymentContractors.map(c => {
                const approvedCount = c.documentos.filter(d => d.estado === 'aprobado').length;
                const totalCount = c.documentos.length;
                const pct = totalCount > 0 ? Math.round((approvedCount / totalCount) * 100) : 0;

                const hasRejected = c.documentos.some(d => d.estado === 'rechazado');
                const hasRevision = c.documentos.some(d => d.estado === 'revision' || d.estado === 'pendiente');

                let statusLabel = 'Pago habilitado';
                let badgeClass = 'b-green';
                let borderColor = 'border-l-[#2a6a3a]';
                let barColor = 'bg-[#2a6a3a]';

                if (hasRejected) {
                  statusLabel = 'Pago retenido';
                  badgeClass = 'b-red';
                  borderColor = 'border-l-[#c02020]';
                  barColor = 'bg-[#c02020]';
                } else if (hasRevision) {
                  statusLabel = 'En revisión';
                  badgeClass = 'b-yellow';
                  borderColor = 'border-l-[#c08000]';
                  barColor = 'bg-[#c08000]';
                }

                return (
                  <div key={c.id} className={`card border-l-4 ${borderColor} rounded-l-none`}>
                    <div className="flex justify-between items-start mb-2">
                      <div><strong className="text-[15.4px]">{c.nombre}</strong><br/><span className="text-[13.2px] text-gray-400">{c.rut}</span></div>
                      <span className={`badge ${badgeClass}`}>{statusLabel}</span>
                    </div>
                    <div className="text-[14.3px] text-gray-500 mb-3">{approvedCount}/{totalCount} documentos aprobados · {pct}% de avance</div>
                    <div className="prog-wrap"><div className="prog-fill" style={{ width: `${pct}%`, backgroundColor: barColor === 'bg-[#c02020]' ? '#c02020' : barColor === 'bg-[#c08000]' ? '#c08000' : '#2a6a3a' }}></div></div>
                    <div className="mt-3 flex gap-2">
                      <button className="btn btn-ghost btn-sm cursor-not-allowed opacity-50 font-medium" disabled title="No disponible en demo"><Download size={14} /> Informe PDF [Demo]</button>
                      <button className="btn btn-ghost btn-sm" onClick={() => { setSelectedContratista(c.id); setActiveProjectTab('contratistas'); }}><Eye size={14} /> Ver acreditación</button>
                    </div>
                  </div>
                );
              });
            })()}
          </div>
        </div>
      )}

      {/* Proyectos Tab */}
      {activeProjectTab === 'resumen' && (
        <div className="fade-in max-w-4xl">
          {proyectoSeleccionadoAjustes === null ? (
            <div className="fade-in">
              <div className="page-header">
                <div>
                  <h2 className="page-title">Proyectos</h2>
                  <p className="page-sub">Selecciona un proyecto para ver su resumen o configurarlo</p>
                         <div className="card-grid">
                    {misProyectos.map(p => {
                      let imgUrl = "https://images.unsplash.com/photo-1504307651254-35680f356dfd?auto=format&fit=crop&q=80&w=400";
                      let badgeClass = "b-green";
                      let badgeText = "Al día";
                      let barColor = "bg-[#2a6a3a]";
                      let percent = 100;
                      let loc = "Mackenna 890, San Joaquín";
                      let dates = "Inicio: 10 Feb 2026 · Cierre: Jun 2027";
                      let workersCount = 52;

                      if (p.id === 'costanera') {
                        imgUrl = "https://images.unsplash.com/photo-1541888946425-d81bb19240f5?auto=format&fit=crop&q=80&w=400";
                        badgeClass = "b-red";
                        badgeText = "Crítico";
                        barColor = "bg-[#c02020]";
                        percent = 45;
                        loc = "Costanera 200, Santiago";
                        dates = "Inicio: 15 Ene 2026 · Cierre: Dic 2026";
                        workersCount = 28;
                      } else if (p.id === 'mackenna') {
                        imgUrl = "https://images.unsplash.com/photo-1504307651254-35680f356dfd?auto=format&fit=crop&q=80&w=400";
                        badgeClass = "b-yellow text-yellow-900 border-none bg-yellow-100";
                        badgeText = "Atención";
                        barColor = "bg-[#c08000]";
                        percent = 85;
                        loc = "Mackenna 890, San Joaquín";
                        dates = "Inicio: 10 Feb 2026 · Cierre: Jun 2027";
                        workersCount = 52;
                      } else if (p.id === 'hospital') {
                        imgUrl = "https://images.unsplash.com/photo-1581094794329-c8112a89af12?auto=format&fit=crop&q=80&w=400";
                        badgeClass = "b-green";
                        badgeText = "Al día";
                        barColor = "bg-[#2a6a3a]";
                        percent = 88;
                        loc = "Av. Libertad 200, Concepción";
                        dates = "Inicio: 15 Mar 2025 · Cierre: 10 May 2027";
                        workersCount = 112;
                      }

                      // Adjust if archived
                      if (p.estado === 'Archivado') {
                        badgeClass = "b-gray";
                        badgeText = "Archivado";
                        barColor = "bg-gray-400";
                      }

                      return (
                        <div key={p.id} className="proj-card cursor-pointer hover:shadow-md transition-shadow" onClick={() => { setProyectoSeleccionadoAjustes(p.id); setProyectoArchivado(p.estado === 'Archivado'); }}>
                          <img src={imgUrl} alt={p.nombre} className="w-full h-28 rounded-lg object-cover border border-cream3 mb-3" referrerPolicy="no-referrer" />
                          <div className="flex justify-between items-start mb-3">
                            <h4 className="text-[15.4px] font-bold text-navy leading-tight">{p.nombre}</h4>
                            <span className={`badge ${badgeClass}`}>{badgeText}</span>
                          </div>
                          <div className="flex flex-col gap-1.5 mb-3">
                            <div className="flex items-center gap-2 text-[12.5px] text-gray-500">
                              <MapPin size={13} className="text-brown flex-shrink-0" /> {loc}
                            </div>
                            <div className="flex items-center gap-2 text-[12.5px] text-gray-500">
                              <CalendarDays size={13} className="text-brown flex-shrink-0" /> {dates}
                            </div>
                            <div className="flex items-center gap-2 text-[12.5px] text-gray-500">
                              <Users size={13} className="text-brown flex-shrink-0" /> {workersCount} trabajadores activos
                            </div>
                            <div className="flex items-center gap-2 text-[12.5px] text-gray-500">
                              <Briefcase size={13} className="text-brown flex-shrink-0" /> {p.contratistas.length} empresas contratistas
                            </div>
                          </div>
                          <div className="prog-wrap"><div className="prog-fill" style={{ width: `${percent}%`, backgroundColor: barColor === 'bg-[#c02020]' ? '#c02020' : barColor === 'bg-[#c08000]' ? '#c08000' : '#2a6a3a' }}></div></div>
                          <p className="text-[12.5px] text-gray-600 mt-1.5">{percent}% documentos aprobados</p>
                        </div>
                      );
                    })}
                  </div>                   </div>

              </div>
            </div>
          ) : (
            <>
              <div
                className="text-[13.2px] text-gray-500 cursor-pointer mb-2 flex items-center gap-1 w-max hover:text-navy"
                onClick={() => { setProyectoSeleccionadoAjustes(null); setAjustesEditando(false); }}
              >
                <ArrowLeft size={14} /> Ajustes del Proyecto
              </div>
              <div className="page-header">
                <div>
                  <h2 className="page-title">{PROYECTOS_AJUSTES.find(p => p.id === proyectoSeleccionadoAjustes)?.nombre}</h2>
                  <p className="page-sub">Establece los datos base del proyecto activo</p>
                </div>
                <button className="btn btn-primary" onClick={() => { setAjustesEditando(!ajustesEditando); showToast(ajustesEditando ? 'Cambios guardados' : 'Modo edición activado'); }}>
                  {ajustesEditando ? <><Save size={15} className="mr-1" /> Guardar cambios</> : <><Pencil size={15} className="mr-1" /> Editar proyecto</>}
                </button>
              </div>

              <div className="card mb-4">
                <h3 className="section-title mb-4">Datos del Proyecto</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="form-label">Nombre del proyecto</label>
                    <input className="form-input w-full" defaultValue={PROYECTOS_AJUSTES.find(p => p.id === proyectoSeleccionadoAjustes)?.nombre || ""} disabled={!ajustesEditando} />
                  </div>
                  <div>
                    <label className="form-label">Dirección de la obra</label>
                    <input className="form-input w-full" defaultValue="Av. Costanera 1200, Santiago" disabled={!ajustesEditando} />
                  </div>
                  <div>
                    <label className="form-label">Fecha de inicio</label>
                    <input type="date" className="form-input w-full" defaultValue="2026-01-15" disabled={!ajustesEditando} />
                  </div>
                  <div>
                    <label className="form-label">Fecha de cierre estimada</label>
                    <input type="date" className="form-input w-full" defaultValue="2026-12-15" disabled={!ajustesEditando} />
                  </div>
                  <div>
                    <label className="form-label">Estado del proyecto</label>
                    <select className="form-input w-full" disabled={!ajustesEditando}>
                      <option>Activo</option>
                      <option>Pausado</option>
                      <option>Cerrado</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* MATRIZ DE REQUISITOS DEL PROYECTO */}
              <div className="card mb-4">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="section-title mb-0">Requisitos del Proyecto</h3>
                  {ajustesEditando && (
                    <button
                      onClick={() => {
                        setNewDocForm({
                          name: '',
                          category: 'Laboral',
                          frequency: 'Mensual',
                          destino: 'empresa',
                          obligatorio: true,
                          criticidad: 'bloquea_pago'
                        });
                        setIsAddDocModalOpen(true);
                      }}
                      className="btn btn-ghost btn-sm text-brown"
                    >
                      <Plus size={14} className="mr-1" /> Añadir Requisito
                    </button>
                  )}
                </div>

                <div className="overflow-x-auto">
                  <table className="table w-full text-left text-sm font-sans">
                    <thead>
                      <tr className="border-b border-cream3 text-[11.5px] text-gray-500 font-semibold uppercase">
                        <th className="py-2.5">Requisito</th>
                        <th className="py-2.5">Aplica a</th>
                        <th className="py-2.5">Obligatorio</th>
                        <th className="py-2.5">Criticidad</th>
                        <th className="py-2.5">Frecuencia</th>
                        {ajustesEditando && <th className="py-2.5 text-right">Acción</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {(() => {
                        const reqs = getRequisitos().filter(r => r.proyectoId === proyectoSeleccionadoAjustes);
                        if (reqs.length === 0) {
                          return (
                            <tr>
                              <td colSpan={6} className="py-4 text-center text-gray-400 text-sm">
                                No hay requisitos activos para este proyecto.
                              </td>
                            </tr>
                          );
                        }

                        return reqs.map(req => {
                          const toggleActive = () => {
                            const list = getRequisitos();
                            const rIdx = list.findIndex(r => r.id === req.id);
                            if (rIdx !== -1) {
                              list[rIdx].activo = !list[rIdx].activo;
                              saveRequisitos(list);
                              showToast(list[rIdx].activo ? 'Requisito activado' : 'Requisito desactivado');
                              setDocumentRequirements([]);
                            }
                          };

                          const toggleObligatorio = () => {
                            const list = getRequisitos();
                            const rIdx = list.findIndex(r => r.id === req.id);
                            if (rIdx !== -1) {
                              list[rIdx].obligatorio = !list[rIdx].obligatorio;
                              saveRequisitos(list);
                              showToast(list[rIdx].obligatorio ? 'Requisito marcado como obligatorio' : 'Requisito marcado como opcional');
                              setDocumentRequirements([]);
                            }
                          };

                          const changeDestino = (newDest: 'empresa' | 'trabajador') => {
                            const list = getRequisitos();
                            const rIdx = list.findIndex(r => r.id === req.id);
                            if (rIdx !== -1) {
                              list[rIdx].destino = newDest;
                              saveRequisitos(list);
                              showToast('Destinatario de requisito modificado');
                              setDocumentRequirements([]);
                            }
                          };

                          return (
                            <tr key={req.id} className={`border-b border-cream/50 ${!req.activo ? 'opacity-40' : ''}`}>
                              <td className="py-3 font-semibold text-navy">
                                {req.nombre}
                              </td>
                              <td className="py-3">
                                {ajustesEditando ? (
                                  <select
                                    value={req.destino}
                                    onChange={(e) => changeDestino(e.target.value as any)}
                                    className="text-[12px] border border-cream3 rounded px-1 py-0.5 bg-white text-navy focus:outline-none"
                                  >
                                    <option value="empresa">Empresa</option>
                                    <option value="trabajador">Trabajador</option>
                                  </select>
                                ) : (
                                  <span className={`badge ${req.destino === 'trabajador' ? 'b-yellow' : 'b-green'} text-[10px] py-0.5 px-1.5`}>
                                    {req.destino === 'trabajador' ? 'Trabajador' : 'Empresa'}
                                  </span>
                                )}
                              </td>
                              <td className="py-3">
                                <input
                                  type="checkbox"
                                  checked={req.obligatorio}
                                  onChange={toggleObligatorio}
                                  disabled={!ajustesEditando}
                                  className="accent-navy w-4 h-4 cursor-pointer"
                                />
                              </td>
                              <td className="py-3 font-medium">
                                <span className={`text-[11px] ${req.criticidad === 'bloquea_acceso' ? 'text-red-600' : req.criticidad === 'bloquea_pago' ? 'text-yellow-600' : 'text-gray-500'}`}>
                                  {req.criticidad === 'bloquea_acceso' ? 'Bloquea Acceso' : req.criticidad === 'bloquea_pago' ? 'Bloquea Pago' : 'Advertencia'}
                                </span>
                              </td>
                              <td className="py-3 text-gray-500 text-[12px]">
                                {req.frecuencia}
                              </td>
                              {ajustesEditando && (
                                <td className="py-3 text-right">
                                  <button
                                    onClick={toggleActive}
                                    className={`btn btn-xs py-0.5 px-2 rounded font-bold border-none text-white ${req.activo ? 'bg-red-500 hover:bg-red-600' : 'bg-green-500 hover:bg-green-600'}`}
                                  >
                                    {req.activo ? 'Desactivar' : 'Activar'}
                                  </button>
                                </td>
                              )}
                            </tr>
                          );
                        });
                      })()}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="card mb-4">
                <h3 className="section-title mb-4">Revisores con acceso</h3>
                <div className="flex flex-col gap-2 mb-3">
                  {[
                    { nombre: 'Carolina Muñoz', rol: 'Administrador', avatar: 'CM' },
                    { nombre: 'Felipe Rojas', rol: 'Revisor', avatar: 'FR' },
                  ].map(u => (
                    <div key={u.nombre} className="flex items-center justify-between py-2 border-b border-cream">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-navy text-white flex items-center justify-center text-[12px] font-bold">{u.avatar}</div>
                        <div>
                          <div className="text-[14px] font-medium text-navy">{u.nombre}</div>
                          <div className="text-[12px] text-gray-400">{u.rol}</div>
                        </div>
                      </div>
                      {ajustesEditando && u.rol !== 'Administrador' && (
                        <button className="btn btn-ghost btn-sm text-gray-300 cursor-not-allowed" disabled title="No disponible en demo">
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                {ajustesEditando && (
                  <button className="btn btn-ghost btn-sm text-gray-400 cursor-not-allowed" disabled title="No disponible en demo">
                    <Plus size={14} className="mr-1" /> Agregar revisor [Demo]
                  </button>
                )}
              </div>

              <div className="card mb-4">
                <h3 className="section-title mb-4">Notificaciones</h3>
                <div className="flex flex-col gap-3">
                  {[
                    { label: 'Documentos rechazados', desc: 'Aviso inmediato al rechazar un documento' },
                    { label: 'Documentos por vencer', desc: 'Aviso con 7 días de anticipación' },
                    { label: 'Resumen semanal', desc: 'Estado general del proyecto cada lunes' },
                  ].map(n => (
                    <div key={n.label} className="flex items-center justify-between">
                      <div>
                        <div className="text-[14px] font-medium text-navy">{n.label}</div>
                        <div className="text-[12px] text-gray-400">{n.desc}</div>
                      </div>
                      <input type="checkbox" defaultChecked className="accent-navy w-4 h-4 cursor-pointer" disabled={!ajustesEditando} />
                    </div>
                  ))}
                </div>
              </div>

              <div className="card border border-red-200 mb-4">
                <h3 className="section-title text-red-500 mb-1">Zona de peligro</h3>
                <p className="text-[13.2px] text-gray-500 mb-4">Estas acciones no se pueden deshacer fácilmente.</p>
                <button
                  className="btn btn-sm bg-red-50 text-red-600 border border-red-200 hover:bg-red-100"
                  onClick={() => {
                    const projList = getProyectos();
                    const pIdx = projList.findIndex(p => p.id === selectedProjectId);
                    if (pIdx !== -1) {
                      projList[pIdx].estado = 'Archivado';
                      saveProyectos(projList);
                    }
                    setProyectoArchivado(true);
                    showToast('Proyecto archivado', 'error');
                  }}
                  disabled={proyectoArchivado}
                >
                  <Archive size={14} className="mr-1" /> {proyectoArchivado ? 'Proyecto archivado' : 'Archivar proyecto'}
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* Contratistas Tab */}
      {activeProjectTab === 'contratistas' && (
        <div className="fade-in">
          {vistaContratistas === 'proyectos' ? (
            <>
              <div className="page-header">
                <div>
                  <h2 className="page-title">Proyectos</h2>
                  <p className="page-sub">Gestión de contratistas agrupados por proyecto</p>
                </div>
                <button className="btn btn-primary" onClick={() => setShowInvitarModal(true)}>
                  <UserPlus size={16} className="mr-1" /> Invitar Contratista
                </button>
              </div>

              <div className="card-grid">
                {misProyectos.map(p => {
                  const countContratistas = p.contratistas.length;
                  let badgeClass = 'b-green';
                  let badgeText = 'Al día';
                  let barColor = 'bg-green-500';
                  let percent = 100;

                  if (p.id === 'costanera') {
                    badgeClass = 'b-red';
                    badgeText = 'Crítico';
                    barColor = 'bg-red-500';
                    percent = 71;
                  } else if (p.id === 'mackenna') {
                    badgeClass = 'bg-yellow-100 text-yellow-800 border-none';
                    badgeText = 'Atención';
                    barColor = 'bg-yellow-500';
                    percent = 85;
                  }

                  if (p.estado === 'Archivado') {
                    badgeClass = 'b-gray';
                    badgeText = 'Archivado';
                    barColor = 'bg-gray-400';
                  }

                  return (
                    <div key={p.id} className="proj-card cursor-pointer hover:shadow-md transition-shadow font-sans" onClick={() => setVistaContratistas(p.id)}>
                      <div className="flex justify-between items-start mb-2">
                        <h4 className="text-[15.4px] font-medium text-navy">{p.nombre}</h4>
                        <span className={`badge ${badgeClass}`}>{badgeText}</span>
                      </div>
                      <div className="flex items-center text-[13.2px] text-gray-500 mb-2.5 gap-3">
                        <span className="flex items-center gap-1"><Users size={14} /> {countContratistas} contratistas</span>
                        <span className="flex items-center gap-1"><Calendar size={14} /> Cierre 30 Nov 2026</span>
                      </div>
                      <div className="prog-wrap">
                        <div className="prog-fill" style={{ width: `${percent}%`, backgroundColor: barColor === 'bg-red-500' ? '#c02020' : barColor === 'bg-yellow-500' ? '#c08000' : '#2a6a3a' }}></div>
                      </div>
                      <p className="text-[13.2px] text-gray-600 mt-1.5 mb-2">{percent}% documentos aprobados</p>
                    </div>
                  );
                })}
              </div>
            </>
          ) : selectedContratista ? (
            <>
              <button type="button" className="text-[14px] font-medium text-black cursor-pointer mb-4 flex items-center gap-1.5 w-max hover:opacity-80 transition-opacity" onClick={() => setSelectedContratista(null)}>
                <ArrowLeft size={18} className="text-orange-500" /> Volver a contratistas
              </button>
              {(() => {
                const cObj = allContratistas.find(c => c.id === selectedContratista);
                if (!cObj) return null;
                return (
                  <FichaAcreditacion
                    tipo="empresa"
                    contratista={cObj}
                    proyectoId={vistaContratistas === 'todos' ? cObj.proyectos[0] || 'costanera' : vistaContratistas}
                    onClose={() => setSelectedContratista(null)}
                    rol="mandante"
                  />
                );
              })()}
            </>
          ) : (
            <>
              <button type="button" className="text-[14px] font-medium text-black cursor-pointer mb-2 flex items-center gap-1.5 w-max hover:opacity-80 transition-opacity" onClick={() => { setVistaContratistas('proyectos'); setSelectedContratista(null); }}>
                <ArrowLeft size={18} className="text-orange-500" /> Proyectos
              </button>
              {(() => {
                const proyectoActivoObj = misProyectos.find(p => p.id === vistaContratistas);
                let badgeClass = 'b-green';
                let badgeText = 'Al día';
                if (proyectoActivoObj) {
                  if (proyectoActivoObj.id === 'costanera') {
                    badgeClass = 'b-red';
                    badgeText = 'Crítico';
                  } else if (proyectoActivoObj.id === 'mackenna') {
                    badgeClass = 'bg-yellow-100 text-yellow-800 border-none';
                    badgeText = 'Atención';
                  }
                }
                return (
                  <div className="page-header">
                    <div>
                      <h2 className="page-title flex items-center gap-2 font-sans">
                        {proyectoActivoObj?.nombre}
                        <span className={`badge ${badgeClass}`}>{badgeText}</span>
                      </h2>
                      <p className="page-sub">Directorio de Contratistas</p>
                    </div>
                    <button className="btn btn-primary" onClick={() => setShowInvitarModal(true)}>
                      <UserPlus size={16} className="mr-1" /> Invitar Contratista
                    </button>
                  </div>
                );
              })()}

              <div className="flex gap-2 mb-4">
                <input type="text" className="form-input flex-1 min-w-[200px]" placeholder="Buscar por razón social o RUT..." />
                <select className="form-input min-w-[180px]">
                  <option>Todos los estados</option>
                  <option>Al día</option>
                  <option>Con advertencias</option>
                  <option>Estado crítico</option>
                </select>
              </div>

              <div className="card p-0 overflow-x-auto mb-24">
                <div className="overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0">
                  <table className="table w-full text-left min-w-[600px]">
                  <thead>
                    <tr>
                      <th className="px-4 py-3 border-b border-cream3 text-[13.2px] text-gray-600 bg-cream2 font-medium">Empresa / RUT</th>
                      <th className="px-4 py-3 border-b border-cream3 text-[13.2px] text-gray-600 bg-cream2 font-medium">Proyectos Asignados</th>
                      <th className="px-4 py-3 border-b border-cream3 text-[13.2px] text-gray-600 bg-cream2 font-medium min-w-[150px]">Progreso Acreditación</th>
                      <th className="px-4 py-3 border-b border-cream3 text-[13.2px] text-gray-600 bg-cream2 font-medium">Estado Acreditación</th>
                      <th className="px-4 py-3 border-b border-cream3 text-[13.2px] text-gray-600 bg-cream2 font-medium text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {contractorsData.filter(c => c.isPending).map(c => (
                      <tr key={c.id} className="hover:bg-gray-50 border-b border-cream">
                        <td className="px-4 py-3">
                          <div className="font-bold text-[14.3px] text-navy">{c.name}</div>
                          <div className="text-[12.1px] text-gray-500">{c.rut}</div>
                        </td>
                        <td className="px-4 py-3">
                          <span className="badge b-gray mr-1">Pre-asignado</span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-[12.1px] font-medium text-gray-500">N/A</span>
                        </td>
                        <td className="px-4 py-3"><span className="badge b-yellow">Invitación pendiente</span></td>
                        <td className="px-4 py-3 text-right">
                          <button className="btn btn-ghost btn-sm text-gray-300 cursor-not-allowed" disabled title="No disponible en demo">Reenviar [Demo]</button>
                        </td>
                      </tr>
                    ))}

                    {(() => {
                      const proyectoActivoObj = misProyectos.find(p => p.id === vistaContratistas);
                      const contratistasDelProyecto = proyectoActivoObj ? allContratistas.filter(c => proyectoActivoObj.contratistas.includes(c.id)) : [];

                      return contratistasDelProyecto.map(c => {
                        const contractorInState = contractorsData.find(cs => cs.id === c.id);
                        const okCount = contractorInState ? Object.values(contractorInState.status).filter(s => s === 'ok').length : 0;
                        const totalCount = contractorInState ? Object.values(contractorInState.status).filter(s => s !== 'na').length : 0;
                        const percent = totalCount > 0 ? Math.round((okCount / totalCount) * 100) : 0;

                        // Determine accreditation state
                        const contractorObj = allContratistas.find(co => co.id === c.id);
                        const workers = contractorObj?.trabajadores || [];

                        const statusLabelVal = contractorObj ? calcularEstadoAcreditacion(contractorObj) : 'No acreditado';
                        const statusLabel = statusLabelVal === 'Aprobado' ? 'Acreditado' : statusLabelVal === 'Vencido/Bloqueado' ? 'Bloqueado' : statusLabelVal;
                        const badgeClass = statusLabelVal === 'Aprobado' ? 'b-green' : statusLabelVal === 'Vencido/Bloqueado' ? 'b-red' : 'b-yellow';
                        const barColor = statusLabelVal === 'Aprobado' ? 'bg-[#2a6a3a]' : statusLabelVal === 'Vencido/Bloqueado' ? 'bg-[#c02020]' : 'bg-[#c08000]';
                        const { accesoBloqueado: accB, pagoBloqueado: pagB } = contractorObj ? calcularAccesoPago(contractorObj, vistaContratistas) : { accesoBloqueado: false, pagoBloqueado: false };

                        return (
                          <tr key={c.id} className="hover:bg-gray-50 border-b border-cream cursor-pointer" onClick={() => setSelectedContratista(c.id)}>
                            <td className="px-4 py-3">
                              <div className="font-bold text-[14.3px] text-navy">{c.nombre}</div>
                              <div className="text-[12.1px] text-gray-500">{c.rut}</div>
                            </td>
                            <td className="px-4 py-3">
                              <span className="badge b-gray mr-1">
                                {proyectoActivoObj?.nombre || 'Proyecto'}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <div className="prog-wrap flex-1 min-w-[80px] m-0">
                                  <div className="prog-fill" style={{ width: `${percent}%`, backgroundColor: barColor === 'bg-[#c02020]' ? '#c02020' : barColor === 'bg-[#c08000]' ? '#c08000' : '#2a6a3a' }}></div>
                                </div>
                                <span className="text-[12.1px] font-medium text-gray-700">{percent}%</span>
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <span className={`badge ${badgeClass}`}>{statusLabel}</span>
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
                              <button className="btn btn-ghost btn-sm" onClick={(e) => { e.stopPropagation(); setSelectedContratista(c.id); }}><Eye size={14} className="mr-1" /> Ver acreditación</button>
                            </td>
                          </tr>
                        );
                      });
                    })()}
                  </tbody>
                </table>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* Requisitos del proyecto */}
      {activeProjectTab === 'requisitos' && (
        <div className="fade-in">
          <div className="page-header">
            <div>
              <h2 className="page-title">Requisitos del proyecto</h2>
              <p className="page-sub">Control detallado de requisitos y excepciones</p>
            </div>
            <button className="btn btn-primary cursor-not-allowed opacity-50" disabled title="No disponible en demo">Configurar Matriz [Demo]</button>
          </div>

          <div className="flex gap-2 mb-6">
            <select className="form-input min-w-[180px]">
              <option>Todos los proyectos</option>
              <option>Hospital Regional Centro</option>
              <option>Torre Mackenna</option>
            </select>
            <input type="text" className="form-input min-w-[200px]" placeholder="Buscar Contratista..." />
          </div>

          <div className="flex gap-4 mb-3 items-center text-[12.1px]">
            <span className="font-semibold text-gray-500 uppercase tracking-wider">Estados:</span>
            <div className="flex items-center gap-3">
              <span className="badge b-green flex items-center gap-1.5"><CheckCircle size={12} /> Aprobado</span>
              <span className="badge b-yellow flex items-center gap-1.5"><AlertTriangle size={12} /> Por vencer</span>
              <span className="badge b-red flex items-center gap-1.5"><XCircle size={12} /> Rechazado</span>
              <span className="badge b-gray flex items-center gap-1.5"><span className="text-gray-400 font-bold">—</span> No requerido</span>
            </div>
          </div>

          {contractorsData.length === 0 ? (
            <div className="text-center py-20 text-gray-400">
              <ClipboardList size={48} className="mx-auto mb-4 text-gray-300" />
              <p className="font-medium text-gray-500 mb-1">No hay documentos por revisar</p>
              <p className="text-sm">Los documentos aparecerán aquí cuando un contratista suba archivos.</p>
            </div>
          ) : (
            <div className="card p-0 overflow-x-auto">
              <div className="overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0">
                <table className="table w-full text-center min-w-[600px]">
                <thead>
                  <tr>
                    <th className="px-4 py-3 border-b border-cream3 text-[13.2px] text-gray-600 bg-cream2 font-medium text-left min-w-[200px]">Empresa Contratista</th>
                    {documentRequirements.map((req) => (
                      <th key={req.id} className="px-4 py-3 border-b border-cream3 text-[13.2px] text-gray-600 bg-cream2 font-medium">
                        {req.name}
                      </th>
                    ))}
                    <th className="px-4 py-3 border-b border-cream3 text-[13.2px] text-gray-600 bg-cream2 font-medium text-center min-w-[150px]">
                      <button
                        onClick={() => setIsAddDocModalOpen(true)}
                        className="btn btn-ghost btn-sm px-2 py-1 mx-auto text-navy hover:bg-cream"
                      >
                        <Plus size={14} className="mr-1" /> Añadir Documento
                      </button>
                    </th>
                    <th className="px-4 py-3 border-b border-cream3 text-[13.2px] text-gray-600 bg-cream2 font-medium text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {contractorsData.map(contractor => {
                    const isEditing = editingContractorId === contractor.id;

                    const renderCell = (docKey: string) => {
                      if (isEditing) {
                        return (
                          <input
                            type="checkbox"
                            className="accent-navy w-4 h-4 mx-auto block cursor-pointer rounded border-gray-300"
                            defaultChecked={contractor.reqs[docKey]}
                            onChange={handleCellEdit}
                          />
                        );
                      }

                      const status = contractor.status[docKey];
                      if (status === 'na') {
                        return <span className="text-gray-400 font-medium block text-center" title="No requerido">—</span>;
                      }

                      if (status === 'ok') return <CheckCircle size={20} className="text-[#2a6a3a] mx-auto block" title="Aprobado" />;
                      if (status === 'warn') return <AlertTriangle size={20} className="text-[#d4a000] mx-auto block" title="Por vencer" />;
                      if (status === 'error') return <XCircle size={20} className="text-[#c02020] mx-auto block" title="Rechazado" />;
                      if (status === 'pending') return <Clock size={20} className="text-amber-500 mx-auto block animate-pulse" title="Pendiente de carga o revisión" />;

                      return <span className="text-gray-400 font-medium block text-center" title="No requerido">—</span>;
                    };

                    return (
                      <tr key={contractor.id} className={`border-b border-cream transition-colors ${isEditing ? 'bg-[#f4efe9]' : 'hover:bg-gray-50'}`}>
                        <td className="px-4 py-3 text-left">
                          <div className="flex justify-between items-start">
                            <div>
                              <div className="font-bold text-[14.3px] text-navy flex items-center gap-2">
                                {contractor.name}
                              </div>
                              <div className="text-[12.1px] text-gray-500">{contractor.rut}</div>
                            </div>
                          </div>
                          <div className="mt-2">
                            {isEditing ? (
                              <span className="text-[11px] font-semibold text-[#8b5e34] uppercase tracking-wider flex items-center gap-1">
                                Configurando matriz
                              </span>
                            ) : (
                              <button
                                onClick={() => setEditingContractorId(contractor.id)}
                                className="btn btn-ghost btn-sm px-2 py-1 h-auto text-[11.5px] text-gray-500 hover:text-navy hover:bg-cream"
                              >
                                <SlidersHorizontal size={13} className="mr-1" /> Asignar Requisitos
                              </button>
                            )}
                          </div>
                        </td>
                        {documentRequirements.map((req) => (
                          <td key={req.id} className="px-4 py-3 align-middle">{renderCell(req.id)}</td>
                        ))}
                        <td className="px-4 py-3 align-middle"></td>
                        <td className="px-4 py-3 text-right align-middle">
                          {isEditing ? (
                            <div className="flex justify-end gap-1.5">
                              <button onClick={() => setEditingContractorId(null)} className="btn btn-ghost btn-sm px-2 py-1.5 h-auto text-gray-500 hover:text-red-600 hover:bg-red-50" title="Cancelar"><X size={16}/></button>
                              <button onClick={() => { setEditingContractorId(null); showToast('Configuración guardada'); }} className="btn btn-primary btn-sm px-2 py-1.5 h-auto shadow-sm" title="Guardar cambios"><Check size={16}/></button>
                            </div>
                          ) : (
                            <button className="btn btn-ghost btn-sm cursor-not-allowed opacity-50 font-medium" disabled title="No disponible en demo"><AlertCircle size={14} className="mr-1" /> Excepción manual [Demo]</button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              </div>
            </div>
          )}

          {/* Modal de Creación de Documento */}
          {isAddDocModalOpen && (
            <div className="fixed inset-0 bg-navy/40 z-50 flex items-center justify-center p-4">
              <div className="card max-w-md w-full max-h-[calc(100vh-24px)] overflow-y-auto shadow-xl">
                <h3 className="section-title mb-4">Añadir Nuevo Documento</h3>

                <div className="form-group mb-4">
                  <label className="form-label text-[13.2px]">Nombre del documento</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="Ej. Certificado SEC"
                    value={newDocForm.name}
                    onChange={(e) => setNewDocForm({...newDocForm, name: e.target.value})}
                  />
                </div>

                <div className="form-group mb-4">
                  <label className="form-label text-[13.2px]">Categoría</label>
                  <select
                    className="form-input"
                    value={newDocForm.category}
                    onChange={(e) => setNewDocForm({...newDocForm, category: e.target.value})}
                  >
                    <option value="Laboral">Laboral</option>
                    <option value="Prevención de Riesgos">Prevención de Riesgos</option>
                    <option value="Certificación Técnica">Certificación Técnica</option>
                    <option value="Legal">Legal</option>
                  </select>
                </div>

                <div className="form-group mb-4">
                  <label className="form-label text-[13.2px]">Aplica a</label>
                  <select
                    className="form-input"
                    value={newDocForm.destino}
                    onChange={(e) => setNewDocForm({...newDocForm, destino: e.target.value})}
                  >
                    <option value="empresa">Empresa Contratista</option>
                    <option value="trabajador">Trabajador (Personal)</option>
                  </select>
                </div>

                <div className="form-group mb-4">
                  <label className="form-label text-[13.2px]">Criticidad / Acción ante incumplimiento</label>
                  <select
                    className="form-input"
                    value={newDocForm.criticidad}
                    onChange={(e) => setNewDocForm({...newDocForm, criticidad: e.target.value})}
                  >
                    <option value="bloquea_acceso">Bloquea Acceso a Faena</option>
                    <option value="bloquea_pago">Bloquea Pago de Factura</option>
                    <option value="advertencia">Solo Advertencia (Opcional)</option>
                  </select>
                </div>

                <div className="form-group mb-4">
                  <label className="form-label text-[13.2px] flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={newDocForm.obligatorio}
                      onChange={(e) => setNewDocForm({...newDocForm, obligatorio: e.target.checked})}
                      className="accent-navy w-4 h-4 cursor-pointer"
                    />
                    ¿Es Obligatorio para Acreditación?
                  </label>
                </div>

                <div className="form-group mb-6">
                  <label className="form-label text-[13.2px]">Frecuencia de renovación</label>
                  <select
                    className="form-input"
                    value={newDocForm.frequency}
                    onChange={(e) => setNewDocForm({...newDocForm, frequency: e.target.value})}
                  >
                    <option value="Mensual">Mensual</option>
                    <option value="Anual">Anual</option>
                    <option value="Por Proyecto">Por Proyecto</option>
                    <option value="Indefinido">Indefinido</option>
                  </select>
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t border-cream">
                  <button
                    className="btn btn-ghost"
                    onClick={() => setIsAddDocModalOpen(false)}
                  >
                    Cancelar
                  </button>
                  <button
                    className="btn btn-primary"
                    onClick={handleAddRequirement}
                    disabled={!newDocForm.name.trim()}
                  >
                    Guardar Requisito
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
