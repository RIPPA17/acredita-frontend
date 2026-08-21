import React, { useEffect, useState } from "react";
import {
  ClipboardList,
  AlertTriangle,
  CheckCircle,
  XCircle,
  FileText,
  SkipForward,
  Building,
  List,
  FolderOpen,
  ArrowRight,
  Search,
  ArrowLeft,
  ChevronRight,
  Briefcase,
} from "lucide-react";
import { getContratistas, saveContratistas, getProyectos, getMandantes, calcularEstadoTrabajador } from "../../data/localStorageDb";
import { buildColaDocs } from "./colaUtils";

export default function ColaRevisionTab({
  onVerEmpresa, 
  selectedDocId, 
  setSelectedDocId,
  aprobadosHoy,
  setAprobadosHoy,
  rechazadosHoy,
  setRechazadosHoy
}: { 
  onVerEmpresa?: (empresa: any) => void;
  selectedDocId?: number | null;
  setSelectedDocId?: (id: number | null) => void;
  aprobadosHoy: number;
  setAprobadosHoy: React.Dispatch<React.SetStateAction<number>>;
  rechazadosHoy: number;
  setRechazadosHoy: React.Dispatch<React.SetStateAction<number>>;
}) {
  const [vistaRevision, setVistaRevision] = useState<'lista' | 'proyectos'>('lista');
  // Load fresh database copies inside component to trigger sync on navigate
  const GLOBAL_MANDANTES = getMandantes();
  const GLOBAL_PROYECTOS = getProyectos();
  const GLOBAL_CONTRATISTAS = getContratistas();
  const MANDANTES = GLOBAL_MANDANTES.map(m => {
    const proyectos = GLOBAL_PROYECTOS.filter(p => p.mandanteId === m.id).map(p => {
      const docRevisionCount = GLOBAL_CONTRATISTAS.filter(c => c.proyectos.includes(p.id))
        .reduce((sum, c) => sum + c.documentos.filter(d => d.estado === 'revision').length, 0);
      
      let badge = 'b-green';
      let badgeLabel = 'Al día';
      let urgentes = 0;

      if (p.id === 'costanera') {
        badge = 'b-red';
        badgeLabel = '3 urgentes';
        urgentes = 3;
      } else if (p.id === 'solar') {
        badge = 'b-red';
        badgeLabel = '1 urgente';
        urgentes = 1;
      } else if (p.id === 'mackenna') {
        badge = 'b-yellow';
        badgeLabel = '1 normal';
      }

      return {
        id: p.id,
        nombre: p.nombre,
        pendientes: docRevisionCount,
        urgentes,
        badge,
        badgeLabel
      };
    });

    return {
      id: m.id,
      nombre: m.nombre,
      rut: m.rut,
      plan: m.plan,
      proyectos
    };
  });

  const [busquedaMandante, setBusquedaMandante] = useState('');
  const [filtroPlan, setFiltroPlan] = useState<'todos' | 'Basic' | 'Pro' | 'Enterprise'>('todos');
  const [mandanteSeleccionado, setMandanteSeleccionado] = useState<string | null>(null);



  const [docs, setDocs] = useState(() => buildColaDocs(GLOBAL_CONTRATISTAS, GLOBAL_PROYECTOS));
  const [motivoRechazoRapido, setMotivoRechazoRapido] = useState('');
  const [observacionRechazo, setObservacionRechazo] = useState('');
  const [showRejectionForm, setShowRejectionForm] = useState(false);
  const [motivoRechazo, setMotivoRechazo] = useState('');
  const [explicacionRechazo, setExplicacionRechazo] = useState('');
  const [solucionRechazo, setSolucionRechazo] = useState('');

  const [filter, setFilter] = useState("all");
  const [sortField, setSortField] = useState("prio");
  const [localSelectedId, setLocalSelectedId] = useState<number | null>(null);
  const selectedId = selectedDocId !== undefined && selectedDocId !== null ? selectedDocId : localSelectedId;
  const setSelectedId = setSelectedDocId !== undefined && setSelectedDocId !== null ? setSelectedDocId : setLocalSelectedId;
  const [reviewTab, setReviewTab] = useState("documento");
  const [contextoAbierto, setContextoAbierto] = useState(true);
  const [zoom, setZoom] = useState(100);
  const [reviewed, setReviewed] = useState(3);
  const [filtroProyecto, setFiltroProyecto] = useState("todos");

  const proyectosDisponibles = Array.from(new Set(buildColaDocs(GLOBAL_CONTRATISTAS, GLOBAL_PROYECTOS).map(d => d.proyecto)));
  const totalDocs = docs.length + reviewed;

  const CUMPLIMIENTO_EMPRESAS: Record<string, { aprobados: number; rechazados: number; pendientes: number; ultimoRechazo?: { documento: string; motivo: string; fecha: string } }> = {};
  GLOBAL_CONTRATISTAS.forEach(c => {
    const aprobados = c.documentos.filter(d => d.estado === 'aprobado').length;
    const rechazados = c.documentos.filter(d => d.estado === 'rechazado').length;
    const pendientes = c.documentos.filter(d => d.estado === 'pendiente').length;
    const rechazadoDoc = c.documentos.find(d => d.estado === 'rechazado');
    
    CUMPLIMIENTO_EMPRESAS[c.nombre] = {
      aprobados,
      rechazados,
      pendientes,
      ultimoRechazo: rechazadoDoc ? {
        documento: rechazadoDoc.nombre,
        motivo: rechazadoDoc.motivo || 'Rechazado',
        fecha: rechazadoDoc.vencimiento
      } : undefined
    };
  });

  const filtered = docs
    .filter((d) => (filter === "all" ? true : d.tag === filter))
    .filter((d) => (filtroProyecto === "todos" ? true : d.proyecto === filtroProyecto))
    .sort((a, b) => {
      if (sortField === "prio")
        return a.prio === "Alta" && b.prio !== "Alta" ? -1 : 1;
      if (sortField === "time") return a.timeSort - b.timeSort;
      return a.emp.localeCompare(b.emp);
    });

  const current = filtered.find((d) => d.id === selectedId);

  // Nothing is selected on first load (and after a filter change drops the
  // current doc out of view), which left the review panel showing "Cola al
  // día" even though the queue still had pending documents. Auto-select the
  // first visible one so the panel always reflects what the list shows.
  useEffect(() => {
    if (!current && filtered.length > 0) {
      setSelectedId(filtered[0].id);
    }
  }, [current, filtered]);

  const selectDoc = (id: number) => {
    setSelectedId(id);
    setReviewTab("documento");
  };

  const decide = (action: string) => {
    if (!current) return;
    if (action === "skip") {
      const currentIdx = filtered.findIndex((d) => d.id === current.id);
      const nextIdx = (currentIdx + 1) % filtered.length;
      setSelectedId(filtered[nextIdx]?.id || null);
      setMotivoRechazo('');
      setExplicacionRechazo('');
      setSolucionRechazo('');
      setShowRejectionForm(false);
      return;
    }
    setReviewed((r) => r + 1);

    // Update localStorageDb
    const list = getContratistas();
    const cObj = list.find(c => c.nombre === current.emp || c.rut === current.rut);
    if (cObj) {
      if (current.origen === 'Trabajador') {
        const worker = cObj.trabajadores?.find(w => w.nombre === current.trabajadorNombre || w.rut === current.trabajadorRut);
        if (worker) {
          // A contractor assigned to several projects gets one expanded document
          // per project, so the same nombre ("Liquidación Mayo 2026") can appear
          // more than once. .find() with an OR returns the first element that
          // satisfies EITHER clause, so a nombre match earlier in the array won
          // over the correct docId every time — always editing the first
          // duplicate instead of the one actually being reviewed. Matching by
          // docId first (falling back to nombre only when no id matches at all)
          // fixes that.
          const docObj = worker.documentos?.find(d => d.id === current.docId)
            ?? worker.documentos?.find(d => d.nombre === current.title);
          if (docObj) {
            if (action === "approve") {
              docObj.estado = 'aprobado';
              docObj.revisor = 'Verificador Acredita';
              docObj.fechaRevisado = new Date().toLocaleDateString('es-CL');
              docObj.motivo = undefined;
              docObj.observacion = undefined;
              docObj.motivoRechazo = undefined;
              docObj.explicacionRechazo = undefined;
              docObj.solucionRechazo = undefined;
              setAprobadosHoy((a) => a + 1);
            } else if (action === "reject") {
              docObj.estado = 'rechazado';
              docObj.motivoRechazo = motivoRechazo;
              docObj.explicacionRechazo = explicacionRechazo;
              docObj.solucionRechazo = solucionRechazo;
              docObj.motivo = explicacionRechazo || 'Rechazado por auditoría';
              docObj.observacion = explicacionRechazo || 'Rechazado por auditoría';
              docObj.revisor = 'Verificador Acredita';
              docObj.fechaRevisado = new Date().toLocaleDateString('es-CL');
              setRechazadosHoy((r) => r + 1);
            }
            worker.estado = calcularEstadoTrabajador(worker, current.proyectoId);
            saveContratistas(list);
          }
        }
      } else {
        // Same duplicate-nombre issue as above, for company-level documents.
        const docObj = cObj.documentos.find(d => d.id === current.docId)
          ?? cObj.documentos.find(d => d.nombre === current.title);
        if (docObj) {
          if (action === "approve") {
            docObj.estado = 'aprobado';
            docObj.revisor = 'Verificador Acredita';
            docObj.fechaRevisado = new Date().toLocaleDateString('es-CL');
            docObj.motivo = undefined;
            docObj.observacion = undefined;
            docObj.motivoRechazo = undefined;
            docObj.explicacionRechazo = undefined;
            docObj.solucionRechazo = undefined;
            setAprobadosHoy((a) => a + 1);
          } else if (action === "reject") {
            docObj.estado = 'rechazado';
            docObj.motivoRechazo = motivoRechazo;
            docObj.explicacionRechazo = explicacionRechazo;
            docObj.solucionRechazo = solucionRechazo;
            docObj.motivo = explicacionRechazo || 'Rechazado por auditoría';
            docObj.observacion = explicacionRechazo || 'Rechazado por auditoría';
            docObj.revisor = 'Verificador Acredita';
            docObj.fechaRevisado = new Date().toLocaleDateString('es-CL');
            setRechazadosHoy((r) => r + 1);
          }
          saveContratistas(list);
        }
      }
    }

    // Reset inputs
    setMotivoRechazo('');
    setExplicacionRechazo('');
    setSolucionRechazo('');
    setShowRejectionForm(false);

    const newDocs = docs.filter((d) => d.id !== current.id);
    setDocs(newDocs);
    const nextFiltered = newDocs
      .filter((d) => (filter === "all" ? true : d.tag === filter))
      .filter((d) => (filtroProyecto === "todos" ? true : d.proyecto === filtroProyecto));
    setSelectedId(nextFiltered[0]?.id || null);
    setReviewTab("documento");
  };

  return (
    <div className="fade-in">
      <div className="page-header mb-4">
        <div>
          <h2 className="page-title">Revisión</h2>
          <p className="page-sub">Revisa y gestiona los documentos pendientes de aprobación</p>
        </div>
      </div>

      <div className="flex gap-2 mb-5 border-b border-cream3">
        <button
          onClick={() => setVistaRevision('lista')}
          className={`flex items-center gap-2 px-5 py-3 text-[14px] font-medium border-b-2 transition-colors ${
            vistaRevision === 'lista' ? 'text-brown border-brown' : 'text-gray-500 border-transparent hover:text-navy'
          }`}
        >
          <List size={16} /> Lista de documentos
        </button>
        <button
          onClick={() => setVistaRevision('proyectos')}
          className={`flex items-center gap-2 px-5 py-3 text-[14px] font-medium border-b-2 transition-colors ${
            vistaRevision === 'proyectos' ? 'text-brown border-brown' : 'text-gray-500 border-transparent hover:text-navy'
          }`}
        >
          <FolderOpen size={16} /> Por mandante
        </button>
      </div>

      {vistaRevision === 'lista' && (
      <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] bg-white border border-cream3 rounded-xl overflow-hidden min-h-[640px] shadow-sm">
        {/* LEFT PANEL */}
        <div className={`bg-[#faf9f8] border-r border-cream3 flex flex-col ${selectedId ? "hidden lg:flex" : "flex"}`}>
          <div className="p-4 border-b border-cream3">
            <div className="text-[13px] font-medium text-navy flex items-center gap-1.5">
              <ClipboardList size={15} />
              Revisión
              <span className="bg-[#c03030] text-white text-[11px] font-medium rounded-full px-2 py-px">
                {filtered.length}
              </span>
            </div>
            <div className="flex gap-1.5 mt-2.5">
              <span
                onClick={() => setFilter("all")}
                className={`text-[11px] px-2.5 py-[3px] rounded-full border cursor-pointer transition-colors ${filter === "all" ? "bg-navy text-white border-navy" : "border-cream3 bg-white text-gray-500 hover:bg-cream"}`}
              >
                Todos
              </span>
              <span
                onClick={() => setFilter("urgente")}
                className={`text-[11px] px-2.5 py-[3px] rounded-full border cursor-pointer transition-colors ${filter === "urgente" ? "bg-navy text-white border-navy" : "border-cream3 bg-white text-gray-500 hover:bg-cream"}`}
              >
                Urgentes
              </span>
              <span
                onClick={() => setFilter("normal")}
                className={`text-[11px] px-2.5 py-[3px] rounded-full border cursor-pointer transition-colors ${filter === "normal" ? "bg-navy text-white border-navy" : "border-cream3 bg-white text-gray-500 hover:bg-cream"}`}
              >
                Normal
              </span>
              <span
                onClick={() => setFilter("nuevo")}
                className={`text-[11px] px-2.5 py-[3px] rounded-full border cursor-pointer transition-colors ${filter === "nuevo" ? "bg-navy text-white border-navy" : "border-cream3 bg-white text-gray-500 hover:bg-cream"}`}
              >
                Nuevos
              </span>
            </div>
            <div className="mt-3">
              <select
                value={filtroProyecto}
                onChange={(e) => setFiltroProyecto(e.target.value)}
                className="w-full text-[11.5px] border border-cream3 rounded-md px-2 py-1 bg-white text-navy focus:outline-none focus:border-brown"
              >
                <option value="todos">Todos los proyectos</option>
                {proyectosDisponibles.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="p-2.5 px-4 border-b border-cream3 flex items-center gap-2">
            <span className="text-[11px] text-gray-500">Ordenar:</span>
            <select
              className="text-[11px] border border-cream3 rounded-md px-1.5 py-0.5 bg-white text-navy focus:outline-none focus:border-brown"
              value={sortField}
              onChange={(e) => setSortField(e.target.value)}
            >
              <option value="prio">Prioridad</option>
              <option value="time">Más reciente</option>
              <option value="empresa">Empresa A-Z</option>
            </select>
          </div>
          <div className="flex-1 overflow-y-auto p-2.5 flex flex-col gap-1.5">
            {filtered.map((d) => (
              <div
                key={d.id}
                onClick={() => selectDoc(d.id)}
                className={`bg-white border rounded-[12px] p-3.5 cursor-pointer transition-all relative overflow-hidden flex flex-col gap-2 ${selectedId === d.id ? "border-brown shadow-[0_0_0_2px_rgba(154,105,78,0.25)] bg-[#fdf9f7]" : "border-cream3 hover:bg-cream hover:border-gray-300"}`}
              >
                <div
                  className={`absolute left-0 top-0 bottom-0 w-[4px] ${d.prio === "Alta" ? "bg-[#c03030]" : d.prio === "Normal" ? "bg-[#d4a000]" : "bg-green-500"}`}
                ></div>
                
                <div className="flex justify-between items-center ml-1">
                  <span className={`text-[10px] px-2 py-0.5 rounded font-semibold ${
                    d.prio === 'Alta' ? 'bg-[#fde8e8] text-[#c03030]' : 
                    d.prio === 'Normal' ? 'bg-[#fffdf0] text-[#a07000]' : 
                    'bg-[#f0fbf0] text-green-700'
                  }`}>
                    Prioridad: {d.prio}
                  </span>
                  <span className="text-[11px] text-gray-500 font-sans">{d.time}</span>
                </div>

                <div className="text-[14px] font-semibold text-navy ml-1 leading-snug">
                  {d.title}
                </div>

                <div className="ml-1 flex gap-1.5 items-center">
                  <span className={`text-[9.5px] uppercase font-bold px-1.5 py-0.5 rounded ${d.origen === 'Trabajador' ? 'bg-[#faeeda] text-[#854f0b]' : 'bg-[#eaf3de] text-[#3b6d11]'}`}>
                    {d.origen}
                  </span>
                  <span className="text-[11.5px] text-gray-500 font-medium">Estado: En revisión</span>
                </div>

                <div className="text-[12px] text-gray-600 ml-1 leading-relaxed font-sans">
                  <div className="font-semibold text-navy/95 truncate">{d.emp}</div>
                  {d.origen === 'Trabajador' && (
                    <div className="text-brown font-medium mt-0.5 truncate">
                      Personal: {d.trabajadorNombre} ({d.trabajadorRut})
                    </div>
                  )}
                </div>

                <div className="mt-1 ml-1 flex justify-between items-center border-t border-cream3/45 pt-2 text-[11px]">
                  <span className="text-gray-400 flex items-center gap-1 font-sans">
                    <Building size={11} className="shrink-0" /> {d.proyecto}
                  </span>
                  <span className="text-brown font-semibold flex items-center gap-0.5 hover:underline">
                    Revisar <ChevronRight size={12} />
                  </span>
                </div>
              </div>
            ))}
            {filtered.length === 0 && (
              <div className="flex justify-center items-center h-20 text-[12px] text-gray-400">
                No hay documentos en esta vista.
              </div>
            )}
          </div>
        </div>

        {/* RIGHT PANEL */}
        <div className={`flex flex-col bg-white overflow-hidden relative ${selectedId ? "flex" : "hidden lg:flex"}`}>
          {!current ? (
            <div className="flex-1 flex flex-col items-center justify-center text-gray-400 gap-3 px-8">
              {docs.length === 0 ? (
                <>
                  <CheckCircle size={44} className="text-[#639922] opacity-80" />
                  <p className="text-[14px] text-navy font-medium text-center">
                    Cola al día — no hay documentos pendientes
                  </p>
                </>
              ) : (
                <>
                  <Search size={40} className="opacity-30" />
                  <p className="text-[14px] text-navy font-medium text-center">
                    Ningún documento coincide con este filtro
                  </p>
                  <button
                    onClick={() => { setFilter("all"); setFiltroProyecto("todos"); }}
                    className="text-brown text-[12.5px] hover:underline"
                  >
                    Limpiar filtros
                  </button>
                </>
              )}
              {docs.length === 0 && reviewed > 0 && (
                <div className="bg-[#faf9f8] border border-cream3 rounded-xl px-5 py-4 mt-2 text-center">
                  <p className="text-[13px] text-gray-600">
                    Revisaste <strong className="text-navy">{reviewed}</strong> documento{reviewed !== 1 ? 's' : ''} hoy
                  </p>
                  <div className="flex gap-4 mt-2 justify-center text-[12px] text-gray-500">
                    <span>· {aprobadosHoy} aprobados</span>
                    <span>· {rechazadosHoy} rechazados</span>
                    <span>· Tiempo promedio: 4 min/doc</span>
                  </div>
                </div>
              )}
            </div>
          ) : (
                      <div className="flex-1 flex flex-col h-full overflow-hidden">
              {/* Header of review */}
              <div className="p-4 px-5 border-b border-cream3 flex items-center justify-between bg-[#faf9f8] shrink-0 font-sans flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => { setLocalSelectedId(null); setSelectedDocId(null); }}
                    className="lg:hidden btn btn-ghost btn-sm text-gray-500 hover:text-navy px-2 py-1 font-bold flex items-center gap-1 border border-cream3 rounded bg-white"
                  >
                    <ArrowLeft size={14} /> Volver
                  </button>
                  <span className="text-[10px] font-bold text-brown uppercase tracking-wider bg-cream px-2 py-1 rounded">
                    {current.origen === 'Trabajador' ? 'Documento de Personal' : 'Documento de Empresa'}
                  </span>
                  <span className={`badge ${current.prio === 'Alta' ? 'b-red' : current.prio === 'Normal' ? 'b-yellow' : 'b-green'} text-[10px] font-semibold`}>
                    Prioridad: {current.prio}
                  </span>
                </div>
                <div className="text-[12px] text-gray-500">
                  Subido: {current.time}
                </div>
              </div>

              {/* Two-Column split layout */}
              <div className="flex-1 grid grid-cols-1 lg:grid-cols-[360px_1fr] overflow-y-auto lg:overflow-hidden">
                
                {/* COLUMN 1: IZQUIERDA (Details, metadata, worker info, compliance) */}
                <div className="border-r border-cream3 overflow-y-auto p-5 bg-[#fcfbfa] flex flex-col gap-4">
                  
                  {/* Empresa */}
                  <div>
                    <div className="text-[10px] uppercase font-bold text-gray-400 font-sans">Contratista / Empresa</div>
                    <div className="text-[14px] font-bold text-navy mt-0.5">{current.emp}</div>
                    <div className="text-[12px] text-gray-500 font-mono">RUT: {current.rut}</div>
                  </div>

                  {/* Trabajador (si corresponde) */}
                  {current.origen === 'Trabajador' && (() => {
                    const contractorObj = GLOBAL_CONTRATISTAS.find(c => c.nombre === current.emp || c.rut === current.rut);
                    const worker = contractorObj?.trabajadores?.find(w => w.rut === current.trabajadorRut || w.nombre === current.trabajadorNombre);
                    
                    const wEstado = worker ? calcularEstadoTrabajador(worker, current.proyectoId) : 'pendiente';
                    const wCompliance = worker?.cumplimiento || 0;
                    
                    const wStatusLabel = wEstado === 'aprobado' ? 'Habilitado' : wEstado === 'rechazado' ? 'Bloqueado' : 'Pendiente';
                    const wBadgeClass = wEstado === 'aprobado' ? 'b-green' : wEstado === 'rechazado' ? 'b-red' : 'b-yellow';

                    return (
                      <div className="bg-[#faf5f0] border border-cream3 rounded-xl p-3.5 flex flex-col gap-2.5">
                        <div className="text-[10.5px] uppercase font-bold text-brown font-sans">Información de Personal</div>
                        <div>
                          <div className="text-[13.5px] font-bold text-navy">{current.trabajadorNombre}</div>
                          <div className="text-[11.5px] text-gray-500 font-mono">RUT: {current.trabajadorRut}</div>
                          <div className="text-[11.5px] text-gray-600 mt-1 flex items-center gap-1 font-sans">
                            <Briefcase size={12} className="text-gray-400" /> Cargo: {current.trabajadorCargo || 'Operario'}
                          </div>
                        </div>
                        
                        <div className="border-t border-cream3/60 pt-2.5">
                          <div className="flex justify-between items-center text-[11.5px] mb-1 font-sans">
                            <span className="text-navy font-semibold">Acreditación:</span>
                            <span className={`badge ${wBadgeClass} text-[9.5px] py-px px-2 font-semibold`}>{wStatusLabel}</span>
                          </div>
                          <div className="flex justify-between items-center text-[11.5px] mb-1 font-sans">
                            <span className="text-gray-500">Cumplimiento General:</span>
                            <span className="font-bold text-navy">{wCompliance}%</span>
                          </div>
                          <div className="prog-wrap h-1.5 bg-gray-200">
                            <div className="prog-fill bg-brown" style={{ width: `${wCompliance}%` }}></div>
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Proyecto */}
                  <div>
                    <div className="text-[10px] uppercase font-bold text-gray-400 font-sans">Proyecto</div>
                    <div className="text-[13px] font-semibold text-navy mt-0.5">{current.proyecto}</div>
                  </div>

                  {/* Requisito / Documento */}
                  <div>
                    <div className="text-[10px] uppercase font-bold text-gray-400 font-sans">Requisito Evaluado</div>
                    <div className="text-[13px] font-bold text-navy mt-0.5">{current.title}</div>
                    <div className="text-[11.5px] text-gray-500 mt-0.5 font-sans">Categoría: {current.type}</div>
                  </div>

                  {/* Estado y fechas del documento */}
                  {(() => {
                    const contractorObj = GLOBAL_CONTRATISTAS.find(c => c.nombre === current.emp || c.rut === current.rut);
                    let docObj = null;
                    if (current.origen === 'Trabajador') {
                      const worker = contractorObj?.trabajadores?.find(w => w.rut === current.trabajadorRut);
                      // Match by docId first — see the note in decide() on why the
                      // nombre fallback alone picks the wrong duplicate.
                      docObj = worker?.documentos?.find(d => d.id === current.docId)
                        ?? worker?.documentos?.find(d => d.nombre === current.title);
                    } else {
                      docObj = contractorObj?.documentos?.find(d => d.id === current.docId)
                        ?? contractorObj?.documentos?.find(d => d.nombre === current.title);
                    }
                    const fechaCarga = docObj?.subido || current.time || 'No disponible';
                    const fechaVencimiento = docObj?.vencimiento || 'Indefinido';
                    
                    return (
                      <>
                        <div>
                          <div className="text-[10px] uppercase font-bold text-gray-400 font-sans">Estado del Documento</div>
                          <span className="badge b-blue text-[10px] font-semibold mt-1">En revisión</span>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <div className="bg-white border border-cream3 rounded-lg p-2 font-sans">
                            <div className="text-[9.5px] text-gray-400 uppercase font-semibold">Fecha Carga</div>
                            <div className="text-[12px] font-medium text-navy mt-0.5">{fechaCarga}</div>
                          </div>
                          <div className="bg-white border border-cream3 rounded-lg p-2 font-sans">
                            <div className="text-[9.5px] text-gray-400 uppercase font-semibold">Vencimiento</div>
                            <div className="text-[12px] font-medium text-navy mt-0.5">{fechaVencimiento}</div>
                          </div>
                        </div>
                      </>
                    );
                  })()}

                </div>

                {/* COLUMN 2: DERECHA (Visor, zoom controls, structured form / review buttons) */}
                <div className="flex flex-col lg:overflow-hidden bg-white min-h-[500px]">
                  
                  {/* Visor Area */}
                  <div className="flex-1 overflow-y-auto p-6 flex flex-col justify-center items-center bg-gray-50/50 relative">
                    
                    {/* Zoom / View controls */}
                    <div className="absolute top-4 right-4 flex items-center gap-1.5 bg-white border border-cream3 rounded-lg p-1.5 shadow-sm z-10 font-sans">
                      <button 
                        onClick={() => setZoom(prev => Math.max(50, prev - 10))}
                        className="w-6 h-6 flex items-center justify-center text-gray-500 hover:text-navy hover:bg-gray-100 rounded text-sm font-bold focus:outline-none"
                        title="Reducir Zoom"
                      >
                        -
                      </button>
                      <span className="text-[11px] font-semibold font-mono text-navy px-1.5">{zoom}%</span>
                      <button 
                        onClick={() => setZoom(prev => Math.min(200, prev + 10))}
                        className="w-6 h-6 flex items-center justify-center text-gray-500 hover:text-navy hover:bg-gray-100 rounded text-sm font-bold focus:outline-none"
                        title="Aumentar Zoom"
                      >
                        +
                      </button>
                      <button 
                        onClick={() => setZoom(100)}
                        className="text-[10px] font-semibold text-brown hover:underline px-1.5 border-l border-cream3 focus:outline-none"
                      >
                        Reset
                      </button>
                    </div>

                    <div 
                      className="bg-[#eeeade] border border-dashed border-[#dedad1] rounded-xl flex flex-col items-center justify-center min-h-[300px] w-full max-w-[480px] p-6 gap-3 transition-transform shadow-sm"
                      style={{ transform: `scale(${zoom / 100})` }}
                    >
                      <FileText size={48} className="text-brown opacity-85" />
                      <div className="text-[14px] font-bold text-navy text-center font-mono">
                        {current.title}.pdf
                      </div>
                      <div className="text-[12px] text-gray-500 text-center font-sans">
                        Vista previa del documento cargado por el contratista
                      </div>
                      <div className="text-[11px] text-[#639922] bg-[#f0fbf0] border border-[#d4f0de] font-semibold rounded-full px-3 py-1 mt-1">
                        ✓ Archivo Digitalizado Correctamente
                      </div>
                    </div>

                    {current.hint && (
                      <div className="bg-[#fdf5df] border border-[#e8c84a] rounded-xl p-3 px-4 flex gap-2.5 items-start mt-6 max-w-[480px] shadow-sm">
                        <AlertTriangle size={16} className="text-[#854f0b] shrink-0 mt-0.5" />
                        <span className="text-[12.5px] text-[#633806] leading-relaxed font-sans">
                          <strong>Sugerencia de Auditoría:</strong> {current.hint}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Actions / Form Footer */}
                  <div className="p-4 px-5 border-t border-cream3 bg-[#faf9f8] shrink-0 flex flex-col gap-3 font-sans">
                    
                    {showRejectionForm ? (
                      <div className="flex flex-col gap-3 fade-in">
                        <h4 className="text-[13px] font-bold text-navy flex items-center gap-1">
                          <XCircle size={15} className="text-[#c02020]" /> Configurar Rechazo de Documento
                        </h4>
                        
                        {/* Motivo dropdown */}
                        <div className="form-group flex flex-col gap-1">
                          <label className="text-[11px] font-semibold text-gray-500">Motivo principal</label>
                          <select
                            value={motivoRechazo}
                            onChange={(e) => setMotivoRechazo(e.target.value)}
                            className="w-full text-[12.5px] border border-cream3 rounded-lg px-2.5 py-1.5 bg-white text-navy focus:outline-none focus:border-brown"
                          >
                            <option value="">Seleccione el motivo de rechazo…</option>
                            <option value="Documento ilegible">Documento ilegible</option>
                            <option value="Documento vencido">Documento vencido</option>
                            <option value="Datos incorrectos">Datos incorrectos</option>
                            <option value="Falta información">Falta información</option>
                            <option value="Documento corresponde a otra persona">Documento corresponde a otra persona</option>
                            <option value="Documento incompleto">Documento incompleto</option>
                            <option value="Formato incorrecto">Formato incorrecto</option>
                            <option value="Otro">Otro</option>
                          </select>
                        </div>

                        {/* Explicación textarea */}
                        <div className="form-group flex flex-col gap-1">
                          <label className="text-[11px] font-semibold text-gray-500">Explicación (qué está mal)</label>
                          <textarea
                            rows={2}
                            value={explicacionRechazo}
                            onChange={(e) => setExplicacionRechazo(e.target.value)}
                            placeholder="Detalle exactamente el problema encontrado con el documento…"
                            className="w-full text-[12.5px] border border-cream3 rounded-lg px-2.5 py-1.5 bg-white text-navy resize-none focus:outline-none focus:border-brown placeholder-gray-400 font-sans"
                          ></textarea>
                        </div>

                        {/* Solución textarea */}
                        <div className="form-group flex flex-col gap-1">
                          <label className="text-[11px] font-semibold text-gray-500">Solución (qué debe hacer el contratista)</label>
                          <textarea
                            rows={2}
                            value={solucionRechazo}
                            onChange={(e) => setSolucionRechazo(e.target.value)}
                            placeholder="Describa los pasos para que el contratista resuelva el rechazo…"
                            className="w-full text-[12.5px] border border-cream3 rounded-lg px-2.5 py-1.5 bg-white text-navy resize-none focus:outline-none focus:border-brown placeholder-gray-400 font-sans"
                          ></textarea>
                        </div>

                        {/* Action buttons inside form */}
                        <div className="flex gap-2.5 mt-1">
                          <button
                            onClick={() => decide("reject")}
                            disabled={!motivoRechazo || !explicacionRechazo || !solucionRechazo}
                            className="flex-1 flex items-center justify-center gap-1.5 text-[13px] font-semibold py-2 rounded-lg bg-[#a32d2d] text-white hover:bg-[#791f1f] disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors border-none"
                          >
                            <XCircle size={15} /> Confirmar Rechazo
                          </button>
                          <button
                            onClick={() => {
                              setShowRejectionForm(false);
                              setMotivoRechazo('');
                              setExplicacionRechazo('');
                              setSolucionRechazo('');
                            }}
                            className="flex-1 flex items-center justify-center gap-1 text-[13px] font-medium py-2 border border-cream3 rounded-lg bg-white text-gray-500 hover:bg-gray-50 transition-colors"
                          >
                            Cancelar
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                        <div className="flex gap-2 flex-1">
                          <button
                            onClick={() => decide("approve")}
                            className="flex-1 flex items-center justify-center gap-1.5 text-[13px] font-bold py-2.5 rounded-lg border-none bg-[#3b6d11] text-white hover:bg-[#27500a] transition-colors shadow-sm"
                          >
                            <CheckCircle size={15} /> Aprobar
                          </button>
                          <button
                            onClick={() => setShowRejectionForm(true)}
                            className="flex-1 flex items-center justify-center gap-1.5 text-[13px] font-bold py-2.5 rounded-lg border-none bg-[#a32d2d] text-white hover:bg-[#791f1f] transition-colors shadow-sm"
                          >
                            <XCircle size={15} /> Rechazar
                          </button>
                        </div>
                        <button
                          onClick={() => decide("skip")}
                          className="flex items-center justify-center gap-1 text-[12.5px] w-full sm:w-auto px-4 py-2.5 border border-cream3 rounded-lg bg-white text-gray-500 hover:bg-gray-50 transition-colors"
                        >
                          <SkipForward size={14} /> Saltar
                        </button>
                      </div>
                    )}
                  </div>

                </div>
              </div>
            </div>
          )}
        </div>
        </div>
      )}

      {vistaRevision === 'proyectos' && (
        <div className="fade-in">
      
          {!mandanteSeleccionado ? (
            <>
              {/* Buscador y filtro */}
              <div className="flex gap-2 mb-4">
                <div className="relative flex-1">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    className="form-input w-full pl-8"
                    placeholder="Buscar por razón social o RUT..."
                    value={busquedaMandante}
                    onChange={e => setBusquedaMandante(e.target.value)}
                  />
                </div>
                <select
                  className="form-input w-40"
                  value={filtroPlan}
                  onChange={e => setFiltroPlan(e.target.value as any)}
                >
                  <option value="todos">Todos los planes</option>
                  <option value="Basic">Basic</option>
                  <option value="Pro">Pro</option>
                  <option value="Enterprise">Enterprise</option>
                </select>
              </div>
      
              {/* Cards mandantes */}
              <div className="card-grid">
                {MANDANTES
                  .filter(m =>
                    (filtroPlan === 'todos' || m.plan === filtroPlan) &&
                    (m.nombre.toLowerCase().includes(busquedaMandante.toLowerCase()) ||
                     m.rut.includes(busquedaMandante))
                  )
                  .map(m => {
                    const totalPendientes = m.proyectos.reduce((acc, p) => acc + p.pendientes, 0);
                    const tieneUrgentes = m.proyectos.some(p => p.urgentes > 0);
                    return (
                      <div
                        key={m.id}
                        className="proj-card cursor-pointer hover:shadow-md transition-shadow"
                        onClick={() => setMandanteSeleccionado(m.id)}
                      >
                        <div className="flex justify-between items-start mb-2">
                          <h4 className="text-[15.4px] font-bold text-navy leading-tight">{m.nombre}</h4>
                          <span className={`badge flex-shrink-0 ml-2 ${tieneUrgentes ? 'b-red' : totalPendientes > 0 ? 'b-yellow' : 'b-green'}`}>
                            {tieneUrgentes ? 'Urgente' : totalPendientes > 0 ? 'Pendiente' : 'Al día'}
                          </span>
                        </div>
                        <p className="text-[13.2px] text-gray-500 mb-3">{m.rut} · Plan {m.plan}</p>
                        <div className="flex flex-col gap-1 mb-3">
                          <div className="flex items-center gap-2 text-[12.5px] text-gray-500">
                            <FolderOpen size={13} className="text-brown" /> {m.proyectos.length} proyecto{m.proyectos.length > 1 ? 's' : ''} activo{m.proyectos.length > 1 ? 's' : ''}
                          </div>
                          <div className="flex items-center gap-2 text-[12.5px] text-gray-500">
                            <ClipboardList size={13} className="text-brown" /> {totalPendientes} documento{totalPendientes !== 1 ? 's' : ''} pendiente{totalPendientes !== 1 ? 's' : ''}
                          </div>
                        </div>
                        <div className="flex items-center gap-1 text-[12px] text-brown font-medium mt-1">
                          Ver proyectos <ChevronRight size={13} />
                        </div>
                      </div>
                    );
                  })
                }
                {MANDANTES.filter(m =>
                  (filtroPlan === 'todos' || m.plan === filtroPlan) &&
                  (m.nombre.toLowerCase().includes(busquedaMandante.toLowerCase()) || m.rut.includes(busquedaMandante))
                ).length === 0 && (
                  <div className="col-span-3 py-10 text-center text-[13.2px] text-gray-400">
                    Sin resultados para esa búsqueda
                  </div>
                )}
              </div>
            </>
          ) : (
            <>
              {/* Detalle proyectos del mandante */}
              {(() => {
                const mandante = MANDANTES.find(m => m.id === mandanteSeleccionado)!;
                return (
                  <>
                    <div
                      className="text-[13.2px] text-gray-500 cursor-pointer mb-4 flex items-center gap-1 w-max hover:text-navy"
                      onClick={() => setMandanteSeleccionado(null)}
                    >
                      <ArrowLeft size={14} /> Mandantes
                    </div>
                    <div className="mb-4">
                      <h3 className="page-title">{mandante.nombre}</h3>
                      <p className="page-sub">{mandante.rut} · Plan {mandante.plan} · {mandante.proyectos.length} proyectos activos</p>
                    </div>
                    <div className="card-grid">
                      {mandante.proyectos.map(p => (
                        <div key={p.id} className="proj-card">
                          <div className="flex justify-between items-start mb-2">
                            <h4 className="text-[15.4px] font-bold text-navy">{p.nombre}</h4>
                            <span className={`badge ${p.badge}`}>{p.badgeLabel}</span>
                          </div>
                          <p className="text-[13.2px] text-gray-500 mb-3">{p.pendientes} documento{p.pendientes !== 1 ? 's' : ''} pendiente{p.pendientes !== 1 ? 's' : ''}</p>
                          <button
                            className="btn btn-ghost btn-sm w-full"
                            onClick={() => { setMandanteSeleccionado(null); setVistaRevision('lista'); }}
                          >
                            Ver en cola <ArrowRight size={13} className="ml-1" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </>
                );
              })()}
            </>
          )}
        </div>
      )}
    </div>
  );
}
