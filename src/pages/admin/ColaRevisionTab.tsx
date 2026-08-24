import { useEffect, useMemo, useState } from "react";
import { CheckCircle, XCircle, Search, AlertTriangle, History, ArrowUpRight, X } from "lucide-react";
import { getContratistas, getProyectos, getMandantes, actualizarEstadoDocumento, simularNuevaVersion, sembrarDocumentosEjemplo, getVerificadorActual, getSupervisorActual, registrarActividadVerificador } from "../../data/localStorageDb";
import { buildColaDocs, buildCorrectionDocs } from "./colaUtils";
import { pruneClaimsRevision } from "./verificadorUtils";
import { Verificador, ClaimRevision } from "../../types";
import DocumentPreview from "./DocumentPreview";

type Tab = "pending" | "review" | "correction";

interface EscalationInfo {
  supervisorId: string;
  motivo: string;
}

const BADGE: Record<string, string> = {
  red: "border-red-200 bg-red-50 text-red-700",
  amber: "border-amber-200 bg-amber-50 text-amber-700",
  green: "border-emerald-200 bg-emerald-50 text-emerald-700",
  blue: "border-blue-200 bg-blue-50 text-blue-700",
  gray: "border-cream3 bg-cream2 text-gray-600",
};

const VENC_BADGE: Record<string, { label: string; cls: string }> = {
  vigente: { label: "VIGENTE", cls: BADGE.green },
  proximo: { label: "PRÓXIMO A VENCER", cls: BADGE.amber },
  vencido: { label: "VENCIDO", cls: BADGE.red },
  sin_vencimiento: { label: "SIN VENCIMIENTO", cls: BADGE.gray },
};

const REASONS = [
  "Documento vencido",
  "Documento ilegible",
  "Documento incorrecto",
  "Datos no coinciden",
  "Falta información",
  "Falta firma",
  "Otro",
];

const ESTADO_DOC_LABEL: Record<string, string> = {
  revision: "Pendiente de revisión",
  aprobado: "Aprobado",
  rechazado: "Rechazado",
  pendiente: "Pendiente",
  por_vencer: "Por vencer",
};

function formatElapsed(fromMs: number): string {
  const diffMs = Date.now() - fromMs;
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "recién tomado";
  if (mins < 60) return `hace ${mins} min`;
  const hours = Math.floor(mins / 60);
  const remMins = mins % 60;
  return remMins > 0 ? `hace ${hours} h ${remMins} min` : `hace ${hours} h`;
}

export default function ColaRevisionTab({
  onVerEmpresa,
  selectedDocKey,
  setSelectedDocKey,
  aprobadosHoy,
  setAprobadosHoy,
  rechazadosHoy,
  setRechazadosHoy,
  showToast,
  verificadores,
  verificadorActualId,
  claimsRevision,
  setClaimsRevision,
}: {
  onVerEmpresa?: (empresa: any) => void;
  selectedDocKey?: string | null;
  setSelectedDocKey?: (key: string | null) => void;
  aprobadosHoy: number;
  setAprobadosHoy: (updater: (n: number) => number) => void;
  rechazadosHoy: number;
  setRechazadosHoy: (updater: (n: number) => number) => void;
  showToast: (msg: string, type?: "success" | "error" | "warning") => void;
  verificadores: Verificador[];
  verificadorActualId?: string | null;
  claimsRevision: ClaimRevision[];
  setClaimsRevision: (data: ClaimRevision[]) => void;
}) {
  const GLOBAL_PROYECTOS = getProyectos();
  const GLOBAL_MANDANTES = getMandantes();
  const GLOBAL_CONTRATISTAS = getContratistas();

  // Verificador operativo actual y supervisor de escalamiento: se resuelven
  // desde el equipo central (nunca strings hardcodeados), y se recalculan si
  // el equipo cambia (p. ej. alguien pasa a Offline o se crea un nuevo
  // verificador) o si Configuración → General cambia quién opera la cola —
  // sin necesitar recargar la página. `verificadorActualId` no se lee
  // directamente aquí (getVerificadorActual() ya resuelve el id persistido);
  // solo se agrega a las deps para forzar el recálculo cuando cambia.
  const currentVerificador = useMemo(() => getVerificadorActual(), [verificadores, verificadorActualId]);
  const supervisor = useMemo(() => getSupervisorActual(), [verificadores]);
  const nombreVerificador = (id: string | undefined) =>
    (id && verificadores.find(v => v.id === id)?.nombre) || "Verificador no disponible";
  const nombreSupervisor = (id: string) =>
    verificadores.find(v => v.id === id)?.nombre || "Supervisor no disponible";

  const initialPendingDocs = buildColaDocs(GLOBAL_CONTRATISTAS, GLOBAL_PROYECTOS);
  const initialCorrectionDocs = buildCorrectionDocs(GLOBAL_CONTRATISTAS, GLOBAL_PROYECTOS);
  // Navegación directa desde otras vistas (p. ej. "Revisar" en la ficha de
  // acreditación): si llega un selectedDocKey válido, la cola se abre
  // directamente en la subpestaña y el documento correctos usando el mismo
  // `key` estable que usan claims/escalamientos — nunca un id secuencial que
  // se reasigna en cada reconstrucción de la lista.
  const navMatchPending = selectedDocKey ? initialPendingDocs.find(d => d.key === selectedDocKey) : undefined;
  const navMatchCorrection = !navMatchPending && selectedDocKey ? initialCorrectionDocs.find(d => d.key === selectedDocKey) : undefined;

  const [tab, setTab] = useState<Tab>(navMatchCorrection ? "correction" : "pending");
  const [pendingDocs, setPendingDocs] = useState(initialPendingDocs);
  const [correctionDocs, setCorrectionDocs] = useState(initialCorrectionDocs);

  // Los escalamientos siguen viviendo solo en esta sesión de Cola (no hay
  // pantalla de Verificadores que los muestre en el MVP), pero ahora
  // identifican al supervisor por id, nunca por nombre.
  const [escalations, setEscalations] = useState<Record<string, EscalationInfo>>({});

  const [search, setSearch] = useState("");
  const [priority, setPriority] = useState("");
  const [project, setProject] = useState("");
  const [mandante, setMandante] = useState("");

  const [selectedKey, setSelectedKeyLocal] = useState<string | null>(navMatchPending?.key || navMatchCorrection?.key || null);
  const [checks, setChecks] = useState({ legible: false, datos: false, vigencia: false });
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");

  const [historialOpen, setHistorialOpen] = useState(false);
  const [escalarOpen, setEscalarOpen] = useState(false);
  const [escalarMotivo, setEscalarMotivo] = useState("");

  // Consumir la navegación una sola vez al montar: no debe volver a forzar
  // la selección si el usuario cambia de documento o de subpestaña después.
  useEffect(() => {
    if (selectedDocKey && setSelectedDocKey) setSelectedDocKey(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const mandanteDeProyecto = (proyectoId: string | undefined) => {
    const p = GLOBAL_PROYECTOS.find(pr => pr.id === proyectoId);
    if (!p) return "—";
    const m = GLOBAL_MANDANTES.find(mm => mm.id === p.mandanteId);
    return m ? m.nombre : "—";
  };

  const claimedKeys = new Set(claimsRevision.map(c => c.documentoKey));
  const porRevisar = pendingDocs.filter(d => !claimedKeys.has(d.key));
  const enRevision = pendingDocs.filter(d => claimedKeys.has(d.key));
  const esperandoCorreccion = correctionDocs;

  const listaBase = tab === "pending" ? porRevisar : tab === "review" ? enRevision : esperandoCorreccion;
  const todos = [...pendingDocs, ...correctionDocs];
  const proyectosDisponibles = Array.from(new Set(todos.map(d => d.proyecto)));
  const mandantesDisponibles = Array.from(new Set(todos.map(d => mandanteDeProyecto(d.proyectoId)))).filter(m => m !== "—");

  const filtered = listaBase
    .filter(d => {
      if (!search) return true;
      const q = search.toLowerCase();
      const haystack = [d.title, d.emp, d.trabajadorNombre, d.proyecto, mandanteDeProyecto(d.proyectoId)].filter(Boolean).join(" ").toLowerCase();
      return haystack.includes(q);
    })
    .filter(d => !priority || d.prio === priority)
    .filter(d => !project || d.proyecto === project)
    .filter(d => !mandante || mandanteDeProyecto(d.proyectoId) === mandante)
    .sort((a, b) => {
      if (a.prio === "Alta" && b.prio !== "Alta") return -1;
      if (b.prio === "Alta" && a.prio !== "Alta") return 1;
      return a.timeSort - b.timeSort;
    });

  const current = filtered.find(d => d.key === selectedKey) ?? filtered[0];
  const currentClaim = current ? claimsRevision.find(c => c.documentoKey === current.key) : undefined;
  const isTaken = !!currentClaim;
  // Un documento tomado por otro verificador se puede ver, pero solo su
  // dueño (mientras el claim exista) puede aprobar, rechazar o escalarlo.
  const isTakenByCurrent = !!currentClaim && !!currentVerificador && currentClaim.verificadorId === currentVerificador.id;
  const isTakenByOther = !!currentClaim && !!currentVerificador && currentClaim.verificadorId !== currentVerificador.id;
  const currentEscalation = current ? escalations[current.key] : undefined;

  const revisadosHoy = aprobadosHoy + rechazadosHoy;

  const resetDecisionForm = () => {
    setChecks({ legible: false, datos: false, vigencia: false });
    setReason("");
    setNote("");
  };

  const selectDoc = (key: string) => {
    setSelectedKeyLocal(key);
    resetDecisionForm();
    if (setSelectedDocKey) setSelectedDocKey(null);
  };

  const cambiarTab = (t: Tab) => {
    setTab(t);
    setSelectedKeyLocal(null);
    resetDecisionForm();
  };

  const refreshAndAdvance = (targetTab: Tab = "pending") => {
    const updated = getContratistas();
    const newPending = buildColaDocs(updated, GLOBAL_PROYECTOS);
    const newCorrection = buildCorrectionDocs(updated, GLOBAL_PROYECTOS);
    setPendingDocs(newPending);
    setCorrectionDocs(newCorrection);
    // Red de seguridad: si algún documento salió de la cola sin pasar por
    // aprobar/rechazar (p. ej. datos de ejemplo recargados), su claim no
    // debe seguir mostrando carga fantasma.
    setClaimsRevision(pruneClaimsRevision(claimsRevision, updated, GLOBAL_PROYECTOS));
    setEscalations(prev => {
      const next: Record<string, EscalationInfo> = {};
      Object.keys(prev).forEach(k => { if (newPending.some(d => d.key === k)) next[k] = prev[k]; });
      return next;
    });
    setTab(targetTab);
    setSelectedKeyLocal(null);
    resetDecisionForm();
  };

  const tomarRevision = () => {
    if (!current || !currentVerificador) return;
    // No sobrescribir un claim existente (propio o ajeno): si ya hay uno
    // para este documento, la UI normalmente ya oculta "Tomar revisión",
    // pero se valida igual aquí como defensa en la función.
    if (claimsRevision.some(c => c.documentoKey === current.key)) return;
    setClaimsRevision([...claimsRevision, { documentoKey: current.key, verificadorId: currentVerificador.id, claimedAt: Date.now() }]);
    setTab("review");
    setSelectedKeyLocal(current.key);
    resetDecisionForm();
    showToast(`Documento tomado por ${currentVerificador.nombre}`);
  };

  const aprobar = () => {
    // Un documento tomado por otro verificador nunca puede aprobarse desde
    // aquí, sin importar el estado de los botones en la UI — la validación
    // de propiedad vive también dentro de la función, no solo en `disabled`.
    if (!current || !currentClaim || !currentVerificador || currentClaim.verificadorId !== currentVerificador.id) return;
    if (!(checks.legible && checks.datos && checks.vigencia)) {
      showToast("Para aprobar, completa el chequeo mínimo", "warning");
      return;
    }
    const list = getContratistas();
    const cObj = list.find(c => c.nombre === current.emp || c.rut === current.rut);
    const verificadorId = currentVerificador.id;
    if (cObj) {
      actualizarEstadoDocumento(cObj.id, current.proyectoId, current.docId, "approve", { verificador: nombreVerificador(verificadorId) });
      setAprobadosHoy(a => a + 1);
      registrarActividadVerificador(verificadorId, current.key, "aprobado");
    }
    showToast(`Documento aprobado: ${current.title}`);
    refreshAndAdvance("pending");
  };

  const rechazar = () => {
    // Misma protección de propiedad que aprobar(): nunca confiar solo en
    // que el botón esté habilitado.
    if (!current || !currentClaim || !currentVerificador || currentClaim.verificadorId !== currentVerificador.id) return;
    if (!reason) { showToast("Selecciona un motivo de rechazo", "warning"); return; }
    if (!note.trim()) { showToast("Indica brevemente qué debe corregir el contratista", "warning"); return; }
    const list = getContratistas();
    const cObj = list.find(c => c.nombre === current.emp || c.rut === current.rut);
    const verificadorId = currentVerificador.id;
    if (cObj) {
      actualizarEstadoDocumento(cObj.id, current.proyectoId, current.docId, "reject", {
        motivoRechazo: reason,
        explicacionRechazo: note,
        verificador: nombreVerificador(verificadorId),
      });
      setRechazadosHoy(r => r + 1);
      registrarActividadVerificador(verificadorId, current.key, "rechazado");
    }
    showToast(`Documento rechazado: ${current.title}`, "warning");
    refreshAndAdvance("pending");
  };

  const siguienteDocumento = () => {
    if (!current) return;
    const idx = filtered.findIndex(d => d.key === current.key);
    const next = filtered[idx + 1];
    if (next) {
      selectDoc(next.key);
    } else {
      showToast("No hay más documentos en esta vista", "warning");
    }
  };

  const enviarEscalamiento = () => {
    // Solo el dueño del claim puede escalar: es quien tiene la
    // responsabilidad de la revisión.
    if (!current || !supervisor || !isTakenByCurrent) return;
    if (!escalarMotivo.trim()) { showToast("Indica el motivo del escalamiento", "warning"); return; }
    setEscalations(prev => ({ ...prev, [current.key]: { supervisorId: supervisor.id, motivo: escalarMotivo } }));
    setEscalarOpen(false);
    setEscalarMotivo("");
    showToast(`Caso escalado a ${supervisor.nombre}`, "warning");
  };

  const simularNuevaVersionAction = () => {
    if (!current) return;
    const res = simularNuevaVersion(current.contratistaId, current.docId);
    if (!res.success) {
      showToast(res.error || "No se pudo simular la nueva versión", "warning");
      return;
    }
    showToast(`Nueva versión cargada: ${current.title} · v${(current.version || 1) + 1}`);
    refreshAndAdvance("pending");
  };

  const cargarDocumentosEjemplo = () => {
    const sembrados = sembrarDocumentosEjemplo();
    if (sembrados === 0) {
      showToast("No hay más documentos de ejemplo disponibles para cargar", "warning");
      return;
    }
    refreshAndAdvance("pending");
    showToast(`${sembrados} documento${sembrados === 1 ? "" : "s"} de ejemplo cargados`);
  };

  const TAB_META: Record<Tab, { label: string; count: number; sub: string }> = {
    pending: { label: "Por revisar", count: porRevisar.length, sub: "Prioridad alta primero · más antiguos arriba" },
    review: { label: "En revisión", count: enRevision.length, sub: "Documentos tomados por verificadores" },
    correction: { label: "Esperando corrección", count: esperandoCorreccion.length, sub: "Fuera de la cola normal" },
  };

  const statusBadge = tab === "pending" ? { label: "Pendiente", color: "amber" } : tab === "review" ? { label: "En revisión", color: "blue" } : { label: "Esperando corrección", color: "red" };

  return (
    <div className="fade-in relative">
      <div className="flex justify-between items-start gap-5 mb-4.5 flex-wrap">
        <div>
          <div className="text-[11px] uppercase tracking-[0.12em] text-brown font-extrabold">Centro de operaciones · Acredita</div>
          <div className="text-[27px] font-extrabold text-navy my-1">Cola de revisión</div>
          <p className="text-[13px] text-gray-500 max-w-[900px] leading-relaxed">
            Revisa documentos pendientes, toma una decisión y continúa con el siguiente. El objetivo es minimizar pasos y evitar revisiones duplicadas.
          </p>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 mb-4">
        <div className="bg-white border border-cream3 rounded-xl p-3.5">
          <div className="text-[9.5px] uppercase text-gray-400 font-extrabold tracking-wide">Por revisar</div>
          <div className="text-[22px] font-extrabold text-amber-700 mt-1.5">{porRevisar.length}</div>
          <div className="text-[9.5px] text-gray-400 mt-1">Documentos pendientes</div>
        </div>
        <div className="bg-white border border-cream3 rounded-xl p-3.5">
          <div className="text-[9.5px] uppercase text-gray-400 font-extrabold tracking-wide">En revisión</div>
          <div className="text-[22px] font-extrabold text-blue-700 mt-1.5">{enRevision.length}</div>
          <div className="text-[9.5px] text-gray-400 mt-1">Tomados por verificadores</div>
        </div>
        <div className="bg-white border border-cream3 rounded-xl p-3.5">
          <div className="text-[9.5px] uppercase text-gray-400 font-extrabold tracking-wide">Esperando corrección</div>
          <div className="text-[22px] font-extrabold text-red-700 mt-1.5">{esperandoCorreccion.length}</div>
          <div className="text-[9.5px] text-gray-400 mt-1">Fuera de la cola normal</div>
        </div>
        <div className="bg-white border border-cream3 rounded-xl p-3.5">
          <div className="text-[9.5px] uppercase text-gray-400 font-extrabold tracking-wide">Revisados hoy</div>
          <div className="text-[22px] font-extrabold text-emerald-700 mt-1.5">{revisadosHoy}</div>
          <div className="text-[9.5px] text-gray-400 mt-1">Aprobados + rechazados</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 mb-3">
        {(["pending", "review", "correction"] as Tab[]).map(t => (
          <button
            key={t}
            onClick={() => cambiarTab(t)}
            className={`border rounded-lg px-3 py-2 text-[11px] font-extrabold cursor-pointer transition-all ${
              tab === t ? "bg-gold-soft text-brown border-[#dbc5ae]" : "bg-white text-gray-600 border-cream3"
            }`}
          >
            {TAB_META[t].label} ({TAB_META[t].count})
          </button>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap gap-1.5 mb-3">
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Buscar documento, mandante, contratista, trabajador o proyecto..."
          className="form-input !rounded-lg text-[11px] py-2 px-2.5 flex-1 min-w-[220px]"
        />
        <select value={mandante} onChange={e => setMandante(e.target.value)} className="form-input !rounded-lg text-[11px] py-2 px-2">
          <option value="">Todos los mandantes</option>
          {mandantesDisponibles.map(m => <option key={m} value={m}>{m}</option>)}
        </select>
        <select value={project} onChange={e => setProject(e.target.value)} className="form-input !rounded-lg text-[11px] py-2 px-2">
          <option value="">Todos los proyectos</option>
          {proyectosDisponibles.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
        <select value={priority} onChange={e => setPriority(e.target.value)} className="form-input !rounded-lg text-[11px] py-2 px-2">
          <option value="">Todas las prioridades</option>
          <option>Alta</option>
          <option>Normal</option>
        </select>
      </div>

      {/* Workspace */}
      <div className="grid grid-cols-1 md:grid-cols-[280px_1fr] lg:grid-cols-[300px_1fr_290px] gap-3.5 items-start">
        {/* Queue list */}
        <section className="bg-white rounded-2xl border border-cream3 shadow-sm overflow-hidden flex flex-col">
          <div className="p-3.5 border-b border-cream3 flex justify-between items-center gap-3">
            <div>
              <div className="text-[13px] font-extrabold text-navy">{TAB_META[tab].label}</div>
              <div className="text-[9.5px] text-gray-400 mt-0.5">{TAB_META[tab].sub}</div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {tab === "pending" && (
                <button
                  onClick={cargarDocumentosEjemplo}
                  title="Agregar documentos de ejemplo a la cola"
                  className="text-[9.5px] font-bold text-brown hover:underline cursor-pointer border-none bg-transparent whitespace-nowrap"
                >
                  + Agregar ejemplos
                </button>
              )}
              <span className={`badge border font-semibold whitespace-nowrap ${BADGE.gray}`}>{filtered.length}</span>
            </div>
          </div>
          <div className="max-h-[640px] overflow-y-auto">
            {filtered.length > 0 ? filtered.map(d => {
              const claim = claimsRevision.find(c => c.documentoKey === d.key);
              const escalation = escalations[d.key];
              return (
                <div
                  key={d.key}
                  onClick={() => selectDoc(d.key)}
                  className={`p-3 border-b border-cream2 cursor-pointer transition-colors border-l-[3px] ${
                    current?.key === d.key ? "bg-gold-soft/40 border-l-brown" : "border-l-transparent hover:bg-[#fbfaf6]"
                  }`}
                >
                  <div className="flex justify-between items-start gap-2">
                    <div className="text-[11.5px] font-extrabold text-navy leading-snug">{d.title}</div>
                    <div className="flex gap-1 shrink-0">
                      {d.version > 1 && <span className={`badge border text-[8.5px] px-1.5 whitespace-nowrap ${BADGE.blue}`}>V{d.version}</span>}
                      <span className={`badge border text-[8.5px] px-1.5 whitespace-nowrap ${d.prio === "Alta" ? BADGE.red : BADGE.gray}`}>{d.prio}</span>
                    </div>
                  </div>
                  <div className="flex gap-1 mt-1">
                    <span className={`badge border text-[8px] px-1.5 whitespace-nowrap ${d.origen === "Trabajador" ? BADGE.blue : BADGE.gray}`}>
                      {d.origen === "Trabajador" ? "TRABAJADOR" : "EMPRESA"}
                    </span>
                    {tab === "correction" && <span className={`badge border text-[8px] px-1.5 whitespace-nowrap ${BADGE.red}`}>RECHAZADO</span>}
                    {escalation && <span className={`badge border text-[8px] px-1.5 whitespace-nowrap ${BADGE.red}`}>ESCALADO</span>}
                  </div>
                  <div className="text-[10px] text-gray-500 mt-1 leading-relaxed">
                    <div className="truncate">{mandanteDeProyecto(d.proyectoId)}</div>
                    <div className="font-semibold text-navy truncate">{d.emp}</div>
                    {d.origen === "Trabajador" && <div className="truncate">{d.trabajadorNombre} · {d.proyecto}</div>}
                    {d.origen === "Empresa" && <div className="truncate">{d.proyecto}</div>}
                  </div>
                  <div className="flex justify-between items-start gap-2 mt-1.5 pt-1.5 border-t border-cream2 text-[9.5px]">
                    {tab === "review" && claim ? (
                      <span className="text-blue-700 font-semibold">{nombreVerificador(claim.verificadorId)} · {formatElapsed(claim.claimedAt)}</span>
                    ) : tab === "correction" ? (
                      <div className="min-w-0 text-gray-400 leading-snug">
                        <div className="truncate text-red-700"><span className="font-semibold">Motivo:</span> {d.motivoRechazo}</div>
                        <div className="truncate mt-0.5">
                          Rechazado por {d.revisor || "Verificador no disponible"} · {d.fechaRevisado || "Fecha no disponible"} · v{d.version}
                        </div>
                      </div>
                    ) : (
                      <span className="text-gray-400">{d.time}</span>
                    )}
                    {tab === "correction" && (
                      <button
                        onClick={e => { e.stopPropagation(); selectDoc(d.key); setHistorialOpen(true); }}
                        className="text-[9px] font-bold text-brown hover:underline cursor-pointer border-none bg-transparent shrink-0"
                      >
                        Ver detalle
                      </button>
                    )}
                  </div>
                </div>
              );
            }) : (
              <div className="p-8 text-center text-[11.5px] text-gray-400">No hay documentos en esta vista.</div>
            )}
          </div>
        </section>

        {/* Document viewer */}
        <section className="bg-white rounded-2xl border border-cream3 shadow-sm overflow-hidden flex flex-col min-w-0">
          {current ? (
            <>
              <div className="p-3.5 border-b border-cream3 flex justify-between items-center gap-3">
                <div className="min-w-0">
                  <div className="text-[14px] font-extrabold text-navy truncate">{current.title}</div>
                  <div className="text-[10px] text-gray-500 mt-0.5 truncate">{current.emp} · {current.proyecto}</div>
                </div>
                <span className={`badge border font-semibold whitespace-nowrap shrink-0 ${BADGE[statusBadge.color]}`}>{statusBadge.label}</span>
              </div>

              <div className="p-4">
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 mb-3.5">
                  {[
                    ["Mandante", mandanteDeProyecto(current.proyectoId)],
                    ["Contratista", current.emp],
                    ["Proyecto", current.proyecto],
                    ["Trabajador", current.origen === "Trabajador" ? current.trabajadorNombre : "No aplica · Documento empresa"],
                  ].map(([label, value]) => (
                    <div key={label} className="border border-cream3 rounded-lg p-2">
                      <label className="block text-[8px] uppercase text-gray-400 font-extrabold tracking-wide">{label}</label>
                      <strong className="block text-[10.5px] text-navy mt-0.5 truncate" title={value}>{value}</strong>
                    </div>
                  ))}
                  <div className="border border-cream3 rounded-lg p-2">
                    <label className="block text-[8px] uppercase text-gray-400 font-extrabold tracking-wide">Tipo</label>
                    <span className={`badge border font-semibold mt-0.5 ${current.origen === "Trabajador" ? BADGE.blue : BADGE.gray}`}>
                      {current.origen === "Trabajador" ? "TRABAJADOR" : "EMPRESA"}
                    </span>
                  </div>
                  <div className="border border-cream3 rounded-lg p-2 sm:col-span-2">
                    <label className="block text-[8px] uppercase text-gray-400 font-extrabold tracking-wide">Requisito</label>
                    <strong className="block text-[10.5px] text-navy mt-0.5 truncate" title={current.requisito}>{current.requisito}</strong>
                  </div>
                  <div className="border border-cream3 rounded-lg p-2">
                    <label className="block text-[8px] uppercase text-gray-400 font-extrabold tracking-wide">Vigencia requerida</label>
                    <strong className="block text-[10.5px] text-navy mt-0.5 truncate">{current.vigenciaLabel}</strong>
                  </div>
                  <div className="border border-cream3 rounded-lg p-2">
                    <label className="block text-[8px] uppercase text-gray-400 font-extrabold tracking-wide">Vencimiento</label>
                    <strong className="block text-[10.5px] text-navy mt-0.5">{current.vencimiento && current.vencimiento !== "—" ? current.vencimiento : "Sin vencimiento"}</strong>
                    <span className={`badge border font-semibold mt-1 text-[8px] ${VENC_BADGE[current.vencEstado].cls}`}>{VENC_BADGE[current.vencEstado].label}</span>
                  </div>
                  <div className="border border-cream3 rounded-lg p-2">
                    <label className="block text-[8px] uppercase text-gray-400 font-extrabold tracking-wide">Versión</label>
                    <strong className="block text-[10.5px] text-navy mt-0.5">v{current.version}</strong>
                  </div>
                </div>

                <div className="relative bg-gradient-to-b from-gray-50 to-gray-100 border border-cream3 rounded-xl min-h-[380px] flex items-center justify-center p-6">
                  <div className="absolute top-3 right-3 flex gap-1.5 z-10">
                    <button onClick={() => setHistorialOpen(true)} className="flex items-center gap-1 text-[9.5px] font-bold text-gray-600 bg-white border border-cream3 rounded-md px-2 py-1.5 cursor-pointer hover:bg-cream2">
                      <History size={11} /> Ver historial
                    </button>
                  </div>
                  <DocumentPreview item={current} />
                </div>

                {tab === "correction" ? (
                  <div className="mt-3.5 bg-red-50 border border-red-200 rounded-xl p-3 flex gap-2 items-start">
                    <XCircle size={15} className="text-red-700 shrink-0 mt-0.5" />
                    <span className="text-[11.5px] text-red-800 leading-relaxed">
                      <strong>Motivo del rechazo:</strong> {current.motivoRechazo}
                      {current.explicacionRechazo && <> — {current.explicacionRechazo}</>}
                    </span>
                  </div>
                ) : current.hint && (
                  <div className="mt-3.5 bg-amber-50 border border-amber-200 rounded-xl p-3 flex gap-2 items-start">
                    <AlertTriangle size={15} className="text-amber-700 shrink-0 mt-0.5" />
                    <span className="text-[11.5px] text-amber-800 leading-relaxed">
                      <strong>Sugerencia de auditoría:</strong> {current.hint}
                    </span>
                  </div>
                )}

                {currentEscalation && (
                  <div className="mt-3.5 bg-red-50 border border-red-200 rounded-xl p-3 flex gap-2 items-start">
                    <ArrowUpRight size={15} className="text-red-700 shrink-0 mt-0.5" />
                    <span className="text-[11.5px] text-red-800 leading-relaxed">
                      <strong>ESCALADO A SUPERVISOR</strong> — {nombreSupervisor(currentEscalation.supervisorId)}: {currentEscalation.motivo}
                    </span>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-gray-400 gap-3 px-8 py-16">
              {pendingDocs.length === 0 && esperandoCorreccion.length === 0 ? (
                <>
                  <CheckCircle size={44} className="text-emerald-600 opacity-80" />
                  <p className="text-[13.5px] text-navy font-bold text-center">Cola al día — no hay documentos pendientes</p>
                  <button onClick={cargarDocumentosEjemplo} className="text-brown text-[12.5px] hover:underline font-semibold cursor-pointer border-none bg-transparent">
                    Cargar documentos de ejemplo
                  </button>
                </>
              ) : (
                <>
                  <Search size={40} className="opacity-30 shrink-0" />
                  <p className="text-[13.5px] text-navy font-bold text-center">No hay documentos en esta vista</p>
                  <button onClick={() => { setSearch(""); setPriority(""); setProject(""); setMandante(""); }} className="text-brown text-[12.5px] hover:underline font-semibold cursor-pointer border-none bg-transparent">
                    Limpiar filtros
                  </button>
                </>
              )}
            </div>
          )}
        </section>

        {/* Decision panel */}
        <section className="bg-white rounded-2xl border border-cream3 shadow-sm overflow-hidden md:col-span-2 lg:col-span-1">
          <div className="p-3.5 border-b border-cream3">
            <div className="text-[14px] font-extrabold text-navy">Decisión</div>
            <div className="text-[10px] text-gray-500 mt-0.5">Revisión rápida del documento</div>
          </div>

          {!current ? (
            <div className="p-6 text-center text-[11.5px] text-gray-400">Selecciona un documento de la lista.</div>
          ) : tab === "correction" ? (
            <div className="p-3.5">
              <div className={`text-[10.5px] font-semibold px-2.5 py-2 rounded-lg mb-3 ${BADGE.red}`}>
                Fuera de la cola normal. Esperando una nueva versión del contratista.
              </div>
              <div className="text-[10.5px] text-gray-500 leading-relaxed mb-3">
                Este documento fue rechazado y quedó fuera de la cola normal. Se reincorporará automáticamente a "Por revisar" cuando el contratista cargue una nueva versión.
              </div>
              <button
                onClick={simularNuevaVersionAction}
                className="w-full text-[11.5px] font-bold py-2 rounded-lg border-none bg-navy text-white hover:bg-navy2 transition-colors cursor-pointer"
              >
                Simular nueva versión
              </button>
              <div className="text-[9.5px] text-gray-400 leading-relaxed mt-2">
                Solo para demostración: simula que el contratista cargó v{(current.version || 1) + 1} y la devuelve a "Por revisar".
              </div>
            </div>
          ) : tab === "pending" ? (
            <div className="p-3.5">
              <div className={`text-[10.5px] font-semibold px-2.5 py-2 rounded-lg mb-3 ${BADGE.amber}`}>
                Disponible para tomar revisión.
              </div>
              <button
                onClick={tomarRevision}
                disabled={!currentVerificador}
                className="w-full flex items-center justify-center gap-1.5 text-[12px] font-bold py-2.5 rounded-lg border-none bg-navy text-white hover:bg-navy2 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Tomar revisión
              </button>
              <button
                onClick={siguienteDocumento}
                className="w-full mt-2 text-[11px] font-semibold py-2 rounded-lg border border-cream3 bg-white text-gray-600 hover:bg-cream2 transition-colors cursor-pointer"
              >
                Siguiente documento
              </button>
              <div className="mt-3.5 pt-3 border-t border-cream2 flex flex-col gap-1.5">
                <div className="flex justify-between text-[10px]"><b className="text-navy font-semibold">Prioridad</b><span className="font-extrabold text-navy">{current.prio}</span></div>
                <div className="flex justify-between text-[10px]"><b className="text-navy font-semibold">Cargado</b><span className="font-extrabold text-navy">{current.time}</span></div>
              </div>
            </div>
          ) : (
            <div className="p-3.5">
              <div className={`text-[10.5px] font-semibold px-2.5 py-2 rounded-lg mb-3 ${BADGE.blue}`}>
                {`Documento tomado por ${nombreVerificador(currentClaim?.verificadorId)}${currentClaim ? " · " + formatElapsed(currentClaim.claimedAt) : ""}.`}
              </div>

              {isTakenByOther && (
                <div className="mb-3.5 text-[11px] font-medium px-2.5 py-2 rounded-lg bg-amber-50 border border-amber-200 text-amber-800">
                  Este documento está siendo revisado por {nombreVerificador(currentClaim?.verificadorId)}.
                </div>
              )}

              <div className="text-[9.5px] uppercase tracking-wide text-gray-400 font-extrabold mb-2">Chequeo mínimo</div>
              <div className="flex flex-col gap-2 mb-3.5">
                {[
                  ["legible", "Documento legible", "Se puede revisar correctamente."],
                  ["datos", "Datos coinciden", "El nombre/RUT corresponde al trabajador o empresa."],
                  ["vigencia", "Vigencia correcta", "Cumple la regla de vigencia definida."],
                ].map(([key, title, desc]) => (
                  <label key={key} className="flex gap-2 items-start p-2.5 border border-cream3 rounded-lg bg-cream2/40 cursor-pointer">
                    <input
                      type="checkbox"
                      className="mt-0.5"
                      checked={(checks as any)[key]}
                      disabled={isTakenByOther}
                      onChange={e => setChecks(prev => ({ ...prev, [key]: e.target.checked }))}
                    />
                    <div>
                      <b className="block text-[10.5px] text-navy">{title}</b>
                      <span className="block text-[9px] text-gray-400 mt-0.5">{desc}</span>
                    </div>
                  </label>
                ))}
              </div>

              <div className="text-[9.5px] uppercase tracking-wide text-gray-400 font-extrabold mb-2">Si rechazas</div>
              <select value={reason} onChange={e => setReason(e.target.value)} disabled={isTakenByOther} className="form-input !rounded-lg text-[10.5px] py-2 px-2.5 w-full mb-2 disabled:opacity-50 disabled:cursor-not-allowed">
                <option value="">Seleccionar motivo...</option>
                {REASONS.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
              <textarea
                value={note}
                onChange={e => setNote(e.target.value)}
                disabled={isTakenByOther}
                placeholder="Indica brevemente qué debe corregir el contratista..."
                className="form-input !rounded-lg text-[10.5px] py-2 px-2.5 w-full min-h-[70px] resize-y disabled:opacity-50 disabled:cursor-not-allowed"
              />

              <div className="grid grid-cols-2 gap-2 mt-3">
                <button
                  onClick={aprobar}
                  disabled={!isTakenByCurrent}
                  title={isTakenByOther ? `Este documento está siendo revisado por ${nombreVerificador(currentClaim?.verificadorId)}.` : undefined}
                  className="flex items-center justify-center gap-1.5 text-[11.5px] font-bold py-2 rounded-lg border-none bg-emerald-700 text-white hover:bg-emerald-800 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-emerald-700"
                >
                  <CheckCircle size={14} /> Aprobar
                </button>
                <button
                  onClick={rechazar}
                  disabled={!isTakenByCurrent}
                  title={isTakenByOther ? `Este documento está siendo revisado por ${nombreVerificador(currentClaim?.verificadorId)}.` : undefined}
                  className="flex items-center justify-center gap-1.5 text-[11.5px] font-bold py-2 rounded-lg border-none bg-red-700 text-white hover:bg-red-800 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-red-700"
                >
                  <XCircle size={14} /> Rechazar
                </button>
                <button onClick={siguienteDocumento} className="col-span-2 text-[11px] font-semibold py-2 rounded-lg border border-cream3 bg-white text-gray-600 hover:bg-cream2 transition-colors cursor-pointer">
                  Siguiente documento
                </button>
              </div>

              {currentEscalation ? (
                <div className="mt-2.5 text-[10.5px] font-semibold px-2.5 py-2 rounded-lg bg-red-50 border border-red-200 text-red-800">
                  ESCALADO A SUPERVISOR
                  <div className="font-normal text-[10px] mt-0.5">Escalado a {nombreSupervisor(currentEscalation.supervisorId)}</div>
                </div>
              ) : (
                <button
                  onClick={() => setEscalarOpen(true)}
                  disabled={!supervisor || !isTakenByCurrent}
                  title={isTakenByOther ? `Este documento está siendo revisado por ${nombreVerificador(currentClaim?.verificadorId)}.` : undefined}
                  className="w-full mt-2.5 flex items-center justify-center gap-1.5 text-[10.5px] font-semibold py-2 rounded-lg border border-cream3 bg-white text-gray-600 hover:bg-cream2 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ArrowUpRight size={13} /> {supervisor ? `Escalar a ${supervisor.nombre}` : "Supervisor no disponible"}
                </button>
              )}

              <div className="text-[9.5px] text-gray-400 leading-relaxed mt-2.5">
                Aprobar o rechazar actualiza el estado y deja trazabilidad en Auditoría. Un documento rechazado sale de la cola hasta que el contratista cargue una nueva versión.
              </div>

              <div className="mt-3.5 pt-3 border-t border-cream2 flex flex-col gap-1.5">
                <div className="flex justify-between text-[10px]"><b className="text-navy font-semibold">Verificador</b><span className="font-extrabold text-navy">{nombreVerificador(currentClaim?.verificadorId)}</span></div>
                <div className="flex justify-between text-[10px]"><b className="text-navy font-semibold">Prioridad</b><span className="font-extrabold text-navy">{current.prio}</span></div>
                <div className="flex justify-between text-[10px]"><b className="text-navy font-semibold">Cargado</b><span className="font-extrabold text-navy">{current.time}</span></div>
              </div>
            </div>
          )}
        </section>
      </div>

      {/* Historial modal */}
      {historialOpen && current && (
        <div className="fixed inset-0 bg-black/40 z-[1000] flex items-center justify-center p-4" onClick={() => setHistorialOpen(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-[440px] max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="p-4 border-b border-cream3 flex justify-between items-center">
              <div>
                <div className="text-[14px] font-extrabold text-navy">Historial</div>
                <div className="text-[10px] text-gray-500 mt-0.5 truncate">{current.title}</div>
              </div>
              <button onClick={() => setHistorialOpen(false)} className="text-gray-400 hover:text-navy cursor-pointer border-none bg-transparent">
                <X size={18} />
              </button>
            </div>
            <div className="p-4 flex flex-col gap-2.5">
              <div className="border border-cream3 rounded-lg p-3">
                <div className="flex justify-between items-center">
                  <b className="text-[11.5px] text-navy">v{current.raw.version || 1} — Actual</b>
                  <span className={`badge border font-semibold text-[9px] ${ESTADO_DOC_LABEL[current.raw.estado] === "Rechazado" ? BADGE.red : ESTADO_DOC_LABEL[current.raw.estado] === "Aprobado" ? BADGE.green : BADGE.amber}`}>
                    {ESTADO_DOC_LABEL[current.raw.estado] || current.raw.estado}
                  </span>
                </div>
                <div className="text-[10px] text-gray-500 mt-1">{current.raw.fechaRevisado || current.raw.subido || "—"}</div>
                {current.raw.motivoRechazo && (
                  <div className="text-[10px] text-gray-600 mt-1.5">Motivo: {current.raw.motivoRechazo}</div>
                )}
              </div>

              {[...(current.raw.historial || [])].reverse().map((h: any, i: number) => (
                <div key={i} className="border border-cream3 rounded-lg p-3">
                  <div className="flex justify-between items-center">
                    <b className="text-[11.5px] text-navy">v{h.version}</b>
                    <span className={`badge border font-semibold text-[9px] ${h.estado === "rechazado" ? BADGE.red : BADGE.green}`}>
                      {h.estado === "rechazado" ? "Rechazado" : "Aprobado"}
                    </span>
                  </div>
                  <div className="text-[10px] text-gray-500 mt-1">{h.fecha}</div>
                  {h.motivoRechazo && <div className="text-[10px] text-gray-600 mt-1.5">Motivo: {h.motivoRechazo}</div>}
                  {h.verificador && <div className="text-[10px] text-gray-500 mt-0.5">Verificador: {h.verificador}</div>}
                </div>
              ))}

              {(!current.raw.historial || current.raw.historial.length === 0) && (
                <p className="text-[11px] text-gray-400 italic text-center py-2">Sin versiones anteriores.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Escalar a supervisor modal */}
      {escalarOpen && current && (
        <div className="fixed inset-0 bg-black/40 z-[1000] flex items-center justify-center p-4" onClick={() => setEscalarOpen(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-[420px]" onClick={e => e.stopPropagation()}>
            <div className="p-4 border-b border-cream3 flex justify-between items-center">
              <div>
                <div className="text-[14px] font-extrabold text-navy">Enviar a supervisor</div>
                <div className="text-[10px] text-gray-500 mt-0.5 truncate">{current.title} · {current.emp}</div>
              </div>
              <button onClick={() => setEscalarOpen(false)} className="text-gray-400 hover:text-navy cursor-pointer border-none bg-transparent">
                <X size={18} />
              </button>
            </div>
            <div className="p-4">
              <label className="block text-[9.5px] uppercase tracking-wide text-gray-400 font-extrabold mb-2">Motivo del escalamiento</label>
              <textarea
                value={escalarMotivo}
                onChange={e => setEscalarMotivo(e.target.value)}
                placeholder="Explica brevemente por qué este caso necesita revisión del supervisor..."
                className="form-input !rounded-lg text-[10.5px] py-2 px-2.5 w-full min-h-[90px] resize-y"
              />
              <button
                onClick={enviarEscalamiento}
                className="w-full mt-3 text-[11.5px] font-bold py-2 rounded-lg border-none bg-navy text-white hover:bg-navy2 transition-colors cursor-pointer"
              >
                Enviar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
