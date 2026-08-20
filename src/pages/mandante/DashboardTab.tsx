import { AlertCircle, XCircle, Activity } from 'lucide-react';
import { getRequisitos, calcularEstadoAcreditacion, calcularEstadoTrabajador, esVencidoPorFecha, esPorVencerPorFecha, getAlertasVigencia } from '../../data/localStorageDb';
import { Contratista, Proyecto } from '../../types';

type FiltroControl = 'todos' | 'aprobados' | 'en_proceso' | 'bloqueados' | 'atencion';
type DashboardSubTab = 'contratistas' | 'trabajadores';

export default function DashboardTab({
  activeProjectId,
  allContratistas,
  misProyectos,
  filtroControl,
  setFiltroControl,
  setSelectedProjectId,
  setClienteSeleccionado,
  dashboardSubTab,
  setDashboardSubTab,
  setFichaTrabajador,
}: {
  activeProjectId: string;
  allContratistas: Contratista[];
  misProyectos: Proyecto[];
  filtroControl: FiltroControl;
  setFiltroControl: (v: FiltroControl) => void;
  setSelectedProjectId: (id: string) => void;
  setClienteSeleccionado: (c: any) => void;
  dashboardSubTab: DashboardSubTab;
  setDashboardSubTab: (v: DashboardSubTab) => void;
  setFichaTrabajador: (w: any) => void;
}) {
  const todayStr = new Date().toLocaleDateString('es-CL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const formattedDate = todayStr.charAt(0).toUpperCase() + todayStr.slice(1);

  const projReqs = getRequisitos().filter(r => r.proyectoId === activeProjectId && r.activo !== false);

  const projContractors = allContratistas.filter(c => c.proyectos.includes(activeProjectId));

  const projWorkers = projContractors.flatMap(c =>
    (c.trabajadores || []).filter(w =>
      w.documentos?.some(d => d.proyectoId === activeProjectId)
    )
  );

  const countContractors = projContractors.length;
  const countWorkers = projWorkers.length;

  const countApprovedWorkers = projWorkers.filter(w => calcularEstadoTrabajador(w, activeProjectId) === 'aprobado').length;
  const countPendingWorkers = projWorkers.filter(w => {
    const s = calcularEstadoTrabajador(w, activeProjectId);
    return s === 'pendiente' || s === 'por_vencer';
  }).length;
  const countBlockedWorkers = projWorkers.filter(w => calcularEstadoTrabajador(w, activeProjectId) === 'rechazado').length;

  const overallPercent = countWorkers > 0 ? Math.round((countApprovedWorkers / countWorkers) * 100) : 100;

  const attentionContractors = projContractors.filter(c => calcularEstadoAcreditacion(c, activeProjectId) !== 'Aprobado');

  const criticalProblems: any[] = [];

  projContractors.forEach(c => {
    const companyReqs = projReqs.filter(r => r.destino === 'empresa');
    companyReqs.forEach(req => {
      const doc = c.documentos.find(d =>
        d.proyectoId === activeProjectId &&
        (d.nombre.toLowerCase().includes(req.nombre.toLowerCase()) ||
         req.nombre.toLowerCase().includes(d.nombre.toLowerCase()))
      );
      if (doc) {
        const isVencido = esVencidoPorFecha(doc.vencimiento);
        if (req.obligatorio && (doc.estado === 'rechazado' || isVencido)) {
          criticalProblems.push({
            tipo: 'empresa',
            id: c.id,
            name: c.nombre,
            issue: `${req.nombre} ${isVencido ? 'vencido' : 'rechazado'}`,
            contratista: c.nombre,
            objetoContratista: c,
            objetoTrabajador: undefined
          });
        }
      }
    });

    const workerReqs = projReqs.filter(r => r.destino === 'trabajador');
    const cWorkers = c.trabajadores || [];
    cWorkers.forEach(w => {
      const hasProjDocs = w.documentos?.some(d => d.proyectoId === activeProjectId);
      if (!hasProjDocs) return;

      workerReqs.forEach(req => {
        const doc = w.documentos?.find(d =>
          d.proyectoId === activeProjectId &&
          (d.nombre.toLowerCase().includes(req.nombre.toLowerCase()) ||
           req.nombre.toLowerCase().includes(d.nombre.toLowerCase()))
        );
        if (doc) {
          const isVencido = esVencidoPorFecha(doc.vencimiento);
          if (req.obligatorio && (doc.estado === 'rechazado' || isVencido)) {
            criticalProblems.push({
              tipo: 'trabajador',
              id: w.rut,
              name: w.nombre,
              issue: `${req.nombre} ${isVencido ? 'vencido' : 'rechazado'}`,
              contratista: c.nombre,
              objetoContratista: c,
              objetoTrabajador: w
            });
          }
        }
      });
    });
  });

  let dynamicApprovedDocsCount = 0;
  let dynamicRejectedDocsCount = 0;
  let dynamicPendingDocsCount = 0;

  projContractors.forEach(c => {
    c.documentos.forEach(d => {
      if (d.proyectoId === activeProjectId) {
        if (d.estado === 'aprobado' && !esVencidoPorFecha(d.vencimiento)) dynamicApprovedDocsCount++;
        else if (d.estado === 'rechazado' || esVencidoPorFecha(d.vencimiento)) dynamicRejectedDocsCount++;
        else if (d.estado === 'revision') dynamicPendingDocsCount++;
      }
    });
    (c.trabajadores || []).forEach(w => {
      (w.documentos || []).forEach(d => {
        if (d.proyectoId === activeProjectId) {
          if (d.estado === 'aprobado' && !esVencidoPorFecha(d.vencimiento)) dynamicApprovedDocsCount++;
          else if (d.estado === 'rechazado' || esVencidoPorFecha(d.vencimiento)) dynamicRejectedDocsCount++;
          else if (d.estado === 'revision') dynamicPendingDocsCount++;
        }
      });
    });
  });
  const dynamicAlertasCount = getAlertasVigencia(activeProjectId).length;

  const filteredContractors = projContractors.filter(c => {
    const state = calcularEstadoAcreditacion(c, activeProjectId);
    if (filtroControl === 'todos') return true;
    if (filtroControl === 'aprobados') return state === 'Aprobado';
    if (filtroControl === 'en_proceso') return state === 'En proceso';
    if (filtroControl === 'bloqueados') return state === 'Vencido/Bloqueado';
    if (filtroControl === 'atencion') return state !== 'Aprobado';
    return true;
  });

  const filteredWorkers = projWorkers.filter(w => {
    const state = calcularEstadoTrabajador(w, activeProjectId);
    if (filtroControl === 'todos') return true;
    if (filtroControl === 'aprobados') return state === 'aprobado';
    if (filtroControl === 'en_proceso') return state === 'pendiente' || state === 'por_vencer';
    if (filtroControl === 'bloqueados') return state === 'rechazado';
    if (filtroControl === 'atencion') return state !== 'aprobado';
    return true;
  });

  return (
    <div className="fade-in space-y-6">

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="page-title text-navy font-bold text-[22px]">Panel de control</h2>
          <p className="page-sub text-gray-500 text-[13.5px]">{formattedDate} · Resumen general de acreditaciones</p>
        </div>
        <div className="flex gap-2">
          <select
            value={activeProjectId}
            onChange={(e) => setSelectedProjectId(e.target.value)}
            className="form-input text-[13px] py-1.5 px-3 w-auto bg-white border border-cream3 rounded-xl font-medium text-navy cursor-pointer"
          >
            {misProyectos.map(p => (
              <option key={p.id} value={p.id}>{p.nombre}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <div className="stat s-primary">
          <div className="stat-n">{overallPercent}%</div>
          <div className="stat-l">Acreditación general</div>
        </div>
        <div className="stat s-green">
          <div className="stat-n">{countContractors}</div>
          <div className="stat-l">Contratistas totales</div>
        </div>
        <div className="stat s-blue">
          <div className="stat-n">{countWorkers}</div>
          <div className="stat-l">Trabajadores totales</div>
        </div>
        <div className="stat s-green">
          <div className="stat-n">{countApprovedWorkers}</div>
          <div className="stat-l">Trabajadores aprobados</div>
        </div>
        <div className="stat s-yellow">
          <div className="stat-n">{countPendingWorkers}</div>
          <div className="stat-l">Trabajadores en proceso</div>
        </div>
        <div className="stat s-red">
          <div className="stat-n">{countBlockedWorkers}</div>
          <div className="stat-l">Trabajadores bloqueados</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1.5fr_1fr] gap-6">

        <div className="space-y-6">
          <div className="card bg-white border border-cream3 shadow-sm p-5">
            <div className="flex justify-between items-start mb-4 border-b border-cream3 pb-3 gap-4">
              <div>
                <h3 className="section-title mb-0 flex items-center gap-2 font-bold text-[16px] text-navy">
                  <AlertCircle size={18} className="text-red-500" />
                  Contratistas que requieren atención
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">Empresas que aún no completan su acreditación en este proyecto.</p>
              </div>
              <span className="badge b-red text-xs font-semibold shrink-0">{attentionContractors.length} empresas</span>
            </div>

            {attentionContractors.length > 0 ? (
              <div className="flex flex-col gap-3.5">
                {attentionContractors.map(c => {
                  const cWorkers = c.trabajadores || [];
                  const approvedW = cWorkers.filter(w => calcularEstadoTrabajador(w, activeProjectId) === 'aprobado').length;
                  const pct = cWorkers.length > 0 ? Math.round((approvedW / cWorkers.length) * 100) : 100;
                  const affectedW = cWorkers.filter(w => {
                    const s = calcularEstadoTrabajador(w, activeProjectId);
                    return s === 'pendiente' || s === 'rechazado';
                  }).length;
                  const cState = calcularEstadoAcreditacion(c, activeProjectId);

                  let numPendientes = 0;
                  let numPorVencer = 0;
                  let numVencidosRechazados = 0;

                  projReqs.forEach(req => {
                    if (req.destino === 'empresa') {
                      const doc = c.documentos.find(d =>
                        d.proyectoId === activeProjectId &&
                        (d.nombre.toLowerCase().includes(req.nombre.toLowerCase()) ||
                         req.nombre.toLowerCase().includes(d.nombre.toLowerCase()))
                      );
                      if (!doc) {
                        if (req.obligatorio) numPendientes++;
                      } else {
                        const isVencido = esVencidoPorFecha(doc.vencimiento);
                        const isPorVencer = esPorVencerPorFecha(doc.vencimiento, req.alertaDias);
                        if (doc.estado === 'rechazado' || isVencido) numVencidosRechazados++;
                        else if (doc.estado === 'pendiente' || doc.estado === 'revision') numPendientes++;
                        else if (isPorVencer) numPorVencer++;
                      }
                    } else {
                      cWorkers.forEach(w => {
                        const doc = w.documentos?.find(d =>
                          d.proyectoId === activeProjectId &&
                          (d.nombre.toLowerCase().includes(req.nombre.toLowerCase()) ||
                           req.nombre.toLowerCase().includes(d.nombre.toLowerCase()))
                        );
                        if (!doc) {
                          if (req.obligatorio) numPendientes++;
                        } else {
                          const isVencido = esVencidoPorFecha(doc.vencimiento);
                          const isPorVencer = esPorVencerPorFecha(doc.vencimiento, req.alertaDias);
                          if (doc.estado === 'rechazado' || isVencido) numVencidosRechazados++;
                          else if (doc.estado === 'pendiente' || doc.estado === 'revision') numPendientes++;
                          else if (isPorVencer) numPorVencer++;
                        }
                      });
                    }
                  });

                  const motives: string[] = [];
                  if (numVencidosRechazados > 0) motives.push(`${numVencidosRechazados} doc. rechazados/vencidos`);
                  if (numPendientes > 0) motives.push(`${numPendientes} doc. pendientes`);
                  if (numPorVencer > 0) motives.push(`${numPorVencer} doc. por vencer`);
                  const principalMotivo = motives.join(', ') || 'Pendiente de acreditación general';

                  const stateBadge = cState === 'Vencido/Bloqueado' ? 'b-red' : 'b-yellow';

                  return (
                    <div key={c.id} className="p-4 border border-cream3 rounded-2xl bg-white flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm font-sans">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <h4 className="text-[14.5px] font-semibold text-navy">{c.nombre}</h4>
                          <span className={`badge ${stateBadge} text-[10.5px]`}>{cState}</span>
                          <span className="text-gray-400 text-xs">Cumplimiento: <strong>{pct}%</strong></span>
                        </div>
                        <p className="text-[12.5px] text-gray-500">
                          Afectados: <span className="font-semibold text-red-600">{affectedW} trabajadores</span> · Motivo: <span className="font-medium text-navy">{principalMotivo}</span>
                        </p>
                      </div>
                      <button
                        className="btn btn-primary btn-sm shrink-0"
                        onClick={() => setClienteSeleccionado(c)}
                      >
                        Ver detalle
                      </button>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-center py-6 text-gray-400 text-xs font-sans">Ningún contratista requiere atención inmediata.</p>
            )}
          </div>

          <div className="card bg-white border border-cream3 shadow-sm p-5 font-sans">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4 pb-3 border-b border-cream3">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setDashboardSubTab('contratistas')}
                  className={`text-[15px] font-bold pb-1 border-b-2 transition-all ${dashboardSubTab === 'contratistas' ? 'border-brown text-navy' : 'border-transparent text-gray-400'}`}
                >
                  Empresas contratistas
                </button>
                <span className="text-gray-300">|</span>
                <button
                  onClick={() => setDashboardSubTab('trabajadores')}
                  className={`text-[15px] font-bold pb-1 border-b-2 transition-all ${dashboardSubTab === 'trabajadores' ? 'border-brown text-navy' : 'border-transparent text-gray-400'}`}
                >
                  Trabajadores del proyecto
                </button>
              </div>

              <select
                value={filtroControl}
                onChange={(e) => setFiltroControl(e.target.value as any)}
                className="form-input text-[12.5px] py-1 px-2.5 w-auto bg-cream/40 border-cream3 rounded-lg font-medium text-navy cursor-pointer"
              >
                <option value="todos">Todos</option>
                <option value="aprobados">Aprobados</option>
                <option value="en_proceso">En proceso</option>
                <option value="bloqueados">Vencidos/Bloqueados</option>
                <option value="atencion">Requieren atención</option>
              </select>
            </div>

            {dashboardSubTab === 'contratistas' ? (
              filteredContractors.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="table w-full text-left text-[13px]">
                    <thead>
                      <tr>
                        <th className="px-3 py-2 bg-cream2 text-navy border-b border-cream3">Empresa / RUT</th>
                        <th className="px-3 py-2 bg-cream2 text-navy border-b border-cream3">Estado</th>
                        <th className="px-3 py-2 bg-cream2 text-navy border-b border-cream3">Cumplimiento</th>
                        <th className="px-3 py-2 bg-cream2 text-navy border-b border-cream3 text-right">Acción</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredContractors.map(c => {
                        const cState = calcularEstadoAcreditacion(c, activeProjectId);
                        const cWorkers = c.trabajadores || [];
                        const approvedW = cWorkers.filter(w => calcularEstadoTrabajador(w, activeProjectId) === 'aprobado').length;
                        const pct = cWorkers.length > 0 ? Math.round((approvedW / cWorkers.length) * 100) : 100;

                        const badgeColor = cState === 'Aprobado' ? 'b-green' : cState === 'Vencido/Bloqueado' ? 'b-red' : 'b-yellow';

                        return (
                          <tr key={c.id} className="hover:bg-gray-50 border-b border-cream last:border-b-0">
                            <td className="px-3 py-2.5">
                              <div className="font-semibold text-navy">{c.nombre}</div>
                              <div className="text-[11px] text-gray-500">{c.rut}</div>
                            </td>
                            <td className="px-3 py-2.5">
                              <span className={`badge ${badgeColor} text-[10.5px]`}>{cState}</span>
                            </td>
                            <td className="px-3 py-2.5 font-medium text-navy">{pct}%</td>
                            <td className="px-3 py-2.5 text-right">
                              <button
                                className="text-brown hover:underline text-[12px] font-semibold"
                                onClick={() => setClienteSeleccionado(c)}
                              >
                                Ver detalle
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-center py-6 text-gray-400 text-xs">No hay contratistas bajo este filtro.</p>
              )
            ) : (
              filteredWorkers.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="table w-full text-left text-[13px]">
                    <thead>
                      <tr>
                        <th className="px-3 py-2 bg-cream2 text-navy border-b border-cream3">Trabajador</th>
                        <th className="px-3 py-2 bg-cream2 text-navy border-b border-cream3">Contratista</th>
                        <th className="px-3 py-2 bg-cream2 text-navy border-b border-cream3">Cargo</th>
                        <th className="px-3 py-2 bg-cream2 text-navy border-b border-cream3">Asignación</th>
                        <th className="px-3 py-2 bg-cream2 text-navy border-b border-cream3">Estado acreditación</th>
                        <th className="px-3 py-2 bg-cream2 text-navy border-b border-cream3">Habilitación</th>
                        <th className="px-3 py-2 bg-cream2 text-navy border-b border-cream3">Motivo</th>
                        <th className="px-3 py-2 bg-cream2 text-navy border-b border-cream3 text-right">Acción</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredWorkers.map(w => {
                        const wState = calcularEstadoTrabajador(w, activeProjectId);
                        const contractor = projContractors.find(c => (c.trabajadores || []).some(tw => tw.rut === w.rut));
                        const badgeColor = wState === 'aprobado' ? 'b-green' : wState === 'rechazado' ? 'b-red' : 'b-yellow';
                        const statusText = wState === 'aprobado' ? '🟢 Aprobado' : wState === 'rechazado' ? '🔴 Vencido/Bloqueado' : '🟡 En proceso';

                        const activeProjectObj = misProyectos.find(p => p.id === activeProjectId);
                        const activeProjectName = activeProjectObj ? activeProjectObj.nombre : 'Proyecto';

                        let blockReason = '—';
                        if (wState !== 'aprobado') {
                          const missingDoc = w.documentos?.find(d => {
                            if (d.proyectoId !== activeProjectId) return false;
                            const isVencido = esVencidoPorFecha(d.vencimiento);
                            const req = projReqs.find(r => d.nombre.toLowerCase().includes(r.nombre.toLowerCase()) || r.nombre.toLowerCase().includes(d.nombre.toLowerCase()));
                            return req?.obligatorio && (d.estado === 'rechazado' || isVencido || d.estado === 'pendiente' || d.estado === 'revision');
                          });
                          if (missingDoc) {
                            const isVencido = esVencidoPorFecha(missingDoc.vencimiento);
                            blockReason = `${missingDoc.nombre} ${isVencido ? 'vencido' : missingDoc.estado === 'rechazado' ? 'rechazado' : 'pendiente'}`;
                          } else {
                            const missingReq = projReqs.find(req => req.obligatorio && !w.documentos?.some(d => d.proyectoId === activeProjectId && (d.nombre.toLowerCase().includes(req.nombre.toLowerCase()) || req.nombre.toLowerCase().includes(d.nombre.toLowerCase()))));
                            if (missingReq) {
                              blockReason = `${missingReq.nombre} pendiente`;
                            } else {
                              blockReason = 'En proceso';
                            }
                          }
                        }

                        const isHabilitado = wState === 'aprobado';

                        return (
                          <tr key={w.rut} className="hover:bg-gray-50 border-b border-cream last:border-b-0">
                            <td className="px-3 py-2.5">
                              <div className="font-semibold text-navy">{w.nombre}</div>
                              <div className="text-[11px] text-gray-500">{w.rut}</div>
                            </td>
                            <td className="px-3 py-2.5 text-gray-600 font-medium">{contractor ? contractor.nombre : '—'}</td>
                            <td className="px-3 py-2.5 text-gray-500">{w.cargo || 'Operario'}</td>
                            <td className="px-3 py-2.5 text-gray-600 font-medium">✓ Asignado a {activeProjectName}</td>
                            <td className="px-3 py-2.5">
                              <span className={`badge ${badgeColor} text-[10.5px]`}>{statusText}</span>
                            </td>
                            <td className="px-3 py-2.5">
                              <span className={`badge ${isHabilitado ? 'b-green' : 'b-red'} text-[10.5px]`}>
                                {isHabilitado ? 'Habilitado' : 'No habilitado'}
                              </span>
                            </td>
                            <td className="px-3 py-2.5 text-gray-500 italic">{blockReason}</td>
                            <td className="px-3 py-2.5 text-right">
                              <button
                                className="text-brown hover:underline text-[12px] font-semibold"
                                onClick={() => {
                                  if (contractor) {
                                    setClienteSeleccionado(contractor);
                                    setFichaTrabajador(w);
                                  }
                                }}
                              >
                                Ver detalle
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-center py-6 text-gray-400 text-xs">No hay trabajadores bajo este filtro.</p>
              )
            )}
          </div>
        </div>

        <div className="space-y-6">
          <div className="card bg-white border border-cream3 shadow-sm p-5 font-sans">
            <div className="flex justify-between items-start mb-4 border-b border-cream3 pb-3 gap-4">
              <div>
                <h3 className="section-title mb-0 flex items-center gap-2 font-bold text-[16px] text-navy">
                  <XCircle size={18} className="text-red-600" />
                  Problemas críticos
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">Documentos puntuales que hoy bloquean el ingreso o el pago.</p>
              </div>
              <span className="badge b-red text-xs font-semibold shrink-0">{criticalProblems.length} bloqueos</span>
            </div>

            {criticalProblems.length > 0 ? (
              <div className="flex flex-col gap-3 max-h-[350px] overflow-y-auto pr-1">
                {criticalProblems.map((prob, idx) => (
                  <div key={idx} className="p-3 bg-red-50/40 border border-red-100 rounded-xl space-y-2 text-[12.5px]">
                    <div className="flex justify-between items-start">
                      <div>
                        <span className="font-bold text-red-700 flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-red-600 shrink-0" aria-hidden="true"></span>
                          {prob.name}
                        </span>
                        <div className="text-[11px] text-gray-500 mt-0.5">Empresa: {prob.contratista}</div>
                      </div>
                      <button
                        className="text-brown hover:underline text-[11px] font-semibold"
                        onClick={() => {
                          setClienteSeleccionado(prob.objetoContratista);
                          if (prob.tipo === 'trabajador') {
                            setFichaTrabajador(prob.objetoTrabajador);
                          } else {
                            setFichaTrabajador(undefined);
                          }
                        }}
                      >
                        Ver detalle
                      </button>
                    </div>
                    <div className="text-[12px] text-red-900 font-medium">Causa: <span className="underline">{prob.issue}</span></div>
                    <div className="border-t border-red-100/60 pt-1.5 mt-1">
                      <div className="text-[11px] font-semibold text-red-700 mb-1.5">Mientras no se resuelva, bloquea:</div>
                      <div className="flex flex-wrap gap-1.5 text-[10.5px] text-red-700 font-medium">
                        {['Ingreso', 'Trabajo', 'Asignación', 'Pago'].map(tag => (
                          <span key={tag} className="bg-red-100/70 border border-red-200 rounded-md px-1.5 py-0.5">{tag}</span>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-center py-6 text-gray-400 text-xs">No hay problemas críticos en este proyecto.</p>
            )}
          </div>

          <div className="card bg-white border border-cream3 shadow-sm p-5 font-sans">
            <h3 className="section-title mb-4 pb-3 border-b border-cream3 text-navy font-bold text-[16px] flex items-center gap-2">
              <Activity size={18} className="text-brown" />
              Actividad de acreditación
            </h3>
            <div className="grid grid-cols-2 gap-3 text-center text-[13px]">
              <div className="bg-green-50 border border-green-100 p-3 rounded-xl">
                <div className="text-lg font-bold text-green-700">{dynamicApprovedDocsCount}</div>
                <div className="text-[11px] text-gray-500 mt-0.5">Aprobados</div>
              </div>
              <div className="bg-red-50 border border-red-100 p-3 rounded-xl">
                <div className="text-lg font-bold text-red-700">{dynamicRejectedDocsCount}</div>
                <div className="text-[11px] text-gray-500 mt-0.5">Rechazados/Vencidos</div>
              </div>
              <div className="bg-blue-50 border border-blue-100 p-3 rounded-xl">
                <div className="text-lg font-bold text-blue-700">{dynamicPendingDocsCount}</div>
                <div className="text-[11px] text-gray-500 mt-0.5">Pendientes</div>
              </div>
              <div className="bg-yellow-50 border border-yellow-100 p-3 rounded-xl">
                <div className="text-lg font-bold text-[#b45309]">{dynamicAlertasCount}</div>
                <div className="text-[11px] text-gray-500 mt-0.5">Alertas de Vigencia</div>
              </div>
            </div>
          </div>

        </div>

      </div>

    </div>
  );
}
