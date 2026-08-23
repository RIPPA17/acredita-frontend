import { CheckCircle, X, AlertCircle, XCircle, AlertTriangle, Clock, Users, ArrowRight, Lock, Wallet, FileText, UserPlus } from 'lucide-react';
import {
  calcularEstadoTrabajador,
  calcularAccesoPago,
  getRequisitos,
  getMotivoBloqueoTrabajador,
  esTrabajadorAsignado,
} from '../../data/localStorageDb';
import { Contratista, Proyecto, Documento, Mandante, Trabajador } from '../../types';
import { buildAcreditacionRows, estadoUILabel, badgeClass as acredBadgeClass } from '../admin/acreditacionUtils';
import {
  buildRequisitosEmpresa,
  buildRequisitosTrabajador,
  impactoLabel,
  motivoEmpresaItem,
  accionEmpresaLabel,
  prioridadItem,
  encontrarProximoVencimiento,
  getEstadoAccesoProyecto,
} from './inicio/inicioUtils';

// Mapea los colores centrales (green/amber/red/gray) a las clases de badge
// ya usadas en todo el portal Contratista (b-green/b-yellow/b-red/b-gray).
const BADGE: Record<string, string> = { green: 'b-green', amber: 'b-yellow', red: 'b-red', gray: 'b-gray' };

interface BloqueoItem {
  tipo: 'Empresa' | 'Trabajador';
  nombre: string;
  estadoLabel: string;
  estadoBadge: string;
  motivo: string;
  impacto: string;
  prioridad: number;
  accionLabel: string;
  onAccion: () => void;
}

export default function DashboardTab({
  contratistaLogueado,
  selectedProyectoId,
  setSelectedProyectoId,
  misProyectos,
  allMandantes,
  showWelcomeAlert,
  setShowWelcomeAlert,
  documentosData,
  trabajadoresData,
  approvedWorkers,
  totalWorkers,
  setActiveTab,
  setSelectedDocumentForPanel,
  setFichaTipo,
  setFichaTrabajador,
  setShowFichaAcreditacion,
  setSelectedWorkerForDocs,
}: {
  contratistaLogueado: Contratista;
  selectedProyectoId: string;
  setSelectedProyectoId: (id: string) => void;
  misProyectos: Proyecto[];
  allMandantes: Mandante[];
  showWelcomeAlert: boolean;
  setShowWelcomeAlert: (v: boolean) => void;
  documentosData: Documento[];
  trabajadoresData: Trabajador[];
  numAprobados: number;
  numRechazados: number;
  numPendientes: number;
  numPorVencer: number;
  approvedWorkers: number;
  totalWorkers: number;
  pendingWorkers: number;
  setActiveTab: (v: string) => void;
  setSelectedDocumentForPanel: (d: Documento | null) => void;
  setFichaTipo: (v: 'empresa' | 'trabajador') => void;
  setFichaTrabajador: (v: any) => void;
  setShowFichaAcreditacion: (v: boolean) => void;
  setSelectedWorkerForDocs: (v: any | null) => void;
}) {
  // --- Sin proyectos asociados: nada más que calcular ---
  if (misProyectos.length === 0) {
    return (
      <div className="fade-in flex flex-col gap-6">
        <div className="page-header">
          <div>
            <h2 className="page-title">Inicio</h2>
            <p className="text-[13px] text-gray-500 mt-1">Vista general de acreditación por proyecto, estado de acceso y pago, bloqueos operativos, acciones urgentes y resumen de empresa y trabajadores.</p>
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

  const proyectoActual = misProyectos.find(p => p.id === selectedProyectoId) || misProyectos[0];
  const mandanteActual = allMandantes.find(m => m.id === proyectoActual.mandanteId);

  // --- Única fuente de verdad de acreditación: reutiliza buildAcreditacionRows ---
  const rows = buildAcreditacionRows([contratistaLogueado], misProyectos, allMandantes);
  const proyectoRow = rows.find(r => r.proyectoId === proyectoActual.id);
  const rowsByProyecto = new Map(rows.map(r => [r.proyectoId, r]));

  // --- Trabajadores realmente asignados a este proyecto: mismo criterio
  // central que usa buildAcreditacionRows (esTrabajadorAsignado), nunca
  // trabajadoresData "a secas" — así la card principal, "Tus proyectos" y
  // las demás secciones jamás pueden contarse historias distintas. ---
  const trabajadoresAsignados = (contratistaLogueado.trabajadores || []).filter(w =>
    esTrabajadorAsignado(w, proyectoActual.id, misProyectos)
  );

  const accesoPago = calcularAccesoPago(contratistaLogueado, proyectoActual.id);
  const estadoAcceso = getEstadoAccesoProyecto(contratistaLogueado, proyectoActual.id, trabajadoresAsignados);

  const empresaObligatoriosOk = proyectoRow?.company.ok ?? 0;
  const empresaObligatoriosTotal = proyectoRow?.company.total ?? 0;
  const trabajadoresOk = proyectoRow?.workers.ok ?? approvedWorkers;
  const trabajadoresTotal = proyectoRow?.workers.total ?? totalWorkers;

  const proyectoRecienIniciado = documentosData.length === 0 && trabajadoresAsignados.length === 0;

  const requisitosAll = getRequisitos();
  const empresaItems = buildRequisitosEmpresa(contratistaLogueado, proyectoActual.id, requisitosAll);
  const workerItemsAll = trabajadoresAsignados.flatMap(w => buildRequisitosTrabajador(w, proyectoActual.id, requisitosAll));
  const proximoVenc = encontrarProximoVencimiento([...empresaItems, ...workerItemsAll]);

  // --- Bloqueos / pendientes: una fila por requisito de empresa incumplido +
  // una fila por trabajador que no está aprobado (nunca por documento suyo,
  // ya que la acción siempre es "Ver trabajador" y abre su carpeta completa) ---
  const bloqueoItems: BloqueoItem[] = [];

  empresaItems.forEach(item => {
    const prioridad = prioridadItem(item);
    if (prioridad >= 99) return;
    bloqueoItems.push({
      tipo: 'Empresa',
      nombre: item.requisito.nombre,
      estadoLabel: item.estado,
      estadoBadge: BADGE[acredBadgeClass(item.estado)] || 'b-gray',
      motivo: motivoEmpresaItem(item),
      impacto: impactoLabel(item.requisito),
      prioridad,
      accionLabel: accionEmpresaLabel(item.estado, !!item.doc),
      onAccion: () => {
        setActiveTab('subir');
        if (item.doc) setSelectedDocumentForPanel(item.doc);
      },
    });
  });

  trabajadoresAsignados.forEach(w => {
    const estado = calcularEstadoTrabajador(w, proyectoActual.id);
    if (estado === 'aprobado') return;
    const prioridad = estado === 'rechazado' ? 1 : estado === 'por_vencer' ? 3 : 4;
    const estadoLabel = estado === 'rechazado' ? 'Bloqueado' : estado === 'por_vencer' ? 'Por vencer' : 'Pendiente';
    bloqueoItems.push({
      tipo: 'Trabajador',
      nombre: w.nombre,
      estadoLabel,
      estadoBadge: estado === 'rechazado' ? 'b-red' : estado === 'por_vencer' ? 'b-yellow' : 'b-gray',
      motivo: getMotivoBloqueoTrabajador(w, proyectoActual.id),
      impacto: estado === 'rechazado' ? 'Bloquea acceso' : estado === 'por_vencer' ? 'Advertencia' : 'Pendiente',
      prioridad,
      accionLabel: 'Ver trabajador',
      onAccion: () => {
        setActiveTab('trabajadores');
        setSelectedWorkerForDocs(w);
      },
    });
  });

  bloqueoItems.sort((a, b) => a.prioridad - b.prioridad);
  const panelBloqueos = bloqueoItems.filter(i => i.prioridad <= 3);

  const primerBloqueoPago = bloqueoItems.find(i => i.prioridad === 0);
  const primerBloqueoAcceso = bloqueoItems.find(i => i.prioridad === 1);
  const hayAlertaHoy = !!primerBloqueoPago || !!primerBloqueoAcceso;
  // Si lo único que bloquea es un documento "En revisión", el contratista ya
  // hizo su parte — la alerta no puede pedirle que "corrija" algo que está
  // esperando a Acredita.
  const mensajeAlertaHoy = primerBloqueoPago
    ? primerBloqueoPago.estadoLabel === 'En revisión'
      ? `Tu pago está retenido por "${primerBloqueoPago.nombre}", que ya está en revisión — Acredita lo evaluará pronto.`
      : `Tu pago está retenido por "${primerBloqueoPago.nombre}". Corrígelo para habilitarlo.`
    : primerBloqueoAcceso
    ? primerBloqueoAcceso.estadoLabel === 'En revisión'
      ? `Tu acceso a faena está bloqueado por "${primerBloqueoAcceso.nombre}", que ya está en revisión — Acredita lo evaluará pronto.`
      : `Tu acceso a faena está bloqueado por "${primerBloqueoAcceso.nombre}". Corrígelo para poder ingresar.`
    : '';

  // --- Empresa opcionales (nunca bloquean, solo informativos) ---
  const empresaOpcionales = empresaItems.filter(i => !i.requisito.obligatorio);
  const empresaOpcionalesOk = empresaOpcionales.filter(i => i.estado === 'Aprobado' || i.estado === 'Por vencer').length;

  // --- Acceso / Pago: el acceso se compone con getEstadoAccesoProyecto()
  // (mismo helper para la card principal y para "Tus proyectos", nunca
  // pueden contradecirse); el pago sigue dependiendo solo de la criticidad
  // de empresa vía calcularAccesoPago() — nunca de trabajadores pendientes. ---
  const accesoLabel = estadoAcceso.label;
  const accesoBadge = estadoAcceso.estado === 'habilitado' ? 'b-green' : estadoAcceso.estado === 'bloqueado' ? 'b-red' : 'b-yellow';
  const accesoDetalle = [
    accesoPago.motivoAcceso && !accesoPago.motivoAcceso.startsWith('Trabajador') ? accesoPago.motivoAcceso : undefined,
    estadoAcceso.detalle,
  ].filter(Boolean).join(' ');

  const pagoLabel = accesoPago.pagoBloqueado ? 'Pago retenido' : 'Pago habilitado';
  const pagoBadge = accesoPago.pagoBloqueado ? 'b-red' : 'b-green';

  const estadoUI = proyectoRow ? estadoUILabel(proyectoRow.estado) : 'En proceso';
  const estadoBadgeClase = proyectoRow ? BADGE[acredBadgeClass(proyectoRow.estado)] : 'b-yellow';
  const StatusIcon = estadoUI === 'Acreditado' ? CheckCircle : estadoUI === 'Bloqueado' ? XCircle : Clock;
  const statusIconColor = estadoUI === 'Acreditado' ? 'text-green-600' : estadoUI === 'Bloqueado' ? 'text-red-600' : 'text-yellow-600';

  const empresaProgressPct = empresaObligatoriosTotal > 0 ? Math.round((empresaObligatoriosOk / empresaObligatoriosTotal) * 100) : 100;
  // 0 trabajadores no es "100% acreditado": es que no se ha agregado a nadie.
  const workersProgressPct = trabajadoresTotal > 0 ? Math.round((trabajadoresOk / trabajadoresTotal) * 100) : 0;

  return (
    <div className="fade-in flex flex-col gap-6">
      <div className="page-header">
        <div>
          <h2 className="page-title">Inicio</h2>
          <p className="text-[13px] text-gray-500 mt-0.5">Vista general de acreditación por proyecto, estado de acceso y pago, bloqueos operativos, acciones urgentes y resumen de empresa y trabajadores.</p>
          <div className="flex items-center gap-3 mt-2 text-[12.5px] flex-wrap">
            <span className="text-gray-500 font-medium">{contratistaLogueado.nombre} · RUT {contratistaLogueado.rut}</span>
            <span className="text-gray-300">|</span>
            <select
              value={selectedProyectoId}
              onChange={(e) => setSelectedProyectoId(e.target.value)}
              className="text-[12.5px] border border-cream3 rounded-md px-2 py-0.5 bg-white text-navy focus:outline-none focus:border-brown font-semibold cursor-pointer"
            >
              {misProyectos.map(p => (
                <option key={p.id} value={p.id}>Proyecto: {p.nombre}</option>
              ))}
            </select>
            {mandanteActual && <span className="text-gray-400">Mandante: {mandanteActual.nombre}</span>}
          </div>
        </div>
      </div>

      {showWelcomeAlert && (
        <div className="alert alert-success fade-in mb-2 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <CheckCircle size={18} className="shrink-0" />
            <span><strong>Bienvenido al proyecto</strong> — revisa los requisitos de acreditación abajo.</span>
          </div>
          <button onClick={() => setShowWelcomeAlert(false)} className="text-[#2a6a3a] hover:opacity-70">
            <X size={16} />
          </button>
        </div>
      )}

      {hayAlertaHoy && (
        <div className="alert alert-warning fade-in flex items-center gap-2">
          <AlertTriangle size={18} className="shrink-0" />
          <span><strong>Prioridad de hoy:</strong> {mensajeAlertaHoy}</span>
        </div>
      )}

      {proyectoRecienIniciado ? (
        <div className="card bg-cream border border-cream3 p-8 flex flex-col items-center text-center">
          <FileText size={34} className="text-brown mb-3" />
          <p className="font-semibold text-navy text-[16px]">Proyecto recién iniciado</p>
          <p className="text-sm text-gray-500 mt-1 max-w-md">Aún no hay documentos ni trabajadores cargados para {proyectoActual.nombre}. Empieza subiendo los documentos de empresa y agregando a tu equipo.</p>
          <div className="flex gap-3 mt-5">
            <button className="btn btn-primary" onClick={() => setActiveTab('subir')}>Subir primer documento empresa</button>
            <button className="btn btn-secondary" onClick={() => setActiveTab('trabajadores')}>Agregar trabajadores</button>
          </div>
        </div>
      ) : (
        <>
          {/* 1. Estado del proyecto */}
          <div className="card bg-cream border border-cream3 p-5">
            <h3 className="section-title text-[15px] font-bold text-navy mb-4 flex items-center justify-between gap-2 w-full">
              <span className="flex items-center gap-2">
                <StatusIcon size={18} className={statusIconColor} />
                Estado de tu acreditación en {proyectoActual.nombre}
              </span>
              <span className={`badge ${estadoBadgeClase} text-[11px]`}>{estadoUI}</span>
            </h3>

            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1 flex flex-col gap-4">
                <div>
                  <div className="flex justify-between items-center text-[13.2px] font-semibold text-navy mb-1.5">
                    <span>Requisitos empresa obligatorios</span>
                    <span className="text-gray-500 font-medium">{empresaObligatoriosOk} / {empresaObligatoriosTotal} aprobados</span>
                  </div>
                  <div className="prog-wrap"><div className="prog-fill" style={{ width: `${empresaProgressPct}%` }}></div></div>
                  {empresaOpcionales.length > 0 && (
                    <p className="text-[11.5px] text-gray-400 mt-1">Opcionales: {empresaOpcionalesOk} / {empresaOpcionales.length} (no afectan tu acreditación)</p>
                  )}
                </div>
                <div>
                  <div className="flex justify-between items-center text-[13.2px] font-semibold text-navy mb-1.5">
                    <span>Trabajadores acreditados</span>
                    <span className="text-gray-500 font-medium">
                      {trabajadoresTotal > 0 ? `${trabajadoresOk} / ${trabajadoresTotal}` : 'Sin trabajadores agregados'}
                    </span>
                  </div>
                  <div className="prog-wrap"><div className="prog-fill" style={{ width: `${workersProgressPct}%`, backgroundColor: '#2a6a3a' }}></div></div>
                  {trabajadoresTotal === 0 && (
                    <button
                      className="btn btn-secondary btn-sm mt-2 py-1 text-[11.5px]"
                      onClick={() => setActiveTab('trabajadores')}
                    >
                      Agregar trabajadores
                    </button>
                  )}
                </div>
              </div>

              {/* 2. Acceso a faena / Estado de pago — dos bloques separados */}
              <div className="flex flex-col sm:flex-row md:flex-col gap-3 w-full md:w-64">
                <div className="flex-1 bg-white border border-cream3 rounded-2xl p-3.5 flex flex-col items-center text-center">
                  <Lock size={16} className="text-gray-400 mb-1" />
                  <span className="text-[10.5px] text-gray-400 font-semibold uppercase tracking-wider mb-1">Acceso a faena</span>
                  <span className={`badge ${accesoBadge} text-[11px] font-bold py-1 px-2.5 mb-1`}>{accesoLabel}</span>
                  {accesoDetalle && <p className="text-[11px] text-gray-500 mt-1 leading-snug">{accesoDetalle}</p>}
                </div>
                <div className="flex-1 bg-white border border-cream3 rounded-2xl p-3.5 flex flex-col items-center text-center">
                  <Wallet size={16} className="text-gray-400 mb-1" />
                  <span className="text-[10.5px] text-gray-400 font-semibold uppercase tracking-wider mb-1">Estado de pago</span>
                  <span className={`badge ${pagoBadge} text-[11px] font-bold py-1 px-2.5 mb-1`}>{pagoLabel}</span>
                  {accesoPago.motivoPago && <p className="text-[11px] text-gray-500 mt-1 leading-snug">{accesoPago.motivoPago}</p>}
                </div>
              </div>
            </div>

            <button
              className="btn btn-secondary btn-sm mt-4 py-1.5 text-[12px] font-semibold"
              onClick={() => { setFichaTipo('empresa'); setFichaTrabajador(null); setShowFichaAcreditacion(true); }}
            >
              Ver ficha de acreditación
            </button>
          </div>

          {/* 3. Qué te está bloqueando exactamente */}
          <div className="card">
            <div className="flex justify-between items-center mb-4 border-b border-cream3 pb-3">
              <h3 className="section-title mb-0 flex items-center gap-2">
                <AlertCircle size={18} className="text-red-600" />
                Qué te está bloqueando exactamente
              </h3>
              {panelBloqueos.length > 0 && <span className="badge b-red font-semibold">{panelBloqueos.length}</span>}
            </div>
            {panelBloqueos.length === 0 ? (
              <div className="py-6 flex flex-col items-center justify-center text-center text-gray-500">
                <CheckCircle size={32} className="text-green-500 mb-2" />
                <p className="font-semibold text-navy">No tienes bloqueos activos en este proyecto.</p>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {panelBloqueos.map((b, idx) => (
                  <div key={idx} className="p-3 border border-red-100 bg-red-50/50 rounded-xl flex flex-col sm:flex-row justify-between sm:items-center gap-3">
                    <div className="flex-1">
                      <div className="text-[13.8px] font-bold text-navy flex items-center gap-1.5 flex-wrap">
                        {b.tipo}: {b.nombre}
                        <span className={`badge ${b.estadoBadge} text-[10px] py-0 px-1.5`}>{b.estadoLabel}</span>
                      </div>
                      <p className="text-[12.1px] text-red-700 mt-1"><strong>Motivo:</strong> {b.motivo}</p>
                      <p className="text-[11.5px] text-gray-500 mt-0.5"><strong>Impacto:</strong> {b.impacto}</p>
                    </div>
                    <button className="btn btn-primary btn-sm shrink-0" onClick={b.onAccion}>{b.accionLabel}</button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 4. KPIs */}
          <div className="card-grid">
            <div className="card p-4">
              <p className="text-[11px] text-gray-400 font-semibold uppercase tracking-wider mb-1">Empresa · Obligatorios</p>
              <p className="text-[22px] font-bold text-navy">{empresaObligatoriosOk}/{empresaObligatoriosTotal}</p>
            </div>
            <div className="card p-4">
              <p className="text-[11px] text-gray-400 font-semibold uppercase tracking-wider mb-1">Empresa · Opcionales</p>
              <p className="text-[22px] font-bold text-navy">{empresaOpcionalesOk}/{empresaOpcionales.length}</p>
            </div>
            <div className="card p-4">
              <p className="text-[11px] text-gray-400 font-semibold uppercase tracking-wider mb-1">Trabajadores acreditados</p>
              <p className="text-[22px] font-bold text-navy">{trabajadoresOk}/{trabajadoresTotal}</p>
            </div>
            <div className="card p-4">
              <p className="text-[11px] text-gray-400 font-semibold uppercase tracking-wider mb-1">Próximo vencimiento</p>
              {proximoVenc ? (
                <>
                  <p className="text-[22px] font-bold text-navy">{proximoVenc.dias}d</p>
                  <p className="text-[11.5px] text-gray-500 truncate">{proximoVenc.nombre}{proximoVenc.trabajadorNombre ? ` · ${proximoVenc.trabajadorNombre}` : ''}</p>
                </>
              ) : (
                <p className="text-[13px] text-gray-400 mt-1.5">Sin vencimientos próximos</p>
              )}
            </div>
          </div>

          {/* 5. Qué te falta hoy */}
          <div className="card">
            <div className="flex justify-between items-center mb-4 border-b border-cream3 pb-3">
              <h3 className="section-title mb-0 flex items-center gap-2">
                <Clock size={18} className="text-navy" />
                Qué te falta hoy
              </h3>
              {bloqueoItems.length > 0 && <span className="badge b-gray font-semibold">{bloqueoItems.length} pendientes</span>}
            </div>
            {bloqueoItems.length === 0 ? (
              <div className="py-6 flex flex-col items-center justify-center text-center text-gray-500">
                <CheckCircle size={32} className="text-green-500 mb-2" />
                <p className="font-semibold text-navy">No tienes acciones pendientes en este proyecto.</p>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {bloqueoItems.map((b, idx) => (
                  <div key={idx} className="p-2.5 border border-cream3 bg-gray-50/50 rounded-xl flex justify-between items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="text-[13px] font-semibold text-navy truncate">{b.tipo}: {b.nombre}</div>
                      <p className="text-[11.5px] text-gray-500 truncate">{b.estadoLabel} · {b.motivo}</p>
                    </div>
                    <button className="btn btn-secondary btn-sm shrink-0" onClick={b.onAccion}>{b.accionLabel}</button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 6. Trabajadores con acción pendiente */}
          <div className="card">
            <div className="flex justify-between items-center mb-4 border-b border-cream3 pb-3">
              <h3 className="section-title mb-0 flex items-center gap-2">
                <Users size={18} className="text-navy" />
                Trabajadores con acción pendiente
              </h3>
              <button className="btn btn-secondary btn-sm flex items-center gap-1.5" onClick={() => setActiveTab('trabajadores')}>
                <UserPlus size={14} /> Ver trabajadores
              </button>
            </div>
            {(() => {
              const pendientes = trabajadoresAsignados
                .map(w => ({ w, estado: calcularEstadoTrabajador(w, proyectoActual.id) }))
                .filter(x => x.estado !== 'aprobado');
              if (trabajadoresAsignados.length === 0) {
                return <p className="text-sm text-gray-500 py-4 text-center">Este proyecto todavía no tiene trabajadores asignados.</p>;
              }
              if (pendientes.length === 0) {
                return (
                  <div className="py-6 flex flex-col items-center justify-center text-center text-gray-500">
                    <CheckCircle size={32} className="text-green-500 mb-2" />
                    <p className="font-semibold text-navy">Todos tus trabajadores están acreditados.</p>
                  </div>
                );
              }
              const label = (e: string) => e === 'rechazado' ? 'Bloqueado' : e === 'por_vencer' ? 'Advertencia' : 'Pendiente';
              const badge = (e: string) => e === 'rechazado' ? 'b-red' : e === 'por_vencer' ? 'b-yellow' : 'b-gray';
              return (
                <div className="overflow-x-auto">
                  <table className="w-full text-[13px]">
                    <thead>
                      <tr className="text-left text-gray-400 text-[11px] uppercase tracking-wider border-b border-cream3">
                        <th className="py-2 pr-3 font-semibold">Trabajador</th>
                        <th className="py-2 pr-3 font-semibold">Estado</th>
                        <th className="py-2 pr-3 font-semibold">Problema</th>
                        <th className="py-2 font-semibold">Acción</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pendientes.map(({ w, estado }) => (
                        <tr key={w.rut} className="border-b border-cream3 last:border-0">
                          <td className="py-2.5 pr-3 font-medium text-navy">{w.nombre}</td>
                          <td className="py-2.5 pr-3"><span className={`badge ${badge(estado)} text-[10.5px]`}>{label(estado)}</span></td>
                          <td className="py-2.5 pr-3 text-gray-500">{getMotivoBloqueoTrabajador(w, proyectoActual.id)}</td>
                          <td className="py-2.5">
                            <button className="btn btn-primary btn-sm" onClick={() => { setActiveTab('trabajadores'); setSelectedWorkerForDocs(w); }}>
                              Ver trabajador
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              );
            })()}
          </div>

          {/* 7. Tus proyectos */}
          <div className="flex justify-between items-center mb-1">
            <h3 className="section-title mb-0">Tus proyectos</h3>
            <button className="btn btn-ghost btn-sm" onClick={() => setActiveTab('proyectos')}>Ver todos <ArrowRight size={14} /></button>
          </div>
          <div className="card-grid">
            {misProyectos.map(p => {
              const r = rowsByProyecto.get(p.id);
              const mandante = allMandantes.find(m => m.id === p.mandanteId);
              const estadoP = r ? estadoUILabel(r.estado) : 'En proceso';
              const badgeP = r ? BADGE[acredBadgeClass(r.estado)] : 'b-yellow';
              // Mismo helper que la card principal: así "Tus proyectos" nunca
              // puede mostrar un acceso distinto al de la card de arriba.
              const trabajadoresP = (contratistaLogueado.trabajadores || []).filter(w => esTrabajadorAsignado(w, p.id, misProyectos));
              const estadoAccesoP = getEstadoAccesoProyecto(contratistaLogueado, p.id, trabajadoresP);
              const pagoP = calcularAccesoPago(contratistaLogueado, p.id);
              return (
                <div
                  key={p.id}
                  className={`proj-card cursor-pointer ${p.id === selectedProyectoId ? 'ring-2 ring-brown' : ''}`}
                  onClick={() => setSelectedProyectoId(p.id)}
                >
                  <div className="flex justify-between items-start mb-2">
                    <h4 className="text-[15.4px] font-medium">{mandante?.nombre || 'Mandante'}</h4>
                    <span className={`badge ${badgeP}`}>{estadoP}</span>
                  </div>
                  <p className="text-[13.2px] text-gray-500 mb-2">Proyecto {p.nombre}</p>
                  <p className="text-[12.5px] text-gray-600">Empresa {r?.company.ok ?? 0}/{r?.company.total ?? 0} · Trabajadores {r?.workers.ok ?? 0}/{r?.workers.total ?? 0}</p>
                  <p className="text-[12.5px] text-gray-600 mt-1">{estadoAccesoP.label} · {pagoP.pagoBloqueado ? 'Pago retenido' : 'Pago habilitado'}</p>
                </div>
              );
            })}
          </div>

          {/* 8. Estado de empresa por requisito */}
          <div className="card">
            <h3 className="section-title mb-4 border-b border-cream3 pb-3">Estado de empresa por requisito</h3>
            {empresaItems.length === 0 ? (
              <p className="text-sm text-gray-500 py-4 text-center">Este proyecto no tiene requisitos de empresa configurados.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-[13px]">
                  <thead>
                    <tr className="text-left text-gray-400 text-[11px] uppercase tracking-wider border-b border-cream3">
                      <th className="py-2 pr-3 font-semibold">Requisito</th>
                      <th className="py-2 pr-3 font-semibold">Estado</th>
                      <th className="py-2 pr-3 font-semibold">Vencimiento</th>
                      <th className="py-2 pr-3 font-semibold">Impacto</th>
                      <th className="py-2 font-semibold">Acción</th>
                    </tr>
                  </thead>
                  <tbody>
                    {empresaItems.map(item => {
                      const accion = accionEmpresaLabel(item.estado, !!item.doc);
                      return (
                        <tr key={item.requisito.id} className="border-b border-cream3 last:border-0">
                          <td className="py-2.5 pr-3 font-medium text-navy">{item.requisito.nombre}{!item.requisito.obligatorio && <span className="text-gray-400 font-normal"> (opcional)</span>}</td>
                          <td className="py-2.5 pr-3"><span className={`badge ${BADGE[acredBadgeClass(item.estado)] || 'b-gray'} text-[10.5px]`}>{item.estado}</span></td>
                          <td className="py-2.5 pr-3 text-gray-500">{item.doc?.vencimiento && item.doc.vencimiento !== '-' ? item.doc.vencimiento : '—'}</td>
                          <td className="py-2.5 pr-3 text-gray-500">{impactoLabel(item.requisito)}</td>
                          <td className="py-2.5">
                            <button
                              className="btn btn-secondary btn-sm"
                              onClick={() => { setActiveTab('subir'); if (item.doc) setSelectedDocumentForPanel(item.doc); }}
                            >
                              {accion}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* 9. Actividad reciente */}
          {(() => {
            const actividad = [
              ...documentosData
                .filter(d => d.estado === 'aprobado' || d.estado === 'rechazado')
                .map(d => ({ nombre: `Empresa: ${d.nombre}`, estado: d.estado, fecha: d.fechaRevisado || d.subido })),
              ...trabajadoresAsignados.flatMap(w =>
                (w.documentos || [])
                  .filter(d => d.proyectoId === proyectoActual.id && (d.estado === 'aprobado' || d.estado === 'rechazado'))
                  .map(d => ({ nombre: `${w.nombre}: ${d.nombre}`, estado: d.estado, fecha: d.fechaRevisado || d.subido }))
              ),
            ]
              .filter(a => !!a.fecha)
              .slice(0, 5);

            if (actividad.length === 0) return null;

            return (
              <div className="card">
                <h3 className="section-title mb-4 border-b border-cream3 pb-3">Actividad reciente</h3>
                <div className="flex flex-col gap-2.5">
                  {actividad.map((a, idx) => (
                    <div key={idx} className="flex items-center gap-2.5 text-[13px]">
                      {a.estado === 'aprobado' ? (
                        <CheckCircle size={15} className="text-green-500 shrink-0" />
                      ) : (
                        <XCircle size={15} className="text-red-500 shrink-0" />
                      )}
                      <span className="text-navy">{a.nombre}</span>
                      <span className="text-gray-400">— {a.estado === 'aprobado' ? 'Documento aprobado' : 'Documento rechazado'}</span>
                      <span className="text-gray-400 ml-auto shrink-0">{a.fecha}</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}
        </>
      )}
    </div>
  );
}
