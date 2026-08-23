import React, { useState, useEffect } from "react";
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
import { buildColaDocs, buildCorrectionDocs } from './admin/colaUtils';
import { GLOBAL_MANDANTES, GLOBAL_PROYECTOS, GLOBAL_CONTRATISTAS, GLOBAL_PLANTILLA_DOCUMENTOS } from './admin/globalData';
import { DocumentoRow, ProyectoRow } from './admin/RowComponents';
import MandantesTab from './admin/MandantesTab';
import ContratistasTab from './admin/ContratistasTab';
import AcreditacionesTab from './admin/AcreditacionesTab';
import PlantillasTab from './admin/PlantillasTab';
import ReglasTab from './admin/ReglasTab';
import FacturacionTab from './admin/FacturacionTab';
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
    const stored = localStorage.getItem('sidebar_collapsed');
    if (stored !== null) return stored === 'true';
    // Default collapsed on laptops (< ~1440px) so the dashboard's KPI row has
    // room to render at its intended spacious size without wrapping.
    return typeof window !== 'undefined' && window.innerWidth < 1440;
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

  // Cosmetic per-template metadata (version/downloads/update date) for the
  // 6 seeded templates only — anything added later gets fresh-item defaults
  // below instead of borrowing one of these entries by coincidence of index.
  const PLANTILLAS_META = [
    { version: 'v3.2', actualizacion: '21 Ago 2026', descargasTotal: 246, descargasMes: 82, porActualizar: true },
    { version: 'v4.0', actualizacion: '18 Ago 2026', descargasTotal: 221, descargasMes: 76, porActualizar: false },
    { version: 'v2.1', actualizacion: '19 Ago 2026', descargasTotal: 138, descargasMes: 51, porActualizar: true },
    { version: 'v2.4', actualizacion: '15 Ago 2026', descargasTotal: 177, descargasMes: 39, porActualizar: false },
    { version: 'v1.4', actualizacion: '05 Ago 2026', descargasTotal: 94, descargasMes: 28, porActualizar: false },
    { version: 'v1.2', actualizacion: '02 Ago 2026', descargasTotal: 61, descargasMes: 17, porActualizar: false },
  ];

  const PLANTILLAS_DESCRIPCION: Record<string, string> = {
    liquidacion: "Comprobante mensual de remuneración del trabajador, con descuentos legales y base imponible.",
    f30: "Certificado de cumplimiento de obligaciones laborales y previsionales emitido por el SII.",
    contrato: "Formato estándar de contrato individual para trabajadores contratados por obra o faena, con cláusulas legales al día.",
    mutual: "Certificado de afiliación y cotizaciones al día ante la mutual de seguridad.",
    antecedentes: "Certificado de antecedentes penales vigente del trabajador.",
    odi: "Obligación de informar los riesgos laborales asociados a la faena, firmada por el trabajador.",
  };

  const PLANTILLAS = GLOBAL_PLANTILLA_DOCUMENTOS.map((p: any, idx) => {
    const tipo = p.tipo || (idx % 2 === 0 ? "gratuita" : "upsell");
    const meta = idx < PLANTILLAS_META.length
      ? PLANTILLAS_META[idx]
      : { version: 'v1.0', actualizacion: '22 Ago 2026', descargasTotal: 0, descargasMes: 0, porActualizar: false };

    return {
      id: idx + 1,
      nombre: p.nombre,
      categoria: p.categoria,
      tipo,
      modalidad: tipo === 'upsell' ? 'Servicio Acredita' : 'Plantilla gratuita',
      estado: 'Activa',
      ...meta,
      descripcion: PLANTILLAS_DESCRIPCION[p.id] || `Modelo de documento ${p.categoria.toLowerCase()} para contratistas.`
    };
  });

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
  // Fuente reactiva de contratistas: se actualiza explícitamente al
  // invitar/reasignar (para que la tabla cambie al instante, sin depender
  // de que algún otro estado fuerce un re-render) y se resincroniza al
  // cambiar de pestaña, para no perder cambios guardados por otros flujos
  // (p. ej. Cola de revisión) que escriben en localStorage por su cuenta.
  const [contratistas, setContratistas] = useState<Contratista[]>(() => getContratistas());
  useEffect(() => {
    setContratistas(getContratistas());
  }, [activeTab]);
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
  const [selectedDocKey, setSelectedDocKey] = useState<string | null>(null);
  const [selectedAcreditacionContratista, setSelectedAcreditacionContratista] = useState<any>(null);
  const [showNotif, setShowNotif] = useState(false);
  const [clienteSeleccionado, setClienteSeleccionado] = useState<any>(null);
  const [tabCliente, setTabCliente] = useState("resumen");
  // Proyecto desde el que se abrió el drawer de Contratistas (si el usuario
  // tenía un filtro de proyecto activo), independiente de _fichaProyectoId
  // que usa FichaAcreditacion. Se limpia solo al cerrar el drawer, nunca
  // queda pegado al contratista siguiente.
  const [proyectoContextoContratista, setProyectoContextoContratista] = useState<string | null>(null);
  useEffect(() => {
    if (!clienteSeleccionado) setProyectoContextoContratista(null);
  }, [clienteSeleccionado]);
  const [busquedaGlobal, setBusquedaGlobal] = useState("");
  const [busquedaAbierta, setBusquedaAbierta] = useState(false);
  const [activeFilterPlantillas, setActiveFilterPlantillas] = useState("Todas");
  const [busquedaPlantilla, setBusquedaPlantilla] = useState("");
  const [showSubirPlantillaModal, setShowSubirPlantillaModal] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState("");
  const [newTemplateCategory, setNewTemplateCategory] = useState("Laboral");
  const [newTemplateTipo, setNewTemplateTipo] = useState("gratuita");

  const handleAddTemplate = () => {
    if (!newTemplateName.trim()) return;
    const newId = 'p_' + Date.now();
    const newTemplate = {
      id: newId,
      nombre: newTemplateName,
      categoria: newTemplateCategory,
      tipo: newTemplateTipo,
      frecuencia: 'Única'
    };
    const list = getPlantillas();
    list.push(newTemplate);
    savePlantillas(list);

    setNewTemplateName("");
    setNewTemplateCategory("Laboral");
    setNewTemplateTipo("gratuita");
    setShowSubirPlantillaModal(false);
    showToast("Plantilla creada correctamente");
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
      fecha: log.fecha || '',
      resultado: log.resultado || 'informativo'
    }));

    // Historial ilustrativo del equipo interno (no hay múltiples cuentas de
    // revisor en el demo), usando el vocabulario real de acciones y
    // contratistas/proyectos reales de la plataforma.
    const haceMin = (n: number) => new Date(Date.now() - n * 60000).toISOString();
    const mockLogs = [
      { id: 'AUD-00018452', accion: 'aprobacion_documento', actor: 'María González', rol: 'Revisor' as const, empresa: 'Servicios Norte', proyecto: 'Costanera Norte', detalle: 'Certificado de Antecedentes', fecha: haceMin(8), resultado: 'exitoso' as const, estadoAnterior: 'Pendiente de revisión', estadoNuevo: 'Aprobado' },
      { id: 'AUD-00018451', accion: 'desbloqueo_pago', actor: 'Felipe Muñoz', rol: 'Revisor' as const, empresa: 'Servicios Norte', proyecto: 'Costanera Norte', detalle: 'Liberación de pago autorizada', fecha: haceMin(14), resultado: 'exitoso' as const, estadoAnterior: 'Listo', estadoNuevo: 'Liberado' },
      { id: 'AUD-00018450', accion: 'rechazo_documento', actor: 'Carlos Soto', rol: 'Revisor' as const, empresa: 'Eléctrica Sur', proyecto: 'Torre Mackenna', detalle: 'Registro Mutual ACHS', fecha: haceMin(26), resultado: 'bloqueado' as const, estadoAnterior: 'Pendiente de revisión', estadoNuevo: 'Rechazado' },
      { id: 'AUD-00018449', accion: 'rechazo_documento', actor: 'María González', rol: 'Revisor' as const, empresa: 'Constructora Vélez', proyecto: 'Costanera Norte', detalle: 'F30 SII (mes vigente)', fecha: haceMin(42), resultado: 'bloqueado' as const, estadoAnterior: 'Pendiente de revisión', estadoNuevo: 'Rechazado' },
      { id: 'AUD-00018448', accion: 'cambios_relevantes_acreditacion', actor: 'Ana Ruiz', rol: 'Revisor' as const, empresa: 'TécnicoSur SpA', proyecto: 'Bodega Logística Sur', detalle: 'Falta firma en Contrato de Trabajo', fecha: haceMin(58), resultado: 'informativo' as const, estadoAnterior: 'Rechazado', estadoNuevo: 'Corrección solicitada' },
      { id: 'AUD-00018447', accion: 'aceptacion_invitacion', actor: 'Carlos Soto', rol: 'Revisor' as const, empresa: 'Lagos y Cía', proyecto: '', detalle: 'Se actualizó correo de contacto del responsable documental', fecha: haceMin(75), resultado: 'exitoso' as const, estadoAnterior: 'contacto@lagoscia.cl', estadoNuevo: 'documentos@lagoscia.cl' },
      { id: 'AUD-00018446', accion: 'desbloqueo_acceso', actor: 'Ana Ruiz', rol: 'Revisor' as const, empresa: 'TécnicoSur SpA', proyecto: 'Ampliación Planta Solar', detalle: 'Proyecto habilitado para revisión de contratistas', fecha: haceMin(96), resultado: 'exitoso' as const, estadoAnterior: 'En preparación', estadoNuevo: 'Activo' },
      { id: 'AUD-00018445', accion: 'creacion_invitacion', actor: 'Felipe Muñoz', rol: 'Revisor' as const, empresa: 'Constructora Vélez', proyecto: 'Costanera Norte', detalle: 'Contratista incorporado y enviado al flujo de acreditación', fecha: haceMin(130), resultado: 'exitoso' as const, estadoAnterior: 'No existe', estadoNuevo: 'Activo' },
      { id: 'AUD-00018444', accion: 'aprobacion_documento', actor: 'Carlos Soto', rol: 'Revisor' as const, empresa: 'Lagos y Cía', proyecto: 'Costanera Norte', detalle: 'ODI 2026', fecha: haceMin(150), resultado: 'exitoso' as const, estadoAnterior: 'Pendiente de revisión', estadoNuevo: 'Aprobado' },
      { id: 'AUD-00018443', accion: 'aprobacion_documento', actor: 'María González', rol: 'Revisor' as const, empresa: 'Eléctrica Sur', proyecto: 'Torre Mackenna', detalle: 'Contrato de Trabajo', fecha: haceMin(175), resultado: 'exitoso' as const, estadoAnterior: 'Pendiente de revisión', estadoNuevo: 'Aprobado' },
      { id: 'AUD-00018442', accion: 'login_exitoso', actor: 'Ana Ruiz', rol: 'Revisor' as const, empresa: 'N/A', proyecto: '', detalle: 'Inicio de sesión en el panel de administración', fecha: haceMin(200), resultado: 'exitoso' as const, ip: '190.16.22.4' },
    ];

    return [...dbLogs, ...mockLogs];
  });

  const [showInvitarModal, setShowInvitarModal] = useState(false);
  const [invitacionEnviada, setInvitacionEnviada] = useState(false);
  const [formInvitacion, setFormInvitacion] = useState({
    nombre: "",
    empresa: "",
    rut: "",
    correo: "",
    industria: "",
  });

  const [showInvitarContratistaModal, setShowInvitarContratistaModal] = useState(false);
  const [resultadoInvitarContratista, setResultadoInvitarContratista] = useState<null | 'nuevo' | 'agregado' | 'ya_asignado'>(null);
  const [formInvitarContratista, setFormInvitarContratista] = useState({
    empresa: "",
    rut: "",
    correo: "",
    proyectoId: "",
  });

  const resetFormInvitarContratista = () => {
    setShowInvitarContratistaModal(false);
    setResultadoInvitarContratista(null);
    setFormInvitarContratista({ empresa: "", rut: "", correo: "", proyectoId: "" });
  };

  const handleInvitarContratista = (e: React.FormEvent) => {
    e.preventDefault();
    const { empresa, rut, correo, proyectoId } = formInvitarContratista;
    if (!empresa.trim() || !rut.trim() || !correo.trim() || !proyectoId) return;

    const list = getContratistas();
    const rutNormalizado = rut.trim().toLowerCase();
    const existente = list.find(c => c.rut.trim().toLowerCase() === rutNormalizado);

    if (existente) {
      if (existente.proyectos.includes(proyectoId)) {
        setResultadoInvitarContratista('ya_asignado');
        return;
      }
      existente.proyectos.push(proyectoId);
      saveContratistas(list);
      setContratistas([...list]);
      setResultadoInvitarContratista('agregado');
    } else {
      const nuevo: Contratista = {
        id: `c_${Date.now()}`,
        nombre: empresa,
        rut,
        proyectos: [proyectoId],
        documentos: [],
        trabajadores: [],
        isNew: true,
      };
      list.push(nuevo);
      saveContratistas(list);
      setContratistas([...list]);
      setResultadoInvitarContratista('nuevo');
    }
  };

  const handleSelectDoc = (doc: any) => {
    setSelectedDoc(doc);
  };

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
    ...GLOBAL_MANDANTES.map(m => ({ tipo: "empresa", label: m.nombre, sub: "Mandante", data: m, esMandante: true })),
    ...GLOBAL_CONTRATISTAS.map(c => ({ tipo: "empresa", label: c.nombre, sub: c.isNew ? "Contratista (Nuevo)" : "Contratista", data: c, esMandante: false })),
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
                          onClick={() => {
                            if ((r as any).esMandante) {
                              setActiveTab('mandantes');
                            } else {
                              setClienteSeleccionado(r.data);
                            }
                            setBusquedaAbierta(false);
                            setBusquedaGlobal("");
                          }}
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
              GLOBAL_CONTRATISTAS={contratistas}
              GLOBAL_PROYECTOS={GLOBAL_PROYECTOS}
              setActiveTab={setActiveTab}
              aprobadosHoy={aprobadosHoy}
              rechazadosHoy={rechazadosHoy}
              setSelectedDocKey={setSelectedDocKey}
            />
          )}

          {/* COLA TAB */}
          {activeTab === "cola" && (
            <ColaRevisionTab
              onVerEmpresa={setClienteSeleccionado}
              selectedDocKey={selectedDocKey}
              setSelectedDocKey={setSelectedDocKey}
              aprobadosHoy={aprobadosHoy}
              setAprobadosHoy={setAprobadosHoy}
              rechazadosHoy={rechazadosHoy}
              setRechazadosHoy={setRechazadosHoy}
              showToast={showToast}
            />
          )}

          {/* Simple Placeholders for other tabs to save space */}
          {activeTab === "mandantes" && (
            <MandantesTab
              setShowInvitarModal={setShowInvitarModal}
              GLOBAL_CONTRATISTAS={contratistas}
              GLOBAL_PROYECTOS={GLOBAL_PROYECTOS}
              GLOBAL_MANDANTES={GLOBAL_MANDANTES}
              onVerFicha={(contratista, proyectoId) =>
                setSelectedAcreditacionContratista({ ...contratista, _fichaProyectoId: proyectoId })
              }
            />
          )}

          {activeTab === "contratistas" && (
            <ContratistasTab
              GLOBAL_CONTRATISTAS={contratistas}
              GLOBAL_PROYECTOS={GLOBAL_PROYECTOS}
              GLOBAL_MANDANTES={GLOBAL_MANDANTES}
              onVerContratista={(contratista, proyectoId) => {
                setClienteSeleccionado(contratista);
                setProyectoContextoContratista(proyectoId || null);
              }}
              setShowInvitarContratistaModal={setShowInvitarContratistaModal}
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
              newTemplateTipo={newTemplateTipo}
              setNewTemplateTipo={setNewTemplateTipo}
              handleAddTemplate={handleAddTemplate}
              GLOBAL_CONTRATISTAS={GLOBAL_CONTRATISTAS}
              GLOBAL_PROYECTOS={GLOBAL_PROYECTOS}
              showToast={showToast}
            />
          )}

          {activeTab === "reglas" && (
            <ReglasTab reglas={reglas} setReglas={setReglas} showToast={showToast} GLOBAL_CONTRATISTAS={GLOBAL_CONTRATISTAS} GLOBAL_PROYECTOS={GLOBAL_PROYECTOS} />
          )}

          {activeTab === "auditoria" && (
            <AuditoriaTab
              auditoriaLogs={auditoriaLogs}
              GLOBAL_CONTRATISTAS={GLOBAL_CONTRATISTAS}
              showToast={showToast}
            />
          )}

          {activeTab === "acreditaciones" && (
            <AcreditacionesTab
              GLOBAL_CONTRATISTAS={contratistas}
              GLOBAL_PROYECTOS={GLOBAL_PROYECTOS}
              GLOBAL_MANDANTES={GLOBAL_MANDANTES}
              setSelectedAcreditacionContratista={setSelectedAcreditacionContratista}
              onIrARevision={(docKey) => {
                setSelectedDocKey(docKey);
                setActiveTab('cola');
              }}
              showToast={showToast}
            />
          )}

          {activeTab === "facturacion" && (
            <FacturacionTab
              GLOBAL_MANDANTES={GLOBAL_MANDANTES}
              GLOBAL_CONTRATISTAS={GLOBAL_CONTRATISTAS}
              GLOBAL_PROYECTOS={GLOBAL_PROYECTOS}
              showToast={showToast}
            />
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
                        rut: "",
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
                    if (!formInvitacion.nombre.trim() || !formInvitacion.empresa.trim() || !formInvitacion.rut.trim() || !formInvitacion.correo.trim()) {
                      return;
                    }
                    const newMandante = {
                      id: `m_${Date.now()}`,
                      nombre: formInvitacion.empresa,
                      rut: formInvitacion.rut,
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
                      Nombre del contacto
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
                      placeholder="Nombre y apellido"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-[13.2px] font-medium text-gray-700 mb-1.5">
                      Empresa / Razón social
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
                      RUT
                    </label>
                    <input
                      type="text"
                      value={formInvitacion.rut}
                      onChange={(e) =>
                        setFormInvitacion({
                          ...formInvitacion,
                          rut: e.target.value,
                        })
                      }
                      className="form-input w-full p-2.5 border border-cream3 rounded-lg focus:border-brown focus:ring-1 focus:ring-brown outline-none transition-all"
                      placeholder="76.999.999-9"
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
                      Industria <span className="text-gray-400 font-normal">(opcional)</span>
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

      {showInvitarContratistaModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-[440px] max-h-[calc(100vh-24px)] overflow-y-auto">
            <div className="flex justify-between items-center p-4 border-b border-cream">
              <h3 className="font-medium text-navy text-[17.6px]">
                Invitar Contratista
              </h3>
              <button
                onClick={resetFormInvitarContratista}
                className="text-gray-400 hover:text-gray-600"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-6">
              {resultadoInvitarContratista === 'ya_asignado' ? (
                <div className="text-center py-4">
                  <div className="bg-amber-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                    <AlertTriangle size={32} className="text-amber-600" />
                  </div>
                  <h4 className="text-lg font-medium text-navy mb-2">
                    Ya está asignado
                  </h4>
                  <p className="text-gray-600 text-sm leading-relaxed mb-6">
                    Este contratista ya está asignado a este proyecto.
                  </p>
                  <button
                    onClick={resetFormInvitarContratista}
                    className="btn btn-primary w-full justify-center"
                  >
                    Entendido
                  </button>
                </div>
              ) : resultadoInvitarContratista ? (
                <div className="text-center py-4">
                  <div className="bg-green-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Mail size={32} className="text-green-600" />
                  </div>
                  <h4 className="text-lg font-medium text-navy mb-2">
                    {resultadoInvitarContratista === 'nuevo' ? 'Contratista agregado' : 'Proyecto agregado'}
                  </h4>
                  <p className="text-gray-600 text-sm leading-relaxed mb-6">
                    {resultadoInvitarContratista === 'nuevo' ? (
                      <><span className="font-medium">{formInvitarContratista.empresa}</span> fue agregado correctamente.</>
                    ) : (
                      <>Se agregó el proyecto seleccionado a <span className="font-medium">{formInvitarContratista.empresa}</span>.</>
                    )}
                  </p>
                  <button
                    onClick={resetFormInvitarContratista}
                    className="btn btn-primary w-full justify-center"
                  >
                    Entendido
                  </button>
                </div>
              ) : (
                <form onSubmit={handleInvitarContratista} className="flex flex-col gap-4">
                  <div>
                    <label className="block text-[13.2px] font-medium text-gray-700 mb-1.5">
                      Razón social
                    </label>
                    <input
                      type="text"
                      value={formInvitarContratista.empresa}
                      onChange={(e) =>
                        setFormInvitarContratista({ ...formInvitarContratista, empresa: e.target.value })
                      }
                      className="form-input w-full p-2.5 border border-cream3 rounded-lg focus:border-brown focus:ring-1 focus:ring-brown outline-none transition-all"
                      placeholder="Nombre de la empresa"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-[13.2px] font-medium text-gray-700 mb-1.5">
                      RUT
                    </label>
                    <input
                      type="text"
                      value={formInvitarContratista.rut}
                      onChange={(e) =>
                        setFormInvitarContratista({ ...formInvitarContratista, rut: e.target.value })
                      }
                      className="form-input w-full p-2.5 border border-cream3 rounded-lg focus:border-brown focus:ring-1 focus:ring-brown outline-none transition-all"
                      placeholder="76.999.999-9"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-[13.2px] font-medium text-gray-700 mb-1.5">
                      Correo de contacto
                    </label>
                    <input
                      type="email"
                      value={formInvitarContratista.correo}
                      onChange={(e) =>
                        setFormInvitarContratista({ ...formInvitarContratista, correo: e.target.value })
                      }
                      className="form-input w-full p-2.5 border border-cream3 rounded-lg focus:border-brown focus:ring-1 focus:ring-brown outline-none transition-all"
                      placeholder="documentos@empresa.cl"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-[13.2px] font-medium text-gray-700 mb-1.5">
                      Proyecto
                    </label>
                    <select
                      value={formInvitarContratista.proyectoId}
                      onChange={(e) =>
                        setFormInvitarContratista({ ...formInvitarContratista, proyectoId: e.target.value })
                      }
                      className="form-input w-full p-2.5 border border-cream3 rounded-lg focus:border-brown focus:ring-1 focus:ring-brown outline-none transition-all"
                      required
                    >
                      <option value="">Selecciona un proyecto...</option>
                      {GLOBAL_PROYECTOS.map(p => {
                        const mandante = GLOBAL_MANDANTES.find(m => m.id === p.mandanteId);
                        return (
                          <option key={p.id} value={p.id}>
                            {mandante ? `${mandante.nombre} · ` : ''}{p.nombre}
                          </option>
                        );
                      })}
                    </select>
                  </div>

                  <div className="flex justify-end gap-3 mt-4 pt-4 border-t border-cream">
                    <button
                      type="button"
                      onClick={resetFormInvitarContratista}
                      className="btn btn-ghost font-medium"
                    >
                      Cancelar
                    </button>
                    <button type="submit" className="btn btn-primary">
                      Agregar contratista
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
          GLOBAL_CONTRATISTAS={contratistas}
          GLOBAL_PROYECTOS={GLOBAL_PROYECTOS}
          GLOBAL_MANDANTES={GLOBAL_MANDANTES}
          proyectoContexto={proyectoContextoContratista}
          onVerAcreditacion={(contratista, proyectoId, trabajador) => {
            setSelectedAcreditacionContratista({ ...contratista, _fichaProyectoId: proyectoId, _fichaTrabajador: trabajador });
          }}
          onIrARevision={(docKey) => {
            setSelectedDocKey(docKey);
            setActiveTab('cola');
            setClienteSeleccionado(null);
          }}
        />
      )}

      <DocumentoDetailModal
        actividadSeleccionada={actividadSeleccionada}
        setActividadSeleccionada={setActividadSeleccionada}
      />

      {selectedAcreditacionContratista && (
        <FichaAcreditacion
          tipo={selectedAcreditacionContratista._fichaTrabajador ? 'trabajador' : 'empresa'}
          trabajador={selectedAcreditacionContratista._fichaTrabajador}
          contratista={selectedAcreditacionContratista}
          proyectoId={selectedAcreditacionContratista._fichaProyectoId || selectedAcreditacionContratista.proyectos[0] || 'costanera'}
          onClose={() => setSelectedAcreditacionContratista(null)}
          rol="admin"
          onRevisarDocumento={(doc) => {
            const contratistasActuales = getContratistas();
            const proyectosActuales = getProyectos();
            const dynamicCola = buildColaDocs(contratistasActuales, proyectosActuales);
            const dynamicCorreccion = buildCorrectionDocs(contratistasActuales, proyectosActuales);
            const contratistaId = selectedAcreditacionContratista.id;
            const queueItem =
              dynamicCola.find(item => item.contratistaId === contratistaId && item.docId === doc.id) ||
              dynamicCorreccion.find(item => item.contratistaId === contratistaId && item.docId === doc.id);
            if (queueItem) {
              setSelectedDocKey(queueItem.key);
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
