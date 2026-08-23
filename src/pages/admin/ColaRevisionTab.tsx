import { useState } from "react";
import { CheckCircle, XCircle, Search, AlertTriangle } from "lucide-react";
import { getContratistas, getProyectos, getMandantes, actualizarEstadoDocumento, sembrarDocumentosEjemplo } from "../../data/localStorageDb";
import { buildColaDocs, buildCorrectionDocs } from "./colaUtils";
import DocumentPreview from "./DocumentPreview";

type Tab = "pending" | "review" | "correction";

const BADGE: Record<string, string> = {
  red: "border-red-200 bg-red-50 text-red-700",
  amber: "border-amber-200 bg-amber-50 text-amber-700",
  green: "border-emerald-200 bg-emerald-50 text-emerald-700",
  blue: "border-blue-200 bg-blue-50 text-blue-700",
  gray: "border-cream3 bg-cream2 text-gray-600",
};

const REASONS = [
  "Documento vencido",
  "Documento ilegible",
  "Documento incorrecto",
  "Datos no coinciden",
  "Falta información o firma",
];

export default function ColaRevisionTab({
  onVerEmpresa,
  selectedDocId,
  setSelectedDocId,
  aprobadosHoy,
  setAprobadosHoy,
  rechazadosHoy,
  setRechazadosHoy,
  showToast,
}: {
  onVerEmpresa?: (empresa: any) => void;
  selectedDocId?: number | null;
  setSelectedDocId?: (id: number | null) => void;
  aprobadosHoy: number;
  setAprobadosHoy: (updater: (n: number) => number) => void;
  rechazadosHoy: number;
  setRechazadosHoy: (updater: (n: number) => number) => void;
  showToast: (msg: string, type?: "success" | "error" | "warning") => void;
}) {
  const GLOBAL_PROYECTOS = getProyectos();
  const GLOBAL_MANDANTES = getMandantes();
  const GLOBAL_CONTRATISTAS = getContratistas();

  const [tab, setTab] = useState<Tab>("pending");
  const [pendingDocs, setPendingDocs] = useState(() => buildColaDocs(GLOBAL_CONTRATISTAS, GLOBAL_PROYECTOS));
  const [correctionDocs, setCorrectionDocs] = useState(() => buildCorrectionDocs(GLOBAL_CONTRATISTAS, GLOBAL_PROYECTOS));

  // "En revisión" ilustra el trabajo en paralelo del equipo: no hay cuentas
  // de verificador separadas en el demo, así que se simula que 2 de los
  // documentos reales de la cola ya fueron tomados por otro compañero.
  // Nota: se usa el `id` numérico secuencial (único dentro de cada lista
  // construida) como clave, no `docId` — este último es el id real del
  // documento y solo es único dentro de un mismo contratista, así que dos
  // contratistas distintos pueden compartir el mismo `docId`.
  const [claims, setClaims] = useState<Record<number, string>>(() => {
    if (pendingDocs.length < 3) return {};
    const sorted = [...pendingDocs].sort((a, b) => (a.prio === "Alta" && b.prio !== "Alta" ? -1 : 1));
    const claimed: Record<number, string> = {};
    if (sorted[0]) claimed[sorted[0].id] = "María González";
    if (sorted[1]) claimed[sorted[1].id] = "Carlos Soto";
    return claimed;
  });

  const [search, setSearch] = useState("");
  const [priority, setPriority] = useState("");
  const [project, setProject] = useState("");

  const [selectedKey, setSelectedKeyLocal] = useState<number | null>(null);
  const [checks, setChecks] = useState({ legible: false, corresponde: false, vigente: false });
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");

  const mandanteDeProyecto = (proyectoId: string) => {
    const p = GLOBAL_PROYECTOS.find(pr => pr.id === proyectoId);
    if (!p) return "—";
    const m = GLOBAL_MANDANTES.find(mm => mm.id === p.mandanteId);
    return m ? m.nombre : "—";
  };

  const claimedKeys = new Set(Object.keys(claims).map(Number));
  const porRevisar = pendingDocs.filter(d => !claimedKeys.has(d.id));
  const enRevision = pendingDocs.filter(d => claimedKeys.has(d.id));
  const esperandoCorreccion = correctionDocs;

  const listaBase = tab === "pending" ? porRevisar : tab === "review" ? enRevision : esperandoCorreccion;
  const proyectosDisponibles = Array.from(new Set(pendingDocs.map(d => d.proyecto)));

  const filtered = listaBase
    .filter(d => {
      if (!search) return true;
      const q = search.toLowerCase();
      const haystack = [d.title, d.emp, d.trabajadorNombre, d.proyecto].filter(Boolean).join(" ").toLowerCase();
      return haystack.includes(q);
    })
    .filter(d => !priority || d.prio === priority)
    .filter(d => !project || d.proyecto === project)
    .sort((a, b) => (a.prio === "Alta" && b.prio !== "Alta" ? -1 : b.prio === "Alta" && a.prio !== "Alta" ? 1 : 0));

  const current = filtered.find(d => d.id === selectedKey) ?? filtered[0];

  const revisadosHoy = aprobadosHoy + rechazadosHoy;

  const resetDecisionForm = () => {
    setChecks({ legible: false, corresponde: false, vigente: false });
    setReason("");
    setNote("");
  };

  const selectDoc = (id: number) => {
    setSelectedKeyLocal(id);
    resetDecisionForm();
    if (setSelectedDocId) setSelectedDocId(null);
  };

  const cambiarTab = (t: Tab) => {
    setTab(t);
    setSelectedKeyLocal(null);
    resetDecisionForm();
  };

  const refreshAndAdvance = () => {
    const updated = getContratistas();
    const newPending = buildColaDocs(updated, GLOBAL_PROYECTOS);
    const newCorrection = buildCorrectionDocs(updated, GLOBAL_PROYECTOS);
    setPendingDocs(newPending);
    setCorrectionDocs(newCorrection);
    setClaims(prev => {
      const next: Record<number, string> = {};
      Object.keys(prev).map(Number).forEach(k => { if (newPending.some(d => d.id === k)) next[k] = prev[k]; });
      return next;
    });
    setSelectedKeyLocal(null);
    resetDecisionForm();
  };

  const aprobar = () => {
    if (!current) return;
    if (!(checks.legible && checks.corresponde && checks.vigente)) {
      showToast("Para aprobar, completa el chequeo mínimo", "warning");
      return;
    }
    const list = getContratistas();
    const cObj = list.find(c => c.nombre === current.emp || c.rut === current.rut);
    if (cObj) {
      actualizarEstadoDocumento(cObj.id, current.proyectoId, current.docId, "approve");
      setAprobadosHoy(a => a + 1);
    }
    showToast(`Documento aprobado: ${current.title}`);
    refreshAndAdvance();
  };

  const rechazar = () => {
    if (!current) return;
    if (!reason) { showToast("Selecciona un motivo de rechazo", "warning"); return; }
    if (!note.trim()) { showToast("Indica brevemente qué debe corregir el contratista", "warning"); return; }
    const list = getContratistas();
    const cObj = list.find(c => c.nombre === current.emp || c.rut === current.rut);
    if (cObj) {
      actualizarEstadoDocumento(cObj.id, current.proyectoId, current.docId, "reject", {
        motivoRechazo: reason,
        explicacionRechazo: note,
      });
      setRechazadosHoy(r => r + 1);
    }
    showToast(`Documento rechazado: ${current.title}`, "warning");
    refreshAndAdvance();
  };

  const siguientePendiente = () => {
    if (porRevisar.length === 0) {
      showToast("No quedan documentos pendientes", "warning");
      return;
    }
    setTab("pending");
    setSelectedKeyLocal(null);
    resetDecisionForm();
  };

  const cargarDocumentosEjemplo = () => {
    const sembrados = sembrarDocumentosEjemplo();
    if (sembrados === 0) {
      showToast("No hay más documentos de ejemplo disponibles para cargar", "warning");
      return;
    }
    refreshAndAdvance();
    showToast(`${sembrados} documento${sembrados === 1 ? "" : "s"} de ejemplo cargados`);
  };

  const TAB_META: Record<Tab, { label: string; count: number; sub: string }> = {
    pending: { label: "Por revisar", count: porRevisar.length, sub: "Más antiguos primero · prioridad alta arriba" },
    review: { label: "En revisión", count: enRevision.length, sub: "Documentos tomados por el equipo" },
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
        <div className="flex gap-2 shrink-0">
          <button onClick={siguientePendiente} className="btn btn-ghost border border-cream3">
            Siguiente pendiente
          </button>
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
          placeholder="Buscar contratista, trabajador o documento..."
          className="form-input !rounded-lg text-[11px] py-2 px-2.5 flex-1 min-w-[220px]"
        />
        <select value={priority} onChange={e => setPriority(e.target.value)} className="form-input !rounded-lg text-[11px] py-2 px-2">
          <option value="">Todas las prioridades</option>
          <option>Alta</option>
          <option>Normal</option>
        </select>
        <select value={project} onChange={e => setProject(e.target.value)} className="form-input !rounded-lg text-[11px] py-2 px-2">
          <option value="">Todos los proyectos</option>
          {proyectosDisponibles.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
      </div>

      {/* Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] xl:grid-cols-[300px_1fr_290px] gap-3.5 items-start">
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
            {filtered.length > 0 ? filtered.map(d => (
              <div
                key={d.id}
                onClick={() => selectDoc(d.id)}
                className={`p-3 border-b border-cream2 cursor-pointer transition-colors border-l-[3px] ${
                  current?.id === d.id ? "bg-gold-soft/40 border-l-brown" : "border-l-transparent hover:bg-[#fbfaf6]"
                }`}
              >
                <div className="flex justify-between items-start gap-2">
                  <div className="text-[11.5px] font-extrabold text-navy leading-snug">{d.title}</div>
                  <span className={`badge border text-[8.5px] px-1.5 whitespace-nowrap shrink-0 ${d.prio === "Alta" ? BADGE.red : BADGE.gray}`}>{d.prio}</span>
                </div>
                <div className="text-[10px] text-gray-500 mt-1 leading-relaxed">
                  <div className="font-semibold text-navy truncate">{d.emp}</div>
                  {d.origen === "Trabajador" && <div className="truncate">{d.trabajadorNombre}</div>}
                  <div className="truncate">{d.proyecto}</div>
                </div>
                <div className="flex justify-between items-center mt-1.5 pt-1.5 border-t border-cream2 text-[9.5px] text-gray-400">
                  <span>{d.time}</span>
                  {tab === "review" && <span className="text-blue-700 font-semibold">{claims[d.id]}</span>}
                </div>
              </div>
            )) : (
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
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 mb-3.5">
                  {[
                    ["Mandante", mandanteDeProyecto(current.proyectoId)],
                    ["Contratista", current.emp],
                    ["Trabajador", current.trabajadorNombre || "—"],
                    ["Proyecto", current.proyecto],
                    ["Cargado", current.time],
                  ].map(([label, value]) => (
                    <div key={label} className="border border-cream3 rounded-lg p-2">
                      <label className="block text-[8px] uppercase text-gray-400 font-extrabold tracking-wide">{label}</label>
                      <strong className="block text-[10.5px] text-navy mt-0.5 truncate" title={value}>{value}</strong>
                    </div>
                  ))}
                </div>

                <div className="relative bg-gradient-to-b from-gray-50 to-gray-100 border border-cream3 rounded-xl min-h-[400px] flex items-center justify-center p-6">
                  <div className="absolute top-3 right-3 flex gap-1.5 z-10">
                    <button onClick={() => showToast("Vista ampliada disponible como siguiente etapa", "warning")} className="text-[9.5px] font-bold text-gray-600 bg-white border border-cream3 rounded-md px-2 py-1.5 cursor-pointer hover:bg-cream2">
                      Ampliar
                    </button>
                    <button onClick={() => showToast("En el MVP esto abriría el archivo original", "warning")} className="text-[9.5px] font-bold text-gray-600 bg-white border border-cream3 rounded-md px-2 py-1.5 cursor-pointer hover:bg-cream2">
                      Original
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
                  <button onClick={() => { setSearch(""); setPriority(""); setProject(""); }} className="text-brown text-[12.5px] hover:underline font-semibold cursor-pointer border-none bg-transparent">
                    Limpiar filtros
                  </button>
                </>
              )}
            </div>
          )}
        </section>

        {/* Decision panel */}
        <section className="bg-white rounded-2xl border border-cream3 shadow-sm overflow-hidden lg:col-span-2 xl:col-span-1">
          <div className="p-3.5 border-b border-cream3">
            <div className="text-[14px] font-extrabold text-navy">Decisión</div>
            <div className="text-[10px] text-gray-500 mt-0.5">Revisión rápida del documento</div>
          </div>

          {current ? (
            <div className="p-3.5 grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-1 gap-3.5">
              <div>
                <div className={`text-[10.5px] font-semibold px-2.5 py-2 rounded-lg mb-3 ${BADGE.blue}`}>
                  {tab === "pending" && "Disponible para tomar revisión."}
                  {tab === "review" && `Documento tomado por ${claims[current.id]}.`}
                  {tab === "correction" && "Fuera de la cola normal. Esperando una nueva versión del contratista."}
                </div>

                {tab !== "correction" && (
                  <>
                    <div className="text-[9.5px] uppercase tracking-wide text-gray-400 font-extrabold mb-2">Chequeo mínimo</div>
                    <div className="flex flex-col gap-2">
                      {[
                        ["legible", "Documento legible", "Se puede revisar correctamente."],
                        ["corresponde", "Corresponde a la persona / empresa", "Nombre o RUT consistente."],
                        ["vigente", "Documento vigente", "Fecha válida según el requisito."],
                      ].map(([key, title, desc]) => (
                        <label key={key} className="flex gap-2 items-start p-2.5 border border-cream3 rounded-lg bg-cream2/40 cursor-pointer">
                          <input
                            type="checkbox"
                            className="mt-0.5"
                            checked={(checks as any)[key]}
                            onChange={e => setChecks(prev => ({ ...prev, [key]: e.target.checked }))}
                          />
                          <div>
                            <b className="block text-[10.5px] text-navy">{title}</b>
                            <span className="block text-[9px] text-gray-400 mt-0.5">{desc}</span>
                          </div>
                        </label>
                      ))}
                    </div>
                  </>
                )}
              </div>

              {tab !== "correction" ? (
                <div>
                  <div className="text-[9.5px] uppercase tracking-wide text-gray-400 font-extrabold mb-2">Si rechazas</div>
                  <select value={reason} onChange={e => setReason(e.target.value)} className="form-input !rounded-lg text-[10.5px] py-2 px-2.5 w-full mb-2">
                    <option value="">Seleccionar motivo...</option>
                    {REASONS.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                  <textarea
                    value={note}
                    onChange={e => setNote(e.target.value)}
                    placeholder="Indica brevemente qué debe corregir el contratista..."
                    className="form-input !rounded-lg text-[10.5px] py-2 px-2.5 w-full min-h-[80px] resize-y"
                  />

                  <div className="grid grid-cols-2 gap-2 mt-3">
                    <button onClick={aprobar} className="flex items-center justify-center gap-1.5 text-[11.5px] font-bold py-2 rounded-lg border-none bg-emerald-700 text-white hover:bg-emerald-800 transition-colors cursor-pointer">
                      <CheckCircle size={14} /> Aprobar
                    </button>
                    <button onClick={rechazar} className="flex items-center justify-center gap-1.5 text-[11.5px] font-bold py-2 rounded-lg border-none bg-red-700 text-white hover:bg-red-800 transition-colors cursor-pointer">
                      <XCircle size={14} /> Rechazar
                    </button>
                    <button onClick={siguientePendiente} className="col-span-2 text-[11px] font-semibold py-2 rounded-lg border border-cream3 bg-white text-gray-600 hover:bg-cream2 transition-colors cursor-pointer">
                      Siguiente documento
                    </button>
                  </div>
                  <div className="text-[9.5px] text-gray-400 leading-relaxed mt-2.5">
                    Aprobar o rechazar actualiza el estado y deja trazabilidad en Auditoría. Un documento rechazado sale de la cola hasta que el contratista cargue una nueva versión.
                  </div>

                  <div className="mt-3.5 pt-3 border-t border-cream2 flex flex-col gap-1.5">
                    <div className="flex justify-between text-[10px]"><b className="text-navy font-semibold">Verificador</b><span className="font-extrabold text-navy">{tab === "review" ? claims[current.id] : "Sin asignar"}</span></div>
                    <div className="flex justify-between text-[10px]"><b className="text-navy font-semibold">Prioridad</b><span className="font-extrabold text-navy">{current.prio}</span></div>
                    <div className="flex justify-between text-[10px]"><b className="text-navy font-semibold">Cargado</b><span className="font-extrabold text-navy">{current.time}</span></div>
                  </div>
                </div>
              ) : (
                <div className="text-[10.5px] text-gray-500 leading-relaxed">
                  Este documento fue rechazado y quedó fuera de la cola normal. Se reincorporará automáticamente cuando el contratista cargue una nueva versión.
                </div>
              )}
            </div>
          ) : (
            <div className="p-6 text-center text-[11.5px] text-gray-400">Selecciona un documento de la lista.</div>
          )}
        </section>
      </div>
    </div>
  );
}
