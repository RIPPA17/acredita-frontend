import React, { useState } from "react";
import { useNavigate } from 'react-router-dom';
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
  ChevronRight, Briefcase, Menu, ChevronLeft
} from "lucide-react";
import { getContratistas, saveContratistas, getProyectos, saveProyectos, getMandantes, saveMandantes, getPlantillas, savePlantillas, getReglas, saveReglas, calcularEstadoAcreditacion, calcularEstadoTrabajador, getAlertasVigencia, esVencidoPorFecha, obtenerDiasRestantes, logoutUser, getAuditLogs } from "../data/localStorageDb";
import { Contratista, Proyecto } from "../types";
import FichaAcreditacion from '../components/FichaAcreditacion';
import ColaRevisionTab from './admin/ColaRevisionTab';
import { buildColaDocs } from './admin/colaUtils';
import { GLOBAL_MANDANTES, GLOBAL_PROYECTOS, GLOBAL_CONTRATISTAS, GLOBAL_PLANTILLA_DOCUMENTOS } from './admin/globalData';
import { DocumentoRow, ProyectoRow } from './admin/RowComponents';
import MandantesTab from './admin/MandantesTab';
import ContratistasTab from './admin/ContratistasTab';
import AcreditacionesTab from './admin/AcreditacionesTab';
import PlantillasTab from './admin/PlantillasTab';
import ReglasTab from './admin/ReglasTab';
import AuditoriaTab from './admin/AuditoriaTab';
import DashboardTab from './admin/DashboardTab';
import ClienteDetailDrawer from './admin/ClienteDetailDrawer';
import DocumentoDetailModal from './admin/DocumentoDetailModal';

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
  const navigate = useNavigate();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    return localStorage.getItem('sidebar_collapsed') === 'true';
  });

  const toggleSidebar = () => {
    const nextState = !sidebarCollapsed;
    setSidebarCollapsed(nextState);
    localStorage.setItem('sidebar_collapsed', String(nextState));
  };
  const GLOBAL_MANDANTES = getMandantes();
  const GLOBAL_PROYECTOS = getProyectos();
  const GLOBAL_CONTRATISTAS = getContratistas();
  const GLOBAL_PLANTILLA_DOCUMENTOS = getPlantillas();

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
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
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
  const [selectedAcreditacionContratista, setSelectedAcreditacionContratista] = useState<any>(null);
  const [showNotif, setShowNotif] = useState(false);
  const [clienteSeleccionado, setClienteSeleccionado] = useState<any>(null);
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

  const [auditoriaLogs, setAuditoriaLogs] = useState<any[]>(() => {
    const dbLogs = getAuditLogs().map(log => ({
      ...log,
      id: log.id,
      accion: log.accion,
      actor: log.actor || log.usuarioId,
      rol: log.rol === 'admin' ? 'Revisor' : log.rol === 'contratista' ? 'Contratista' : log.rol === 'sistema' ? 'Sistema Automático' : 'Desconocido',
      empresa: log.empresa || 'N/A',
      proyecto: log.proyecto || '',
      detalle: log.detalle || '',
      fecha: log.fecha ? new Date(log.fecha).toLocaleString() : '',
      resultado: log.resultado || 'informativo'
    }));

    const mockLogs = [
      { id: 'mock_1', accion: "aprobacion", actor: "Ana Díaz", rol: "Revisor" as const, empresa: "Lagos y Cía", proyecto: "Costanera Norte", detalle: "F30 SII Abril 2026", fecha: "18 May · 09:35", resultado: "exitoso" as const },
      { id: 'mock_2', accion: "rechazo", actor: "Carlos Martínez", rol: "Revisor" as const, empresa: "Constructora Vélez", proyecto: "Minera Los Andes", detalle: "Registro mutual ACHS (Ilegible)", fecha: "18 May · 09:12", resultado: "exitoso" as const },
      { id: 'mock_3', accion: "subida", actor: "Jorge Morales", rol: "Contratista" as const, empresa: "Servicios Norte Ltda.", proyecto: "", detalle: "Liquidación Mayo 2026", fecha: "18 May · 08:45", resultado: "informativo" as const, ip: "190.16.22.4" },
      { id: 'mock_4', accion: "acceso_fallido", actor: "Desconocido", rol: "Desconocido" as const, empresa: "N/A", proyecto: "", detalle: "Login fallido (Credenciales inválidas)", fecha: "18 May · 03:22", resultado: "bloqueado" as const },
      { id: 'mock_5', accion: "alerta", actor: "Sistema Automático", rol: "Sistema Automático" as const, empresa: "Constructora Vélez", proyecto: "", detalle: "3 Documentos Vencidos - Bloqueo de Acceso", fecha: "17 May · 23:59", resultado: "informativo" as const }
    ];

    return [...dbLogs, ...mockLogs];
  });

  React.useEffect(() => {
    if (activeTab === "auditoria") {
      const dbLogs = getAuditLogs().map(log => ({
        ...log,
        id: log.id,
        accion: log.accion,
        actor: log.actor || log.usuarioId,
        rol: log.rol === 'admin' ? 'Revisor' : log.rol === 'contratista' ? 'Contratista' : log.rol === 'sistema' ? 'Sistema Automático' : 'Desconocido',
        empresa: log.empresa || 'N/A',
        proyecto: log.proyecto || '',
        detalle: log.detalle || '',
        fecha: log.fecha ? new Date(log.fecha).toLocaleString() : '',
        resultado: log.resultado || 'informativo'
      }));

      const mockLogs = [
        { id: 'mock_1', accion: "aprobacion", actor: "Ana Díaz", rol: "Revisor" as const, empresa: "Lagos y Cía", proyecto: "Costanera Norte", detalle: "F30 SII Abril 2026", fecha: "18 May · 09:35", resultado: "exitoso" as const },
        { id: 'mock_2', accion: "rechazo", actor: "Carlos Martínez", rol: "Revisor" as const, empresa: "Constructora Vélez", proyecto: "Minera Los Andes", detalle: "Registro mutual ACHS (Ilegible)", fecha: "18 May · 09:12", resultado: "exitoso" as const },
        { id: 'mock_3', accion: "subida", actor: "Jorge Morales", rol: "Contratista" as const, empresa: "Servicios Norte Ltda.", proyecto: "", detalle: "Liquidación Mayo 2026", fecha: "18 May · 08:45", resultado: "informativo" as const, ip: "190.16.22.4" },
        { id: 'mock_4', accion: "acceso_fallido", actor: "Desconocido", rol: "Desconocido" as const, empresa: "N/A", proyecto: "", detalle: "Login fallido (Credenciales inválidas)", fecha: "18 May · 03:22", resultado: "bloqueado" as const },
        { id: 'mock_5', accion: "alerta", actor: "Sistema Automático", rol: "Sistema Automático" as const, empresa: "Constructora Vélez", proyecto: "", detalle: "3 Documentos Vencidos - Bloqueo de Acceso", fecha: "17 May · 23:59", resultado: "informativo" as const }
      ];

      setAuditoriaLogs([...dbLogs, ...mockLogs]);
    }
  }, [activeTab]);
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
      docsTotal: c.documentos.length,
      docsAprobados: c.documentos.filter(d => d.estado === 'aprobado').length,
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
          id: c.id,
          empresa: c.nombre,
          rut: c.rut,
          rol: "Contratista",
          cumplimiento,
          iniciales: c.nombre.split(" ").map(n => n[0]).join("").substring(0, 2),
          docsTotal: c.documentos.length,
          docsAprobados: c.documentos.filter(d => d.estado === 'aprobado').length,
        };
      });

      return {
        id: p.id,
        nombre: p.nombre,
        pendientes: p.id === 'costanera' ? 3 : p.id === 'solar' ? 1 : 0,
        urgentes: p.id === 'costanera' ? 3 : p.id === 'solar' ? 1 : 0,
        badge: p.id === 'costanera' || p.id === 'solar' ? "b-red" : "b-green",
        badgeLabel: p.id === 'costanera' ? "3 urgentes" : p.id === 'solar' ? "1 urgente" : "Al día",
        empresas
      };
    });

    return {
      id: m.id,
      empresa: m.nombre,
      rut: m.rut,
      iniciales: m.nombre.split(" ").map((n: string) => n[0]).join("").substring(0, 2),
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
    { id: "cola", label: "Cola de revisión", icon: ClipboardList, badge: pendingDocsCount },
    { id: "acreditaciones", label: "Acreditaciones", icon: ShieldCheck, section: "Operación" },
    { id: "mandantes", label: "Mandantes", icon: Building2, section: "Directorios" },
    { id: "contratistas", label: "Contratistas", icon: Users },
    { id: "plantillas", label: "Plantillas", icon: FileCode2, section: "Configuración" },
    { id: "reglas", label: "Reglas de vigencia", icon: SlidersHorizontal },
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
          <button
            onClick={() => setMobileMenuOpen(true)}
            className="md:hidden text-cream hover:text-white mr-3 focus:outline-none"
            title="Abrir menú"
          >
            <Menu size={20} className="text-cream" />
          </button>
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
              <div className="absolute top-11 w-[calc(100vw-24px)] max-w-[340px] bg-white rounded-xl shadow-2xl border border-cream3 z-[300] right-3 sm:right-0">
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
        <div className={`sidebar hidden md:flex flex-col ${sidebarCollapsed ? 'collapsed' : ''}`}>
          <div className={`sb-org flex ${sidebarCollapsed ? 'flex-col items-center gap-2' : 'justify-between items-center'} px-4 py-3 border-b border-white/5`}>
            {!sidebarCollapsed && (
              <div className="truncate flex-1">
                <div className="sb-org-name truncate">Panel Administración</div>
                <div className="sb-org-sub truncate">Acredita · Equipo revisor</div>
              </div>
            )}
            {sidebarCollapsed && (
              <div className="w-8 h-8 rounded-lg bg-brown text-white flex items-center justify-center font-bold text-sm shrink-0">
                A
              </div>
            )}
            <button 
              onClick={toggleSidebar} 
              className="text-gray-400 hover:text-white p-1 hover:bg-white/10 rounded-lg cursor-pointer transition-colors"
              title={sidebarCollapsed ? "Expandir menú" : "Colapsar menú"}
            >
              {sidebarCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
            </button>
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
                title={sidebarCollapsed ? item.label : undefined}
              >
                <item.icon size={18} className="shrink-0" />
                <span className="flex-1">{item.label}</span>
                {item.badge !== undefined && (
                  <span className={`sb-badge ${item.badgeTipo === "alerta" ? "sb-badge-alerta" : ""}`}>
                    {item.badge}
                  </span>
                )}
                {item.badgePunto && !sidebarCollapsed && (
                  <span className="w-2 h-2 rounded-full bg-[#c03030] shrink-0" title="Requiere atención" />
                )}
              </button>
            </React.Fragment>
          ))}
          <div className="sb-bottom">
            <button 
              className="sb-item w-full flex text-left mt-auto" 
              onClick={() => { logoutUser(); navigate('/'); }}
              title={sidebarCollapsed ? "Cerrar sesión" : undefined}
            >
              <LogOut size={18} className="shrink-0" /> 
              <span className="flex-1">Cerrar sesión</span>
            </button>
          </div>
        </div>

        {/* Mobile Sidebar Drawer Overlay */}
        {mobileMenuOpen && (
          <>
            <div 
              className="fixed inset-0 bg-black/60 z-[998] md:hidden" 
              onClick={() => setMobileMenuOpen(false)} 
            />
            <div className="fixed left-0 top-0 bottom-0 w-[260px] bg-navy z-[999] md:hidden flex flex-col pt-4 overflow-y-auto text-left shadow-2xl animate-slide-right">
              <div className="sb-org flex justify-between items-center pr-3 pb-3 border-b border-white/10">
                <div>
                  <div className="sb-org-name">Panel Administración</div>
                  <div className="sb-org-sub">Acredita · Equipo revisor</div>
                </div>
                <button onClick={() => setMobileMenuOpen(false)} className="text-gray-400 hover:text-white p-1">
                  <X size={20} />
                </button>
              </div>

              <div className="sb-label">Principal</div>
              {menuItems.map((item, index) => (
                <React.Fragment key={item.id}>
                  {item.section && (
                    <div className="sb-label mt-2">{item.section}</div>
                  )}
                  <button
                    onClick={() => { setActiveTab(item.id); setMobileMenuOpen(false); }}
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
                <button className="sb-item w-full flex text-left mt-auto" onClick={() => { logoutUser(); setMobileMenuOpen(false); navigate('/'); }}>
                  <LogOut size={18} /> Cerrar sesión
                </button>
              </div>
            </div>
          </>
        )}

        {/* MAIN CONTENT */}
        <div className="main">
          {/* DASHBOARD TAB */}
          {activeTab === "dashboard" && (
            <DashboardTab
              GLOBAL_CONTRATISTAS={GLOBAL_CONTRATISTAS}
              GLOBAL_PROYECTOS={GLOBAL_PROYECTOS}
              setActiveTab={setActiveTab}
              aprobadosHoy={aprobadosHoy}
              rechazadosHoy={rechazadosHoy}
              setSelectedDocId={setSelectedDocId}
              filtroActividad={filtroActividad}
              setFiltroActividad={setFiltroActividad}
              ACTIVIDAD_RECIENTE={ACTIVIDAD_RECIENTE}
              setActividadSeleccionada={setActividadSeleccionada}
              setSelectedAcreditacionContratista={setSelectedAcreditacionContratista}
            />
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
            <MandantesTab
              setShowInvitarModal={setShowInvitarModal}
              ARBOL_MANDANTES={ARBOL_MANDANTES}
              setClienteSeleccionado={setClienteSeleccionado}
            />
          )}

          {activeTab === "contratistas" && (
            <ContratistasTab
              EMPRESAS_CONTRATISTAS={EMPRESAS_CONTRATISTAS}
              setClienteSeleccionado={setClienteSeleccionado}
              GLOBAL_PROYECTOS={GLOBAL_PROYECTOS}
            />
          )}
          {activeTab === "plantillas" && (
            <PlantillasTab
              PLANTILLAS={PLANTILLAS}
              activeFilterPlantillas={activeFilterPlantillas}
              setActiveFilterPlantillas={setActiveFilterPlantillas}
              busquedaPlantilla={busquedaPlantilla}
              setBusquedaPlantilla={setBusquedaPlantilla}
              showSubirPlantillaModal={showSubirPlantillaModal}
              setShowSubirPlantillaModal={setShowSubirPlantillaModal}
              newTemplateName={newTemplateName}
              setNewTemplateName={setNewTemplateName}
              newTemplateCategory={newTemplateCategory}
              setNewTemplateCategory={setNewTemplateCategory}
              handleAddTemplate={handleAddTemplate}
            />
          )}

          {activeTab === "reglas" && (
            <ReglasTab reglas={reglas} setReglas={setReglas} showToast={showToast} />
          )}

          {activeTab === "auditoria" && (
            <AuditoriaTab
              auditoriaLogs={auditoriaLogs}
              filtroAccionLog={filtroAccionLog}
              setFiltroAccionLog={setFiltroAccionLog}
              filtroActorLog={filtroActorLog}
              setFiltroActorLog={setFiltroActorLog}
              filtroFechaLog={filtroFechaLog}
              setFiltroFechaLog={setFiltroFechaLog}
              busquedaLog={busquedaLog}
              setBusquedaLog={setBusquedaLog}
              expandedLogId={expandedLogId}
              setExpandedLogId={setExpandedLogId}
            />
          )}

          {activeTab === "acreditaciones" && (
            <AcreditacionesTab
              GLOBAL_CONTRATISTAS={GLOBAL_CONTRATISTAS}
              GLOBAL_PROYECTOS={GLOBAL_PROYECTOS}
              setSelectedAcreditacionContratista={setSelectedAcreditacionContratista}
              setActiveTab={setActiveTab}
            />
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
          <div className="bg-white rounded-xl shadow-xl w-full max-w-[440px] max-h-[calc(100vh-24px)] overflow-y-auto">
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
        <ClienteDetailDrawer
          clienteSeleccionado={clienteSeleccionado}
          setClienteSeleccionado={setClienteSeleccionado}
          tabCliente={tabCliente}
          setTabCliente={setTabCliente}
          busquedaDoc={busquedaDoc}
          setBusquedaDoc={setBusquedaDoc}
          filtroEstado={filtroEstado}
          setFiltroEstado={setFiltroEstado}
          ordenDoc={ordenDoc}
          setOrdenDoc={setOrdenDoc}
          showToast={showToast}
          setActividadSeleccionada={setActividadSeleccionada}
          GLOBAL_CONTRATISTAS={GLOBAL_CONTRATISTAS}
          GLOBAL_PROYECTOS={GLOBAL_PROYECTOS}
          GLOBAL_MANDANTES={GLOBAL_MANDANTES}
        />
      )}

      <DocumentoDetailModal
        actividadSeleccionada={actividadSeleccionada}
        setActividadSeleccionada={setActividadSeleccionada}
      />

      {selectedAcreditacionContratista && (
        <FichaAcreditacion
          tipo="empresa"
          contratista={selectedAcreditacionContratista}
          proyectoId={selectedAcreditacionContratista.proyectos[0] || 'costanera'}
          onClose={() => setSelectedAcreditacionContratista(null)}
          rol="admin"
          onRevisarDocumento={(doc) => {
            const dynamicCola = buildColaDocs(getContratistas(), getProyectos());
            const queueItem = dynamicCola.find(item => item.docId === doc.id || item.title === doc.nombre);
            if (queueItem) {
              setSelectedDocId(queueItem.id);
              setActiveTab('cola');
            } else {
              showToast('El documento ya está aprobado o no se encuentra pendiente en la cola de revisión.', 'warning');
            }
            setSelectedAcreditacionContratista(null);
          }}
        />
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
