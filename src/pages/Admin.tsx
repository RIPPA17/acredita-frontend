import React, { useState } from "react";
import {
  Bell,
  LayoutDashboard,
  ClipboardList,
  Users,
  FileCode2,
  SlidersHorizontal,
  CreditCard,
  ShieldCheck,
  LogOut,
  AlertCircle,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Maximize,
  FileText,
  UserPlus,
  Eye,
  Edit,
  Upload,
  Sparkles,
  Plus,
  Download,
  Edit2,
  Trash2,
  Mail,
  X,
  SkipForward,
  Building,
  Building2,
  ChevronDown,
  Clock,
  ShieldAlert,
  List,
  FolderOpen,
  Folder,
  ArrowRight,
  Search,
  ArrowLeft,
  ChevronRight,
} from "lucide-react";
import { getContratistas, saveContratistas, getProyectos, saveProyectos, getMandantes, saveMandantes, getPlantillas, savePlantillas, getReglas, saveReglas } from "../data/localStorageDb";
import { Contratista, Proyecto } from "../types";

const GLOBAL_MANDANTES = getMandantes();
const GLOBAL_PROYECTOS = getProyectos();
const GLOBAL_CONTRATISTAS = getContratistas();
const GLOBAL_PLANTILLA_DOCUMENTOS = getPlantillas();

function buildColaDocs(contratistas: Contratista[], proyectos: Proyecto[]) {
  const list: any[] = [];
  let qId = 1;
  contratistas.forEach(c => {
    c.documentos.forEach(d => {
      if (d.estado === 'revision') {
        const pId = c.proyectos[0] || 'costanera';
        const project = proyectos.find(p => p.id === pId);
        
        list.push({
          id: qId++,
          emp: c.nombre,
          rut: c.rut,
          proyecto: project ? project.nombre : 'Costanera Norte',
          title: d.nombre,
          type: d.categoria === 'Laboral' ? 'Liquidación mensual' : d.categoria === 'Tributario' ? 'Declaración mensual SII' : 'Certificación prevención',
          prio: d.nombre.toLowerCase().includes('contrato') || d.nombre.toLowerCase().includes('f30') ? 'Alta' : 'Media',
          tag: d.nombre.toLowerCase().includes('contrato') || d.nombre.toLowerCase().includes('f30') ? 'urgente' : 'normal',
          time: 'Hace 2 hr',
          timeSort: 2,
          hint: d.motivo || 'Verificar descuentos legales y base imponible del trabajador indicado.',
          historial: [
            {
              type: 'uploaded',
              who: c.nombre,
              when: 'Hace 2 hr',
              msg: 'Subido por portal contratista'
            }
          ]
        });
      }
    });
  });
  return list;
}

const initialColaDocs = buildColaDocs(GLOBAL_CONTRATISTAS, GLOBAL_PROYECTOS);

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


function ColaRevisionTab({ 
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

  const [filter, setFilter] = useState("all");
  const [sortField, setSortField] = useState("prio");
  const [localSelectedId, setLocalSelectedId] = useState<number | null>(null);
  const selectedId = selectedDocId !== undefined && selectedDocId !== null ? selectedDocId : localSelectedId;
  const setSelectedId = setSelectedDocId !== undefined && setSelectedDocId !== null ? setSelectedDocId : setLocalSelectedId;
  const [reviewTab, setReviewTab] = useState("documento");
  const [contextoAbierto, setContextoAbierto] = useState(true);
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
      setMotivoRechazoRapido('');
      setObservacionRechazo('');
      return;
    }
    setReviewed((r) => r + 1);

    // Update localStorageDb
    const list = getContratistas();
    const cObj = list.find(c => c.nombre === current.emp || c.rut === current.rut);
    if (cObj) {
      const docObj = cObj.documentos.find(d => d.nombre === current.title);
      if (docObj) {
        if (action === "approve") {
          docObj.estado = 'aprobado';
          docObj.revisor = 'Ana Díaz';
          docObj.subido = '13 Aug 2026';
          setAprobadosHoy((a) => a + 1);
        } else if (action === "reject") {
          const finalMotivo = motivoRechazoRapido || "Rechazado por auditoría";
          const finalObs = observacionRechazo ? `${finalMotivo}: ${observacionRechazo}` : finalMotivo;
          docObj.estado = 'rechazado';
          docObj.motivo = finalObs;
          docObj.observacion = finalObs;
          setRechazadosHoy((r) => r + 1);
        }
        saveContratistas(list);
      }
    }

    // Reset inputs
    setMotivoRechazoRapido('');
    setObservacionRechazo('');

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
      <div className="grid grid-cols-[320px_1fr] bg-white border border-cream3 rounded-xl overflow-hidden min-h-[640px] shadow-sm">
        {/* LEFT PANEL */}
        <div className="bg-[#faf9f8] border-r border-cream3 flex flex-col">
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
                className={`bg-white border rounded-[10px] p-3 cursor-pointer transition-all relative overflow-hidden ${selectedId === d.id ? "border-brown shadow-[0_0_0_2px_rgba(154,105,78,0.25)] bg-[#fdf9f7]" : "border-cream3 hover:bg-cream hover:border-gray-300"}`}
              >
                <div
                  className={`absolute left-0 top-0 bottom-0 w-[3px] ${d.prio === "Alta" ? "bg-[#c03030]" : d.prio === "Media" ? "bg-[#d4a000]" : "bg-cream3"}`}
                ></div>
                <div className="flex justify-between items-center mb-1.5 ml-1">
                  <span
                    className={`text-[10.5px] font-medium px-2 py-0.5 rounded-full ${d.tag === "urgente" ? "bg-[#fde8e8] text-[#a32d2d]" : d.tag === "nuevo" ? "bg-[#eaf3de] text-[#3b6d11]" : "bg-[#faeeda] text-[#854f0b]"}`}
                  >
                    {d.tag === "urgente"
                      ? "Urgente"
                      : d.tag === "nuevo"
                        ? "Nuevo"
                        : "Normal"}
                  </span>
                  <span className="text-[11px] text-gray-500">{d.time}</span>
                </div>
                <div className="text-[13.5px] font-medium text-navy mb-0.5 ml-1">
                  {d.title}
                </div>
                <div className="text-[11.5px] text-gray-500 truncate ml-1">
                  {d.emp} · {d.rut}
                </div>
                <div className="text-[11px] text-gray-400 mt-1.5 ml-1 flex items-center gap-1">
                  <Building size={11} /> {d.proyecto}
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
        <div className="flex flex-col bg-white overflow-hidden relative">
          {!current ? (
            <div className="flex-1 flex flex-col items-center justify-center text-gray-400 gap-3 px-8">
              <CheckCircle size={44} className="text-[#639922] opacity-80" />
              <p className="text-[14px] text-navy font-medium text-center">
                Cola al día — no hay documentos pendientes
              </p>
              {reviewed > 0 && (
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
            <div className="flex-1 flex flex-col h-full">
              <div className="p-3.5 px-5 border-b border-cream3 flex items-start justify-between gap-3">
                <div>
                  <div className="text-[15px] font-medium text-navy">
                    {current.title}
                  </div>
                  <div className="text-[12.5px] text-gray-500 mt-0.5">
                    {current.emp} · RUT {current.rut}
                  </div>
                </div>
                <span
                  className={`flex items-center gap-1.5 text-[11.5px] font-medium px-2.5 py-1 rounded-full whitespace-nowrap ${current.prio === "Alta" ? "bg-[#fde8e8] text-[#a32d2d]" : "bg-[#faeeda] text-[#854f0b]"}`}
                >
                  {current.prio === "Alta" ? <AlertCircle size={12} /> : null}{" "}
                  Prioridad {current.prio}
                </span>
              </div>
              <div className="flex items-center gap-2 px-5 pb-3 pt-2 border-b border-cream3">
                <span className="text-[11px] text-gray-500 whitespace-nowrap">
                  Revisado {reviewed} de {totalDocs}
                </span>
                <div className="flex-1 h-[3px] bg-cream3 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-brown rounded-full transition-all duration-500"
                    style={{
                      width: `${Math.round((reviewed / totalDocs) * 100)}%`,
                    }}
                  ></div>
                </div>
              </div>

              {(() => {
                const contractorObj = GLOBAL_CONTRATISTAS.find(c => c.nombre === current.emp || c.rut === current.rut);
                const workers = contractorObj?.trabajadores || [];
                const approvedW = workers.filter(w => w.estado === 'aprobado').length;
                
                const totalDocs = contractorObj?.documentos.length || 0;
                const approvedDocs = contractorObj?.documentos.filter(d => d.estado === 'aprobado').length || 0;
                const totalWorkers = workers.length;

                let associatedWorker = null;
                const isWorkerDoc = current.title.toLowerCase().includes('odi') || current.title.toLowerCase().includes('antecedentes') || current.title.toLowerCase().includes('sueldo');
                if (isWorkerDoc) {
                  associatedWorker = workers.find(w => w.estado !== 'aprobado') || workers[0];
                }

                const hasRejectedDocs = contractorObj?.documentos.some(d => d.estado === 'rechazado');
                let paymentLabel = 'Pago Habilitado';
                let paymentBadgeClass = 'b-green';
                if (hasRejectedDocs) {
                  paymentLabel = 'Pago Retenido';
                  paymentBadgeClass = 'b-red';
                }

                return (
                  <div className="border-b border-cream3 bg-[#faf9f8]">
                    <button
                      onClick={() => setContextoAbierto(!contextoAbierto)}
                      className="w-full flex items-center justify-between px-5 py-2.5 text-left focus:outline-none"
                    >
                      <span className="flex items-center gap-2 text-[12.5px] font-medium text-navy">
                        <Building size={14} className="text-brown" /> Contexto de Acreditación
                      </span>
                      <ChevronDown size={15} className={`text-gray-400 transition-transform ${contextoAbierto ? "rotate-180" : ""}`} />
                    </button>

                    {contextoAbierto && (
                      <div className="px-5 pb-3.5 flex flex-col gap-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-[13px] font-medium text-navy">{current.emp}</p>
                            <p className="text-[11.5px] text-gray-500">{current.proyecto}</p>
                          </div>
                          <button
                            onClick={() => onVerEmpresa?.({
                              empresa: current.emp,
                              rut: current.rut,
                              rol: "Contratista",
                              cumplimiento: hasRejectedDocs ? "Con Requisitos Pendientes" : "Acreditado",
                              iniciales: current.emp.split(" ").map((w: string) => w[0]).slice(0, 2).join("").toUpperCase(),
                            })}
                            className="text-[11.5px] text-brown font-medium hover:underline whitespace-nowrap"
                          >
                            Ver empresa completa
                          </button>
                        </div>

                        <div className="grid grid-cols-3 gap-2 text-center">
                          <div className="bg-white border border-cream3 rounded-lg p-2">
                            <div className="text-[14px] font-semibold text-navy">{approvedDocs} / {totalDocs}</div>
                            <div className="text-[10px] text-gray-500">Requisitos Empresa</div>
                          </div>
                          <div className="bg-white border border-cream3 rounded-lg p-2">
                            <div className="text-[14px] font-semibold text-navy">{approvedW} / {totalWorkers}</div>
                            <div className="text-[10px] text-gray-500">Personal Acreditado</div>
                          </div>
                          <div className="bg-white border border-cream3 rounded-lg p-2 flex flex-col justify-center items-center">
                            <span className={`badge ${paymentBadgeClass} text-[9px] font-bold px-1.5 py-0.5`}>{paymentLabel}</span>
                            <div className="text-[9px] text-gray-400 mt-1 font-sans">Estado de Pago</div>
                          </div>
                        </div>

                        <div className="bg-cream border border-cream3 rounded-lg p-2.5">
                          <div className="text-[11.5px] text-navy font-semibold mb-1">Impacto de la Acreditación:</div>
                          <p className="text-[11px] text-gray-600 leading-relaxed font-sans">
                            Este documento corresponde al requisito <strong>{current.title}</strong> {associatedWorker ? `del trabajador ${associatedWorker.nombre}` : 'de la empresa'}.
                          </p>
                          <p className="text-[11px] text-brown font-medium mt-1 font-sans">
                            💡 Al aprobar este documento, el requisito de {associatedWorker ? associatedWorker.nombre : current.emp} quedará cumplido.
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}

              <div className="px-5 border-b border-cream3 flex gap-0 shrink-0">
                <button
                  onClick={() => setReviewTab("documento")}
                  className={`text-[12.5px] px-3.5 py-2.5 border-b-2 cursor-pointer transition-colors ${reviewTab === "documento" ? "text-brown border-brown font-medium" : "text-gray-500 border-transparent hover:text-navy"}`}
                >
                  Documento
                </button>
                <button
                  onClick={() => setReviewTab("metadata")}
                  className={`text-[12.5px] px-3.5 py-2.5 border-b-2 cursor-pointer transition-colors ${reviewTab === "metadata" ? "text-brown border-brown font-medium" : "text-gray-500 border-transparent hover:text-navy"}`}
                >
                  Detalle
                </button>
                <button
                  onClick={() => setReviewTab("historial")}
                  className={`text-[12.5px] px-3.5 py-2.5 border-b-2 cursor-pointer transition-colors ${reviewTab === "historial" ? "text-brown border-brown font-medium" : "text-gray-500 border-transparent hover:text-navy"}`}
                >
                  Historial
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-4 px-5 flex flex-col gap-3.5">
                {reviewTab === "documento" && (
                  <>
                    <div className="bg-[#eeeade] border border-dashed border-[#dedad1] rounded-[10px] flex flex-col items-center justify-center min-h-[200px] gap-2 p-4">
                      <FileText
                        size={32}
                        className="text-brown opacity-70 mb-1"
                      />
                      <div className="text-[13px] font-medium text-navy text-center">
                        {current.title}.pdf
                      </div>
                      <div className="text-[11.5px] text-gray-500">
                        Vista previa del documento
                      </div>
                      <button className="flex items-center gap-1.5 mt-1 text-[12px] px-3.5 py-1.5 border border-cream3 rounded-lg bg-white hover:bg-gray-50 text-navy cursor-pointer transition-colors">
                        <Maximize size={13} /> Abrir en pantalla completa
                      </button>
                    </div>
                    {current.hint && (
                      <div className="bg-[#fdf5df] border border-[#e8c84a] rounded-lg p-2.5 px-3 flex gap-2 items-start mt-2">
                        <AlertTriangle
                          size={16}
                          className="text-[#854f0b] shrink-0 mt-0.5"
                        />
                        <span className="text-[12.5px] text-[#633806] leading-relaxed">
                          {current.hint}
                        </span>
                      </div>
                    )}
                  </>
                )}
                {reviewTab === "metadata" && (
                  <div className="grid grid-cols-2 gap-2.5">
                    {[
                      ["Proyecto", current.proyecto],
                      ["Empresa", current.emp],
                      ["RUT", current.rut],
                      ["Tipo de doc.", current.type],
                      ["Prioridad", current.prio],
                      ["Subido", current.time],
                    ].map(([l, v]) => (
                      <div
                        key={l as string}
                        className="bg-[#faf9f8] rounded-lg p-2.5 border border-cream3"
                      >
                        <div className="text-[11px] text-gray-500 mb-1">
                          {l}
                        </div>
                        <div className="text-[13px] font-medium text-navy">
                          {v}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {reviewTab === "historial" && (
                  <div className="flex flex-col gap-3">
                    {current.historial.map((h, i) => (
                      <div key={i} className="flex gap-2.5">
                        <div
                          className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${h.type === "approved" ? "bg-[#639922]" : h.type === "rejected" ? "bg-[#c03030]" : "bg-brown"}`}
                        ></div>
                        <div>
                          <div className="text-[12.5px] text-gray-600 leading-relaxed">
                            <strong className="text-navy font-medium">
                              {h.who}
                            </strong>{" "}
                            · {h.msg}
                          </div>
                          <div className="text-[11px] text-gray-400 mt-0.5">
                            {h.when}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="p-4 pt-3.5 px-5 border-t border-cream3 bg-[#faf9f8] mt-auto shrink-0">
                <div className="flex gap-2 mb-2.5">
                  <select 
                    value={motivoRechazoRapido}
                    onChange={(e) => setMotivoRechazoRapido(e.target.value)}
                    className="w-full text-[12.5px] border border-cream3 rounded-lg px-2.5 py-1.5 bg-white text-navy focus:outline-none focus:border-brown"
                  >
                    <option value="">Motivo de rechazo rápido…</option>
                    <option value="Documento ilegible">Documento ilegible</option>
                    <option value="Faltan firmas">Faltan firmas</option>
                    <option value="Fechas no coinciden">Fechas no coinciden</option>
                    <option value="Falta timbre institucional">Falta timbre institucional</option>
                    <option value="Período incorrecto">Período incorrecto</option>
                  </select>
                </div>
                <textarea
                  rows={2}
                  value={observacionRechazo}
                  onChange={(e) => setObservacionRechazo(e.target.value)}
                  placeholder="Observación adicional (opcional)…"
                  className="w-full text-[12.5px] border border-cream3 rounded-lg px-2.5 py-1.5 bg-white text-navy resize-none mb-3 focus:outline-none focus:border-brown placeholder-gray-400"
                ></textarea>
                <div className="flex gap-2">
                  <button
                    onClick={() => decide("approve")}
                    className="flex-1 flex items-center justify-center gap-1.5 text-[13px] font-medium py-2 rounded-lg border-none bg-[#3b6d11] text-white hover:bg-[#27500a] transition-colors"
                  >
                    <CheckCircle size={15} /> Aprobar
                  </button>
                  <button
                    onClick={() => decide("reject")}
                    className="flex-1 flex items-center justify-center gap-1.5 text-[13px] font-medium py-2 rounded-lg border-none bg-[#a32d2d] text-white hover:bg-[#791f1f] transition-colors"
                  >
                    <XCircle size={15} /> Rechazar
                  </button>
                  <button
                    onClick={() => decide("skip")}
                    className="flex items-center justify-center gap-1 text-[12px] px-3.5 py-2 border border-cream3 rounded-lg bg-white text-gray-500 hover:bg-gray-50 transition-colors"
                  >
                    <SkipForward size={14} /> Saltar
                  </button>
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

const DocumentoRow: React.FC<{ doc: any; onRevisar?: (doc: any) => void }> = ({ doc, onRevisar }) => {
  const [open, setOpen] = useState(false);
  const badgeMap: any = {
    aprobado: "b-green bg-green-100 text-green-800",
    rechazado: "b-red bg-red-100 text-red-800",
    por_vencer: "bg-yellow-100 text-yellow-800",
    pendiente: "b-gray bg-gray-100 text-gray-500",
  };
  const labelMap: any = {
    aprobado: "Aprobado",
    rechazado: "Rechazado",
    por_vencer: "Por vencer",
    pendiente: "Pendiente",
  };
  return (
    <div className="border border-cream3 rounded-xl overflow-hidden">
      <div
        onClick={() => setOpen(!open)}
        className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-cream2 transition-colors"
      >
        <div className="flex items-center gap-2.5">
          <FileText size={16} className="text-gray-400 shrink-0" />
          <span className="text-[13.5px] font-medium text-navy">
            {doc.nombre}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className={`badge text-[11px] ${badgeMap[doc.estado]}`}>
            {labelMap[doc.estado]}
          </span>
          <button
            onClick={(ev) => {
              ev.stopPropagation();
              onRevisar?.(doc);
            }}
            className="btn btn-ghost btn-sm shrink-0"
          >
            <Eye size={13} className="mr-1" /> Revisar
          </button>
          <ChevronDown
            size={14}
            className={`text-gray-400 transition-transform ${open ? "rotate-180" : ""}`}
          />
        </div>
      </div>
      {open && (
        <div className="px-4 pb-3 pt-1 bg-cream2 border-t border-cream3 text-[12.5px] text-gray-500 flex flex-col gap-1.5">
          <p>
            <span className="font-medium text-navy">Subido:</span> {doc.subido}
          </p>
          <p>
            <span className="font-medium text-navy">Vence:</span> {doc.vence}
          </p>
          {doc.obs && (
            <p className="text-red-500">
              <span className="font-medium">Observación:</span> {doc.obs}
            </p>
          )}
          <div className="flex gap-2 mt-2">
            <button className="btn btn-ghost btn-sm text-[12px]">
              <Eye size={12} /> Ver documento
            </button>
            <button className="btn btn-ghost btn-sm text-[12px]">
              <Download size={12} /> Descargar
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

const getDocumentosEmpresa = (cliente: any) => {
  const cObj = GLOBAL_CONTRATISTAS.find(c => 
    c.nombre === cliente?.empresa || 
    c.nombre === cliente?.nombre || 
    c.id === cliente?.id
  ) || GLOBAL_CONTRATISTAS[0];
  
  return cObj.documentos.map(d => ({
    nombre: d.nombre,
    estado: d.estado,
    vence: d.vencimiento,
    subido: d.subido || "05 May 2026",
    obs: d.motivo
  }));
};

const ProyectoRow: React.FC<{ proyecto: any; contractorId?: string }> = ({ proyecto, contractorId }) => {
  const [open, setOpen] = useState(false);
  const [tabProy, setTabProy] = useState("trabajadores");

  const cObj = GLOBAL_CONTRATISTAS.find(c => 
    c.id === contractorId || 
    c.nombre === proyecto?.mandante || 
    c.nombre.toLowerCase().includes(proyecto?.mandante?.toLowerCase() || "")
  ) || GLOBAL_CONTRATISTAS.find(c => c.trabajadores && c.trabajadores.length > 0) || GLOBAL_CONTRATISTAS[1];

  const realProjectName = proyecto.nombre.replace("Proyecto ", "").trim();
  const trabajadores = (cObj.trabajadores || []).filter(t => t.faena === realProjectName);

  const documentosProyecto = cObj.documentos.map(d => ({
    nombre: d.nombre,
    estado: d.estado,
    vence: d.vencimiento,
    subido: d.subido || "05 May 2026",
  }));

  const badgeEstado: any = {
    aprobado: "bg-green-100 text-green-800",
    rechazado: "bg-red-100 text-red-800",
    por_vencer: "bg-yellow-100 text-yellow-800",
    pendiente: "bg-gray-100 text-gray-500",
  };
  const labelEstado: any = {
    aprobado: "Aprobado",
    rechazado: "Rechazado",
    por_vencer: "Por vencer",
    pendiente: "Pendiente",
  };

  return (
    <div className="border border-cream3 rounded-xl overflow-hidden mb-3 last:mb-0">
      {/* Header clickeable */}
      <div
        onClick={() => setOpen(!open)}
        className="flex items-center justify-between p-4 cursor-pointer hover:bg-cream2 transition-colors bg-white"
      >
        <div>
          <p className="font-semibold text-navy text-[14px]">
            {proyecto.nombre}
          </p>
          <p className="text-[12.5px] text-gray-400 mt-0.5">
            {proyecto.mandante} · {trabajadores.length} trabajadores
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`badge ${proyecto.estado}`}>{proyecto.pct}%</span>
          <ChevronDown
            size={14}
            className={`text-gray-400 transition-transform ${open ? "rotate-180" : ""}`}
          />
        </div>
      </div>

      {open && (
        <div className="border-t border-cream3 bg-cream2">
          {/* Stats rápidas */}
          <div className="grid grid-cols-3 divide-x divide-cream3 border-b border-cream3">
            {[
              { label: "Trabajadores", val: trabajadores.length },
              {
                label: "Docs aprobados",
                val: documentosProyecto.filter((d) => d.estado === "aprobado")
                  .length,
              },
              {
                label: "Estado pago",
                val: proyecto.pct >= 80 ? "✓ Habilitado" : "✗ Retenido",
              },
            ].map((s) => (
              <div key={s.label} className="text-center py-3 bg-white">
                <p className="text-[15px] font-semibold text-navy">{s.val}</p>
                <p className="text-[11.5px] text-gray-400">{s.label}</p>
              </div>
            ))}
          </div>

          {/* Tabs internos */}
          <div className="flex border-b border-cream3 px-3 bg-white pt-1">
            {["trabajadores", "documentos"].map((t) => (
              <button
                key={t}
                onClick={() => setTabProy(t)}
                className={`px-4 py-2 text-[12.5px] capitalize border-b-2 transition-colors ${tabProy === t ? "border-brown text-brown font-semibold" : "border-transparent text-gray-400 hover:text-navy"}`}
              >
                {t === "trabajadores"
                  ? `Trabajadores (${trabajadores.length})`
                  : `Documentos (${documentosProyecto.length})`}
              </button>
            ))}
          </div>

          {/* Tab trabajadores */}
          {tabProy === "trabajadores" && (
            <div className="flex flex-col divide-y divide-cream3 px-4 bg-white">
              {trabajadores.map((t, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between py-2.5"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-full bg-navy text-cream flex items-center justify-center text-[11px] font-semibold shrink-0">
                      {t.nombre
                        .split(" ")
                        .map((n) => n[0])
                        .join("")
                        .slice(0, 2)}
                    </div>
                    <div>
                      <p className="text-[13px] font-medium text-navy">
                        {t.nombre}
                      </p>
                      <p className="text-[11.5px] text-gray-400">{t.rut}</p>
                    </div>
                  </div>
                  <span
                    className={`badge text-[11px] ${badgeEstado[t.estado]}`}
                  >
                    {labelEstado[t.estado]}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Tab documentos */}
          {tabProy === "documentos" && (
            <div className="flex flex-col gap-2 p-3 bg-cream2">
              {documentosProyecto.map((doc, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between bg-white rounded-lg px-3 py-2.5 border border-cream3"
                >
                  <div className="flex items-center gap-2">
                    <FileText size={14} className="text-gray-400 shrink-0" />
                    <div>
                      <p className="text-[13px] font-medium text-navy">
                        {doc.nombre}
                      </p>
                      <p className="text-[11.5px] text-gray-400">
                        Vence: {doc.vence}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`badge text-[11px] ${badgeEstado[doc.estado]}`}
                    >
                      {labelEstado[doc.estado]}
                    </span>
                    <button className="text-gray-400 hover:text-navy">
                      <Eye size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Info adicional */}
          <div className="px-4 py-3 border-t border-cream3 flex justify-between text-[12px] text-gray-400 bg-white">
            <span>Inicio: 01 Ene 2026</span>
            <span>Cierre: 31 Dic 2026</span>
            <button className="text-brown hover:underline font-medium">
              Ver proyecto completo →
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

const PLANTILLAS = GLOBAL_PLANTILLA_DOCUMENTOS.map((p, idx) => ({
  id: idx + 1,
  nombre: p.nombre,
  categoria: p.categoria,
  tipo: idx % 2 === 0 ? "gratuita" : "upsell",
  actualizacion: "10 May 2026",
  descargas: idx % 2 === 0 ? "342 descargas" : "85 solicitudes",
  descripcion: p.nombre.toLowerCase().includes('contrato') 
    ? "Formato estándar de contrato individual para trabajadores contratados por obra o faena, con cláusulas legales al día." 
    : "Matriz de identificación de peligros y evaluación de riesgos. Requiere conocimiento técnico especializado."
}));

type Regla = {
  id: number;
  documento: string;
  diasVigencia: number;
  alertaDias: number;
  criticidad: "bloquea_pago" | "bloquea_acceso" | "advertencia";
  isNew?: boolean;
};

type LogEntry = {
  id: number;
  accion: "aprobacion" | "rechazo" | "subida" | "acceso_fallido" | "alerta";
  actor: string;
  rol: "Revisor" | "Contratista" | "Sistema Automático" | "Desconocido";
  empresa: string;
  proyecto: string;
  detalle: string;
  fecha: string;
  resultado: "exitoso" | "bloqueado" | "informativo";
  ip?: string;
};

const ACTIVIDAD_RECIENTE: any[] = [];
let actId = 1;

const cTecnico = GLOBAL_CONTRATISTAS.find(c => c.id === 'tecnicosur');
if (cTecnico) {
  ACTIVIDAD_RECIENTE.push({
    id: actId++,
    evento: 'Registro',
    empresa: cTecnico.nombre,
    rut: cTecnico.rut,
    documento: 'Cuenta nueva',
    categoria: '—',
    hora: '08:55',
    fecha: '04 Jun 2026',
    estado: 'registrado',
    revisor: '—',
    proyecto: 'Torre Mackenna'
  });
}

GLOBAL_CONTRATISTAS.forEach(c => {
  c.documentos.forEach(d => {
    const pId = c.proyectos[0] || 'costanera';
    const project = GLOBAL_PROYECTOS.find(p => p.id === pId);
    const proyectoNombre = project ? project.nombre : 'Costanera Norte';

    let evento = 'Doc subido';
    let revisor = '—';
    if (d.estado === 'aprobado') {
      evento = 'Aprobado';
      revisor = 'Ana Díaz';
    } else if (d.estado === 'rechazado') {
      evento = 'Rechazado';
      revisor = 'Carlos Reyes';
    }

    if (d.estado === 'revision' || d.estado === 'aprobado' || d.estado === 'rechazado') {
      ACTIVIDAD_RECIENTE.push({
        id: actId++,
        evento,
        empresa: c.nombre,
        rut: c.rut,
        documento: d.nombre,
        categoria: d.categoria,
        hora: d.estado === 'revision' ? '08:40' : d.estado === 'aprobado' ? '09:35' : '09:18',
        fecha: '04 Jun 2026',
        estado: d.estado,
        revisor,
        proyecto: proyectoNombre,
        motivo: d.motivo || d.observacion
      });
    }
  });
});

const ALERTAS_DASHBOARD = [
  {
    id: 1,
    tipo: "urgente",
    icono: AlertCircle,
    titulo: "3 documentos llevan más de 24 hrs sin revisión",
    detalle: "Costanera Norte y Torre Mackenna",
    doc: { documento: "Liquidación Mayo 2026", empresa: "Servicios Norte", rut: "76.111.222-3", categoria: "Laboral", proyecto: "Costanera Norte", fecha: "16-06-2026", hora: "09:42", estado: "revision", revisor: "—", evento: "Doc subido" },
  },
  {
    id: 2,
    tipo: "bloqueo",
    icono: XCircle,
    titulo: "1 empresa con documentos rechazados",
    detalle: "No cumple requisitos mínimos de acceso a faena",
    doc: { documento: "Registro Mutual ACHS", empresa: "TécnicoSur SpA", rut: "77.321.654-1", categoria: "Prevención", proyecto: "Torre Mackenna", fecha: "12-06-2026", hora: "08:10", estado: "rechazado", revisor: "Ana Díaz", evento: "Rechazado", motivo: "la firma del representante legal es ilegible en página 2" },
  },
  {
    id: 3,
    tipo: "por_vencer",
    icono: Clock,
    titulo: "Certificado ODI de TécnicoSur vence próximamente",
    detalle: "Proyecto Torre Mackenna",
    doc: { documento: "Certificado ODI", empresa: "TécnicoSur SpA", rut: "77.321.654-1", categoria: "Prevención", proyecto: "Torre Mackenna", fecha: "19-06-2026", hora: "-", estado: "revision", revisor: "—", evento: "Por vencer" },
  },
];

export default function AdminPortal() {
  const GLOBAL_MANDANTES = getMandantes();
  const GLOBAL_PROYECTOS = getProyectos();
  const GLOBAL_CONTRATISTAS = getContratistas();
  const GLOBAL_PLANTILLA_DOCUMENTOS = getPlantillas();

  const ACTIVIDAD_RECIENTE: any[] = [];
  let actId = 1;
  GLOBAL_CONTRATISTAS.forEach(c => {
    c.documentos.forEach(d => {
      if (d.estado === 'aprobado') {
        ACTIVIDAD_RECIENTE.push({
          id: actId++,
          empresa: c.nombre,
          documento: d.nombre,
          fecha: 'Hoy',
          estado: 'Aprobado',
          detalle: `Revisado por ${d.revisor || 'Sistema'}`
        });
      } else if (d.estado === 'rechazado') {
        ACTIVIDAD_RECIENTE.push({
          id: actId++,
          empresa: c.nombre,
          documento: d.nombre,
          fecha: 'Hoy',
          estado: 'Rechazado',
          detalle: d.motivo || 'Rechazado por auditoría'
        });
      }
    });
  });

  const [activeTab, setActiveTab] = useState("dashboard");
  const [aprobadosHoy, setAprobadosHoy] = useState(2);
  const [rechazadosHoy, setRechazadosHoy] = useState(1);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'warning' } | null>(null);
  const showToast = (message: string, type: 'success' | 'error' | 'warning' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };
  const [actividadSeleccionada, setActividadSeleccionada] = useState<typeof ACTIVIDAD_RECIENTE[0] | null>(null);
  const [selectedDoc, setSelectedDoc] = useState<any>(null);
  const [selectedDocId, setSelectedDocId] = useState<number | null>(null);
  const [showNotif, setShowNotif] = useState(false);
  const [clienteSeleccionado, setClienteSeleccionado] = useState<any>(null);
  const [mandanteActivo, setMandanteActivo] = useState<any>(null);
  const [proyectoActivo, setProyectoActivo] = useState<any>(null);
  const [tabCliente, setTabCliente] = useState("documentos");
  const [busquedaDoc, setBusquedaDoc] = useState("");
  const [filtroEstado, setFiltroEstado] = useState("todos");
  const [ordenDoc, setOrdenDoc] = useState("vencimiento");
  const [filtroActividad, setFiltroActividad] = useState("todos");
  const [busquedaGlobal, setBusquedaGlobal] = useState("");
  const [busquedaAbierta, setBusquedaAbierta] = useState(false);
  const [activeFilterPlantillas, setActiveFilterPlantillas] = useState("Todas");
  const [busquedaPlantilla, setBusquedaPlantilla] = useState("");
  const [showSubirPlantillaModal, setShowSubirPlantillaModal] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState("");
  const [newTemplateCategory, setNewTemplateCategory] = useState("Laboral");

  const handleAddTemplate = () => {
    if (!newTemplateName.trim()) return;
    const newId = 'p_' + Date.now();
    const newTemplate = {
      id: newId,
      nombre: newTemplateName,
      categoria: newTemplateCategory,
      frecuencia: 'Única'
    };
    const list = getPlantillas();
    list.push(newTemplate);
    savePlantillas(list);
    
    setNewTemplateName("");
    setNewTemplateCategory("Laboral");
    setShowSubirPlantillaModal(false);
  };
  const [reglas, setReglas] = useState<Regla[]>(() => getReglas());

  const [auditoriaLogs] = useState<LogEntry[]>([
    { id: 1, accion: "aprobacion", actor: "Ana Díaz", rol: "Revisor", empresa: "Lagos y Cía", proyecto: "Costanera Norte", detalle: "F30 SII Abril 2026", fecha: "18 May · 09:35", resultado: "exitoso" },
    { id: 2, accion: "rechazo", actor: "Carlos Martínez", rol: "Revisor", empresa: "Constructora Vélez", proyecto: "Minera Los Andes", detalle: "Registro mutual ACHS (Ilegible)", fecha: "18 May · 09:12", resultado: "exitoso" },
    { id: 3, accion: "subida", actor: "Jorge Morales", rol: "Contratista", empresa: "Servicios Norte Ltda.", proyecto: "", detalle: "Liquidación Mayo 2026", fecha: "18 May · 08:45", resultado: "informativo", ip: "190.16.22.4" },
    { id: 4, accion: "acceso_fallido", actor: "Desconocido", rol: "Desconocido", empresa: "N/A", proyecto: "", detalle: "Login fallido (Credenciales inválidas)", fecha: "18 May · 03:22", resultado: "bloqueado" },
    { id: 5, accion: "alerta", actor: "Sistema Automático", rol: "Sistema Automático", empresa: "Constructora Vélez", proyecto: "", detalle: "3 Documentos Vencidos - Bloqueo de Acceso", fecha: "17 May · 23:59", resultado: "informativo" }
  ]);
  const [filtroAccionLog, setFiltroAccionLog] = useState("Todas las Acciones");
  const [filtroActorLog, setFiltroActorLog] = useState("Todos los Actores");
  const [filtroFechaLog, setFiltroFechaLog] = useState("");
  const [busquedaLog, setBusquedaLog] = useState("");
  const [expandedLogId, setExpandedLogId] = useState<number | null>(null);

  const [showInvitarModal, setShowInvitarModal] = useState(false);
  const [invitacionEnviada, setInvitacionEnviada] = useState(false);
  const [formInvitacion, setFormInvitacion] = useState({
    nombre: "",
    empresa: "",
    correo: "",
    industria: "",
  });

  const handleSelectDoc = (doc: any) => {
    setSelectedDoc(doc);
  };

  const EMPRESAS_MANDANTES = GLOBAL_MANDANTES.map(m => ({
    empresa: m.nombre,
    rut: m.rut,
    rol: "Mandante",
    cumplimiento: "N/A",
    iniciales: m.nombre.split(" ").map(n => n[0]).join("").substring(0, 2),
    estado: "Activo"
  }));

  const EMPRESAS_CONTRATISTAS = GLOBAL_CONTRATISTAS.map(c => {
    let cumplimiento = "100% Aprobado";
    const hasRechazados = c.documentos.some(d => d.estado === 'rechazado');
    const hasPorVencer = c.documentos.some(d => d.estado === 'por_vencer');
    if (hasRechazados) {
      cumplimiento = "Con Docs. Rechazados";
    } else if (hasPorVencer) {
      cumplimiento = "Con Docs. por Vencer";
    }

    return {
      empresa: c.nombre,
      rut: c.rut,
      rol: c.isNew ? "Contratista (Nuevo)" : "Contratista",
      cumplimiento,
      iniciales: c.nombre.split(" ").map(n => n[0]).join("").substring(0, 2),
      proyectos: c.proyectos.map(pId => GLOBAL_PROYECTOS.find(p => p.id === pId)?.nombre || pId),
      estado: "Activo"
    };
  });

  const ARBOL_MANDANTES = GLOBAL_MANDANTES.map(m => {
    const proyectos = GLOBAL_PROYECTOS.filter(p => p.mandanteId === m.id).map(p => {
      const empresas = GLOBAL_CONTRATISTAS.filter(c => c.proyectos.includes(p.id)).map(c => {
        let cumplimiento = "100% Aprobado";
        const hasRechazados = c.documentos.some(d => d.estado === 'rechazado');
        const hasPorVencer = c.documentos.some(d => d.estado === 'por_vencer');
        if (hasRechazados) {
          cumplimiento = "Con Docs. Rechazados";
        } else if (hasPorVencer) {
          cumplimiento = "Con Docs. por Vencer";
        }
        
        return {
          empresa: c.nombre,
          rut: c.rut,
          rol: "Contratista",
          cumplimiento,
          iniciales: c.nombre.split(" ").map(n => n[0]).join("").substring(0, 2),
        };
      });

      return {
        nombre: p.nombre,
        pendientes: p.id === 'costanera' ? 3 : p.id === 'solar' ? 1 : 0,
        urgentes: p.id === 'costanera' ? 3 : p.id === 'solar' ? 1 : 0,
        badge: p.id === 'costanera' || p.id === 'solar' ? "b-red" : "b-green",
        badgeLabel: p.id === 'costanera' ? "3 urgentes" : p.id === 'solar' ? "1 urgente" : "Al día",
        empresas
      };
    });

    return {
      empresa: m.nombre,
      rut: m.rut,
      proyectos
    };
  });

  const mandantesConBloqueo = ARBOL_MANDANTES.filter(m =>
    m.proyectos.some(p => p.urgentes > 0)
  ).length;

  const contratistasConVencidos = EMPRESAS_CONTRATISTAS.filter(c =>
    c.cumplimiento?.includes("Vencido")
  ).length;

  const hayAccesosFallidos = auditoriaLogs.some((log: any) =>
    log.accion?.toLowerCase().includes("fallido") || log.accion?.toLowerCase().includes("error")
  );

  const pendingDocsCount = buildColaDocs(GLOBAL_CONTRATISTAS, GLOBAL_PROYECTOS).length;

  const menuItems: Array<{ id: string; label: string; icon: any; badge?: number; section?: string; badgeTipo?: string; badgePunto?: boolean }> = [
    { id: "dashboard", label: "Inicio", icon: LayoutDashboard },
    { id: "cola", label: "Cola de Revisión", icon: ClipboardList, badge: pendingDocsCount },
    { id: "acreditaciones", label: "Acreditaciones", icon: ShieldCheck, section: "Operación" },
    { id: "mandantes", label: "Mandantes", icon: Building2, section: "Directorios" },
    { id: "contratistas", label: "Contratistas", icon: Users },
    { id: "plantillas", label: "Plantillas", icon: FileCode2, section: "Configuración" },
    { id: "reglas", label: "Reglas vigencia", icon: SlidersHorizontal },
    { id: "facturacion", label: "Facturación", icon: CreditCard },
    { id: "auditoria", label: "Auditoría", icon: ShieldAlert, badgePunto: hayAccesosFallidos, badgeTipo: "alerta" },
  ];

  const REVISORES = [
    { nombre: "Ana Díaz", estado: "Online", revisados: 14 },
    { nombre: "Carlos Reyes", estado: "Online", revisados: 9 },
    { nombre: "María Pérez", estado: "Offline", revisados: 0 },
  ];

  const PROYECTOS_BUSQUEDA = GLOBAL_PROYECTOS.map(p => {
    const mandante = GLOBAL_MANDANTES.find(m => m.id === p.mandanteId);
    return {
      nombre: p.nombre,
      mandante: mandante ? mandante.nombre : "Mandante"
    };
  });

  const indiceBusqueda = [
    ...EMPRESAS_MANDANTES.map(e => ({ tipo: "empresa", label: e.empresa, sub: e.rol, data: e })),
    ...EMPRESAS_CONTRATISTAS.map(e => ({ tipo: "empresa", label: e.empresa, sub: e.rol, data: e })),
    ...ACTIVIDAD_RECIENTE.map(a => ({ tipo: "documento", label: a.documento, sub: `${a.empresa} · ${a.estado}`, data: a })),
    ...PROYECTOS_BUSQUEDA.map(p => ({ tipo: "proyecto", label: p.nombre, sub: p.mandante, data: p })),
    ...REVISORES.map(r => ({ tipo: "revisor", label: r.nombre, sub: r.estado, data: r })),
  ];

  const resultadosBusqueda = busquedaGlobal.trim().length === 0
    ? []
    : indiceBusqueda.filter(item =>
        item.label.toLowerCase().includes(busquedaGlobal.toLowerCase()) ||
        item.sub?.toLowerCase().includes(busquedaGlobal.toLowerCase())
      );

  const resultadosPorTipo = {
    empresa: resultadosBusqueda.filter(r => r.tipo === "empresa"),
    documento: resultadosBusqueda.filter(r => r.tipo === "documento"),
    proyecto: resultadosBusqueda.filter(r => r.tipo === "proyecto"),
    revisor: resultadosBusqueda.filter(r => r.tipo === "revisor"),
  };

  return (
    <div className="h-screen flex flex-col font-sans bg-cream2 text-navy">
      {/* TOPBAR */}
      <div className="topbar">
        <div className="logo flex-shrink-0 flex items-center">
          Acre<b>dita</b>
          <span className="text-[12.1px] bg-brown/30 text-brown px-2 py-0.5 rounded-lg ml-2 tracking-[1px]">
            ADMIN
          </span>
        </div>

        {/* Buscador Global */}
        <div className="relative flex-1 max-w-[380px] mx-4">
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={busquedaGlobal}
              onChange={(e) => { setBusquedaGlobal(e.target.value); setBusquedaAbierta(true); }}
              onFocus={() => setBusquedaAbierta(true)}
              placeholder="Buscar empresas, documentos, proyectos..."
              className="w-full text-[13px] bg-white/10 text-cream placeholder-gray-400 rounded-lg pl-9 pr-3 py-2 border border-white/10 focus:outline-none focus:border-white/30 focus:bg-white/15 transition-colors"
            />
          </div>

          {busquedaAbierta && (
            <div className="fixed inset-0 z-[349]" onClick={() => setBusquedaAbierta(false)} />
          )}

          {busquedaAbierta && busquedaGlobal.trim().length > 0 && (
            <div className="absolute left-0 top-11 w-full bg-white rounded-xl shadow-2xl border border-cream3 z-[350] max-h-[420px] overflow-y-auto">
              {resultadosBusqueda.length === 0 ? (
                <div className="p-4 text-center text-[12.5px] text-gray-400">
                  Sin resultados para "{busquedaGlobal}"
                </div>
              ) : (
                <>
                  {resultadosPorTipo.empresa.length > 0 && (
                    <div className="p-2">
                      <p className="text-[10.5px] uppercase tracking-wider text-gray-400 font-semibold px-2 py-1">Empresas</p>
                      {resultadosPorTipo.empresa.map((r, i) => (
                        <div
                          key={i}
                          onClick={() => { setClienteSeleccionado(r.data); setBusquedaAbierta(false); setBusquedaGlobal(""); }}
                          className="flex items-center justify-between px-2.5 py-2 rounded-lg hover:bg-cream cursor-pointer"
                        >
                          <span className="text-[13px] text-navy">{r.label}</span>
                          <span className="text-[11px] text-gray-400">{r.sub}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {resultadosPorTipo.documento.length > 0 && (
                    <div className="p-2 border-t border-cream3">
                      <p className="text-[10.5px] uppercase tracking-wider text-gray-400 font-semibold px-2 py-1">Documentos</p>
                      {resultadosPorTipo.documento.map((r, i) => (
                        <div
                          key={i}
                          onClick={() => { setActividadSeleccionada(r.data); setBusquedaAbierta(false); setBusquedaGlobal(""); }}
                          className="flex items-center justify-between px-2.5 py-2 rounded-lg hover:bg-cream cursor-pointer"
                        >
                          <span className="text-[13px] text-navy">{r.label}</span>
                          <span className="text-[11px] text-gray-400">{r.sub}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {resultadosPorTipo.proyecto.length > 0 && (
                    <div className="p-2 border-t border-cream3">
                      <p className="text-[10.5px] uppercase tracking-wider text-gray-400 font-semibold px-2 py-1">Proyectos</p>
                      {resultadosPorTipo.proyecto.map((r, i) => (
                        <div
                          key={i}
                          className="flex items-center justify-between px-2.5 py-2 rounded-lg hover:bg-cream cursor-pointer"
                        >
                          <span className="text-[13px] text-navy">{r.label}</span>
                          <span className="text-[11px] text-gray-400">{r.sub}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {resultadosPorTipo.revisor.length > 0 && (
                    <div className="p-2 border-t border-cream3">
                      <p className="text-[10.5px] uppercase tracking-wider text-gray-400 font-semibold px-2 py-1">Revisores</p>
                      {resultadosPorTipo.revisor.map((r, i) => (
                        <div
                          key={i}
                          className="flex items-center justify-between px-2.5 py-2 rounded-lg hover:bg-cream cursor-pointer"
                        >
                          <span className="text-[13px] text-navy">{r.label}</span>
                          <span className="text-[11px] text-gray-400">{r.sub}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center gap-4">
          <div className="relative">
            <button
              onClick={() => setShowNotif(!showNotif)}
              className="flex items-center justify-center relative w-8 h-8 rounded-md bg-white/10 text-cream hover:bg-white/20 transition-colors"
            >
              <Bell size={18} />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-[#c03030] rounded-full border border-navy"></span>
            </button>

            {showNotif && (
              <div
                className="fixed inset-0 z-[299]"
                onClick={() => setShowNotif(false)}
              />
            )}

            {showNotif && (
              <div className="absolute right-0 top-11 w-[340px] bg-white rounded-xl shadow-2xl border border-cream3 z-[300]">
                {/* Header */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-cream3">
                  <span className="font-semibold text-navy text-[15px]">
                    Notificaciones
                  </span>
                  <span className="badge b-red">2 urgentes</span>
                </div>

                {/* Items */}
                <div className="flex flex-col divide-y divide-cream3 max-h-[400px] overflow-y-auto">
                  <div className="flex items-start gap-3 px-4 py-3 bg-red-50 hover:bg-red-100/60 transition-colors cursor-pointer">
                    <AlertCircle
                      size={18}
                      className="text-red-500 shrink-0 mt-0.5"
                    />
                    <div>
                      <p className="text-[13.8px] font-semibold text-red-700">
                        3 documentos sin revisar +24hrs
                      </p>
                      <p className="text-[12.5px] text-red-500 mt-0.5">
                        Requieren atención urgente — cola de revisión
                      </p>
                      <p className="text-[11.5px] text-gray-400 mt-1">
                        Hace 2 horas
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 px-4 py-3 bg-yellow-50 hover:bg-yellow-100/60 transition-colors cursor-pointer">
                    <AlertTriangle
                      size={18}
                      className="text-yellow-600 shrink-0 mt-0.5"
                    />
                    <div>
                      <p className="text-[13.8px] font-semibold text-yellow-800">
                        Plantilla "F30 SII" desactualizada
                      </p>
                      <p className="text-[12.5px] text-yellow-700 mt-0.5">
                        Revisar antes del 31 de mayo — Gestión de plantillas
                      </p>
                      <p className="text-[11.5px] text-gray-400 mt-1">
                        Hace 5 horas
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 px-4 py-3 hover:bg-cream2 transition-colors cursor-pointer">
                    <CheckCircle
                      size={18}
                      className="text-green-500 shrink-0 mt-0.5"
                    />
                    <div>
                      <p className="text-[13.8px] font-medium text-navy">
                        Eléctrica Sur aprobó contrato de trabajo
                      </p>
                      <p className="text-[11.5px] text-gray-400 mt-1">
                        Hace 6 horas
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 px-4 py-3 hover:bg-cream2 transition-colors cursor-pointer">
                    <Users
                      size={18}
                      className="text-blue-500 shrink-0 mt-0.5"
                    />
                    <div>
                      <p className="text-[13.8px] font-medium text-navy">
                        TécnicoSur SpA se registró en la plataforma
                      </p>
                      <p className="text-[11.5px] text-gray-400 mt-1">
                        Hace 8 horas
                      </p>
                    </div>
                  </div>
                </div>

                {/* Footer */}
                <div className="px-4 py-2.5 border-t border-cream3 text-center">
                  <button
                    onClick={() => setShowNotif(false)}
                    className="text-[13px] text-brown hover:underline font-medium"
                  >
                    Marcar todas como leídas
                  </button>
                </div>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity">
            <div className="w-8 h-8 rounded-full bg-brown text-[var(--brown-text,white)] flex items-center justify-center text-[13.2px] font-semibold">
              AD
            </div>
            <span className="text-[14.3px] text-cream">
              Revisora · Ana Díaz
            </span>
          </div>
        </div>
      </div>

      <div className="layout">
        {/* SIDEBAR */}
        <div className="sidebar">
          <div className="sb-org">
            <div className="sb-org-name">Panel Administración</div>
            <div className="sb-org-sub">Acredita · Equipo revisor</div>
          </div>

          <div className="sb-label">Principal</div>
          {menuItems.map((item, index) => (
            <React.Fragment key={item.id}>
              {item.section && (
                <div className="sb-label mt-2">{item.section}</div>
              )}
              <button
                onClick={() => setActiveTab(item.id)}
                className={`sb-item w-full flex text-left ${activeTab === item.id ? "active" : ""}`}
              >
                <item.icon size={18} className="shrink-0" />
                <span className="flex-1">{item.label}</span>
                {item.badge !== undefined && (
                  <span className={`sb-badge ${item.badgeTipo === "alerta" ? "sb-badge-alerta" : ""}`}>
                    {item.badge}
                  </span>
                )}
                {item.badgePunto && (
                  <span className="w-2 h-2 rounded-full bg-[#c03030] shrink-0" title="Requiere atención" />
                )}
              </button>
            </React.Fragment>
          ))}
<div className="sb-bottom">
            <button className="sb-item w-full flex text-left mt-auto">
              <LogOut size={18} /> Cerrar sesión
            </button>
          </div>
        </div>

        {/* MAIN CONTENT */}
        <div className="main">
          {/* DASHBOARD TAB */}
          {activeTab === "dashboard" && (
            <div className="fade-in space-y-6">
              <div className="page-header">
                <div>
                  <h2 className="page-title text-navy font-bold text-[22px]">Centro de Operaciones</h2>
                  <p className="page-sub text-gray-500 text-[13.5px]">
                    Lunes 18 de mayo 2026 · Monitoreo y control de Acreditaciones
                  </p>
                </div>
              </div>

              {(() => {
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
                              onClick={() => showToast('Abriendo vista de seguimiento...')}
                              className="text-[12px] text-brown font-semibold hover:underline flex items-center gap-1"
                            >
                              Ver todos los seguimientos de corrección <ChevronRight size={14} />
                            </button>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-6">
                        <div className="card border border-cream3 shadow-sm bg-white font-sans">
                          <div className="mb-3">
                            <h3 className="section-title mb-0 text-navy font-bold text-[16px] flex items-center gap-2">
                              <Building2 size={18} className="text-brown" />
                              CASOS EN SEGUIMIENTO
                            </h3>
                            <p className="text-xs text-gray-500 mt-0.5">Requieren atención humana y contacto con la empresa contratista.</p>
                            <span className="text-[10px] text-gray-400 italic block mt-1">* Concepto operacional (Dato mock de simulación)</span>
                          </div>

                          <div className="divide-y divide-cream">
                            {mockCasosSeguimiento.map(caso => (
                              <div key={caso.id} className="py-2.5 flex items-start justify-between gap-3 text-[12.5px]">
                                <div className="flex-1">
                                  <div className="font-semibold text-navy">{caso.empresa}</div>
                                  <div className="text-[11.5px] text-gray-600 font-medium">{caso.detalle}</div>
                                  <div className="text-[11px] text-gray-400 mt-0.5">{caso.info}</div>
                                </div>
                                <button
                                  onClick={() => showToast(`Iniciando seguimiento para ${caso.empresa}`)}
                                  className="btn btn-ghost btn-sm text-brown text-[11px] font-semibold shrink-0"
                                >
                                  Ver caso
                                </button>
                              </div>
                            ))}
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
                                  onClick={() => showToast(`Abriendo decisión de supervisor para ${caso.empresa}`)}
                                  className="btn btn-ghost btn-sm text-[#a32d2d] text-[11px] font-semibold shrink-0"
                                >
                                  Revisar
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
                );
              })()}
            {actividadSeleccionada && (
              <>
                <div
                  className="fixed inset-0 z-[399] bg-black/20"
                  onClick={() => setActividadSeleccionada(null)}
                />
                <div className="fixed left-1/2 top-1/2 z-[400] flex h-[90vh] w-3/4 max-w-[1000px] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-2xl border border-cream3 bg-white shadow-2xl">
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
                      <button className="flex items-center gap-1.5 text-[13px] text-gray-400 hover:text-white transition-colors" title="Descargar documento">
                        <Download size={14} /> Descargar
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
          )}

          {/* COLA TAB */}
          {activeTab === "cola" && (
            <ColaRevisionTab 
              onVerEmpresa={setClienteSeleccionado} 
              selectedDocId={selectedDocId}
              setSelectedDocId={setSelectedDocId}
              aprobadosHoy={aprobadosHoy}
              setAprobadosHoy={setAprobadosHoy}
              rechazadosHoy={rechazadosHoy}
              setRechazadosHoy={setRechazadosHoy}
            />
          )}

          {/* Simple Placeholders for other tabs to save space */}
          {activeTab === "mandantes" && (
            <div className="fade-in">
              <div className="page-header">
                <div>
                  <h2 className="page-title">Mandantes</h2>
                  <p className="page-sub">Empresas propietarias de proyectos que requieren acreditación de sus contratistas</p>
                </div>
                <button className="btn btn-primary" onClick={() => setShowInvitarModal(true)}>
                  <Plus size={16} /> Invitar Mandante
                </button>
              </div>

              {/* Breadcrumb */}
              <div className="flex items-center gap-1.5 text-[13px] text-gray-500 mb-4">
                <span
                  onClick={() => { setMandanteActivo(null); setProyectoActivo(null); }}
                  className={`cursor-pointer hover:text-brown transition-colors ${!mandanteActivo ? "text-navy font-medium" : ""}`}
                >
                  Mandantes
                </span>
                {mandanteActivo && (
                  <>
                    <ChevronRight size={14} className="text-gray-300" />
                    <span
                      onClick={() => setProyectoActivo(null)}
                      className={`cursor-pointer hover:text-brown transition-colors ${!proyectoActivo ? "text-navy font-medium" : ""}`}
                    >
                      {mandanteActivo.empresa}
                    </span>
                  </>
                )}
                {proyectoActivo && (
                  <>
                    <ChevronRight size={14} className="text-gray-300" />
                    <span className="text-navy font-medium">{proyectoActivo.nombre}</span>
                  </>
                )}
              </div>

              {/* Nivel 1: Lista de mandantes */}
              {!mandanteActivo && (
                <div className="grid grid-cols-2 gap-3">
                  {ARBOL_MANDANTES.map((m, i) => (
                    <div
                      key={i}
                      onClick={() => setMandanteActivo(m)}
                      className="card p-4 cursor-pointer hover:border-brown hover:shadow-md transition-all"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="text-[14.5px] font-semibold text-navy">{m.empresa}</h4>
                          <p className="text-[12.5px] text-gray-500 mt-0.5">{m.rut}</p>
                        </div>
                        <ChevronRight size={18} className="text-gray-300" />
                      </div>
                      <p className="text-[12px] text-gray-400 mt-3">{m.proyectos.length} proyecto{m.proyectos.length !== 1 ? "s" : ""}</p>
                    </div>
                  ))}
                </div>
              )}

              {/* Nivel 2: Proyectos del mandante */}
              {mandanteActivo && !proyectoActivo && (
                <div className="grid grid-cols-2 gap-3">
                  {mandanteActivo.proyectos.map((p: any, i: number) => (
                    <div
                      key={i}
                      onClick={() => setProyectoActivo(p)}
                      className="card p-4 cursor-pointer hover:border-brown hover:shadow-md transition-all"
                    >
                      <div className="flex items-center justify-between">
                        <h4 className="text-[14.5px] font-semibold text-navy">{p.nombre}</h4>
                        <span className={`badge ${p.badge}`}>{p.badgeLabel}</span>
                      </div>
                      <p className="text-[12px] text-gray-400 mt-3">{p.empresas.length} empresa{p.empresas.length !== 1 ? "s" : ""} asignada{p.empresas.length !== 1 ? "s" : ""}</p>
                    </div>
                  ))}
                </div>
              )}

              {/* Nivel 3: Empresas del proyecto */}
              {proyectoActivo && (
                <div className="flex flex-col gap-2">
                  {proyectoActivo.empresas.map((e: any, i: number) => (
                    <div
                      key={i}
                      onClick={() => setClienteSeleccionado(e)}
                      className="card p-4 cursor-pointer hover:border-brown hover:shadow-md transition-all flex items-center justify-between"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-brown text-white flex items-center justify-center font-semibold text-[14px] shrink-0">{e.iniciales}</div>
                        <div>
                          <h4 className="text-[14.3px] font-medium text-navy">{e.empresa}</h4>
                          <p className="text-[12.3px] text-gray-500">{e.rut} · {e.rol}</p>
                        </div>
                      </div>
                      <span className={`badge ${e.cumplimiento === "100% Aprobado" ? "b-green bg-green-100 text-green-800" : e.cumplimiento?.includes("Vencido") ? "b-red bg-red-100 text-red-800" : "bg-yellow-100 text-yellow-800 border-none"}`}>
                        {e.cumplimiento}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === "contratistas" && (
            <div className="fade-in">
              <div className="page-header">
                <div>
                  <h2 className="page-title">Contratistas</h2>
                  <p className="page-sub">Empresas contratistas y subcontratistas asignadas a proyectos</p>
                </div>
                <select className="form-input py-1.5 min-w-[200px]">
                  <option>Todos los proyectos</option>
                  <option>Proyecto Costanera Norte</option>
                  <option>Proyecto Minera Los Andes</option>
                  <option>Ampliación Planta Solar</option>
                </select>
              </div>

              <div className="card max-w-full overflow-x-auto p-0">
                <table className="w-full text-left">
                  <thead>
                    <tr>
                      <th className="px-4 py-3 border-b border-cream3 text-[13.2px] text-gray-600 bg-cream2 font-medium">Empresa</th>
                      <th className="px-4 py-3 border-b border-cream3 text-[13.2px] text-gray-600 bg-cream2 font-medium">RUT</th>
                      <th className="px-4 py-3 border-b border-cream3 text-[13.2px] text-gray-600 bg-cream2 font-medium">Rol</th>
                      <th className="px-4 py-3 border-b border-cream3 text-[13.2px] text-gray-600 bg-cream2 font-medium">Proyectos Asignados</th>
                      <th className="px-4 py-3 border-b border-cream3 text-[13.2px] text-gray-600 bg-cream2 font-medium">Estado</th>
                      <th className="px-4 py-3 border-b border-cream3 text-[13.2px] text-gray-600 bg-cream2 font-medium">Cumplimiento</th>
                    </tr>
                  </thead>
                  <tbody>
                    {EMPRESAS_CONTRATISTAS.map((c, i) => (
                      <tr
                        key={i}
                        onClick={() => setClienteSeleccionado(c)}
                        className="hover:bg-gray-50 border-b border-cream cursor-pointer"
                      >
                        <td className="px-4 py-3 text-[14.3px]"><div className="font-medium text-navy">{c.empresa}</div></td>
                        <td className="px-4 py-3 text-[14.3px] text-gray-600">{c.rut}</td>
                        <td className="px-4 py-3 text-[14.3px]">
                          <span className={`badge ${c.rol === "Subcontratista" ? "border border-cream3 bg-cream2 text-gray-600" : "border border-cream3 bg-white text-gray-700"}`}>
                            {c.rol}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-[14.3px]">
                          <div className="flex flex-wrap gap-1">
                            {c.proyectos.map((p: string, j: number) => (
                              <span key={j} className="badge b-gray bg-cream">{p}</span>
                            ))}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-[14.3px]">
                          <span className="badge b-green bg-green-100 text-green-800">{c.estado}</span>
                        </td>
                        <td className="px-4 py-3 text-[14.3px]">
                          <span className={`badge ${c.cumplimiento === "100% Aprobado" ? "b-green bg-green-100 text-green-800" : c.cumplimiento?.includes("Vencido") ? "b-red bg-red-100 text-red-800" : "bg-yellow-100 text-yellow-800 border-none"}`}>
                            {c.cumplimiento}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          {activeTab === "plantillas" && (() => {
            const plantillasFiltradas = PLANTILLAS
              .filter(p => activeFilterPlantillas === "Todas" || p.categoria === activeFilterPlantillas || (activeFilterPlantillas === "Premium / Asesoría" && p.tipo === "upsell"))
              .filter(p => p.nombre.toLowerCase().includes(busquedaPlantilla.toLowerCase()));

            return (
              <div className="fade-in relative">
                <div className="page-header">
                  <div>
                    <h2 className="page-title">Gestión de Plantillas</h2>
                    <p className="page-sub">
                      Documentos base y oferta de servicio de redacción para
                      contratistas
                    </p>
                  </div>
                  <button onClick={() => setShowSubirPlantillaModal(true)} className="btn btn-primary">
                    <Plus size={16} /> Subir nueva plantilla
                  </button>
                </div>

                <div className="alert alert-info mb-6">
                  <Sparkles size={18} className="shrink-0 text-brown" />
                  <div>
                    <strong>Servicio de Redacción y Asesoría:</strong> Las
                    plantillas complejas pueden ofrecer a los contratistas la
                    opción de pagar por nuestra asesoría legal experta, en lugar
                    de descargar el formato vacío. Esto representa una oportunidad
                    de upsell para la plataforma.
                  </div>
                </div>

                <div className="flex gap-2 mb-6">
                  {["Todas", "Laboral", "Prevención", "Premium / Asesoría"].map(f => (
                    <button 
                      key={f}
                      onClick={() => setActiveFilterPlantillas(f)}
                      className={`btn btn-sm ${activeFilterPlantillas === f ? 'bg-white border border-cream3 text-navy font-medium shadow-sm' : 'btn-ghost'}`}>
                      {f}
                    </button>
                  ))}
                </div>

                <div className="card-grid mb-8">
                  {plantillasFiltradas.slice(0, 3).map(p => (
                    <div key={p.id} className={`card flex flex-col h-full hover:shadow-md transition-shadow ${p.tipo === 'upsell' ? 'border-l-4 border-l-brown bg-gradient-to-br from-white to-orange-50/30' : ''}`}>
                      <div className="flex justify-between items-start mb-3">
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${p.tipo === 'upsell' ? 'bg-[#f0e4da]' : 'bg-cream'}`}>
                          <FileText className={p.tipo === 'upsell' ? 'text-[#9A694E]' : (p.categoria === 'Laboral' ? 'text-blue-600' : 'text-navy')} size={20} />
                        </div>
                        <span className={`badge border font-medium ${p.tipo === 'upsell' ? 'border-brown/30 bg-[#f0e4da] text-[#7a5038]' : 'border-blue-200 bg-blue-50 text-blue-700'}`}>
                          {p.categoria}
                        </span>
                      </div>
                      <h3 className="text-[16.5px] font-semibold text-navy mb-1.5 leading-tight">
                        {p.nombre}
                      </h3>
                      <p className={`text-[13.2px] mb-4 flex-1 ${p.tipo === 'upsell' ? 'text-gray-600' : 'text-gray-500'}`}>
                        {p.descripcion}
                      </p>
                      <div className={`pt-3 flex flex-col gap-2 mt-auto ${p.tipo === 'upsell' ? 'border-t border-brown/10' : 'border-t border-cream'}`}>
                        {p.tipo === 'upsell' ? (
                          <>
                            <div className="flex items-center gap-1.5 text-brown mb-1.5">
                              <Sparkles size={14} className="fill-brown/20" />
                              <span className="text-[12.1px] font-medium uppercase tracking-wide">
                                Servicio de Redacción Disponible
                              </span>
                            </div>
                            <button className="btn btn-primary btn-sm w-full py-1.5 text-[12.5px]">Solicitar asesoría</button>
                          </>
                        ) : (
                          <div className="flex items-center justify-between">
                             <span className="text-[12.1px] text-gray-400 font-medium tracking-wide uppercase">
                              Plantilla Gratuita
                            </span>
                            <button className="btn btn-secondary btn-sm">
                              <Download size={14} /> Ver documento
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex items-center justify-between mb-4">
                  <h3 className="section-title mb-0">Listado de Plantillas Activas</h3>
                  <input
                    type="text"
                    placeholder="Buscar plantilla por nombre..."
                    value={busquedaPlantilla}
                    onChange={e => setBusquedaPlantilla(e.target.value)}
                    className="form-input text-[13px] py-1.5 w-[250px]"
                  />
                </div>
                
                <div className="card p-0 overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr>
                        <th className="px-4 py-3 border-b border-cream3 text-[13.2px] text-gray-600 bg-cream2 font-medium">Nombre de Plantilla</th>
                        <th className="px-4 py-3 border-b border-cream3 text-[13.2px] text-gray-600 bg-cream2 font-medium">Categoría</th>
                        <th className="px-4 py-3 border-b border-cream3 text-[13.2px] text-gray-600 bg-cream2 font-medium">Actualización</th>
                        <th className="px-4 py-3 border-b border-cream3 text-[13.2px] text-gray-600 bg-cream2 font-medium">Descargas / Usos</th>
                        <th className="px-4 py-3 border-b border-cream3 text-[13.2px] text-gray-600 bg-cream2 font-medium text-right">Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {plantillasFiltradas.length > 0 ? plantillasFiltradas.map(p => (
                        <tr key={p.id} className="hover:bg-gray-50 border-b border-cream">
                          <td className="px-4 py-3 text-[14.3px] font-medium text-navy flex items-center gap-1.5">
                            {p.nombre}
                            {p.tipo === 'upsell' && <Sparkles size={14} className="text-brown shrink-0" />}
                          </td>
                          <td className="px-4 py-3 text-[14.3px]">
                            <span className={`badge border ${p.tipo === 'upsell' ? 'border-brown/30 bg-[#f0e4da] text-[#7a5038]' : 'border-blue-200 bg-blue-50 text-blue-700'}`}>
                              {p.categoria}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-[13.2px] text-gray-500">{p.actualizacion}</td>
                          <td className="px-4 py-3 text-[13.2px] text-gray-600">{p.descargas}</td>
                          <td className="px-4 py-3 text-right whitespace-nowrap">
                            <button className="text-gray-400 hover:text-navy mr-3"><Edit2 size={16} /></button>
                            <button className="text-gray-400 hover:text-red-500"><Trash2 size={16} /></button>
                          </td>
                        </tr>
                      )) : (
                        <tr>
                          <td colSpan={5} className="py-8 text-center text-[13.2px] text-gray-500">
                            No se encontraron plantillas.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {showSubirPlantillaModal && (
                  <>
                    <div className="fixed inset-0 z-[399] bg-black/20" onClick={() => setShowSubirPlantillaModal(false)} />
                    <div className="fixed left-1/2 top-1/2 z-[400] w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-white p-6 shadow-2xl border border-cream3">
                      <div className="flex justify-between items-center mb-5">
                        <h3 className="text-[18px] font-semibold text-navy">Subir Nueva Plantilla</h3>
                        <button onClick={() => setShowSubirPlantillaModal(false)} className="text-gray-400 hover:text-navy"><XCircle size={20}/></button>
                      </div>
                      
                      <div className="flex flex-col gap-4">
                        <div>
                          <label className="block text-[12.5px] font-medium text-navy mb-1.5">Nombre de la plantilla</label>
                          <input 
                            type="text" 
                            value={newTemplateName} 
                            onChange={(e) => setNewTemplateName(e.target.value)} 
                            className="form-input" 
                            placeholder="Ej: Contrato de confidencialidad" 
                          />
                        </div>
                        <div>
                          <label className="block text-[12.5px] font-medium text-navy mb-1.5">Categoría</label>
                          <select 
                            value={newTemplateCategory} 
                            onChange={(e) => setNewTemplateCategory(e.target.value)} 
                            className="form-input"
                          >
                            <option value="Laboral">Laboral</option>
                            <option value="Prevención">Prevención</option>
                            <option value="Premium / Asesoría">Premium / Asesoría</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-[12.5px] font-medium text-navy mb-1.5">Tipo de plantilla</label>
                          <select className="form-input">
                            <option value="gratuita">Gratuita (Descarga directa)</option>
                            <option value="upsell">Upsell (Servicio de redacción)</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-[12.5px] font-medium text-navy mb-1.5">Archivo base</label>
                          <div className="border border-dashed border-cream3 rounded-lg p-6 bg-cream2/50 text-center flex flex-col items-center justify-center gap-2 cursor-pointer hover:bg-cream2 transition-colors">
                            <FileText size={24} className="text-gray-400" />
                            <p className="text-[12.5px] text-gray-500">Haz clic para buscar o arrastra el archivo aquí<br/>.docx, .pdf, .xls</p>
                          </div>
                        </div>
                        <button onClick={handleAddTemplate} className="btn btn-primary w-full mt-2 py-2.5">
                          Guardar plantilla
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            );
          })()}

          {activeTab === "reglas" && (() => {
            const hasError = reglas.some(r => r.alertaDias >= r.diasVigencia);
            
            return (
              <div className="fade-in">
                <div className="page-header">
                  <div>
                    <h2 className="page-title">Reglas de vigencia</h2>
                    <p className="page-sub">
                      Define la caducidad global por tipo de documento y alertas
                      automatizadas.
                    </p>
                  </div>
                  <button 
                    onClick={() => { saveReglas(reglas); alert("Cambios guardados con éxito"); }}
                    disabled={hasError}
                    className={`btn btn-primary ${hasError ? 'opacity-50 pointer-events-none' : ''}`}
                  >
                    Guardar cambios
                  </button>
                </div>

                <div className="card p-0 overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr>
                        <th className="px-4 py-3 border-b border-cream3 text-[13.2px] text-gray-600 bg-cream2 font-medium">
                          Tipo de documento
                        </th>
                        <th className="px-4 py-3 border-b border-cream3 text-[13.2px] text-gray-600 bg-cream2 font-medium">
                          Días de vigencia
                        </th>
                        <th className="px-4 py-3 border-b border-cream3 text-[13.2px] text-gray-600 bg-cream2 font-medium">
                          Alerta anticipada (días)
                        </th>
                        <th className="px-4 py-3 border-b border-cream3 text-[13.2px] text-gray-600 bg-cream2 font-medium">
                          Criticidad
                        </th>
                        <th className="px-4 py-3 border-b border-cream3 text-[13.2px] text-gray-600 bg-cream2 font-medium">
                          Efecto
                        </th>
                        <th className="px-4 py-3 border-b border-cream3 text-[13.2px] text-gray-600 bg-cream2 font-medium text-right">
                          Acciones
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {reglas.map(regla => (
                        <tr key={regla.id} className="border-b border-cream">
                          <td className="px-4 py-4 text-[14.3px] font-medium text-navy">
                            {regla.isNew ? (
                              <input 
                                type="text"
                                className="form-input w-full min-w-[150px]"
                                placeholder="Nombre de documento..."
                                value={regla.documento}
                                onChange={(e) => setReglas(reglas.map(r => r.id === regla.id ? { ...r, documento: e.target.value } : r))}
                              />
                            ) : (
                              <span>{regla.documento}</span>
                            )}
                          </td>
                          <td className="px-4 py-4">
                            <input
                              type="number"
                              className="form-input w-24"
                              value={regla.diasVigencia}
                              onChange={(e) => setReglas(reglas.map(r => r.id === regla.id ? { ...r, diasVigencia: Number(e.target.value) } : r))}
                            />
                          </td>
                          <td className="px-4 py-4">
                            <input
                              type="number"
                              className={`form-input w-24 ${regla.alertaDias >= regla.diasVigencia ? "outline outline-1 outline-red-400 border-red-400" : ""}`}
                              value={regla.alertaDias}
                              onChange={(e) => setReglas(reglas.map(r => r.id === regla.id ? { ...r, alertaDias: Number(e.target.value) } : r))}
                            />
                          </td>
                          <td className="px-4 py-4">
                            <select 
                              className="form-input w-full min-w-[160px]"
                              value={regla.criticidad}
                              onChange={(e) => setReglas(reglas.map(r => r.id === regla.id ? { ...r, criticidad: e.target.value as any } : r))}
                            >
                              <option value="bloquea_pago">Bloquea pago</option>
                              <option value="bloquea_acceso">Bloquea acceso</option>
                              <option value="advertencia">Solo advertencia</option>
                            </select>
                          </td>
                          <td className="px-4 py-4">
                            {regla.criticidad === "bloquea_pago" && <span className="badge bg-yellow-100 text-yellow-800">⚠ Bloquea pago</span>}
                            {regla.criticidad === "bloquea_acceso" && <span className="badge bg-red-100 text-red-800">✕ Bloquea acceso</span>}
                            {regla.criticidad === "advertencia" && <span className="badge bg-gray-100 text-gray-600">~ Solo aviso</span>}
                          </td>
                          <td className="px-4 py-4 text-right">
                            <button 
                              onClick={() => setReglas(reglas.filter(r => r.id !== regla.id))}
                              className="text-gray-400 hover:text-red-500"
                            >
                              <Trash2 size={16} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div className="p-4 border-t border-cream">
                    <button 
                      onClick={() => setReglas([...reglas, { id: Date.now(), documento: "", diasVigencia: 30, alertaDias: 7, criticidad: "advertencia", isNew: true }])}
                      className="btn btn-ghost btn-sm mt-2"
                    >
                      <Plus size={14} className="mr-1" /> Añadir nueva regla
                    </button>
                  </div>
                </div>
              </div>
            );
          })()}

          {activeTab === "auditoria" && (() => {
            const filteredLogs = auditoriaLogs.filter(log => {
              if (filtroAccionLog !== "Todas las Acciones") {
                const mapAccion: Record<string, string> = { 
                  "Aprobaciones": "aprobacion", "Rechazos": "rechazo", "Subidas de doc": "subida", "Inicios de sesión": "acceso_fallido" 
                };
                if (log.accion !== mapAccion[filtroAccionLog]) return false;
              }
              if (filtroActorLog !== "Todos los Actores" && log.rol !== filtroActorLog) return false;
              if (filtroFechaLog) {
                const parts = filtroFechaLog.split("-");
                if (parts.length === 3) {
                  const dayStr = parts[2];
                  if (!log.fecha.startsWith(dayStr + " ") && !log.fecha.startsWith(parseInt(dayStr, 10) + " ")) return false;
                }
              }
              if (busquedaLog) {
                const lowerSrc = busquedaLog.toLowerCase();
                if (!log.empresa.toLowerCase().includes(lowerSrc) && !log.detalle.toLowerCase().includes(lowerSrc)) return false;
              }
              return true;
            });

            const renderAccion = (accion: string) => {
              switch (accion) {
                case "aprobacion": return <><CheckCircle size={15} className="inline mr-1 text-green-600" /> Aprobación Documento</>;
                case "rechazo": return <><XCircle size={15} className="inline mr-1 text-red-500" /> Rechazo Documento</>;
                case "subida": return <><Upload size={15} className="inline mr-1 text-blue-500" /> Subida de Documento</>;
                case "acceso_fallido": return <><ShieldAlert size={15} className="inline mr-1 text-red-700" /> Intento de Acceso Base</>;
                case "alerta": return <><Bell size={15} className="inline mr-1 text-amber-500" /> Alerta Automática</>;
                default: return <>{accion}</>;
              }
            };

            const renderResultado = (resultado: string) => {
              switch (resultado) {
                case "exitoso": return <span className="badge bg-green-100 text-green-800 text-[11px]">Exitoso</span>;
                case "bloqueado": return <span className="badge bg-red-100 text-red-800 text-[11px]">Bloqueado</span>;
                case "informativo": return <span className="badge bg-cream text-gray-600 text-[11px]">Informativo</span>;
                default: return null;
              }
            };

            return (
              <div className="fade-in">
                <div className="page-header">
                  <div>
                    <h2 className="page-title">Auditoría</h2>
                    <p className="page-sub">
                      Registro detallado (log) de toda la actividad en la
                      plataforma.
                    </p>
                  </div>
                  <button className="btn btn-ghost btn-sm">
                    <Download size={14} className="mr-1" /> Exportar log (CSV)
                  </button>
                </div>

                <div className="flex flex-wrap gap-2 mb-4">
                  <select 
                    className="form-input py-1.5 min-w-[150px] text-[13.2px]"
                    value={filtroAccionLog}
                    onChange={e => setFiltroAccionLog(e.target.value)}
                  >
                    <option>Todas las Acciones</option>
                    <option>Aprobaciones</option>
                    <option>Rechazos</option>
                    <option>Subidas de doc</option>
                    <option>Inicios de sesión</option>
                  </select>
                  <select 
                    className="form-input py-1.5 min-w-[150px] text-[13.2px]"
                    value={filtroActorLog}
                    onChange={e => setFiltroActorLog(e.target.value)}
                  >
                    <option>Todos los Actores</option>
                    <option value="Revisor">Revisor</option>
                    <option value="Contratista">Contratista</option>
                    <option value="Sistema Automático">Sistema Automático</option>
                  </select>
                  <input
                    type="date"
                    className="form-input py-1.5 min-w-[150px] text-[13.2px]"
                    value={filtroFechaLog}
                    onChange={e => setFiltroFechaLog(e.target.value)}
                  />
                  <input
                    type="text"
                    className="form-input py-1.5 flex-1 min-w-[200px] text-[13.2px]"
                    placeholder="Buscar por RUT o nombre de empresa..."
                    value={busquedaLog}
                    onChange={e => setBusquedaLog(e.target.value)}
                  />
                </div>

                <div className="mb-2 text-[12.5px] text-gray-500 font-medium">
                  Mostrando {filteredLogs.length} de {auditoriaLogs.length} eventos
                </div>

                <div className="card p-0 overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr>
                        <th className="px-4 py-3 border-b border-cream3 text-[13.2px] text-gray-600 bg-cream2 font-medium">
                          Acción
                        </th>
                        <th className="px-4 py-3 border-b border-cream3 text-[13.2px] text-gray-600 bg-cream2 font-medium">
                          Actor
                        </th>
                        <th className="px-4 py-3 border-b border-cream3 text-[13.2px] text-gray-600 bg-cream2 font-medium">
                          Empresa / Proyecto
                        </th>
                        <th className="px-4 py-3 border-b border-cream3 text-[13.2px] text-gray-600 bg-cream2 font-medium">
                          Detalle
                        </th>
                        <th className="px-4 py-3 border-b border-cream3 text-[13.2px] text-gray-600 bg-cream2 font-medium">
                          Fecha y Hora
                        </th>
                        <th className="px-4 py-3 border-b border-cream3 text-[13.2px] text-gray-600 bg-cream2 font-medium">
                          Resultado
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredLogs.map(log => (
                        <React.Fragment key={log.id}>
                          <tr 
                            className="hover:bg-gray-50 border-b border-cream cursor-pointer"
                            onClick={() => setExpandedLogId(expandedLogId === log.id ? null : log.id)}
                          >
                            <td className="px-4 py-4 text-[13.2px] font-medium text-navy flex items-center">
                              {renderAccion(log.accion)}
                            </td>
                            <td className="px-4 py-4 text-[13.2px] text-gray-600">
                              <div className="font-medium text-navy">{log.actor}</div>
                              <div className="text-[11px] text-gray-400 mt-0.5">{log.rol}{log.ip ? ` · IP: ${log.ip}` : ''}</div>
                            </td>
                            <td className="px-4 py-4 text-[13.2px] text-gray-600">
                              <div className="font-bold text-[13px] text-navy">{log.empresa}</div>
                              {log.proyecto && <div className="text-[11px] text-gray-500 mt-0.5">· {log.proyecto}</div>}
                            </td>
                            <td className="px-4 py-4 text-[13.2px] text-gray-600 max-w-[200px] truncate" title={log.detalle}>
                              {log.detalle}
                            </td>
                            <td className="px-4 py-4 text-[13.2px] text-gray-500 whitespace-nowrap">
                              {log.fecha}
                            </td>
                            <td className="px-4 py-4 text-[13.2px]">
                              {renderResultado(log.resultado)}
                            </td>
                          </tr>
                          {expandedLogId === log.id && (
                            <tr className="bg-cream2 border-b border-cream">
                              <td colSpan={6} className="px-6 py-5">
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-6 text-[13px]">
                                  <div>
                                    <span className="block text-gray-400 font-semibold mb-1 text-[11px] uppercase tracking-wide">Detalle de la acción</span>
                                    <p className="text-navy leading-relaxed">{log.detalle}</p>
                                  </div>
                                  <div>
                                    <span className="block text-gray-400 font-semibold mb-1 text-[11px] uppercase tracking-wide">Contexto Operativo</span>
                                    <p className="text-navy">{log.empresa} {log.proyecto ? `· ${log.proyecto}` : ''}</p>
                                  </div>
                                  <div>
                                    <span className="block text-gray-400 font-semibold mb-1 text-[11px] uppercase tracking-wide">Metadatos</span>
                                    <p className="text-navy">{log.fecha}</p>
                                    {log.ip ? <p className="text-gray-500 mt-0.5">IP: {log.ip}</p> : null}
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })()}

          {activeTab === "acreditaciones" && (
            <div className="fade-in space-y-4">
              <div className="page-header">
                <div>
                  <h2 className="page-title text-navy font-bold text-[22px]">Estados de Acreditación</h2>
                  <p className="page-sub text-gray-500 text-[13.5px]">Monitoreo de contratistas y progreso de cumplimiento</p>
                </div>
              </div>
              
              <div className="card p-0 overflow-x-auto bg-white shadow-sm border border-cream3">
                <table className="table w-full text-left">
                  <thead>
                    <tr>
                      <th className="px-4 py-3 bg-cream2 text-navy text-[13.2px] font-semibold border-b border-cream3">Contratista</th>
                      <th className="px-4 py-3 bg-cream2 text-navy text-[13.2px] font-semibold border-b border-cream3">Proyecto(s)</th>
                      <th className="px-4 py-3 bg-cream2 text-navy text-[13.2px] font-semibold border-b border-cream3">Requisitos de Empresa</th>
                      <th className="px-4 py-3 bg-cream2 text-navy text-[13.2px] font-semibold border-b border-cream3">Personal Acreditado</th>
                      <th className="px-4 py-3 bg-cream2 text-navy text-[13.2px] font-semibold border-b border-cream3">Estado Acreditación</th>
                    </tr>
                  </thead>
                  <tbody>
                    {GLOBAL_CONTRATISTAS.map(c => {
                      const approvedDocs = c.documentos.filter(d => d.estado === 'aprobado').length;
                      const totalDocs = c.documentos.length;
                      const workers = c.trabajadores || [];
                      const approvedWorkers = workers.filter(w => w.estado === 'aprobado').length;
                      
                      const hasRejected = c.documentos.some(d => d.estado === 'rechazado') || workers.some(w => w.estado === 'rechazado');
                      const hasPending = c.documentos.some(d => d.estado === 'revision' || d.estado === 'pendiente') || workers.some(w => w.estado === 'pendiente');
                      
                      let stateLabel = 'Acreditado';
                      let badgeClass = 'b-green';
                      if (hasRejected) {
                        stateLabel = 'Bloqueado';
                        badgeClass = 'b-red';
                      } else if (hasPending) {
                        stateLabel = 'En proceso';
                        badgeClass = 'b-yellow';
                      }
                      
                      return (
                        <tr key={c.id} className="border-b border-cream hover:bg-gray-50 last:border-0 font-sans">
                          <td className="px-4 py-3">
                            <div className="font-semibold text-navy text-[14px]">{c.nombre}</div>
                            <div className="text-[11.5px] text-gray-500">RUT: {c.rut}</div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex flex-wrap gap-1">
                              {c.proyectos.map(pId => {
                                const proj = GLOBAL_PROYECTOS.find(p => p.id === pId);
                                return <span key={pId} className="badge b-gray text-[10.5px] font-medium">{proj ? proj.nombre : pId}</span>;
                              })}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-[13px] text-navy font-semibold">{approvedDocs} / {totalDocs}</td>
                          <td className="px-4 py-3 text-[13px] text-navy font-semibold">{approvedWorkers} / {workers.length}</td>
                          <td className="px-4 py-3"><span className={`badge ${badgeClass} text-[11px]`}>{stateLabel}</span></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === "facturacion" && (
            <div className="fade-in">
              <div className="page-header">
                <div>
                  <h2 className="page-title capitalize">{activeTab}</h2>
                  <p className="page-sub">Panel en desarrollo...</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {showInvitarModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-[440px] overflow-hidden">
            <div className="flex justify-between items-center p-4 border-b border-cream">
              <h3 className="font-medium text-navy text-[17.6px]">
                Invitar Mandante
              </h3>
              <button
                onClick={() => setShowInvitarModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-6">
              {invitacionEnviada ? (
                <div className="text-center py-4">
                  <div className="bg-green-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Mail size={32} className="text-green-600" />
                  </div>
                  <h4 className="text-lg font-medium text-navy mb-2">
                    ¡Invitación enviada!
                  </h4>
                  <p className="text-gray-600 text-sm leading-relaxed mb-6">
                    Invitación enviada a{" "}
                    <span className="font-medium">{formInvitacion.correo}</span>
                    .<br />
                    El mandante recibirá un link para activar su cuenta.
                  </p>
                  <button
                    onClick={() => {
                      setShowInvitarModal(false);
                      setFormInvitacion({
                        nombre: "",
                        empresa: "",
                        correo: "",
                        industria: "",
                      });
                    }}
                    className="btn btn-primary w-full justify-center"
                  >
                    Entendido
                  </button>
                </div>
              ) : (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    const newId = 'm_' + Date.now();
                    const newMandante = {
                      id: newId,
                      nombre: formInvitacion.empresa,
                      rut: '76.321.456-K',
                      plan: 'Pro',
                      proyectos: []
                    };
                    const list = getMandantes();
                    list.push(newMandante);
                    saveMandantes(list);
                    setInvitacionEnviada(true);
                  }}
                  className="flex flex-col gap-4"
                >
                  <div>
                    <label className="block text-[13.2px] font-medium text-gray-700 mb-1.5">
                      Nombre completo
                    </label>
                    <input
                      type="text"
                      value={formInvitacion.nombre}
                      onChange={(e) =>
                        setFormInvitacion({
                          ...formInvitacion,
                          nombre: e.target.value,
                        })
                      }
                      className="form-input w-full p-2.5 border border-cream3 rounded-lg focus:border-brown focus:ring-1 focus:ring-brown outline-none transition-all"
                      placeholder="Tu nombre"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-[13.2px] font-medium text-gray-700 mb-1.5">
                      Empresa
                    </label>
                    <input
                      type="text"
                      value={formInvitacion.empresa}
                      onChange={(e) =>
                        setFormInvitacion({
                          ...formInvitacion,
                          empresa: e.target.value,
                        })
                      }
                      className="form-input w-full p-2.5 border border-cream3 rounded-lg focus:border-brown focus:ring-1 focus:ring-brown outline-none transition-all"
                      placeholder="Nombre de la empresa"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-[13.2px] font-medium text-gray-700 mb-1.5">
                      Correo corporativo
                    </label>
                    <input
                      type="email"
                      value={formInvitacion.correo}
                      onChange={(e) =>
                        setFormInvitacion({
                          ...formInvitacion,
                          correo: e.target.value,
                        })
                      }
                      className="form-input w-full p-2.5 border border-cream3 rounded-lg focus:border-brown focus:ring-1 focus:ring-brown outline-none transition-all"
                      placeholder="tu@empresa.cl"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-[13.2px] font-medium text-gray-700 mb-1.5">
                      Industria
                    </label>
                    <select
                      value={formInvitacion.industria}
                      onChange={(e) =>
                        setFormInvitacion({
                          ...formInvitacion,
                          industria: e.target.value,
                        })
                      }
                      className="form-input w-full p-2.5 border border-cream3 rounded-lg focus:border-brown focus:ring-1 focus:ring-brown outline-none transition-all"
                      required
                    >
                      <option value="">Selecciona una industria...</option>
                      <option value="construccion">Construcción</option>
                      <option value="mineria">Minería</option>
                      <option value="energia">Energía</option>
                      <option value="manufactura">Manufactura</option>
                      <option value="logistica">Logística y Transporte</option>
                      <option value="retail">Retail</option>
                      <option value="telecomunicaciones">
                        Telecomunicaciones
                      </option>
                      <option value="servicios">Servicios Generales</option>
                    </select>
                  </div>

                  <div className="flex justify-end gap-3 mt-4 pt-4 border-t border-cream">
                    <button
                      type="button"
                      onClick={() => setShowInvitarModal(false)}
                      className="btn btn-ghost font-medium"
                    >
                      Cancelar
                    </button>
                    <button type="submit" className="btn btn-primary">
                      Enviar invitación
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Drawer Cliente Seleccionado */}
      {clienteSeleccionado && (
        <>
          <div
            className="fixed inset-0 z-[399] bg-black/20"
            onClick={() => setClienteSeleccionado(null)}
          />
          <div className="fixed left-1/2 top-1/2 z-[400] flex h-[90vh] w-3/4 max-w-[1000px] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-2xl border border-cream3 bg-white shadow-2xl">
            {/* Header */}
            <div className="flex items-start justify-between p-5 border-b border-cream3">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-10 h-10 rounded-full bg-brown text-white flex items-center justify-center font-semibold text-[14px]">
                    {clienteSeleccionado.iniciales}
                  </div>
                  <div>
                    <p className="font-semibold text-navy text-[16px]">
                      {clienteSeleccionado.empresa}
                    </p>
                    <p className="text-[13px] text-gray-400">
                      {clienteSeleccionado.rut}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2 mt-2">
                  <span className="badge border border-cream3 bg-white text-gray-700">
                    {clienteSeleccionado.rol}
                  </span>
                  <span
                    className={`badge ${clienteSeleccionado.cumplimiento === "100% Aprobado" ? "b-green bg-green-100 text-green-800" : clienteSeleccionado.cumplimiento?.includes("Vencido") ? "b-red bg-red-100 text-red-800" : "bg-yellow-100 text-yellow-800"}`}
                  >
                    {clienteSeleccionado.cumplimiento}
                  </span>
                </div>
              </div>
              <button
                onClick={() => setClienteSeleccionado(null)}
                className="text-gray-400 hover:text-navy"
              >
                <XCircle size={20} />
              </button>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-cream3 px-4">
              {["documentos", "proyectos", "actividad", "info"].map((t) => (
                <button
                  key={t}
                  onClick={() => setTabCliente(t)}
                  className={`px-4 py-3 text-[13px] capitalize border-b-2 transition-colors ${tabCliente === t ? "border-brown text-brown font-semibold" : "border-transparent text-gray-400 hover:text-navy"}`}
                >
                  {t === "documentos"
                    ? "Documentos"
                    : t === "proyectos"
                      ? "Proyectos"
                      : t === "actividad"
                        ? "Actividad"
                        : "Info empresa"}
                </button>
              ))}
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4">
              {tabCliente === "documentos" &&
                (() => {
                  const docsFiltrados = getDocumentosEmpresa(clienteSeleccionado)
                    .filter(
                      (d) =>
                        filtroEstado === "todos" || d.estado === filtroEstado,
                    )
                    .filter((d) =>
                      d.nombre
                        .toLowerCase()
                        .includes(busquedaDoc.toLowerCase()),
                    )
                    .sort((a, b) =>
                      ordenDoc === "nombre"
                        ? a.nombre.localeCompare(b.nombre)
                        : 0,
                    );

                  return (
                    <div className="flex flex-col gap-2">
                      <div className="flex flex-col gap-2 mb-3">
                        <input
                          type="text"
                          placeholder="Buscar documento..."
                          value={busquedaDoc}
                          onChange={(e) => setBusquedaDoc(e.target.value)}
                          className="form-input text-[13px] py-2"
                        />
                        <div className="flex gap-2">
                          <select
                            value={filtroEstado}
                            onChange={(e) => setFiltroEstado(e.target.value)}
                            className="form-input text-[13px] py-1.5 flex-1"
                          >
                            <option value="todos">Todos los estados</option>
                            <option value="aprobado">Aprobado</option>
                            <option value="rechazado">Rechazado</option>
                            <option value="por_vencer">Por vencer</option>
                            <option value="pendiente">Pendiente</option>
                          </select>
                          <select
                            value={ordenDoc}
                            onChange={(e) => setOrdenDoc(e.target.value)}
                            className="form-input text-[13px] py-1.5 flex-1"
                          >
                            <option value="vencimiento">
                              Ordenar: Vencimiento
                            </option>
                            <option value="subido">
                              Ordenar: Fecha subida
                            </option>
                            <option value="nombre">Ordenar: Nombre A-Z</option>
                          </select>
                        </div>
                      </div>

                      <p className="text-[12px] text-gray-400 mb-2">
                        Mostrando {docsFiltrados.length} de{" "}
                        {getDocumentosEmpresa(clienteSeleccionado).length} documentos
                      </p>

                      {docsFiltrados.length === 0 ? (
                        <div className="text-center py-10 text-gray-400">
                          <FileText
                            size={36}
                            className="mx-auto mb-2 opacity-30"
                          />
                          <p className="text-[13px]">
                            No hay documentos que coincidan con los filtros
                          </p>
                          <button
                            onClick={() => {
                              setBusquedaDoc("");
                              setFiltroEstado("todos");
                            }}
                            className="text-brown text-[12.5px] mt-1 hover:underline"
                          >
                            Limpiar filtros
                          </button>
                        </div>
                      ) : (
                         docsFiltrados.map((doc, i) => (
                           <DocumentoRow
                             key={i}
                             doc={doc}
                             onRevisar={(d) => setActividadSeleccionada({
                               id: d.id || Math.random(),
                               documento: d.nombre || "—",
                               categoria: d.categoria || "Laboral",
                               proyecto: d.proyecto || "—",
                               empresa: clienteSeleccionado.empresa,
                               rut: clienteSeleccionado.rut,
                               fecha: d.subido || "—",
                               hora: "—",
                               estado: d.estado || "revision",
                               revisor: d.revisor || "—",
                               evento: d.estado === "aprobado" ? "Aprobación" : d.estado === "rechazado" ? "Rechazo" : "Subida",
                               motivo: d.obs || ""
                             })}
                           />
                         ))
                      )}
                    </div>
                  );
                })()}

              {tabCliente === "proyectos" && (() => {
                const contractorObj = GLOBAL_CONTRATISTAS.find(c => 
                  c.nombre === clienteSeleccionado?.empresa || 
                  c.nombre === clienteSeleccionado?.nombre || 
                  c.id === clienteSeleccionado?.id
                ) || GLOBAL_CONTRATISTAS[0];
                const contractorProjects = GLOBAL_PROYECTOS.filter(p => contractorObj.proyectos.includes(p.id)).map(p => {
                  const mandante = GLOBAL_MANDANTES.find(m => m.id === p.mandanteId);
                  
                  // Calculate project compliance percentage dynamically from real documents of the contractor
                  const total = contractorObj.documentos.length;
                  const aprobados = contractorObj.documentos.filter(d => d.estado === 'aprobado').length;
                  const pct = total > 0 ? Math.round((aprobados / total) * 100) : 100;
                  const estado = pct >= 90 ? "b-green" : pct >= 70 ? "b-yellow" : "b-red";

                  return {
                    nombre: `Proyecto ${p.nombre}`,
                    mandante: mandante ? mandante.nombre : "Mandante",
                    pct,
                    estado
                  };
                });

                return (
                  <div className="flex flex-col gap-2">
                    {contractorProjects.map((p, i) => (
                      <ProyectoRow key={i} proyecto={p} contractorId={contractorObj.id} />
                    ))}
                  </div>
                );
              })()}

              {tabCliente === "actividad" && (() => {
                const contractorObj = GLOBAL_CONTRATISTAS.find(c => 
                  c.nombre === clienteSeleccionado?.empresa || 
                  c.nombre === clienteSeleccionado?.nombre || 
                  c.id === clienteSeleccionado?.id
                ) || GLOBAL_CONTRATISTAS[0];

                const dynamicAct: any[] = [];
                contractorObj.documentos.forEach(d => {
                  if (d.estado === 'aprobado') {
                    dynamicAct.push({
                      accion: "Documento aprobado",
                      detalle: `${d.nombre} · Revisado por ${d.revisor || 'Ana Díaz'}`,
                      hora: d.subido || "Hoy 09:35",
                      icon: "green"
                    });
                  } else if (d.estado === 'rechazado') {
                    dynamicAct.push({
                      accion: "Documento rechazado",
                      detalle: `${d.nombre} · Motivo: ${d.motivo || 'Firma ilegible'}`,
                      hora: "Hoy 09:18",
                      icon: "red"
                    });
                  } else if (d.estado === 'revision') {
                    dynamicAct.push({
                      accion: "Documento subido",
                      detalle: `${d.nombre} · Esperando revisión`,
                      hora: "Hace 2 hr",
                      icon: "blue"
                    });
                  }
                });

                if (dynamicAct.length === 0) {
                  dynamicAct.push({
                    accion: "Sin actividad reciente",
                    detalle: "No hay eventos registrados en este período",
                    hora: "—",
                    icon: "gray"
                  });
                }

                return (
                  <div className="flex flex-col gap-2">
                    {dynamicAct.map((ev, i) => (
                      <div
                        key={i}
                        className="flex items-start gap-3 py-2.5 border-b border-cream3 last:border-0"
                      >
                        <div
                          className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${ev.icon === "green" ? "bg-green-500" : ev.icon === "red" ? "bg-red-500" : ev.icon === "blue" ? "bg-blue-400" : "bg-gray-300"}`}
                        />
                        <div className="flex-1">
                          <p className="text-[13.5px] font-medium text-navy">
                            {ev.accion}
                          </p>
                          <p className="text-[12.5px] text-gray-400">
                            {ev.detalle}
                          </p>
                        </div>
                        <span className="text-[11.5px] text-gray-400 shrink-0">
                          {ev.hora}
                        </span>
                      </div>
                    ))}
                  </div>
                );
              })()}

              {tabCliente === "info" && (
                <div className="flex flex-col gap-4">
                  <div className="card p-4">
                    <p className="text-[12px] uppercase tracking-wider text-gray-400 mb-3 font-medium">
                      Datos de la empresa
                    </p>
                    {[
                      ["Razón social", clienteSeleccionado.empresa],
                      ["RUT", clienteSeleccionado.rut],
                      ["Rol en plataforma", clienteSeleccionado.rol],
                      ["Industria", "Construcción"],
                      ["Fecha de registro", "12 Ene 2026"],
                      ["Contacto principal", "contacto@empresa.cl"],
                      ["Teléfono", "+56 9 8765 4321"],
                    ].map(([label, val]) => (
                      <div
                        key={label}
                        className="flex justify-between py-2 border-b border-cream3 last:border-0 text-[13.5px]"
                      >
                        <span className="text-gray-400">{label}</span>
                        <span className="font-medium text-navy text-right">
                          {val}
                        </span>
                      </div>
                    ))}
                  </div>
                  <div className="card p-4">
                    <p className="text-[12px] uppercase tracking-wider text-gray-400 mb-3 font-medium">
                      Plan y facturación
                    </p>
                    {[
                      ["Plan actual", clienteSeleccionado.rol === "Mandante" ? `${clienteSeleccionado.plan || "Pro"} · $${clienteSeleccionado.plan === "Enterprise" ? "149.990" : clienteSeleccionado.plan === "Pro" ? "49.990" : "19.990"}/mes` : "N/A (Acceso Contratista)"],
                      ["Próxima factura", "01 Jul 2026"],
                      ["Estado de pago", "Al día"],
                    ].map(([label, val]) => (
                      <div
                        key={label}
                        className="flex justify-between py-2 border-b border-cream3 last:border-0 text-[13.5px]"
                      >
                        <span className="text-gray-400">{label}</span>
                        <span className="font-medium text-navy">{val}</span>
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <button className="flex-1 flex items-center justify-center gap-1.5 text-[13px] font-medium py-2 rounded-lg border border-cream3 bg-white hover:bg-gray-50 text-navy transition-colors">
                      <Edit size={14} /> Editar datos
                    </button>
                    <button className="flex-1 flex items-center justify-center gap-1.5 text-[13px] font-medium py-2 rounded-lg border border-red-200 bg-red-50 text-red-600 hover:bg-red-100 transition-colors">
                      <Trash2 size={14} /> Suspender cuenta
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {toast && (
        <div className={`fixed bottom-5 right-5 z-[9999] flex items-center gap-2 px-4 py-3 rounded-xl shadow-2xl border ${
          toast.type === 'error' ? 'bg-[#fef2f2] border-[#fecaca] text-[#a32d2d]' :
          toast.type === 'warning' ? 'bg-[#fffbeb] border-[#fde68a] text-[#b45309]' :
          'bg-[#eaf3de] border-[#cde3b0] text-[#3b6d11]'
        } fade-in text-[13.5px] font-sans font-medium`}>
          {toast.type === 'error' ? <XCircle size={16} /> : toast.type === 'warning' ? <AlertTriangle size={16} /> : <CheckCircle size={16} />}
          {toast.message}
        </div>
      )}
    </div>
  );
}
