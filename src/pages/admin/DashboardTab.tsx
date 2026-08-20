import { ClipboardList, Clock, ChevronRight, Bell, ShieldAlert, FileText, Download, X, XCircle } from 'lucide-react';
import { getAlertasVigencia } from '../../data/localStorageDb';
import { Contratista, Proyecto } from '../../types';
import { buildColaDocs } from './colaUtils';

export default function DashboardTab({
  GLOBAL_CONTRATISTAS,
  GLOBAL_PROYECTOS,
  setActiveTab,
  aprobadosHoy,
  rechazadosHoy,
  setSelectedDocId,
  filtroActividad,
  setFiltroActividad,
  ACTIVIDAD_RECIENTE,
  actividadSeleccionada,
  setActividadSeleccionada,
}: {
  GLOBAL_CONTRATISTAS: Contratista[];
  GLOBAL_PROYECTOS: Proyecto[];
  setActiveTab: (v: string) => void;
  aprobadosHoy: number;
  rechazadosHoy: number;
  setSelectedDocId: (id: number | null) => void;
  filtroActividad: string;
  setFiltroActividad: (v: string) => void;
  ACTIVIDAD_RECIENTE: any[];
  actividadSeleccionada: any;
  setActividadSeleccionada: (v: any) => void;
}) {
  const dynamicCola = buildColaDocs(GLOBAL_CONTRATISTAS, GLOBAL_PROYECTOS);
  const countPending = dynamicCola.length;
  const countUrgent = dynamicCola.filter(d => d.prio === 'Alta').length;

  const waitingCorrectionList: any[] = [];
  GLOBAL_CONTRATISTAS.forEach(c => {
    c.documentos.forEach(d => {
      if (d.estado === 'rechazado') {
        const pId = c.proyectos[0] || 'costanera';
        const project = GLOBAL_PROYECTOS.find(p => p.id === pId);

        waitingCorrectionList.push({
          id: d.id,
          empresa: c.nombre,
          rut: c.rut,
          proyecto: project ? project.nombre : 'Faena Costanera',
          documento: d.nombre,
          motivo: d.motivo || 'Firma digital no legible en el anexo 2.',
          intentos: 2,
          fecha: d.vencimiento || '12-05-2026'
        });
      }
    });
  });

  const mockCasosSeguimiento = [
    { id: "seg-1", empresa: "TécnicoSur SpA", proyecto: "Torre Mackenna", detalle: "ODI de Alejandro Muñoz", info: "2 rechazos consecutivos por huella digital borrosa" },
    { id: "seg-2", empresa: "Constructora del Sol", proyecto: "Planta Solar", detalle: "Registro Mutual ACHS", info: "Documentación de faena no corresponde al período" },
    { id: "seg-3", empresa: "Eléctrica del Sur", proyecto: "Torre Mackenna", detalle: "Contrato de Trabajo de Juan Pérez", info: "RUT de trabajador no coincide con credencial" },
    { id: "seg-4", empresa: "Lagos y Cía", proyecto: "Costanera Norte", detalle: "F30 de Empresa", info: "3 intentos fallidos de subida de planilla SII" },
    { id: "seg-5", empresa: "Servicios Generales Ltda", proyecto: "Costanera Norte", detalle: "Certificado de Antecedentes de Carlos Rojas", info: "Documento con vigencia vencida por 3 meses" }
  ];

  const mockCasosDecision = [
    { id: "dec-1", empresa: "TécnicoSur SpA", proyecto: "Torre Mackenna", detalle: "Certificado ODI", info: "Excepción de firma notarial para trabajador extranjero (Jefe Verificador)" },
    { id: "dec-2", empresa: "Constructora del Sol", proyecto: "Planta Solar", detalle: "Certificado Antecedentes", info: "Discrepancia en validación de firma digital homologada (Jefe Verificador)" },
    { id: "dec-3", empresa: "Eléctrica del Sur", proyecto: "Torre Mackenna", detalle: "Examen de Altura Física", info: "Criterio de vigencia de examen médico extranjero (Jefe Verificador)" },
    { id: "dec-4", empresa: "Lagos y Cía", proyecto: "Costanera Norte", detalle: "Declaración jurada F30", info: "Revisión de cláusula de responsabilidad solidaria (Jefe Verificador)" }
  ];

  return (
    <div className="fade-in space-y-6">
      <div className="page-header">
        <div>
          <h2 className="page-title text-navy font-bold text-[22px]">Centro de Operaciones</h2>
          <p className="page-sub text-gray-500 text-[13.5px]">
            Lunes 18 de mayo 2026 · Monitoreo y control de Acreditaciones
          </p>
        </div>
      </div>

      <div className="space-y-6">
        <div className="stats">
          <div className="stat s-orange cursor-pointer hover:opacity-95 transition-opacity" onClick={() => { setActiveTab("cola"); }}>
            <div className="stat-n">{countPending}</div>
            <div className="stat-l font-sans">Pendientes de revisión</div>
          </div>
          <div className="stat s-yellow">
            <div className="stat-n">{waitingCorrectionList.length}</div>
            <div className="stat-l font-sans">Esperando corrección</div>
          </div>
          <div className="stat s-brown">
            <div className="stat-n">5</div>
            <div className="stat-l font-sans">Casos en seguimiento</div>
          </div>
          <div className="stat s-red">
            <div className="stat-n">4</div>
            <div className="stat-l font-sans">Casos que requieren decisión</div>
          </div>
          <div className="stat s-green">
            <div className="stat-n">{aprobadosHoy}</div>
            <div className="stat-l font-sans">Aprobados hoy</div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-6">
          <div className="space-y-6">
            <div className="card border border-cream3 shadow-sm bg-white">
              <div className="flex justify-between items-center mb-4 pb-3 border-b border-cream3">
                <div>
                  <h3 className="section-title mb-0 text-navy font-bold text-[16px] flex items-center gap-2">
                    <ClipboardList size={18} className="text-orange-500" />
                    PENDIENTES DE REVISIÓN
                  </h3>
                  <p className="text-xs text-gray-500 mt-0.5">El trabajo está pendiente de Acredita en la cola común.</p>
                </div>
                <span className="badge b-orange text-xs font-semibold">{countPending} documentos</span>
              </div>

              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-cream/30 p-4 rounded-xl border border-cream3">
                <div>
                  <div className="text-[14.5px] font-bold text-navy">Cola común de verificación</div>
                  <p className="text-[12.5px] text-gray-600 mt-0.5 leading-relaxed font-sans">
                    Hay {countPending} documentos esperando revisión por el equipo. {countUrgent > 0 && `${countUrgent} de ellos son de alta prioridad.`}
                  </p>
                </div>
                <button
                  onClick={() => {
                    if (dynamicCola.length > 0) {
                      setSelectedDocId(dynamicCola[0].id);
                    }
                    setActiveTab("cola");
                  }}
                  className="btn btn-primary shadow-md shrink-0 w-full sm:w-auto"
                >
                  Comenzar revisión
                </button>
              </div>
            </div>

            <div className="card border border-cream3 shadow-sm bg-white font-sans">
              <div className="flex justify-between items-center mb-4 pb-3 border-b border-cream3">
                <div>
                  <h3 className="section-title mb-0 text-navy font-bold text-[16px] flex items-center gap-2 font-sans">
                    <Clock size={18} className="text-yellow-600" />
                    ESPERANDO CORRECCIÓN DEL CONTRATISTA
                  </h3>
                  <p className="text-xs text-gray-500 mt-0.5">Documentos revisados y rechazados por Acredita que esperan corrección.</p>
                </div>
                <span className="badge b-yellow text-xs font-semibold">{waitingCorrectionList.length} pendientes</span>
              </div>

              {waitingCorrectionList.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="table w-full text-left">
                    <thead>
                      <tr>
                        <th className="px-3 py-2 text-[12px] bg-cream2 text-navy border-b border-cream3">Contratista / Proyecto</th>
                        <th className="px-3 py-2 text-[12px] bg-cream2 text-navy border-b border-cream3">Requisito</th>
                        <th className="px-3 py-2 text-[12px] bg-cream2 text-navy border-b border-cream3">Motivo Rechazo</th>
                        <th className="px-3 py-2 text-[12px] bg-cream2 text-navy border-b border-cream3 text-right">Intentos</th>
                      </tr>
                    </thead>
                    <tbody>
                      {waitingCorrectionList.map((item) => (
                        <tr key={item.id} className="hover:bg-gray-50 border-b border-cream last:border-b-0 text-[12.5px]">
                          <td className="px-3 py-2.5">
                            <div className="font-semibold text-navy">{item.empresa}</div>
                            <div className="text-[11px] text-gray-500">{item.proyecto}</div>
                          </td>
                          <td className="px-3 py-2.5">
                            <span className="font-medium text-gray-700">{item.documento}</span>
                          </td>
                          <td className="px-3 py-2.5 text-red-700 font-sans max-w-[200px] truncate" title={item.motivo}>
                            {item.motivo}
                          </td>
                          <td className="px-3 py-2.5 text-right font-medium text-navy">{item.intentos}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-center py-6 text-gray-400 text-xs">No hay documentos pendientes de corrección.</p>
              )}
              <div className="mt-3.5 flex justify-end">
                <button
                  disabled
                  title="No disponible en entorno demo"
                  className="text-[12px] text-gray-400 font-semibold flex items-center gap-1 cursor-not-allowed opacity-60"
                >
                  Ver todos los seguimientos [Demo] <ChevronRight size={14} />
                </button>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="card border border-cream3 shadow-sm bg-white font-sans">
              <div className="mb-3">
                <h3 className="section-title mb-0 text-navy font-bold text-[16px] flex items-center gap-2">
                  <Bell size={18} className="text-orange-500 animate-pulse" />
                  ALERTAS DE VIGENCIA
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">Alertas de vencimiento basadas en proyectos y criticidad de requisitos.</p>
              </div>

              <div className="divide-y divide-cream max-h-[300px] overflow-y-auto pr-1">
                {(() => {
                  const list = getAlertasVigencia();
                  const sorted = [...list].sort((a, b) => {
                    const score = { 'Crítica': 3, 'Atención': 2, 'Informativa': 1 };
                    return score[b.criticidad] - score[a.criticidad];
                  });

                  if (sorted.length === 0) {
                    return <p className="text-center py-6 text-gray-400 text-xs">No hay alertas de vigencia activas.</p>;
                  }

                  return sorted.map(alert => {
                    const critColor = alert.criticidad === 'Crítica' ? 'text-red-600 bg-red-50 border-red-100' :
                                      alert.criticidad === 'Atención' ? 'text-yellow-600 bg-yellow-50 border-yellow-100' :
                                      'text-blue-600 bg-blue-50 border-blue-100';

                    return (
                      <div key={alert.id} className="py-2.5 flex items-start justify-between gap-3 text-[12.5px]">
                        <div className="flex-1">
                          <div className="font-semibold text-navy flex items-center gap-1.5 flex-wrap">
                            {alert.documentoNombre}
                            <span className={`text-[9.5px] px-1.5 py-0.5 rounded border font-medium ${critColor}`}>
                              {alert.criticidad}
                            </span>
                          </div>
                          <div className="text-[11px] text-gray-600 font-medium mt-0.5">
                            Empresa: {alert.empresaNombre} {alert.trabajadorNombre && `· Personal: ${alert.trabajadorNombre}`}
                          </div>
                          <div className="text-[10.5px] text-gray-400 mt-0.5 flex flex-wrap gap-x-2">
                            <span>Obra: {alert.proyectoNombre}</span>
                            <span>Vence: {alert.vencimiento}</span>
                            {alert.bloquea && <span className="text-red-500 font-bold font-sans">Bloquea Faena</span>}
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <div className={`font-bold text-[13px] ${alert.diasRestantes < 0 ? 'text-red-600' : 'text-gray-600'}`}>
                            {alert.diasRestantes < 0 ? `Vencido` : `${alert.diasRestantes} d`}
                          </div>
                          <div className="text-[9.5px] text-gray-400">restantes</div>
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>
            </div>

            <div className="card border border-cream3 shadow-sm bg-white font-sans">
              <div className="mb-3">
                <h3 className="section-title mb-0 text-navy font-bold text-[16px] flex items-center gap-2">
                  <ShieldAlert size={18} className="text-[#a32d2d]" />
                  REQUIEREN DECISIÓN
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">Casos complejos que requieren intervención del Jefe de Verificadores.</p>
                <span className="text-[10px] text-gray-400 italic block mt-1">* Concepto operacional (Dato mock de simulación)</span>
              </div>

              <div className="divide-y divide-cream">
                {mockCasosDecision.map(caso => (
                  <div key={caso.id} className="py-2.5 flex items-start justify-between gap-3 text-[12.5px]">
                    <div className="flex-1">
                      <div className="font-semibold text-navy">{caso.empresa}</div>
                      <div className="text-[11.5px] text-gray-600 font-medium">{caso.detalle}</div>
                      <div className="text-[11px] text-gray-400 mt-0.5">{caso.info}</div>
                    </div>
                    <button
                      disabled
                      title="No disponible en demo"
                      className="btn btn-ghost btn-sm text-gray-400 text-[11px] font-semibold shrink-0 cursor-not-allowed opacity-50"
                    >
                      Revisar [Demo]
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="card border border-cream3 shadow-sm bg-white font-sans">
              <h3 className="section-title mb-3 text-navy font-bold text-[16px] flex items-center gap-2">
                <Clock size={18} className="text-gray-500" />
                ACTIVIDAD DE LA OPERACIÓN (HOY)
              </h3>
              <div className="grid grid-cols-2 gap-3 text-center">
                <div className="bg-[#eaf3de] border border-[#cde3b0] p-2.5 rounded-lg">
                  <div className="text-lg font-bold text-[#3b6d11]">{aprobadosHoy}</div>
                  <div className="text-[11.5px] text-gray-600">Aprobados</div>
                </div>
                <div className="bg-[#fef2f2] border border-[#fecaca] p-2.5 rounded-lg">
                  <div className="text-lg font-bold text-[#a32d2d]">{rechazadosHoy}</div>
                  <div className="text-[11.5px] text-gray-600">Rechazados</div>
                </div>
                <div className="bg-cream/40 border border-cream3 p-2.5 rounded-lg col-span-2">
                  <div className="text-[12.5px] text-gray-700 font-medium">Total en cola: <strong>{countPending} pendientes</strong></div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 mt-6">
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="section-title mb-0">Actividad reciente</h3>
              <select
                value={filtroActividad}
                onChange={(e) => setFiltroActividad(e.target.value)}
                className="form-input text-[12px] py-1 px-2 w-auto"
              >
                <option value="todos">Todos los estados</option>
                <option value="revision">En revisión</option>
                <option value="aprobado">Aprobado</option>
                <option value="rechazado">Rechazado</option>
                <option value="registrado">Registrado</option>
              </select>
            </div>
            <div className="overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0">
              <table className="table min-w-[600px]">
                <thead>
                  <tr>
                    <th>Evento</th>
                    <th>Empresa</th>
                    <th>Documento</th>
                    <th>Hora</th>
                    <th>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {ACTIVIDAD_RECIENTE
                    .filter(a => filtroActividad === "todos" || a.estado === filtroActividad)
                    .map(a => (
                      <tr
                        key={a.id}
                        className="cursor-pointer hover:bg-cream transition-colors"
                        onClick={() => setActividadSeleccionada(a)}
                      >
                        <td>{a.evento}</td>
                        <td className="text-[13.2px]">{a.empresa}</td>
                        <td className="text-[13.2px]">{a.documento}</td>
                        <td className="text-[13.2px]">{a.hora}</td>
                        <td>
                          <span className={`badge ${
                            a.estado === 'aprobado' ? 'b-green' :
                            a.estado === 'rechazado' ? 'b-red' :
                            a.estado === 'registrado' ? 'b-blue' : 'b-yellow'
                          }`}>
                            {a.estado === 'revision' ? 'En revisión' :
                             a.estado === 'aprobado' ? 'Aprobado' :
                             a.estado === 'rechazado' ? 'Rechazado' : 'Registrado'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  {ACTIVIDAD_RECIENTE.filter(a => filtroActividad === "todos" || a.estado === filtroActividad).length === 0 && (
                      <tr><td colSpan={5} className="text-center py-6 text-gray-400 text-[13px]">No hay actividad con este estado.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
      {actividadSeleccionada && (
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
      )}
    </div>
  );
}
