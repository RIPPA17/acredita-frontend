import React, { useState } from "react";
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
import { getContratistas, saveContratistas, getProyectos, getMandantes, calcularEstadoTrabajador, actualizarEstadoDocumento } from "../../data/localStorageDb";
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

    // Update localStorageDb using database functions
    const list = getContratistas();
    const cObj = list.find(c => c.nombre === current.emp || c.rut === current.rut);
    if (cObj) {
      if (action === "approve") {
        actualizarEstadoDocumento(cObj.id, current.proyectoId, current.docId, "approve");
        setAprobadosHoy((a) => a + 1);
      } else if (action === "reject") {
        actualizarEstadoDocumento(cObj.id, current.proyectoId, current.docId, "reject", {
          motivoRechazo,
          explicacionRechazo,
          solucionRechazo
        });
        setRechazadosHoy((r) => r + 1);
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
    <div className="fade-in flex flex-col flex-1 min-h-0">
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
      <div className="grid grid-cols-1 md:grid-cols-[290px_1fr] bg-white border border-cream3 rounded-xl overflow-hidden h-auto md:h-[calc(100vh-215px)] md:min-h-[680px] flex-1 min-h-0 shadow-sm">
        {/* LEFT PANEL */}
        <div className={`bg-[#faf9f8] border-r md:border-r-2 border-[var(--navy)] flex flex-col ${selectedId ? "hidden md:flex" : "flex"} h-full min-h-0`}>
          <div className="p-3 border-b border-cream3 shrink-0">
            <div className="text-[13px] font-bold text-navy flex items-center gap-1.5 justify-between">
              <span className="flex items-center gap-1.5">
                <ClipboardList size={15} />
                Revisión
              </span>
              <span className="bg-[#c03030] text-white text-[10.5px] font-bold rounded-full px-2 py-0.5">
                {filtered.length}
              </span>
            </div>
            
            {/* Segmented Control */}
            <div className="flex gap-1 mt-2.5 bg-[#f4f4f5] p-0.5 rounded-lg border border-cream3">
              {(['all', 'urgente', 'normal', 'nuevo'] as const).map((opt) => {
                const active = filter === opt;
                const label = opt === 'all' ? 'Todos' : opt === 'urgente' ? 'Urgentes' : opt === 'normal' ? 'Normal' : 'Nuevos';
                return (
                  <button
                    key={opt}
                    onClick={() => setFilter(opt)}
                    className={`flex-1 text-center py-1 rounded-md text-[10.5px] font-semibold transition-all cursor-pointer border-none ${
                      active
                        ? "bg-navy text-white shadow-sm"
                        : "text-gray-500 hover:text-navy hover:bg-white/50 bg-transparent"
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>

            {/* Project Select Dropdown */}
            <div className="mt-2.5">
              <select
                value={filtroProyecto}
                onChange={(e) => setFiltroProyecto(e.target.value)}
                className="w-full text-[11px] border border-cream3 rounded-md px-2 py-1.5 bg-white text-navy font-medium focus:outline-none focus:border-brown cursor-pointer"
              >
                <option value="todos">Todos los proyectos</option>
                {proyectosDisponibles.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="p-2 border-b border-cream3 flex items-center gap-2 shrink-0 bg-white">
            <span className="text-[11px] text-gray-500 font-medium ml-2">Ordenar:</span>
            <select
              className="text-[11px] border border-cream3 rounded-md px-2 py-0.5 bg-white text-navy font-medium focus:outline-none focus:border-brown cursor-pointer"
              value={sortField}
              onChange={(e) => setSortField(e.target.value)}
            >
              <option value="prio">Prioridad</option>
              <option value="time">Más reciente</option>
              <option value="empresa">Empresa A-Z</option>
            </select>
          </div>

          {/* Cards List */}
          <div className="flex-1 overflow-y-auto p-2.5 flex flex-col gap-2 bg-[#faf9f8]">
            {filtered.map((d) => {
              const borderLeftColor = d.prio === "Alta" ? "#c03030" : d.prio === "Normal" ? "#d4a000" : "#22c55e";
              return (
                <div
                  key={d.id}
                  onClick={() => selectDoc(d.id)}
                  style={{ borderLeftColor }}
                  className={`bg-white border rounded-[10px] p-2.5 cursor-pointer transition-all relative overflow-hidden flex flex-col gap-1.5 border-l-[3px] ${
                    selectedId === d.id 
                      ? "border-brown shadow-[0_2px_8px_rgba(154,105,78,0.12)]" 
                      : "border-cream3 hover:bg-white hover:border-gray-300"
                  }`}
                >
                  <div className="flex justify-between items-center text-[10.5px]">
                    <span className={`font-semibold ${
                      d.prio === 'Alta' ? 'text-[#c03030]' : 
                      d.prio === 'Normal' ? 'text-[#a07000]' : 
                      'text-green-700'
                    }`}>
                      Prioridad: {d.prio}
                    </span>
                    <span className="text-gray-400 font-sans">{d.time}</span>
                  </div>

                  <div className="text-[12.5px] font-bold text-navy leading-snug">
                    {d.title}
                  </div>

                  <div className="flex gap-1.5 items-center text-[11px]">
                    <span className={`text-[9px] uppercase font-bold px-1.5 py-0.5 rounded ${d.origen === 'Trabajador' ? 'bg-[#faeeda] text-[#854f0b]' : 'bg-[#eaf3de] text-[#3b6d11]'}`}>
                      {d.origen === 'Trabajador' ? 'Personal' : 'Empresa'}
                    </span>
                    <span className="text-gray-400 font-medium">Estado: En revisión</span>
                  </div>

                  <div className="text-[12px] text-gray-600 leading-relaxed font-sans">
                    <div className="font-semibold text-navy truncate">{d.emp}</div>
                    {d.origen === 'Trabajador' && (
                      <div className="text-brown font-medium text-[11px] mt-0.5 truncate">
                        Personal: {d.trabajadorNombre} ({d.trabajadorRut})
                      </div>
                    )}
                  </div>

                  <div className="mt-1 flex justify-between items-center border-t border-cream3 pt-2 text-[10.5px]">
                    <span className="text-gray-400 flex items-center gap-1 font-sans truncate max-w-[70%]">
                      <Building size={11} className="shrink-0" /> {d.proyecto}
                    </span>
                    <span className="text-brown font-semibold flex items-center gap-0.5 hover:underline shrink-0">
                      Revisar <ChevronRight size={12} />
                    </span>
                  </div>
                </div>
              );
            })}
            {filtered.length === 0 && (
              <div className="flex justify-center items-center h-20 text-[11.5px] text-gray-400">
                No hay documentos en esta vista.
              </div>
            )}
          </div>
        </div>

        {/* RIGHT PANEL */}
        <div className={`flex flex-col bg-white overflow-hidden relative ${selectedId ? "flex" : "hidden md:flex"} h-full min-h-0`}>
          {!current ? (
            <div className="flex-1 flex flex-col items-center justify-center text-gray-400 gap-3 px-8">
              <CheckCircle size={44} className="text-[#639922] opacity-80" />
              <p className="text-[13.5px] text-navy font-bold text-center">
                Cola al día — no hay documentos pendientes
              </p>
              {reviewed > 0 && (
                <div className="bg-[#faf9f8] border border-cream3 rounded-xl px-5 py-4 mt-2 text-center shadow-sm">
                  <p className="text-[12.5px] text-gray-600">
                    Revisaste <strong className="text-navy">{reviewed}</strong> documento{reviewed !== 1 ? 's' : ''} hoy
                  </p>
                  <div className="flex gap-4 mt-2 justify-center text-[11px] text-gray-500">
                    <span>· {aprobadosHoy} aprobados</span>
                    <span>· {rechazadosHoy} rechazados</span>
                    <span>· Tiempo promedio: 4 min/doc</span>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex-1 flex flex-col h-full overflow-hidden min-h-0">
              {/* Header of review */}
              <div className="p-3 px-4 border-b-2 border-[var(--navy)] flex items-center justify-between bg-white shrink-0 font-sans flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => { setLocalSelectedId(null); setSelectedDocId(null); }}
                    className="md:hidden btn btn-ghost btn-sm text-gray-500 hover:text-navy px-2 py-1 font-bold flex items-center gap-1 border border-cream3 rounded bg-white"
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
                <div className="text-[11px] text-gray-500 font-medium">
                  Subido: {current.time}
                </div>
              </div>

              {/* Two-Column split layout */}
              <div className="flex-1 grid grid-cols-1 md:grid-cols-[300px_1fr] overflow-hidden min-h-0">
                
                {/* COLUMN 1: METADATA (Izquierda en el split, Centro en la pantalla) */}
                <div className="border-r md:border-r-2 border-[var(--navy)] flex flex-col h-full min-h-0 bg-white">
                  
                  {/* Metadata Blocks Container (Scrollable) */}
                  <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3.5 bg-[#fcfbfa]">
                    
                    {/* Empresa */}
                    <div className="border-b border-cream3 pb-2.5">
                      <div className="text-[10px] uppercase font-bold text-gray-400 tracking-wider font-sans">Contratista / Empresa</div>
                      <div className="text-[13.5px] font-bold text-navy mt-0.5">{current.emp}</div>
                      <div className="text-[11.5px] text-gray-500 font-mono mt-0.5">RUT: {current.rut}</div>
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
                        <div className="bg-[#faf5f0] border border-cream3 rounded-xl p-3 flex flex-col gap-2 border-l-[3px] border-l-brown">
                          <div className="text-[10px] uppercase font-bold text-brown tracking-wider font-sans">Información de Personal</div>
                          <div>
                            <div className="text-[13px] font-bold text-navy">{current.trabajadorNombre}</div>
                            <div className="text-[11px] text-gray-500 font-mono mt-0.5">RUT: {current.trabajadorRut}</div>
                            <div className="text-[11px] text-gray-600 mt-1 flex items-center gap-1 font-sans">
                              <Briefcase size={11} className="text-gray-400 shrink-0" /> Cargo: {current.trabajadorCargo || 'Operario'}
                            </div>
                          </div>
                          
                          <div className="border-t border-cream3/60 pt-2 flex flex-col gap-1.5">
                            <div className="flex justify-between items-center text-[11px] font-sans">
                              <span className="text-navy font-semibold">Acreditación:</span>
                              <span className={`badge ${wBadgeClass} text-[9px] py-px px-1.5 font-semibold`}>{wStatusLabel}</span>
                            </div>
                            <div className="flex justify-between items-center text-[11px] font-sans">
                              <span className="text-gray-500">Cumplimiento:</span>
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
                    <div className="border-b border-cream3 pb-2.5">
                      <div className="text-[10px] uppercase font-bold text-gray-400 tracking-wider font-sans">Proyecto</div>
                      <div className="text-[13px] font-semibold text-navy mt-0.5">{current.proyecto}</div>
                    </div>

                    {/* Requisito / Documento */}
                    <div className="border-b border-cream3 pb-2.5">
                      <div className="text-[10px] uppercase font-bold text-gray-400 tracking-wider font-sans">Requisito Evaluado</div>
                      <div className="text-[13px] font-bold text-navy mt-0.5">{current.title}</div>
                      <div className="text-[11.5px] text-gray-500 mt-0.5 font-sans">Categoría: {current.type}</div>
                    </div>

                    {/* Estado y fechas del documento */}
                    {(() => {
                      const contractorObj = GLOBAL_CONTRATISTAS.find(c => c.nombre === current.emp || c.rut === current.rut);
                      let docObj = null;
                      if (current.origen === 'Trabajador') {
                        const worker = contractorObj?.trabajadores?.find(w => w.rut === current.trabajadorRut);
                        docObj = worker?.documentos?.find(d => d.id === current.docId || d.nombre === current.title);
                      } else {
                        docObj = contractorObj?.documentos?.find(d => d.id === current.docId || d.nombre === current.title);
                      }
                      const fechaCarga = docObj?.subido || current.time || 'No disponible';
                      const fechaVencimiento = docObj?.vencimiento || 'Indefinido';
                      
                      return (
                        <>
                          <div className="border-b border-cream3 pb-2.5">
                            <div className="text-[10px] uppercase font-bold text-gray-400 tracking-wider font-sans">Estado del Documento</div>
                            <span className="badge b-blue text-[10px] font-semibold mt-1">En revisión</span>
                          </div>

                          <div className="grid grid-cols-2 gap-2 mt-1">
                            <div className="bg-white border border-cream3 rounded-lg p-2 font-sans">
                              <div className="text-[9.5px] text-gray-400 uppercase font-bold tracking-wider">Fecha Carga</div>
                              <div className="text-[11.5px] font-semibold text-navy mt-0.5">{fechaCarga}</div>
                            </div>
                            <div className="bg-white border border-cream3 rounded-lg p-2 font-sans">
                              <div className="text-[9.5px] text-gray-400 uppercase font-bold tracking-wider">Vencimiento</div>
                              <div className="text-[11.5px] font-semibold text-navy mt-0.5">{fechaVencimiento}</div>
                            </div>
                          </div>
                        </>
                      );
                    })()}

                  </div>

                  {/* Actions / Form Footer (Pinned at the bottom of Metadata Column) */}
                  <div className="p-3 px-4 border-t-2 border-[var(--navy)] bg-[#faf9f8] shrink-0 flex flex-col gap-2.5 font-sans">
                    
                    {showRejectionForm ? (
                      <div className="flex flex-col gap-2.5 fade-in">
                        <h4 className="text-[12px] font-bold text-navy flex items-center gap-1 mb-0.5">
                          <XCircle size={14} className="text-[#c02020] shrink-0" /> Configurar Rechazo de Documento
                        </h4>
                        
                        {/* Motivo dropdown */}
                        <div className="form-group flex flex-col gap-0.5 mb-1.5">
                          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Motivo principal</label>
                          <select
                            value={motivoRechazo}
                            onChange={(e) => setMotivoRechazo(e.target.value)}
                            className="w-full text-[12px] border border-cream3 rounded-md px-2 py-1 bg-white text-navy focus:outline-none focus:border-brown cursor-pointer"
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
                        <div className="form-group flex flex-col gap-0.5 mb-1.5">
                          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Explicación (qué está mal)</label>
                          <textarea
                            rows={2}
                            value={explicacionRechazo}
                            onChange={(e) => setExplicacionRechazo(e.target.value)}
                            placeholder="Detalle exactamente el problema..."
                            className="w-full text-[12px] border border-cream3 rounded-md px-2 py-1 bg-white text-navy resize-none focus:outline-none focus:border-brown placeholder-gray-400 font-sans"
                          ></textarea>
                        </div>

                        {/* Solución textarea */}
                        <div className="form-group flex flex-col gap-0.5 mb-2">
                          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Solución (qué hacer)</label>
                          <textarea
                            rows={2}
                            value={solucionRechazo}
                            onChange={(e) => setSolucionRechazo(e.target.value)}
                            placeholder="Describa cómo resolverlo..."
                            className="w-full text-[12px] border border-cream3 rounded-md px-2 py-1 bg-white text-navy resize-none focus:outline-none focus:border-brown placeholder-gray-400 font-sans"
                          ></textarea>
                        </div>

                        {/* Action buttons inside form */}
                        <div className="flex gap-2">
                          <button
                            onClick={() => decide("reject")}
                            disabled={!motivoRechazo || !explicacionRechazo || !solucionRechazo}
                            className="flex-1 flex items-center justify-center gap-1 text-[12px] font-bold py-2 rounded-lg bg-[#a32d2d] text-white hover:bg-[#791f1f] disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors border-none cursor-pointer"
                          >
                            <XCircle size={14} /> Confirmar Rechazo
                          </button>
                          <button
                            onClick={() => {
                              setShowRejectionForm(false);
                              setMotivoRechazo('');
                              setExplicacionRechazo('');
                              setSolucionRechazo('');
                            }}
                            className="flex-1 flex items-center justify-center gap-1 text-[12px] font-medium py-2 border border-cream3 rounded-lg bg-white text-gray-500 hover:bg-gray-50 transition-colors cursor-pointer"
                          >
                            Cancelar
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col gap-2">
                        <div className="flex gap-2">
                          <button
                            onClick={() => decide("approve")}
                            className="flex-1 flex items-center justify-center gap-1 text-[12px] font-bold py-2 rounded-lg border-none bg-[#3b6d11] text-white hover:bg-[#27500a] transition-colors shadow-sm cursor-pointer"
                          >
                            <CheckCircle size={14} /> Aprobar
                          </button>
                          <button
                            onClick={() => setShowRejectionForm(true)}
                            className="flex-1 flex items-center justify-center gap-1 text-[12px] font-bold py-2 rounded-lg border-none bg-[#a32d2d] text-white hover:bg-[#791f1f] transition-colors shadow-sm cursor-pointer"
                          >
                            <XCircle size={14} /> Rechazar
                          </button>
                        </div>
                        <button
                          onClick={() => decide("skip")}
                          className="flex items-center justify-center gap-1 text-[11.5px] w-full py-1.5 border border-cream3 rounded-lg bg-white text-gray-500 hover:bg-gray-50 transition-colors cursor-pointer"
                        >
                          <SkipForward size={13} /> Saltar Documento
                        </button>
                      </div>
                    )}
                  </div>

                </div>

                {/* COLUMN 2: DERECHA (Visor, zoom controls, suggestions) */}
                <div className="flex flex-col overflow-hidden bg-white h-full min-h-0">
                  
                  {/* Visor Area */}
                  <div className="flex-1 overflow-y-auto p-4 flex flex-col justify-between items-center bg-gray-50/50 relative min-h-0">
                    
                    {/* Zoom / View controls */}
                    <div className="absolute top-3 right-3 flex items-center gap-1 bg-white border border-cream3 rounded-lg p-1 shadow-sm z-10 font-sans">
                      <button 
                        onClick={() => setZoom(prev => Math.max(50, prev - 10))}
                        className="w-5 h-5 flex items-center justify-center text-gray-500 hover:text-navy hover:bg-gray-100 rounded text-xs font-bold border-none bg-transparent cursor-pointer focus:outline-none"
                        title="Reducir Zoom"
                      >
                        -
                      </button>
                      <span className="text-[10px] font-semibold font-mono text-navy px-1">{zoom}%</span>
                      <button 
                        onClick={() => setZoom(prev => Math.min(200, prev + 10))}
                        className="w-5 h-5 flex items-center justify-center text-gray-500 hover:text-navy hover:bg-gray-100 rounded text-xs font-bold border-none bg-transparent cursor-pointer focus:outline-none"
                        title="Aumentar Zoom"
                      >
                        +
                      </button>
                      <button 
                        onClick={() => setZoom(100)}
                        className="text-[10px] font-semibold text-brown hover:underline px-1.5 border-l border-cream3 border-none bg-transparent cursor-pointer focus:outline-none"
                      >
                        Reset
                      </button>
                    </div>
 
                    {/* Empty spacer to align visual card centered */}
                    <div className="flex-1 flex items-center justify-center w-full py-6">
                      <div 
                        className="bg-[#eeeade] border border-dashed border-[#dedad1] rounded-xl flex flex-col items-center justify-center h-[230px] w-full max-w-[400px] p-6 gap-3 transition-transform shadow-sm"
                        style={{ transform: `scale(${zoom / 100})` }}
                      >
                        <FileText size={44} className="text-brown opacity-85" />
                        <div className="text-[13px] font-bold text-navy text-center font-mono">
                          {current.title}.pdf
                        </div>
                        <div className="text-[11.5px] text-gray-500 text-center font-sans">
                          Vista previa del documento cargado por el contratista
                        </div>
                        <div className="text-[10.5px] text-[#639922] bg-[#f0fbf0] border border-[#d4f0de] font-semibold rounded-full px-3 py-0.5 mt-1">
                          ✓ Archivo Digitalizado Correctamente
                        </div>
                      </div>
                    </div>

                    {/* Suggestions Box (placed neatly at the bottom of the visor) */}
                    {current.hint && (
                      <div className="w-full max-w-[440px] bg-[#fdf5df] border border-[#e8c84a] rounded-xl p-3 flex gap-2 items-start shadow-sm shrink-0 mb-2">
                        <AlertTriangle size={15} className="text-[#854f0b] shrink-0 mt-0.5" />
                        <span className="text-[11.5px] text-[#633806] leading-relaxed font-sans">
                          <strong>Sugerencia de Auditoría:</strong> {current.hint}
                        </span>
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
