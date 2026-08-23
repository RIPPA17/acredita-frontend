import { useState } from 'react';
import {
  Search, Building2, Lock, Wallet, AlertCircle, AlertTriangle, CheckCircle,
  X, FileText, Eye,
} from 'lucide-react';
import {
  calcularAccesoPago,
  calcularEstadoTrabajador,
  esTrabajadorAsignado,
  getRequisitos,
  getMotivoBloqueoTrabajador,
} from '../../data/localStorageDb';
import { Contratista, Proyecto, Mandante, Documento, Trabajador } from '../../types';
import { buildAcreditacionRows, estadoUILabel, badgeClass as acredBadgeClass, EstadoUI } from '../admin/acreditacionUtils';
import {
  buildRequisitosEmpresa,
  buildRequisitosTrabajador,
  impactoLabel,
  motivoEmpresaItem,
  accionEmpresaLabel,
  prioridadItem,
  encontrarProximoVencimiento,
  getEstadoAccesoProyecto,
  RequisitoConDoc,
} from './inicio/inicioUtils';

// Mismo mapeo de colores centrales usado en el resto del portal Contratista.
const BADGE: Record<string, string> = { green: 'b-green', amber: 'b-yellow', red: 'b-red', gray: 'b-gray' };
const STATE_BORDER: Record<EstadoUI, string> = {
  Acreditado: 'border-t-[#2a6a3a]',
  'En proceso': 'border-t-[#d4a000]',
  Bloqueado: 'border-t-[#c02020]',
};
const STATE_ALERT_CLASS: Record<EstadoUI, string> = {
  Acreditado: 'alert-success',
  'En proceso': 'alert-warn',
  Bloqueado: 'alert-danger',
};
const STATE_ICON: Record<EstadoUI, typeof CheckCircle> = {
  Acreditado: CheckCircle,
  'En proceso': AlertTriangle,
  Bloqueado: AlertCircle,
};

interface BloqueoResumen {
  tipo: 'Empresa' | 'Trabajador';
  nombre: string;
  estadoLabel: string;
  prioridad: number;
}

function buildBloqueosResumen(
  proyectoId: string,
  empresaItems: RequisitoConDoc[],
  trabajadoresAsignados: Trabajador[]
): BloqueoResumen[] {
  const items: BloqueoResumen[] = [];
  empresaItems.forEach(item => {
    const prioridad = prioridadItem(item);
    if (prioridad >= 99) return;
    items.push({ tipo: 'Empresa', nombre: item.requisito.nombre, estadoLabel: item.estado, prioridad });
  });
  trabajadoresAsignados.forEach(w => {
    const estado = calcularEstadoTrabajador(w, proyectoId);
    if (estado === 'aprobado') return;
    const prioridad = estado === 'rechazado' ? 1 : estado === 'por_vencer' ? 3 : 4;
    const estadoLabel = estado === 'rechazado' ? 'Bloqueado' : estado === 'por_vencer' ? 'Por vencer' : 'Pendiente';
    items.push({ tipo: 'Trabajador', nombre: w.nombre, estadoLabel, prioridad });
  });
  return items.sort((a, b) => a.prioridad - b.prioridad);
}

export default function MisProyectosTab({
  contratistaLogueado,
  misProyectos,
  allMandantes,
  setActiveTab,
  setSelectedProyectoId,
  setSelectedDocumentForPanel,
  setSelectedWorkerForDocs,
  setFichaTipo,
  setFichaTrabajador,
  setShowFichaAcreditacion,
}: {
  contratistaLogueado: Contratista;
  misProyectos: Proyecto[];
  allMandantes: Mandante[];
  setActiveTab: (v: string) => void;
  setSelectedProyectoId: (id: string) => void;
  setSelectedDocumentForPanel: (d: Documento | null) => void;
  setSelectedWorkerForDocs: (v: any | null) => void;
  setFichaTipo: (v: 'empresa' | 'trabajador') => void;
  setFichaTrabajador: (v: any) => void;
  setShowFichaAcreditacion: (v: boolean) => void;
}) {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'Todos' | EstadoUI>('Todos');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [detailTab, setDetailTab] = useState<'resumen' | 'empresa' | 'trabajadores'>('resumen');

  if (misProyectos.length === 0) {
    return (
      <div className="fade-in flex flex-col gap-6">
        <div className="page-header">
          <div>
            <h2 className="page-title">Mis proyectos</h2>
            <p className="page-sub">Revisa tu acreditación en cada obra o faena asignada.</p>
          </div>
        </div>
        <div className="card py-14 flex flex-col items-center justify-center text-center">
          <FileText size={38} className="text-gray-300 mb-3" />
          <p className="font-semibold text-navy text-[15.4px]">Todavía no tienes proyectos asociados.</p>
          <p className="text-sm text-gray-500 mt-1 max-w-md">Cuando un mandante te invite o te asigne a un proyecto, aquí verás su acreditación y requisitos.</p>
        </div>
      </div>
    );
  }

  // --- Única fuente de verdad de acreditación, igual que en Inicio ---
  const rows = buildAcreditacionRows([contratistaLogueado], misProyectos, allMandantes);
  const rowsByProyecto = new Map(rows.map(r => [r.proyectoId, r]));
  const requisitosAll = getRequisitos();

  const proyectosInfo = misProyectos.map(p => {
    const row = rowsByProyecto.get(p.id);
    const mandante = allMandantes.find(m => m.id === p.mandanteId);
    const estadoUI: EstadoUI = row ? estadoUILabel(row.estado) : 'En proceso';
    const badge = row ? BADGE[acredBadgeClass(row.estado)] : 'b-yellow';

    const trabajadoresAsignados = (contratistaLogueado.trabajadores || []).filter(w =>
      esTrabajadorAsignado(w, p.id, misProyectos)
    );
    const accesoPago = calcularAccesoPago(contratistaLogueado, p.id);
    const estadoAcceso = getEstadoAccesoProyecto(contratistaLogueado, p.id, trabajadoresAsignados);
    const empresaItems = buildRequisitosEmpresa(contratistaLogueado, p.id, requisitosAll);
    const workerItemsAll = trabajadoresAsignados.flatMap(w => buildRequisitosTrabajador(w, p.id, requisitosAll));
    const proximoVenc = encontrarProximoVencimiento([...empresaItems, ...workerItemsAll]);
    const bloqueos = buildBloqueosResumen(p.id, empresaItems, trabajadoresAsignados);

    const empresaOk = row?.company.ok ?? 0;
    const empresaTotal = row?.company.total ?? 0;
    const trabajadoresOk = row?.workers.ok ?? 0;
    const trabajadoresTotal = row?.workers.total ?? trabajadoresAsignados.length;
    const empresaPct = empresaTotal > 0 ? Math.round((empresaOk / empresaTotal) * 100) : 100;
    const trabajadoresPct = trabajadoresTotal > 0 ? Math.round((trabajadoresOk / trabajadoresTotal) * 100) : 0;

    const alertText = bloqueos.length === 0
      ? 'No tienes bloqueos ni acciones pendientes en este proyecto.'
      : bloqueos.slice(0, 2).map(b => `${b.tipo === 'Empresa' ? b.nombre : b.nombre} (${b.estadoLabel})`).join(' · ') +
        (bloqueos.length > 2 ? ` y ${bloqueos.length - 2} más` : '');

    return {
      proyecto: p,
      mandante,
      estadoUI,
      badge,
      trabajadoresAsignados,
      accesoPago,
      estadoAcceso,
      empresaItems,
      proximoVenc,
      bloqueos,
      empresaOk,
      empresaTotal,
      trabajadoresOk,
      trabajadoresTotal,
      empresaPct,
      trabajadoresPct,
      alertText,
    };
  });

  const totalAcreditados = proyectosInfo.filter(i => i.estadoUI === 'Acreditado').length;
  const totalEnProceso = proyectosInfo.filter(i => i.estadoUI === 'En proceso').length;
  const totalBloqueados = proyectosInfo.filter(i => i.estadoUI === 'Bloqueado').length;

  const q = search.toLowerCase().trim();
  const proyectosFiltrados = proyectosInfo.filter(i => {
    const okFilter = filter === 'Todos' || i.estadoUI === filter;
    const okSearch = !q || i.proyecto.nombre.toLowerCase().includes(q) || (i.mandante?.nombre || '').toLowerCase().includes(q);
    return okFilter && okSearch;
  });

  const expandido = proyectosInfo.find(i => i.proyecto.id === expandedId);

  const toggleDetail = (id: string) => {
    if (expandedId === id) {
      setExpandedId(null);
    } else {
      setExpandedId(id);
      setDetailTab('resumen');
    }
  };

  const irADocumentos = (proyectoId: string, doc?: Documento) => {
    setSelectedProyectoId(proyectoId);
    setActiveTab('subir');
    if (doc) setSelectedDocumentForPanel(doc);
  };

  const irATrabajadores = (proyectoId: string, worker?: Trabajador) => {
    setSelectedProyectoId(proyectoId);
    setActiveTab('trabajadores');
    if (worker) setSelectedWorkerForDocs(worker);
  };

  const verFicha = (proyectoId: string) => {
    setSelectedProyectoId(proyectoId);
    setFichaTipo('empresa');
    setFichaTrabajador(null);
    setShowFichaAcreditacion(true);
  };

  return (
    <div className="fade-in flex flex-col gap-5">
      <div className="page-header">
        <div>
          <h2 className="page-title">Mis proyectos</h2>
          <p className="page-sub">Acreditación, acceso y pago de cada obra o faena donde prestas servicios.</p>
          <p className="text-[12.5px] text-gray-500 mt-1">{contratistaLogueado.nombre} · RUT {contratistaLogueado.rut} · {misProyectos.length} proyecto{misProyectos.length === 1 ? '' : 's'} activo{misProyectos.length === 1 ? '' : 's'}</p>
        </div>
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="form-input pl-9 w-64"
            placeholder="Buscar proyecto o mandante..."
          />
        </div>
      </div>

      {/* Resumen general: siempre 4 en una sola línea, sin envolver */}
      <div className="grid grid-cols-4 gap-[10px] mb-4">
        <div className="card p-4">
          <p className="text-[11px] text-gray-400 font-semibold uppercase tracking-wider mb-1">Proyectos activos</p>
          <p className="text-[22px] font-bold text-navy">{misProyectos.length}</p>
          <p className="text-[11.5px] text-gray-500 mt-0.5">Obras y faenas asignadas</p>
        </div>
        <div className="card p-4">
          <p className="text-[11px] text-gray-400 font-semibold uppercase tracking-wider mb-1">Acreditados</p>
          <p className="text-[22px] font-bold text-[#1a6030]">{totalAcreditados}</p>
          <p className="text-[11.5px] text-gray-500 mt-0.5">Sin acciones pendientes</p>
        </div>
        <div className="card p-4">
          <p className="text-[11px] text-gray-400 font-semibold uppercase tracking-wider mb-1">En proceso</p>
          <p className="text-[22px] font-bold text-[#a87400]">{totalEnProceso}</p>
          <p className="text-[11.5px] text-gray-500 mt-0.5">Requieren seguimiento</p>
        </div>
        <div className="card p-4">
          <p className="text-[11px] text-gray-400 font-semibold uppercase tracking-wider mb-1">Bloqueados</p>
          <p className="text-[22px] font-bold text-[#9a2020]">{totalBloqueados}</p>
          <p className="text-[11.5px] text-gray-500 mt-0.5">Requieren acción prioritaria</p>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex gap-2 flex-wrap">
        {([
          ['Todos', misProyectos.length],
          ['Acreditado', totalAcreditados],
          ['En proceso', totalEnProceso],
          ['Bloqueado', totalBloqueados],
        ] as Array<[typeof filter, number]>).map(([f, count]) => (
          <button
            key={f}
            className={`chip ${filter === f ? 'active' : ''}`}
            onClick={() => setFilter(f)}
          >
            {f} <span className="chip-count">{count}</span>
          </button>
        ))}
      </div>

      {/* Grid de proyectos */}
      {proyectosFiltrados.length === 0 ? (
        <div className="card py-10 flex flex-col items-center justify-center text-center text-gray-500">
          <Search size={28} className="text-gray-300 mb-2" />
          <p>No hay proyectos que coincidan con la búsqueda o filtro.</p>
        </div>
      ) : (
        <div className="card-grid">
          {proyectosFiltrados.map(info => {
            const { proyecto: p, mandante, estadoUI, badge, estadoAcceso, accesoPago, empresaOk, empresaTotal, trabajadoresOk, trabajadoresTotal, empresaPct, trabajadoresPct, proximoVenc, alertText } = info;
            const StatusIcon = STATE_ICON[estadoUI];
            const accesoBadge = estadoAcceso.estado === 'habilitado' ? 'b-green' : estadoAcceso.estado === 'bloqueado' ? 'b-red' : 'b-yellow';
            const pagoBadge = accesoPago.pagoBloqueado ? 'b-red' : 'b-green';

            return (
              <div key={p.id} className={`card !p-0 overflow-hidden flex flex-col border-t-4 ${STATE_BORDER[estadoUI]} hover:shadow-md transition-shadow`}>
                <div className="p-4 border-b border-cream">
                  <div className="flex justify-between items-start gap-2 mb-1">
                    <div>
                      <div className="flex items-center gap-1.5 text-gray-500 text-[11px] font-bold uppercase tracking-wider">
                        <Building2 size={13} /> {mandante?.nombre || 'Mandante'}
                      </div>
                      <h3 className="text-[16.5px] font-bold text-navy mt-0.5">{p.nombre}</h3>
                    </div>
                    <span className={`badge ${badge} shrink-0`}>{estadoUI}</span>
                  </div>
                </div>

                <div className="p-4 flex-1 flex flex-col gap-3">
                  <div className="grid grid-cols-2 gap-2">
                    <div className="bg-cream2 border border-cream3 rounded-xl p-2.5 flex flex-col items-center text-center">
                      <Lock size={14} className="text-gray-400 mb-0.5" />
                      <span className="text-[9.5px] text-gray-400 font-semibold uppercase tracking-wider">Acceso</span>
                      <span className={`badge ${accesoBadge} text-[10px] mt-1`}>{estadoAcceso.label.replace('Acceso ', '')}</span>
                    </div>
                    <div className="bg-cream2 border border-cream3 rounded-xl p-2.5 flex flex-col items-center text-center">
                      <Wallet size={14} className="text-gray-400 mb-0.5" />
                      <span className="text-[9.5px] text-gray-400 font-semibold uppercase tracking-wider">Pago</span>
                      <span className={`badge ${pagoBadge} text-[10px] mt-1`}>{accesoPago.pagoBloqueado ? 'Retenido' : 'Habilitado'}</span>
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-[12px] font-semibold text-navy mb-1">
                      <span>Empresa</span>
                      <span className="text-gray-500 font-medium">{empresaOk} / {empresaTotal} obligatorios</span>
                    </div>
                    <div className="prog-wrap"><div className="prog-fill" style={{ width: `${empresaPct}%` }}></div></div>
                  </div>
                  <div>
                    <div className="flex justify-between text-[12px] font-semibold text-navy mb-1">
                      <span>Trabajadores</span>
                      <span className="text-gray-500 font-medium">{trabajadoresTotal > 0 ? `${trabajadoresOk} / ${trabajadoresTotal} acreditados` : 'Sin trabajadores'}</span>
                    </div>
                    <div className="prog-wrap"><div className="prog-fill" style={{ width: `${trabajadoresPct}%`, backgroundColor: '#2a6a3a' }}></div></div>
                  </div>

                  <div className={`alert ${STATE_ALERT_CLASS[estadoUI]} !mb-0 text-[11.5px] items-start`}>
                    <StatusIcon size={15} className="shrink-0 mt-0.5" />
                    <span>{alertText}</span>
                  </div>

                  <div className="text-[11.5px] text-gray-500">
                    {proximoVenc
                      ? <>Próximo vencimiento: <strong className="text-navy">{proximoVenc.nombre}{proximoVenc.trabajadorNombre ? ` · ${proximoVenc.trabajadorNombre}` : ''} · {proximoVenc.dias} día{proximoVenc.dias === 1 ? '' : 's'}</strong></>
                      : 'Sin vencimientos próximos dentro del período de alerta.'}
                  </div>
                </div>

                <div className="p-3 pt-0 mt-auto flex gap-2">
                  <button
                    className={`btn ${estadoUI === 'Bloqueado' ? 'btn-reject' : 'btn-primary'} btn-sm flex-1`}
                    onClick={() => toggleDetail(p.id)}
                  >
                    {estadoUI === 'Bloqueado' ? 'Resolver bloqueos' : 'Ver proyecto'}
                  </button>
                  <button className="btn btn-secondary btn-sm" onClick={() => irADocumentos(p.id)}>Documentos</button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Detalle expandido */}
      {expandido && (
        <div className="card fade-in">
          <div className="flex justify-between items-start gap-4 flex-wrap border-b border-cream3 pb-4 mb-4">
            <div>
              <p className="text-[11px] text-gray-400 font-semibold uppercase tracking-wider mb-1">Detalle del proyecto</p>
              <h2 className="text-[20px] font-bold text-navy">{expandido.proyecto.nombre}</h2>
              <p className="text-[12.5px] text-gray-500 mt-0.5">Mandante: {expandido.mandante?.nombre || '—'}</p>
            </div>
            <div className="flex items-center gap-2">
              <span className={`badge ${expandido.badge}`}>{expandido.estadoUI}</span>
              <button className="btn btn-secondary btn-sm" onClick={() => setExpandedId(null)}>
                <X size={14} className="mr-1" /> Cerrar
              </button>
            </div>
          </div>

          <div className="tab-bar mb-4">
            {(['resumen', 'empresa', 'trabajadores'] as const).map(t => (
              <button key={t} className={`tab ${detailTab === t ? 'active' : ''}`} onClick={() => setDetailTab(t)}>
                {t === 'resumen' ? 'Resumen' : t === 'empresa' ? 'Empresa' : 'Trabajadores'}
              </button>
            ))}
          </div>

          <div className="card-grid mb-4">
            <div className="card p-3.5">
              <p className="text-[10.5px] text-gray-400 font-semibold uppercase tracking-wider mb-1">Acreditación</p>
              <p className="text-[15px] font-bold text-navy">{expandido.estadoUI}</p>
            </div>
            <div className="card p-3.5">
              <p className="text-[10.5px] text-gray-400 font-semibold uppercase tracking-wider mb-1">Acceso</p>
              <p className="text-[15px] font-bold text-navy">{expandido.estadoAcceso.label}</p>
            </div>
            <div className="card p-3.5">
              <p className="text-[10.5px] text-gray-400 font-semibold uppercase tracking-wider mb-1">Pago</p>
              <p className="text-[15px] font-bold text-navy">{expandido.accesoPago.pagoBloqueado ? 'Pago retenido' : 'Pago habilitado'}</p>
            </div>
            <div className="card p-3.5">
              <p className="text-[10.5px] text-gray-400 font-semibold uppercase tracking-wider mb-1">Próximo vencimiento</p>
              <p className="text-[15px] font-bold text-navy">{expandido.proximoVenc ? `${expandido.proximoVenc.dias} día${expandido.proximoVenc.dias === 1 ? '' : 's'}` : 'Sin alertas'}</p>
            </div>
          </div>

          {detailTab === 'resumen' && (
            <div className="grid md:grid-cols-2 gap-5">
              <div>
                <h3 className="section-title">Qué requiere atención</h3>
                <div className={`alert ${STATE_ALERT_CLASS[expandido.estadoUI]} items-start`}>
                  {(() => { const Icon = STATE_ICON[expandido.estadoUI]; return <Icon size={16} className="shrink-0 mt-0.5" />; })()}
                  <span>{expandido.alertText}</span>
                </div>
                <div className="flex gap-2 flex-wrap mt-3">
                  <button className="btn btn-primary btn-sm" onClick={() => irADocumentos(expandido.proyecto.id)}>Ir a documentos</button>
                  <button className="btn btn-secondary btn-sm" onClick={() => irATrabajadores(expandido.proyecto.id)}>Ver trabajadores</button>
                  <button className="btn btn-secondary btn-sm" onClick={() => verFicha(expandido.proyecto.id)}>Ver ficha de acreditación</button>
                </div>
              </div>
              <div>
                <h3 className="section-title">Avance</h3>
                <div className="flex flex-col gap-3">
                  <div>
                    <div className="flex justify-between text-[12.5px] font-semibold text-navy mb-1">
                      <span>Empresa</span><span className="text-gray-500 font-medium">{expandido.empresaOk} / {expandido.empresaTotal}</span>
                    </div>
                    <div className="prog-wrap"><div className="prog-fill" style={{ width: `${expandido.empresaPct}%` }}></div></div>
                  </div>
                  <div>
                    <div className="flex justify-between text-[12.5px] font-semibold text-navy mb-1">
                      <span>Trabajadores</span><span className="text-gray-500 font-medium">{expandido.trabajadoresOk} / {expandido.trabajadoresTotal}</span>
                    </div>
                    <div className="prog-wrap"><div className="prog-fill" style={{ width: `${expandido.trabajadoresPct}%`, backgroundColor: '#2a6a3a' }}></div></div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {detailTab === 'empresa' && (
            <div className="overflow-x-auto">
              {expandido.empresaItems.length === 0 ? (
                <p className="text-sm text-gray-500 py-4 text-center">Este proyecto no tiene requisitos de empresa configurados.</p>
              ) : (
                <table className="w-full text-[13px]">
                  <thead>
                    <tr>
                      <th>Requisito</th>
                      <th>Estado</th>
                      <th>Vencimiento</th>
                      <th>Impacto</th>
                      <th>Acción</th>
                    </tr>
                  </thead>
                  <tbody>
                    {expandido.empresaItems.map(item => (
                      <tr key={item.requisito.id}>
                        <td className="font-medium text-navy">{item.requisito.nombre}{!item.requisito.obligatorio && <span className="text-gray-400 font-normal"> (opcional)</span>}</td>
                        <td><span className={`badge ${BADGE[acredBadgeClass(item.estado)] || 'b-gray'} text-[10.5px]`}>{item.estado}</span></td>
                        <td className="text-gray-500">{item.doc?.vencimiento && item.doc.vencimiento !== '-' ? item.doc.vencimiento : '—'}</td>
                        <td className="text-gray-500">{impactoLabel(item.requisito)}</td>
                        <td>
                          <button className="btn btn-secondary btn-sm" onClick={() => irADocumentos(expandido.proyecto.id, item.doc)}>
                            {accionEmpresaLabel(item.estado, !!item.doc)}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {detailTab === 'trabajadores' && (
            <div className="overflow-x-auto">
              {expandido.trabajadoresAsignados.length === 0 ? (
                <p className="text-sm text-gray-500 py-4 text-center">Este proyecto todavía no tiene trabajadores asignados.</p>
              ) : (
                <table className="w-full text-[13px]">
                  <thead>
                    <tr>
                      <th>Trabajador</th>
                      <th>Estado</th>
                      <th>Detalle</th>
                      <th>Acción</th>
                    </tr>
                  </thead>
                  <tbody>
                    {expandido.trabajadoresAsignados.map(w => {
                      const estado = calcularEstadoTrabajador(w, expandido.proyecto.id);
                      const label = estado === 'aprobado' ? 'Aprobado' : estado === 'rechazado' ? 'Bloqueado' : estado === 'por_vencer' ? 'Por vencer' : 'Pendiente';
                      const badgeW = estado === 'aprobado' ? 'b-green' : estado === 'rechazado' ? 'b-red' : estado === 'por_vencer' ? 'b-yellow' : 'b-gray';
                      return (
                        <tr key={w.rut}>
                          <td className="font-medium text-navy">{w.nombre}</td>
                          <td><span className={`badge ${badgeW} text-[10.5px]`}>{label}</span></td>
                          <td className="text-gray-500">{estado === 'aprobado' ? 'Sin observaciones' : getMotivoBloqueoTrabajador(w, expandido.proyecto.id)}</td>
                          <td>
                            <button className="btn btn-secondary btn-sm" onClick={() => irATrabajadores(expandido.proyecto.id, w)}>
                              <Eye size={13} className="mr-1" /> Ver trabajador
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
