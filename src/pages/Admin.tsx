import React, { useState, useEffect, useMemo } from "react";
import { useNavigate } from 'react-router-dom';
import {
  Bell,
  LayoutDashboard,
  ClipboardList,
  Users,
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
  ShieldAlert,
  List,
  FolderOpen,
  Folder,
  ArrowRight,
  Search,
  ArrowLeft,
  ChevronRight, Briefcase, Menu, ChevronLeft, UserCheck, Settings
} from "lucide-react";
import { getContratistas, saveContratistas, getProyectos, saveProyectos, getMandantes, saveMandantes, getRequisitos, saveRequisitos, calcularEstadoAcreditacion, calcularEstadoTrabajador, getAlertasVigencia, esVencidoPorFecha, obtenerDiasRestantes, logoutUser, getCurrentSession } from "../data/localStorageDb";
import { Contratista, Proyecto, Requisito, Verificador, ClaimRevision } from "../types";
import FichaAcreditacion from '../components/FichaAcreditacion';
import ColaRevisionTab from './admin/ColaRevisionTab';
import { buildColaDocs, buildCorrectionDocs } from './admin/colaUtils';
import { pruneClaimsRevision } from './admin/verificadorUtils';
import { GLOBAL_MANDANTES, GLOBAL_PROYECTOS, GLOBAL_CONTRATISTAS } from './admin/globalData';
import { DocumentoRow, ProyectoRow } from './admin/RowComponents';
import MandantesTab from './admin/MandantesTab';
import ContratistasTab from './admin/ContratistasTab';
import ProyectosTab from './admin/ProyectosTab';
import ProyectoDetailDrawer from './admin/ProyectoDetailDrawer';
import VerificadoresTab from './admin/VerificadoresTab';
import VerificadorDetailDrawer from './admin/VerificadorDetailDrawer';
import ConfiguracionTab from './admin/ConfiguracionTab';
import AcreditacionesTab from './admin/AcreditacionesTab';
import AuditoriaTab from './admin/AuditoriaTab';
import DashboardTab from './admin/DashboardTab';
import ClienteDetailDrawer from './admin/ClienteDetailDrawer';
import DocumentoDetailModal from './admin/DocumentoDetailModal';
import { loadSupabaseAuditLogs } from '../data/supabaseAuditData';
import { refreshReviewOperationsCache } from '../data/supabaseReviewOperations';
import OperationalNotificationsPanel from '../components/OperationalNotificationsPanel';
import { buildAdminNotifications, type OperationalNotification } from '../data/operationalNotifications';
import { loadReadNotificationKeys, markNotificationKeysRead } from '../data/supabaseNotifications';

const iniciales = (nombre: string) =>
  nombre.split(' ').filter(Boolean).map(n => n[0]).join('').substring(0, 2).toUpperCase();

export default function AdminPortal() {
  const navigate = useNavigate();
  const session = getCurrentSession();
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
  // Mismo patrón para proyectos (creación de "Nuevo proyecto" desde
  // Proyectos) y requisitos (alta/edición/activación desde el drawer de
  // Proyecto), para que ambos aparezcan al instante sin recargar.
  const [proyectos, setProyectos] = useState<Proyecto[]>(() => getProyectos());
  const [requisitos, setRequisitos] = useState<Requisito[]>(() => getRequisitos());
  // Equipo de verificación y claims de la Cola de revisión: única fuente
  // reactiva compartida entre ColaRevisionTab y VerificadoresTab, para que
  // "tomar revisión"/aprobar/rechazar en Cola se refleje al instante en
  // Verificadores (y viceversa) sin depender de un refresh manual.
  const [verificadores, setVerificadores] = useState<Verificador[]>([]);
  const [claimsRevision, setClaimsRevisionState] = useState<ClaimRevision[]>([]);
  const setClaimsRevision = (next: ClaimRevision[]) => setClaimsRevisionState(next);
  useEffect(() => {
    const freshContratistas = getContratistas();
    const freshProyectos = getProyectos();
    setContratistas(freshContratistas);
    setProyectos(freshProyectos);
    setRequisitos(getRequisitos());
    void refreshReviewOperationsCache().then(snapshot => {
      setVerificadores(snapshot.verificadores);
      setVerificadorActualIdState(snapshot.currentReviewerId);
      setClaimsRevision(pruneClaimsRevision(snapshot.claims, freshContratistas, freshProyectos));
    }).catch(() => {
      // Conserva el último snapshot válido si Supabase tiene una interrupción breve.
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
  const [notificacionesLeidas, setNotificacionesLeidas] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!session?.profileId) return;
    let cancelled = false;
    loadReadNotificationKeys(session.profileId, session)
      .then(keys => { if (!cancelled) setNotificacionesLeidas(keys); })
      .catch(() => { if (!cancelled) setNotificacionesLeidas(new Set()); });
    return () => { cancelled = true; };
  }, [session?.profileId]);
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
  const [proyectoSeleccionado, setProyectoSeleccionado] = useState<any>(null);
  const [tabProyecto, setTabProyecto] = useState("resumen");
  useEffect(() => {
    if (!proyectoSeleccionado) setTabProyecto("resumen");
  }, [proyectoSeleccionado]);
  const [verificadorSeleccionado, setVerificadorSeleccionado] = useState<any>(null);
  const [tabVerificador, setTabVerificador] = useState("resumen");
  useEffect(() => {
    if (!verificadorSeleccionado) setTabVerificador("resumen");
  }, [verificadorSeleccionado]);
  // El revisor operativo es la identidad Acredita autenticada que devuelve Supabase.
  const [verificadorActualId, setVerificadorActualIdState] = useState<string | null>(null);
  const topbarVerificador = useMemo(
    () => verificadores.find(item => item.id === verificadorActualId) || null,
    [verificadores, verificadorActualId],
  );
  const [busquedaGlobal, setBusquedaGlobal] = useState("");
  const [busquedaAbierta, setBusquedaAbierta] = useState(false);

  const [auditoriaLogs, setAuditoriaLogs] = useState<any[]>([]);

  useEffect(() => {
    if (activeTab !== "auditoria") return;
    let cancelled = false;
    loadSupabaseAuditLogs()
      .then((logs) => {
        if (!cancelled) setAuditoriaLogs(logs);
      })
      .catch(() => {
        if (!cancelled) setAuditoriaLogs([]);
      });
    return () => { cancelled = true; };
  }, [activeTab]);

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

  const [showNuevoProyectoModal, setShowNuevoProyectoModal] = useState(false);
  const [formNuevoProyecto, setFormNuevoProyecto] = useState({ nombre: "", mandanteId: "" });

  const resetFormNuevoProyecto = () => {
    setShowNuevoProyectoModal(false);
    setFormNuevoProyecto({ nombre: "", mandanteId: "" });
  };

  const handleCrearProyecto = (e: React.FormEvent) => {
    e.preventDefault();
    const { nombre, mandanteId } = formNuevoProyecto;
    if (!nombre.trim() || !mandanteId) return;

    const nuevoProyecto: Proyecto = {
      id: `p_${Date.now()}`,
      nombre: nombre.trim(),
      mandanteId,
      estado: 'Activo',
      contratistas: [],
    };
    const listaProyectos = getProyectos();
    listaProyectos.push(nuevoProyecto);
    saveProyectos(listaProyectos);
    setProyectos([...listaProyectos]);

    const listaMandantes = getMandantes();
    const mandante = listaMandantes.find(m => m.id === mandanteId);
    if (mandante && !mandante.proyectos.includes(nuevoProyecto.id)) {
      mandante.proyectos.push(nuevoProyecto.id);
      saveMandantes(listaMandantes);
    }

    resetFormNuevoProyecto();
    showToast("Proyecto creado correctamente");
  };

  const handleSelectDoc = (doc: any) => {
    setSelectedDoc(doc);
  };

  const hayAccesosFallidos = auditoriaLogs.some((log: any) =>
    log.accion?.toLowerCase().includes("fallido") || log.accion?.toLowerCase().includes("error")
  );

  const pendingDocsCount = buildColaDocs(GLOBAL_CONTRATISTAS, GLOBAL_PROYECTOS).length;

  const notificacionesOperativas = buildAdminNotifications(contratistas, proyectos, pendingDocsCount);
  const notificacionesSinLeer = notificacionesOperativas.filter(item => !notificacionesLeidas.has(item.id)).length;

  const marcarNotificacionesLeidas = (ids: string[]) => {
    setNotificacionesLeidas(actual => {
      const next = new Set(actual);
      ids.forEach(id => next.add(id));
      return next;
    });
    if (session?.profileId) void markNotificationKeysRead(session.profileId, ids, session).catch(() => undefined);
  };

  const abrirNotificacionOperativa = (notificacion: OperationalNotification) => {
    marcarNotificacionesLeidas([notificacion.id]);
    if (notificacion.destino === 'cola') setActiveTab('cola');
    else if (notificacion.destino === 'acreditacion') setActiveTab('acreditaciones');
    else {
      setActiveTab('proyectos');
      if (notificacion.proyectoId) {
        const proyecto = proyectos.find(item => item.id === notificacion.proyectoId);
        if (proyecto) setProyectoSeleccionado(proyecto);
      }
    }
    setShowNotif(false);
  };


  const menuItems: Array<{ id: string; label: string; icon: any; badge?: number; section?: string; badgeTipo?: string; badgePunto?: boolean }> = [
    { id: "dashboard", label: "Inicio", icon: LayoutDashboard },
    { id: "cola", label: "Cola de revisión", icon: ClipboardList, badge: pendingDocsCount },
    { id: "acreditaciones", label: "Acreditaciones", icon: ShieldCheck, section: "Operación" },
    { id: "mandantes", label: "Mandantes", icon: Building2, section: "Directorios" },
    { id: "contratistas", label: "Contratistas", icon: Users },
    { id: "proyectos", label: "Proyectos", icon: FolderOpen },
    { id: "verificadores", label: "Verificadores", icon: UserCheck },
    { id: "auditoria", label: "Auditoría", icon: ShieldAlert, section: "Sistema", badgePunto: hayAccesosFallidos, badgeTipo: "alerta" },
    { id: "configuracion", label: "Configuración", icon: Settings },
  ];

  const PROYECTOS_BUSQUEDA = proyectos.map(p => {
    const mandante = GLOBAL_MANDANTES.find(m => m.id === p.mandanteId);
    return {
      nombre: p.nombre,
      mandante: mandante ? mandante.nombre : "Mandante no disponible",
      proyecto: p,
    };
  });

  const indiceBusqueda = [
    ...GLOBAL_MANDANTES.map(m => ({ tipo: "empresa", label: m.nombre, sub: "Mandante", data: m, esMandante: true })),
    ...GLOBAL_CONTRATISTAS.map(c => ({ tipo: "empresa", label: c.nombre, sub: c.isNew ? "Contratista (Nuevo)" : "Contratista", data: c, esMandante: false })),
    ...ACTIVIDAD_RECIENTE.map(a => ({ tipo: "documento", label: a.documento, sub: `${a.empresa} · ${a.estado}`, data: a })),
    ...PROYECTOS_BUSQUEDA.map(p => ({ tipo: "proyecto", label: p.nombre, sub: p.mandante, data: p })),
    ...verificadores.map(v => ({
      tipo: "revisor",
      label: v.nombre,
      sub: `${v.rol === 'supervisor' ? 'Supervisor' : 'Verificador'} · ${v.estado === 'online' ? 'Online' : 'Offline'}`,
      data: v,
    })),
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
                          onClick={() => {
                            setActiveTab('proyectos');
                            setProyectoSeleccionado((r.data as any).proyecto);
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
                  {resultadosPorTipo.revisor.length > 0 && (
                    <div className="p-2 border-t border-cream3">
                      <p className="text-[10.5px] uppercase tracking-wider text-gray-400 font-semibold px-2 py-1">Revisores</p>
                      {resultadosPorTipo.revisor.map((r, i) => (
                        <div
                          key={i}
                          onClick={() => {
                            setActiveTab('verificadores');
                            setVerificadorSeleccionado(r.data as any);
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
                </>
              )}
            </div>
          )}
        </div>

        <div className="flex min-w-0 items-center gap-2 sm:gap-4">
          <div className="relative">
            <button
              onClick={() => setShowNotif(!showNotif)}
              aria-label={showNotif ? 'Cerrar notificaciones' : 'Abrir notificaciones'}
              aria-expanded={showNotif}
              className="flex items-center justify-center relative w-8 h-8 rounded-md bg-white/10 text-cream hover:bg-white/20 transition-colors"
            >
              <Bell size={18} />
              {notificacionesSinLeer > 0 && <span className="absolute -top-1.5 -right-1.5 min-w-[17px] h-[17px] px-1 flex items-center justify-center bg-[#c73b3b] text-white text-[8px] font-extrabold rounded-full border-2 border-navy">{notificacionesSinLeer}</span>}
            </button>
            {showNotif && <div className="fixed inset-0 z-[299]" onClick={() => setShowNotif(false)} />}
            {showNotif && <OperationalNotificationsPanel
              contextLabel="Equipo Acredita"
              notificaciones={notificacionesOperativas}
              leidas={notificacionesLeidas}
              onMarcarLeida={id => marcarNotificacionesLeidas([id])}
              onMarcarTodas={() => marcarNotificacionesLeidas(notificacionesOperativas.map(item => item.id))}
              onAbrir={abrirNotificacionOperativa}
            />}
          </div>
          <div className="flex min-w-0 max-w-[55vw] items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity">
            <div className="w-8 h-8 rounded-full bg-brown text-[var(--brown-text,white)] flex items-center justify-center text-[13.2px] font-semibold">
              {topbarVerificador ? iniciales(topbarVerificador.nombre) : "?"}
            </div>
            <span className="hidden min-w-0 truncate text-[14.3px] text-cream sm:block">
              {topbarVerificador
                ? `${topbarVerificador.rol === 'supervisor' ? 'Supervisor' : 'Verificador'} · ${topbarVerificador.nombre}`
                : "Usuario operativo no disponible"}
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
              GLOBAL_PROYECTOS={proyectos}
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
              verificadores={verificadores}
              verificadorActualId={verificadorActualId}
              claimsRevision={claimsRevision}
              setClaimsRevision={setClaimsRevision}
            />
          )}

          {/* Simple Placeholders for other tabs to save space */}
          {activeTab === "mandantes" && (
            <MandantesTab
              setShowInvitarModal={setShowInvitarModal}
              GLOBAL_CONTRATISTAS={contratistas}
              GLOBAL_PROYECTOS={proyectos}
              GLOBAL_MANDANTES={GLOBAL_MANDANTES}
              onVerFicha={(contratista, proyectoId) =>
                setSelectedAcreditacionContratista({ ...contratista, _fichaProyectoId: proyectoId })
              }
            />
          )}

          {activeTab === "contratistas" && (
            <ContratistasTab
              GLOBAL_CONTRATISTAS={contratistas}
              GLOBAL_PROYECTOS={proyectos}
              GLOBAL_MANDANTES={GLOBAL_MANDANTES}
              onVerContratista={(contratista, proyectoId) => {
                setClienteSeleccionado(contratista);
                setProyectoContextoContratista(proyectoId || null);
              }}
              setShowInvitarContratistaModal={setShowInvitarContratistaModal}
            />
          )}

          {activeTab === "proyectos" && (
            <ProyectosTab
              GLOBAL_CONTRATISTAS={contratistas}
              GLOBAL_PROYECTOS={proyectos}
              GLOBAL_MANDANTES={GLOBAL_MANDANTES}
              requisitos={requisitos}
              onVerProyecto={(proyecto) => setProyectoSeleccionado(proyecto)}
              setShowNuevoProyectoModal={setShowNuevoProyectoModal}
              selectedProyectoId={proyectoSeleccionado?.id || null}
            />
          )}

          {activeTab === "verificadores" && (
            <VerificadoresTab
              verificadores={verificadores}
              setVerificadores={setVerificadores}
              claimsRevision={claimsRevision}
              GLOBAL_CONTRATISTAS={contratistas}
              GLOBAL_PROYECTOS={proyectos}
              onVerVerificador={(verificador) => setVerificadorSeleccionado(verificador)}
            />
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
              GLOBAL_PROYECTOS={proyectos}
              GLOBAL_MANDANTES={GLOBAL_MANDANTES}
              setSelectedAcreditacionContratista={setSelectedAcreditacionContratista}
              onIrARevision={(docKey) => {
                setSelectedDocKey(docKey);
                setActiveTab('cola');
              }}
              showToast={showToast}
            />
          )}

          {activeTab === "configuracion" && (
            <ConfiguracionTab
              verificadores={verificadores}
              verificadorActualId={verificadorActualId}
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
                      {proyectos.map(p => {
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

      {showNuevoProyectoModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-[440px] max-h-[calc(100vh-24px)] overflow-y-auto">
            <div className="flex justify-between items-center p-4 border-b border-cream">
              <h3 className="font-medium text-navy text-[17.6px]">
                Nuevo proyecto
              </h3>
              <button
                onClick={resetFormNuevoProyecto}
                className="text-gray-400 hover:text-gray-600"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-6">
              <form onSubmit={handleCrearProyecto} className="flex flex-col gap-4">
                <div>
                  <label className="block text-[13.2px] font-medium text-gray-700 mb-1.5">
                    Nombre del proyecto
                  </label>
                  <input
                    type="text"
                    value={formNuevoProyecto.nombre}
                    onChange={(e) =>
                      setFormNuevoProyecto({ ...formNuevoProyecto, nombre: e.target.value })
                    }
                    className="form-input w-full p-2.5 border border-cream3 rounded-lg focus:border-brown focus:ring-1 focus:ring-brown outline-none transition-all"
                    placeholder="Costanera Norte"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[13.2px] font-medium text-gray-700 mb-1.5">
                    Mandante
                  </label>
                  <select
                    value={formNuevoProyecto.mandanteId}
                    onChange={(e) =>
                      setFormNuevoProyecto({ ...formNuevoProyecto, mandanteId: e.target.value })
                    }
                    className="form-input w-full p-2.5 border border-cream3 rounded-lg focus:border-brown focus:ring-1 focus:ring-brown outline-none transition-all"
                    required
                  >
                    <option value="">Selecciona un mandante...</option>
                    {GLOBAL_MANDANTES.map(m => (
                      <option key={m.id} value={m.id}>{m.nombre}</option>
                    ))}
                  </select>
                </div>

                <div className="flex justify-end gap-3 mt-4 pt-4 border-t border-cream">
                  <button
                    type="button"
                    onClick={resetFormNuevoProyecto}
                    className="btn btn-ghost font-medium"
                  >
                    Cancelar
                  </button>
                  <button type="submit" className="btn btn-primary">
                    Crear proyecto
                  </button>
                </div>
              </form>
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
          GLOBAL_PROYECTOS={proyectos}
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

      {/* Drawer Proyecto Seleccionado */}
      {proyectoSeleccionado && (
        <ProyectoDetailDrawer
          proyectoSeleccionado={proyectoSeleccionado}
          setProyectoSeleccionado={setProyectoSeleccionado}
          tabProyecto={tabProyecto}
          setTabProyecto={setTabProyecto}
          GLOBAL_CONTRATISTAS={contratistas}
          GLOBAL_PROYECTOS={proyectos}
          GLOBAL_MANDANTES={GLOBAL_MANDANTES}
          requisitos={requisitos}
          setRequisitos={setRequisitos}
          onVerAcreditacion={(contratista, proyectoId) => {
            setSelectedAcreditacionContratista({ ...contratista, _fichaProyectoId: proyectoId });
          }}
        />
      )}

      {/* Drawer Verificador Seleccionado */}
      {verificadorSeleccionado && (
        <VerificadorDetailDrawer
          verificadorSeleccionado={verificadorSeleccionado}
          setVerificadorSeleccionado={setVerificadorSeleccionado}
          tabVerificador={tabVerificador}
          setTabVerificador={setTabVerificador}
          verificadores={verificadores}
          setVerificadores={setVerificadores}
          claimsRevision={claimsRevision}
          GLOBAL_CONTRATISTAS={contratistas}
          GLOBAL_PROYECTOS={proyectos}
        />
      )}

      <DocumentoDetailModal
        actividadSeleccionada={actividadSeleccionada}
        setActividadSeleccionada={setActividadSeleccionada}
      />

      {selectedAcreditacionContratista && selectedAcreditacionContratista._fichaProyectoId && (
        <FichaAcreditacion
          tipo={selectedAcreditacionContratista._fichaTrabajador ? 'trabajador' : 'empresa'}
          trabajador={selectedAcreditacionContratista._fichaTrabajador}
          contratista={selectedAcreditacionContratista}
          proyectoId={selectedAcreditacionContratista._fichaProyectoId}
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
