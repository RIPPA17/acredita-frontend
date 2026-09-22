import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { 
  Bell, LayoutDashboard, Folder, Upload, Users,
  Settings, LogOut, AlertCircle, AlertTriangle, CheckCircle, ArrowRight, ArrowLeft,
  FileCheck, Clock, X, XCircle, CloudUpload, Download, Eye,
  Building2, MapPin, Search, Info, FileText, Plus, Send, ShieldCheck, Banknote,
  UserPlus, Briefcase, FolderOpen, Save, Shield, Mail, Smartphone, ToggleRight, ClipboardList, Menu,
  ChevronLeft, ChevronRight
} from 'lucide-react';
import { Contratista, Documento, Proyecto, Trabajador, type RegimenEspecialLaboral, type TipoContratoLaboral } from '../types';
import { getContratistas, saveContratistas, getProyectos, saveProyectos, getMandantes, calcularEstadoAcreditacion, calcularEstadoTrabajador, getRequisitos, saveRequisitos, esVencidoPorFecha, esPorVencerPorFecha, obtenerDiasRestantes, esTrabajadorAsignado, logoutUser, getCurrentSession } from '../data/businessStore';
import FichaAcreditacion from '../components/FichaAcreditacion';
import ContratistaNotificaciones from '../components/ContratistaNotificaciones';
import DataSyncButton from '../components/DataSyncButton';
import { useDataSync } from '../components/DataSyncContext';
import { usePortalTab } from '../hooks/usePortalTab';
import { useSidebarPreference } from '../hooks/useSidebarPreference';
import DashboardTab from './contratista/DashboardTab';
import SubirTab from './contratista/SubirTab';
import MisProyectosTab from './contratista/MisProyectosTab';
import TrabajadoresTab from './contratista/TrabajadoresTab';
import ConfigTab from './contratista/ConfigTab';
import OperationsTab from './contratista/OperationsTab';
import { crearDocumentosPendientesProyecto } from './contratista/documentosUtils';
import { buildNotificacionesContratista, NotificacionContratista } from './contratista/notificacionesUtils';
import { mergeContractorNotifications } from './contratista/notificationMerge';
import { createWorkerFormDefaults, validateWorkerForm, type WorkerFormState } from './contratista/workerForm';
import { DEFAULT_NOTIFICATION_PREFERENCES, loadNotificationPreferences, loadReadNotificationKeys, loadStoredNotifications, markNotificationKeysRead, saveNotificationPreferences, type StoredNotification } from '../data/supabaseNotifications';
import { confirmBusinessPersistence } from '../data/supabasePersistence';
import { getAsignacionProyecto, getServiciosProyecto, proyectoOperativoParaContratista } from '../data/operationalCore';

export default function ContratistaPortal() {
  const navigate = useNavigate();
  const location = useLocation();
  const { revision: dataSyncRevision } = useDataSync();
  const { sidebarCollapsed, toggleSidebar } = useSidebarPreference(false);
  const [activeTab, setActiveTab] = usePortalTab('contratista');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showNotif, setShowNotif] = useState(false);
  const [showWelcomeAlert, setShowWelcomeAlert] = useState(false);
  const [toast, setToast] = useState<{msg: string, type: 'success'|'error'|'warning'} | null>(null);
  const [showAddWorkerModal, setShowAddWorkerModal] = useState(false);
  const [editingWorkerRut, setEditingWorkerRut] = useState<string | null>(null);
  const [savingWorker, setSavingWorker] = useState(false);
  const [showFichaAcreditacion, setShowFichaAcreditacion] = useState(false);
  const [selectedWorkerForDocs, setSelectedWorkerForDocs] = useState<Trabajador | null>(null);
  const [dataRevision, setDataRevision] = useState(0);
  const [newWorkerForm, setNewWorkerForm] = useState<WorkerFormState>(createWorkerFormDefaults);

  const showToast = (msg: string, type: 'success'|'error'|'warning' = 'success') => {
    setToast({msg, type});
    setTimeout(() => setToast(null), 2500);
  };

  const handleLogout = () => {
    logoutUser();
    setMobileMenuOpen(false);
    navigate('/');
  };

  const menuItems = [
    { id: 'dashboard', label: 'Inicio', icon: LayoutDashboard },
    { id: 'proyectos', label: 'Proyectos', icon: Folder },
    { id: 'subir', label: 'Documentos', icon: Upload },
    { id: 'trabajadores', label: 'Trabajadores', icon: Users },
    { id: 'operacion', label: 'Operación', icon: Briefcase },
    { id: 'config', label: 'Configuración', icon: Settings },
  ];

  // Load contractors, projects, and mandantes from businessStore
  const allContratistas = getContratistas();
  const allProyectos = getProyectos();
  const allMandantes = getMandantes();

  const session = getCurrentSession();
  const contratistaEncontrado = allContratistas.find(c => c.id === session?.contratistaId);
  const contratistaLogueado: Contratista = contratistaEncontrado || {
    id: session?.contratistaId || '__unresolved__',
    nombre: session?.nombre || 'Contratista',
    rut: '',
    proyectos: [],
    documentos: [],
    trabajadores: [],
  };
  const [notificacionesLeidas, setNotificacionesLeidas] = useState<Set<string>>(new Set());
  const [notificacionesPersistidas, setNotificacionesPersistidas] = useState<StoredNotification[]>([]);
  const [preferenciasNotificaciones, setPreferenciasNotificaciones] = useState({ ...DEFAULT_NOTIFICATION_PREFERENCES });
  const misProyectos = allProyectos
    .filter(p => p.contratistas.includes(contratistaLogueado.id))
    .sort((a, b) => Number(proyectoOperativoParaContratista(b, contratistaLogueado.id)) - Number(proyectoOperativoParaContratista(a, contratistaLogueado.id)) || a.nombre.localeCompare(b.nombre, 'es'));
  const proyectosActivos = misProyectos.filter(proyecto => proyectoOperativoParaContratista(proyecto, contratistaLogueado.id));
  const proyectosHistoricos = misProyectos.filter(proyecto => !proyectoOperativoParaContratista(proyecto, contratistaLogueado.id));
  const proyectosKey = misProyectos.map(proyecto => `${proyecto.id}:${proyecto.estado}:${proyectoOperativoParaContratista(proyecto, contratistaLogueado.id)}`).join('|');

  React.useEffect(() => {
    if (!session?.profileId) return;
    let cancelled = false;
    Promise.all([
      loadNotificationPreferences(session.profileId, session),
      loadReadNotificationKeys(session.profileId, session),
      loadStoredNotifications(session.profileId, session),
    ]).then(([preferencias, leidas, persistidas]) => {
      if (cancelled) return;
      setPreferenciasNotificaciones(preferencias);
      setNotificacionesLeidas(leidas);
      setNotificacionesPersistidas(persistidas);
    }).catch(() => {
      if (!cancelled) {
        setNotificacionesLeidas(new Set());
        setNotificacionesPersistidas([]);
      }
    });
    return () => { cancelled = true; };
  }, [session?.profileId]);

  React.useEffect(() => {
    if (!showNotif || !session?.profileId) return;
    let cancelled = false;
    Promise.all([
      loadStoredNotifications(session.profileId, session),
      loadReadNotificationKeys(session.profileId, session),
    ]).then(([persistidas, leidas]) => {
      if (cancelled) return;
      setNotificacionesPersistidas(persistidas);
      setNotificacionesLeidas(leidas);
    }).catch(() => undefined);
    return () => { cancelled = true; };
  }, [showNotif, session?.profileId, dataRevision, dataSyncRevision]);

  const actuales = buildNotificacionesContratista({
    contratista: contratistaLogueado,
    proyectos: misProyectos,
    requisitos: getRequisitos(),
    preferencias: preferenciasNotificaciones,
  });

  const notificaciones = mergeContractorNotifications({
    actuales,
    persistidas: notificacionesPersistidas,
    proyectos: misProyectos,
    contratista: contratistaLogueado,
  });
  const notificacionesSinLeer = notificaciones.filter(item => item.situacion !== 'resuelta' && !notificacionesLeidas.has(item.id)).length;

  const marcarLeidas = (ids: string[]) => {
    setNotificacionesLeidas(actual => {
      const next = new Set<string>(actual);
      ids.forEach(id => next.add(id));
      return next;
    });
    if (session?.profileId) void markNotificationKeysRead(session.profileId, ids, session).catch(() => undefined);
  };

  const guardarPreferenciasNotificaciones = async (preferencias: typeof preferenciasNotificaciones) => {
    if (!session?.profileId) throw new Error('Sesión inválida');
    await saveNotificationPreferences(session.profileId, preferencias, session);
    setPreferenciasNotificaciones(preferencias);
  };

  const abrirNotificaciones = () => setShowNotif(actual => !actual);

  const navegarNotificacion = (notificacion: NotificacionContratista) => {
    marcarLeidas([notificacion.id]);
    if (notificacion.proyectoId) seleccionarProyecto(notificacion.proyectoId);
    if (notificacion.destino.tipo === 'trabajador' && notificacion.destino.trabajador) {
      setSelectedWorkerForDocs(notificacion.destino.trabajador);
      setActiveTab('trabajadores');
    } else if (notificacion.destino.tipo === 'acreditacion') {
      setShowFichaAcreditacion(true);
    } else if (notificacion.destino.tipo === 'operacion') {
      if (notificacion.actionPlanId || notificacion.evaluationId || notificacion.paymentCaseId || notificacion.supportTicketId) {
        const params = new URLSearchParams();
        params.set('proyecto', notificacion.proyectoId);
        if (notificacion.actionPlanId) params.set('plan', notificacion.actionPlanId);
        if (notificacion.evaluationId) params.set('evaluacion', notificacion.evaluationId);
        if (notificacion.paymentCaseId) params.set('pago', notificacion.paymentCaseId);
        if (notificacion.supportTicketId) params.set('ticket', notificacion.supportTicketId);
        navigate({ pathname: '/contratista/operacion', search: `?${params.toString()}` });
      } else {
        setActiveTab('operacion');
      }
    } else if (notificacion.destino.tipo === 'proyecto') {
      setActiveTab('proyectos');
    } else if (notificacion.requisitoId) {
      const params = new URLSearchParams();
      params.set('proyecto', notificacion.proyectoId);
      params.set('requisito', notificacion.requisitoId);
      if (notificacion.trabajadorRut) params.set('trabajador', notificacion.trabajadorRut);
      navigate({ pathname: '/contratista/documentos', search: `?${params.toString()}` });
    } else {
      setActiveTab('subir');
    }
    setShowNotif(false);
  };

  React.useEffect(() => {
    if (!showNotif) return;
    const close = (event: KeyboardEvent) => { if (event.key === 'Escape') setShowNotif(false); };
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, [showNotif]);

  const projectStorageKey = `acredita:last-project:${session?.profileId || contratistaLogueado.id}`;
  const [selectedProyectoId, setSelectedProyectoId] = useState(() => {
    const requested = new URLSearchParams(location.search).get('proyecto');
    if (requested && misProyectos.some(proyecto => proyecto.id === requested)) return requested;
    const saved = localStorage.getItem(projectStorageKey);
    if (saved && misProyectos.some(proyecto => proyecto.id === saved)) return saved;
    return proyectosActivos[0]?.id || misProyectos[0]?.id || '';
  });

  const seleccionarProyecto = React.useCallback((proyectoId: string, replace = false) => {
    if (!misProyectos.some(proyecto => proyecto.id === proyectoId)) return;
    setSelectedProyectoId(proyectoId);
    setSelectedWorkerForDocs(null);
    localStorage.setItem(projectStorageKey, proyectoId);
    const params = new URLSearchParams(location.search);
    params.set('proyecto', proyectoId);
    navigate({ pathname: location.pathname, search: `?${params.toString()}` }, { replace });
  }, [location.pathname, location.search, misProyectos, navigate, projectStorageKey]);

  React.useEffect(() => {
    if (misProyectos.length === 0) {
      if (selectedProyectoId) setSelectedProyectoId('');
      const params = new URLSearchParams(location.search);
      if (params.has('proyecto')) {
        params.delete('proyecto');
        navigate({ pathname: location.pathname, search: params.toString() ? `?${params.toString()}` : '' }, { replace: true });
      }
      return;
    }

    const params = new URLSearchParams(location.search);
    const requested = params.get('proyecto');
    if (requested && misProyectos.some(proyecto => proyecto.id === requested)) {
      if (requested !== selectedProyectoId) {
        setSelectedProyectoId(requested);
        setSelectedWorkerForDocs(null);
      }
      localStorage.setItem(projectStorageKey, requested);
      return;
    }

    const saved = localStorage.getItem(projectStorageKey);
    const fallback = (saved && misProyectos.some(proyecto => proyecto.id === saved) ? saved : undefined)
      || (misProyectos.some(proyecto => proyecto.id === selectedProyectoId) ? selectedProyectoId : undefined)
      || proyectosActivos[0]?.id
      || misProyectos[0].id;
    seleccionarProyecto(fallback, true);
  }, [location.pathname, location.search, projectStorageKey, proyectosKey]);

  const proyectoActivo = misProyectos.find(p => p.id === selectedProyectoId) || proyectosActivos[0] || misProyectos[0];
  const mandanteProyectoActivo = proyectoActivo ? allMandantes.find(m => m.id === proyectoActivo.mandanteId) : undefined;

  const [documentosData, setDocumentosData] = useState<Documento[]>([]);

  React.useEffect(() => {
    const list = getContratistas();
    const cObj = list.find(c => c.id === contratistaLogueado.id);
    if (cObj) {
      const filteredDocs = cObj.documentos.filter(d => d.proyectoId === selectedProyectoId);
      setDocumentosData(filteredDocs);
      
    }
  }, [selectedProyectoId, dataRevision, contratistaLogueado.id, dataSyncRevision]);

  const categoriasDisponibles = Array.from(new Set(
    getRequisitos()
      .filter(r => r.proyectoId === selectedProyectoId && r.destino === 'trabajador' && r.activo !== false)
      .flatMap(r => r.categoriasAplicables || [])
      .map(categoria => categoria.trim())
      .filter(Boolean),
  )).sort((a, b) => a.localeCompare(b, 'es'));

  const categoriasSeleccionadas = new Set<string>(
    newWorkerForm.categorias.split(',').map(item => item.trim()).filter(Boolean),
  );
  const requisitosTrabajadorProyecto = getRequisitos().filter(
    r => r.proyectoId === selectedProyectoId && r.destino === 'trabajador' && r.activo !== false,
  );
  const serviciosDisponibles = getServiciosProyecto(selectedProyectoId, contratistaLogueado.id);
  const servicioObligatorio = serviciosDisponibles.length > 0 || requisitosTrabajadorProyecto.some(r => Boolean(r.servicioId));
  const categoriasObligatorias = categoriasDisponibles.length > 0;

  const resetWorkerForm = () => setNewWorkerForm(createWorkerFormDefaults());

  const openAddWorkerModal = () => {
    const project = misProyectos.find(item => item.id === selectedProyectoId);
    if (!project || !proyectoOperativoParaContratista(project, contratistaLogueado.id)) {
      showToast('Este proyecto está en modo histórico y solo permite consultar el historial.', 'warning');
      return;
    }
    setEditingWorkerRut(null);
    resetWorkerForm();
    setShowAddWorkerModal(true);
  };

  const openEditWorkerModal = (worker: Trabajador) => {
    const project = misProyectos.find(item => item.id === selectedProyectoId);
    if (!project || !proyectoOperativoParaContratista(project, contratistaLogueado.id)) {
      showToast('Este proyecto está en modo histórico y no permite editar trabajadores.', 'warning');
      return;
    }
    const assignment = getAsignacionProyecto(worker, selectedProyectoId);
    if (!assignment) {
      showToast('No encontramos una asignación activa para editar.', 'warning');
      return;
    }
    setEditingWorkerRut(worker.rut);
    setNewWorkerForm({
      nombre: worker.nombre,
      rut: worker.rut,
      cargo: assignment.cargo || worker.cargo || '',
      servicioId: assignment.servicioId || '',
      categorias: (assignment.categorias || []).filter(item => item.toLocaleLowerCase('es') !== 'general').join(', '),
      fechaIngreso: assignment.fechaIngreso || new Date().toISOString().slice(0, 10),
      tipoContrato: worker.tipoContrato || 'indefinido',
      fechaInicioContrato: worker.fechaInicioContrato || new Date().toISOString().slice(0, 10),
      fechaTerminoContrato: worker.fechaTerminoContrato || '',
      obraFaenaContrato: worker.obraFaenaContrato || '',
      regimenEspecial: worker.regimenEspecial || '',
      detalleRegimenEspecial: worker.detalleRegimenEspecial || '',
    });
    setShowAddWorkerModal(true);
  };

  const handleRetireWorker = async (worker: Trabajador) => {
    const project = misProyectos.find(item => item.id === selectedProyectoId);
    if (!project || !proyectoOperativoParaContratista(project, contratistaLogueado.id)) {
      showToast('Este proyecto está en modo histórico y no permite retirar trabajadores.', 'warning');
      return;
    }
    const list = getContratistas();
    const contractor = list.find(item => item.id === contratistaLogueado.id);
    const target = contractor?.trabajadores?.find(item => item.rut === worker.rut);
    const assignment = target?.asignaciones?.find(item => item.proyectoId === selectedProyectoId && item.estado === 'activa');
    if (!contractor || !target || !assignment) {
      showToast('No encontramos una asignación activa para retirar.', 'warning');
      return;
    }
    assignment.tipoContrato ||= target.tipoContrato;
    assignment.fechaInicioContrato ||= target.fechaInicioContrato;
    assignment.fechaTerminoContrato ||= target.fechaTerminoContrato;
    assignment.obraFaenaContrato ||= target.obraFaenaContrato;
    assignment.regimenEspecial ||= target.regimenEspecial;
    assignment.detalleRegimenEspecial ||= target.detalleRegimenEspecial;
    assignment.estado = 'baja';
    assignment.estadoAcceso = 'bloqueado';
    assignment.fechaSalida = new Date().toISOString().slice(0, 10);
    target.estado = 'pendiente';
    try {
      saveContratistas(list);
      await confirmBusinessPersistence('all');
      setSelectedWorkerForDocs(null);
      setDataRevision(value => value + 1);
      showToast('Trabajador retirado del proyecto. Su historial fue conservado.');
    } catch (error) {
      console.error('No fue posible retirar al trabajador.', error);
      showToast('No fue posible retirar al trabajador. Intenta nuevamente.', 'error');
    }
  };

  const toggleCategoria = (categoria: string) => {
    const next = new Set(categoriasSeleccionadas);
    if (next.has(categoria)) next.delete(categoria);
    else next.add(categoria);
    setNewWorkerForm(actual => ({ ...actual, categorias: Array.from(next).join(', ') }));
  };

  const handleAddWorkerSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWorkerForm.nombre || !newWorkerForm.rut || savingWorker) return;
    const project = misProyectos.find(item => item.id === selectedProyectoId);
    const validation = validateWorkerForm(newWorkerForm, {
      projectOperational: Boolean(project && proyectoOperativoParaContratista(project, contratistaLogueado.id)),
      serviceRequired: servicioObligatorio,
      availableServices: serviciosDisponibles.length,
      categoriesRequired: categoriasObligatorias,
      selectedCategories: categoriasSeleccionadas.size,
    });
    if (validation) {
      showToast(validation.message, validation.type);
      return;
    }

    const projectReqs = requisitosTrabajadorProyecto;
    const list = getContratistas();
    const currentIdx = list.findIndex(c => c.id === contratistaLogueado.id);
    if (currentIdx === -1) {
      showToast('No fue posible encontrar al contratista.', 'error');
      return;
    }

    const contratista = list[currentIdx];
    contratista.trabajadores ||= [];
    const editingWorker = editingWorkerRut
      ? contratista.trabajadores.find(w => w.rut === editingWorkerRut)
      : undefined;
    const existingWorker = contratista.trabajadores.find(w => w.rut === newWorkerForm.rut);
    if (!editingWorker && existingWorker && esTrabajadorAsignado(existingWorker, selectedProyectoId, misProyectos)) {
      showToast('Este trabajador ya está asignado a este proyecto.', 'warning');
      return;
    }

    const assignmentCategories = categoriasObligatorias
      ? Array.from(categoriasSeleccionadas)
      : ['General'];
    const applicableReqs = projectReqs.filter(req => {
      if (req.servicioId && req.servicioId !== (newWorkerForm.servicioId || undefined)) return false;
      const requiredCategories = (req.categoriasAplicables || []).map(item => item.trim().toLocaleLowerCase('es')).filter(Boolean);
      if (requiredCategories.length === 0 || requiredCategories.includes('general')) return true;
      const selectedCategories = assignmentCategories.map(item => item.toLocaleLowerCase('es'));
      return requiredCategories.some(category => selectedCategories.includes(category));
    });
    const workerDocs = crearDocumentosPendientesProyecto(applicableReqs, contratista.id, selectedProyectoId, newWorkerForm.rut);
    const assignment = {
      id: `asignacion_${crypto.randomUUID()}`,
      proyectoId: selectedProyectoId,
      servicioId: newWorkerForm.servicioId || undefined,
      cargo: newWorkerForm.cargo || undefined,
      categorias: assignmentCategories,
      fechaIngreso: newWorkerForm.fechaIngreso || undefined,
      estado: 'activa' as const,
      estadoAcceso: 'pendiente' as const,
      tipoContrato: newWorkerForm.tipoContrato,
      fechaInicioContrato: newWorkerForm.fechaInicioContrato,
      fechaTerminoContrato: newWorkerForm.tipoContrato === 'plazo_fijo' ? newWorkerForm.fechaTerminoContrato : undefined,
      obraFaenaContrato: newWorkerForm.tipoContrato === 'obra_faena' ? newWorkerForm.obraFaenaContrato.trim() : undefined,
      regimenEspecial: newWorkerForm.regimenEspecial || undefined,
      detalleRegimenEspecial: newWorkerForm.regimenEspecial === 'otro' ? newWorkerForm.detalleRegimenEspecial.trim() : undefined,
    };

    setSavingWorker(true);
    try {
      if (editingWorker) {
        const currentAssignment = getAsignacionProyecto(editingWorker, selectedProyectoId);
        if (!currentAssignment) throw new Error('No existe una asignación activa para editar');
        editingWorker.nombre = newWorkerForm.nombre.trim();
        editingWorker.cargo = newWorkerForm.cargo || undefined;
        editingWorker.tipoContrato = newWorkerForm.tipoContrato;
        editingWorker.fechaInicioContrato = newWorkerForm.fechaInicioContrato;
        editingWorker.fechaTerminoContrato = newWorkerForm.tipoContrato === 'plazo_fijo' ? newWorkerForm.fechaTerminoContrato : undefined;
        editingWorker.obraFaenaContrato = newWorkerForm.tipoContrato === 'obra_faena' ? newWorkerForm.obraFaenaContrato.trim() : undefined;
        editingWorker.regimenEspecial = newWorkerForm.regimenEspecial || undefined;
        editingWorker.detalleRegimenEspecial = newWorkerForm.regimenEspecial === 'otro' ? newWorkerForm.detalleRegimenEspecial.trim() : undefined;
        currentAssignment.servicioId = newWorkerForm.servicioId || undefined;
        currentAssignment.cargo = newWorkerForm.cargo || undefined;
        currentAssignment.categorias = assignmentCategories;
        currentAssignment.fechaIngreso = newWorkerForm.fechaIngreso || undefined;
        currentAssignment.estadoAcceso = 'pendiente';
        currentAssignment.tipoContrato = newWorkerForm.tipoContrato;
        currentAssignment.fechaInicioContrato = newWorkerForm.fechaInicioContrato;
        currentAssignment.fechaTerminoContrato = newWorkerForm.tipoContrato === 'plazo_fijo' ? newWorkerForm.fechaTerminoContrato : undefined;
        currentAssignment.obraFaenaContrato = newWorkerForm.tipoContrato === 'obra_faena' ? newWorkerForm.obraFaenaContrato.trim() : undefined;
        currentAssignment.regimenEspecial = newWorkerForm.regimenEspecial || undefined;
        currentAssignment.detalleRegimenEspecial = newWorkerForm.regimenEspecial === 'otro' ? newWorkerForm.detalleRegimenEspecial.trim() : undefined;

        const existingDocKeys = new Set(
          (editingWorker.documentos || []).map(doc => `${doc.proyectoId || ''}:${doc.nombre.trim().toLocaleLowerCase('es')}`),
        );
        const missingDocs = workerDocs.filter(doc => !existingDocKeys.has(`${doc.proyectoId || ''}:${doc.nombre.trim().toLocaleLowerCase('es')}`));
        editingWorker.documentos = [...(editingWorker.documentos || []), ...missingDocs];
        editingWorker.estado = calcularEstadoTrabajador(editingWorker, selectedProyectoId);
        setSelectedWorkerForDocs(editingWorker);
      } else if (existingWorker) {
        const existingDocKeys = new Set(
          (existingWorker.documentos || []).map(doc => `${doc.proyectoId || ''}:${doc.nombre.trim().toLocaleLowerCase('es')}`),
        );
        const missingDocs = workerDocs.filter(doc => !existingDocKeys.has(`${doc.proyectoId || ''}:${doc.nombre.trim().toLocaleLowerCase('es')}`));
        existingWorker.documentos = [...(existingWorker.documentos || []), ...missingDocs];
        existingWorker.asignaciones = [...(existingWorker.asignaciones || []), assignment];
        existingWorker.nombre = newWorkerForm.nombre.trim();
        existingWorker.cargo = newWorkerForm.cargo || undefined;
        existingWorker.tipoContrato = newWorkerForm.tipoContrato;
        existingWorker.fechaInicioContrato = newWorkerForm.fechaInicioContrato;
        existingWorker.fechaTerminoContrato = newWorkerForm.tipoContrato === 'plazo_fijo' ? newWorkerForm.fechaTerminoContrato : undefined;
        existingWorker.obraFaenaContrato = newWorkerForm.tipoContrato === 'obra_faena' ? newWorkerForm.obraFaenaContrato.trim() : undefined;
        existingWorker.regimenEspecial = newWorkerForm.regimenEspecial || undefined;
        existingWorker.detalleRegimenEspecial = newWorkerForm.regimenEspecial === 'otro' ? newWorkerForm.detalleRegimenEspecial.trim() : undefined;
        existingWorker.estado = calcularEstadoTrabajador(existingWorker, selectedProyectoId);
      } else {
        contratista.trabajadores.push({
          nombre: newWorkerForm.nombre,
          rut: newWorkerForm.rut,
          estado: 'pendiente',
          cargo: newWorkerForm.cargo || undefined,
          faena: misProyectos.find(p => p.id === selectedProyectoId)?.nombre || selectedProyectoId,
          tipoContrato: newWorkerForm.tipoContrato,
          fechaInicioContrato: newWorkerForm.fechaInicioContrato,
          fechaTerminoContrato: newWorkerForm.tipoContrato === 'plazo_fijo' ? newWorkerForm.fechaTerminoContrato : undefined,
          obraFaenaContrato: newWorkerForm.tipoContrato === 'obra_faena' ? newWorkerForm.obraFaenaContrato.trim() : undefined,
          regimenEspecial: newWorkerForm.regimenEspecial || undefined,
          detalleRegimenEspecial: newWorkerForm.regimenEspecial === 'otro' ? newWorkerForm.detalleRegimenEspecial.trim() : undefined,
          cumplimiento: 0,
          documentos: workerDocs,
          asignaciones: [assignment],
        });
      }
      saveContratistas(list);
      await confirmBusinessPersistence('all');
      setDataRevision(value => value + 1);
      resetWorkerForm();
      setEditingWorkerRut(null);
      setShowAddWorkerModal(false);
      showToast(editingWorker ? 'Trabajador actualizado con éxito' : 'Trabajador agregado con éxito');
    } catch (error) {
      setDataRevision(value => value + 1);
      console.error('No fue posible agregar el trabajador.', error);
      showToast('No fue posible guardar el trabajador. Intenta nuevamente.', 'error');
    } finally {
      setSavingWorker(false);
    }
  };

  if (!contratistaEncontrado) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-cream2 px-6 text-navy">
        <div className="max-w-md rounded-2xl border border-cream3 bg-white p-6 text-center shadow-sm">
          <h1 className="text-xl font-semibold">No fue posible cargar tu empresa</h1>
          <p className="mt-2 text-sm text-gray-500">La sesión es válida, pero no encontramos el contratista asociado dentro de los datos autorizados. Vuelve a iniciar sesión para resincronizar tu acceso.</p>
          <button className="btn btn-primary mt-5" onClick={handleLogout}>Volver a iniciar sesión</button>
        </div>
      </div>
    );
  }

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
        </div>
        {proyectoActivo && (
          <div className="contractor-project-context hidden sm:flex" aria-label="Contexto del proyecto activo">
            <div>
              <span>Proyecto</span>
              <select
                aria-label="Proyecto activo global"
                value={proyectoActivo.id}
                onChange={event => seleccionarProyecto(event.target.value)}
              >
                {proyectosActivos.length > 0 && <optgroup label="Proyectos activos">{proyectosActivos.map(proyecto => <option key={proyecto.id} value={proyecto.id}>{proyecto.nombre}</option>)}</optgroup>}
                {proyectosHistoricos.length > 0 && <optgroup label="Históricos / relación finalizada">{proyectosHistoricos.map(proyecto => <option key={proyecto.id} value={proyecto.id}>{proyecto.nombre} · Histórico</option>)}</optgroup>}
              </select>
            </div>
            <small>{proyectoOperativoParaContratista(proyectoActivo, contratistaLogueado.id) ? '' : 'Histórico · '}{mandanteProyectoActivo?.nombre || 'Mandante no disponible'}</small>
          </div>
        )}
        <div className="flex items-center gap-4">
          <DataSyncButton />
          <div className="relative">
            <button 
              onClick={abrirNotificaciones}
              aria-label={showNotif ? 'Cerrar notificaciones' : 'Abrir notificaciones'}
              aria-expanded={showNotif}
              className="flex items-center justify-center relative w-8 h-8 rounded-md bg-white/10 text-cream hover:bg-white/20 transition-colors">
              <Bell size={18} />
              {notificacionesSinLeer > 0 && <span className="absolute -top-1.5 -right-1.5 min-w-[17px] h-[17px] px-1 flex items-center justify-center bg-[#c73b3b] text-white text-[8px] font-extrabold rounded-full border-2 border-navy">{notificacionesSinLeer}</span>}
            </button>

            {showNotif && <div className="fixed inset-0 z-[299]" onClick={() => setShowNotif(false)} />}
            
            {showNotif && <ContratistaNotificaciones contratistaNombre={contratistaLogueado.nombre} notificaciones={notificaciones} leidas={notificacionesLeidas} onMarcarLeida={id => marcarLeidas([id])} onMarcarTodas={() => marcarLeidas(notificaciones.filter(item => item.situacion !== 'resuelta').map(item => item.id))} onAbrir={navegarNotificacion} />}
          </div>
          <button type="button" onClick={() => setActiveTab('config')} className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition" aria-label="Abrir configuración de cuenta" title="Configuración de cuenta">
            <div className="w-8 h-8 rounded-full bg-brown text-[var(--brown-text,white)] flex items-center justify-center text-[13.2px] font-semibold">
              {contratistaLogueado.nombre.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()}
            </div>
            <span className="text-[14.3px] text-cream hidden md:block">{contratistaLogueado.nombre}</span>
          </button>
        </div>
      </div>

      {proyectoActivo && (
        <div className="contractor-project-context-mobile sm:hidden">
          <label htmlFor="contractor-mobile-project">Proyecto</label>
          <select
            id="contractor-mobile-project"
            value={proyectoActivo.id}
            onChange={event => seleccionarProyecto(event.target.value)}
          >
            {proyectosActivos.length > 0 && <optgroup label="Proyectos activos">{proyectosActivos.map(proyecto => <option key={proyecto.id} value={proyecto.id}>{proyecto.nombre}</option>)}</optgroup>}
            {proyectosHistoricos.length > 0 && <optgroup label="Históricos / relación finalizada">{proyectosHistoricos.map(proyecto => <option key={proyecto.id} value={proyecto.id}>{proyecto.nombre} · Histórico</option>)}</optgroup>}
          </select>
          <span>{proyectoOperativoParaContratista(proyectoActivo, contratistaLogueado.id) ? '' : 'Histórico · '}{mandanteProyectoActivo?.nombre || 'Mandante no disponible'}</span>
        </div>
      )}

      {misProyectos.length === 0 && (
        <div className="bg-yellow-50 border-b border-yellow-200 px-6 py-3 flex items-center sticky top-[64px] z-40">
          <div className="flex items-center gap-2 text-yellow-800 text-sm">
            <AlertTriangle size={16} className="shrink-0"/>
            <span><strong>Aún no tienes proyectos asignados.</strong> Cuando un mandante te invite o asigne a un proyecto, aparecerá aquí.</span>
          </div>
        </div>
      )}

      {/* MOBILE QUICK ACCESS BANNER */}
      <div className="hidden bg-white border-b border-gray-100 px-4 py-3 gap-3">
        <button onClick={() => setActiveTab('subir')}
          className="flex-1 btn btn-primary text-sm py-2 flex items-center justify-center gap-2">
          <Upload size={16}/> Subir documento
        </button>
        <button onClick={() => setActiveTab('dashboard')}
          className="flex-1 btn btn-secondary text-sm py-2 flex items-center justify-center gap-2">
          <ClipboardList size={16}/> Mi estado
        </button>
      </div>

      <div className="layout">
        {/* SIDEBAR */}
        <aside className={`hidden md:flex sidebar flex-col ${sidebarCollapsed ? 'collapsed' : ''}`}>
          <div className={`sb-org flex ${sidebarCollapsed ? 'flex-col items-center gap-2' : 'justify-between items-center'} px-4 py-3 border-b border-white/5`}>
            {!sidebarCollapsed && (
              <div className="truncate flex-1">
                <div className="sb-org-name truncate">{contratistaLogueado.nombre}</div>
                <div className="sb-org-sub truncate">RUT {contratistaLogueado.rut}</div>
              </div>
            )}
            {sidebarCollapsed && (
              <div className="w-8 h-8 rounded-lg bg-brown text-white flex items-center justify-center font-bold text-sm shrink-0">
                {contratistaLogueado.nombre[0]}
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
          {menuItems.map(item => (
            <React.Fragment key={item.id}>
              <button 
                onClick={() => setActiveTab(item.id)}
                className={`sb-item w-full flex text-left ${activeTab === item.id ? 'active' : ''}`}
                title={sidebarCollapsed ? item.label : undefined}
              >
                <item.icon size={18} className="shrink-0" /> 
                <span className="flex-1">{item.label}</span>
              </button>
            </React.Fragment>
          ))}
          
          <div className="sb-bottom">
            <button 
              className="sb-item w-full flex text-left mt-auto" 
              onClick={handleLogout}
              title={sidebarCollapsed ? "Cerrar sesión" : undefined}
            >
              <LogOut size={18} className="shrink-0" /> 
              <span className="flex-1">Cerrar sesión</span>
            </button>
          </div>
        </aside>

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
                  <div className="sb-org-name">{contratistaLogueado.nombre}</div>
                  <div className="sb-org-sub">RUT {contratistaLogueado.rut} · {proyectosActivos.length} proyecto{proyectosActivos.length === 1 ? '' : 's'} activo{proyectosActivos.length === 1 ? '' : 's'}</div>
                </div>
                <button onClick={() => setMobileMenuOpen(false)} className="text-gray-400 hover:text-white p-1">
                  <X size={20} />
                </button>
              </div>

              <div className="sb-label">Principal</div>
              {menuItems.map(item => (
                <React.Fragment key={item.id}>
                  <button 
                    onClick={() => { setActiveTab(item.id); setMobileMenuOpen(false); }}
                    className={`sb-item w-full flex text-left ${activeTab === item.id ? 'active' : ''}`}
                  >
                    <item.icon size={18} className="shrink-0" /> 
                    <span className="flex-1">{item.label}</span>
                  </button>
                </React.Fragment>
              ))}
              
              <div className="sb-bottom">
                <button className="sb-item w-full flex text-left mt-auto" onClick={handleLogout}>
                  <LogOut size={18} /> Cerrar sesión
                </button>
              </div>
            </div>
          </>
        )}

        {/* MAIN CONTENT */}
        <div className="main pb-24 lg:pb-0">
          
          {activeTab === 'dashboard' && (
            <DashboardTab
              contratistaLogueado={contratistaLogueado}
              selectedProyectoId={selectedProyectoId}
              setSelectedProyectoId={seleccionarProyecto}
              misProyectos={misProyectos}
              allMandantes={allMandantes}
              showWelcomeAlert={showWelcomeAlert}
              setShowWelcomeAlert={setShowWelcomeAlert}
              documentosData={documentosData}
              setActiveTab={setActiveTab}
              setShowFichaAcreditacion={setShowFichaAcreditacion}
              setSelectedWorkerForDocs={setSelectedWorkerForDocs}
              setShowAddWorkerModal={(value) => value ? openAddWorkerModal() : setShowAddWorkerModal(false)}
            />
          )}

          {activeTab === 'subir' && (
            <SubirTab
              contratistaLogueado={contratistaLogueado}
              misProyectos={misProyectos}
              allMandantes={allMandantes}
              selectedProyectoId={selectedProyectoId}
              setSelectedProyectoId={seleccionarProyecto}
              onDataChanged={() => setDataRevision(value => value + 1)}
              showToast={showToast}
            />
          )}

          {activeTab === 'proyectos' && (
            <MisProyectosTab
              contratistaLogueado={contratistaLogueado}
              misProyectos={misProyectos}
              allMandantes={allMandantes}
              selectedProyectoId={selectedProyectoId}
              setSelectedProyectoId={seleccionarProyecto}
              setActiveTab={setActiveTab}
              setSelectedWorkerForDocs={setSelectedWorkerForDocs}
              setShowFichaAcreditacion={setShowFichaAcreditacion}
              showToast={showToast}
            />
          )}

          {activeTab === 'trabajadores' && (
            <TrabajadoresTab
              selectedWorkerForDocs={selectedWorkerForDocs}
              setSelectedWorkerForDocs={setSelectedWorkerForDocs}
              contratistaLogueado={contratistaLogueado}
              selectedProyectoId={selectedProyectoId}
              setSelectedProyectoId={seleccionarProyecto}
              misProyectos={misProyectos}
              allMandantes={allMandantes}
              setShowAddWorkerModal={(value) => value ? openAddWorkerModal() : setShowAddWorkerModal(false)}
              onEditWorker={openEditWorkerModal}
              onRetireWorker={handleRetireWorker}
              onDataChanged={() => setDataRevision(value => value + 1)}
              showToast={showToast}
            />
          )}

          {activeTab === 'operacion' && (
            <div className="cfg-page">
              <section className="cfg-hero">
                <div className="cfg-eyebrow">Portal contratista</div>
                <h1>Operación</h1>
                <p>Consulta evaluaciones, responde planes de acción, revisa estados de pago y conversa con soporte en un espacio dedicado.</p>
              </section>
              <section className="cfg-floating">
                <OperationsTab
                  contratista={contratistaLogueado}
                  proyectos={misProyectos}
                  selectedProyectoId={selectedProyectoId}
                  setSelectedProyectoId={seleccionarProyecto}
                  showToast={showToast}
                />
              </section>
            </div>
          )}

          {activeTab === 'config' && (
            <ConfigTab
              contratistaLogueado={contratistaLogueado}
              misProyectos={misProyectos}
              allMandantes={allMandantes}
              session={session}
              onLogout={handleLogout}
              showToast={showToast}
              preferenciasNotificaciones={preferenciasNotificaciones}
              onGuardarPreferencias={guardarPreferenciasNotificaciones}
            />
          )}

          {/* MOBILE NAVBAR */}
          <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 flex md:hidden z-50">
            {menuItems.filter(item => item.id !== 'config').map(item => (
              <button key={item.id} onClick={() => setActiveTab(item.id)}
                className={`flex-1 min-w-0 flex flex-col items-center py-3 text-[10px] gap-1
                  ${activeTab === item.id ? 'text-brown font-semibold' : 'text-gray-400'}`}>
                <item.icon size={19} />
                <span className="max-w-full truncate px-0.5">{item.label}</span>
              </button>
            ))}
          </nav>
        </div>
      </div>
      
      {toast && (
        <div className={`fixed bottom-6 right-6 z-[999] px-5 py-3 rounded-xl shadow-lg text-white text-sm font-medium flex items-center gap-2
          ${toast.type === 'success' ? 'bg-green-600' : toast.type === 'error' ? 'bg-red-500' : 'bg-yellow-500'}`}>
          {toast.type === 'success' && <CheckCircle size={18}/>}
          {toast.type === 'error' && <XCircle size={18}/>}
          {toast.type === 'warning' && <AlertTriangle size={18}/>}
          {toast.msg}
        </div>
      )}

      {showFichaAcreditacion && (
        <FichaAcreditacion
          tipo="empresa"
          contratista={contratistaLogueado}
          proyectoId={selectedProyectoId}
          onClose={() => setShowFichaAcreditacion(false)}
          rol="contratista"
          proyectos={misProyectos}
          mandantes={allMandantes}
          onProyectoChange={seleccionarProyecto}
          onIrADocumentos={(proyectoId) => {
            seleccionarProyecto(proyectoId);
            setActiveTab('subir');
          }}
          onIrATrabajador={(proyectoId, trabajador) => {
            seleccionarProyecto(proyectoId);
            setSelectedWorkerForDocs(trabajador);
            setActiveTab('trabajadores');
          }}
        />
      )}

      {showAddWorkerModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowAddWorkerModal(false)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-[500px] max-h-[calc(100vh-24px)] overflow-y-auto font-sans" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center p-4 border-b border-cream">
              <h3 className="font-semibold text-navy text-[17.6px] flex items-center gap-2">
                <UserPlus size={18} className="text-brown" /> {editingWorkerRut ? 'Editar trabajador y asignación' : 'Agregar trabajador al proyecto'}
              </h3>
              <button 
                onClick={() => setShowAddWorkerModal(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors p-1 rounded"
                aria-label="Cerrar"
              >
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleAddWorkerSubmit} className="p-6 flex flex-col gap-4 max-h-[80vh] overflow-y-auto">
              <div>
                <label className="block text-[13px] font-medium text-gray-700 mb-1.5">Nombre completo</label>
                <input 
                  type="text" 
                  value={newWorkerForm.nombre}
                  onChange={(e) => setNewWorkerForm({...newWorkerForm, nombre: e.target.value})}
                  className="form-input w-full p-2.5 border border-cream3 rounded-lg focus:border-brown focus:ring-1 focus:ring-brown outline-none transition-all text-sm" 
                  placeholder="Ej. María González"
                  required 
                />
              </div>
              
              <div>
                <label className="block text-[13px] font-medium text-gray-700 mb-1.5">RUT</label>
                <input 
                  type="text" 
                  value={newWorkerForm.rut}
                  onChange={(e) => setNewWorkerForm({...newWorkerForm, rut: e.target.value})}
                  className="form-input w-full p-2.5 border border-cream3 rounded-lg focus:border-brown focus:ring-1 focus:ring-brown outline-none transition-all text-sm" 
                  placeholder="12.345.678-9" 
                  required
                  disabled={Boolean(editingWorkerRut)}
                />
              </div>

              <div>
                <label className="block text-[13px] font-medium text-gray-700 mb-1.5">Cargo</label>
                <input 
                  type="text" 
                  value={newWorkerForm.cargo}
                  onChange={(e) => setNewWorkerForm({...newWorkerForm, cargo: e.target.value})}
                  className="form-input w-full p-2.5 border border-cream3 rounded-lg focus:border-brown focus:ring-1 focus:ring-brown outline-none transition-all text-sm" 
                  placeholder="Ej. Operador"
                  required 
                />
              </div>

              <div className="rounded-xl border border-cream3 bg-cream2/40 p-4">
                <div className="mb-3">
                  <h4 className="text-[13px] font-semibold text-navy">Relación laboral</h4>
                  <p className="mt-1 text-[11px] leading-relaxed text-gray-500">El tipo de contrato se registra por su duración. Los regímenes especiales se informan por separado.</p>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="block text-[13px] font-medium text-gray-700 mb-1.5">Tipo de contrato *</label>
                    <select
                      aria-label="Tipo de contrato"
                      value={newWorkerForm.tipoContrato}
                      onChange={(e) => setNewWorkerForm({
                        ...newWorkerForm,
                        tipoContrato: e.target.value as TipoContratoLaboral,
                        fechaTerminoContrato: e.target.value === 'plazo_fijo' ? newWorkerForm.fechaTerminoContrato : '',
                        obraFaenaContrato: e.target.value === 'obra_faena' ? newWorkerForm.obraFaenaContrato : '',
                      })}
                      className="form-input w-full p-2.5 border border-cream3 rounded-lg text-sm"
                      required
                    >
                      <option value="indefinido">Contrato indefinido</option>
                      <option value="plazo_fijo">Contrato a plazo fijo</option>
                      <option value="obra_faena">Contrato por obra o faena determinada</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[13px] font-medium text-gray-700 mb-1.5">Fecha de inicio del contrato *</label>
                    <input
                      aria-label="Fecha de inicio del contrato"
                      type="date"
                      value={newWorkerForm.fechaInicioContrato}
                      onChange={(e) => setNewWorkerForm({...newWorkerForm, fechaInicioContrato: e.target.value})}
                      className="form-input w-full p-2.5 border border-cream3 rounded-lg text-sm"
                      required
                    />
                  </div>

                  {newWorkerForm.tipoContrato === 'plazo_fijo' && (
                    <div className="sm:col-span-2">
                      <label className="block text-[13px] font-medium text-gray-700 mb-1.5">Fecha de término del contrato *</label>
                      <input
                        aria-label="Fecha de término del contrato"
                        type="date"
                        min={newWorkerForm.fechaInicioContrato || undefined}
                        value={newWorkerForm.fechaTerminoContrato}
                        onChange={(e) => setNewWorkerForm({...newWorkerForm, fechaTerminoContrato: e.target.value})}
                        className="form-input w-full p-2.5 border border-cream3 rounded-lg text-sm"
                        required
                      />
                    </div>
                  )}

                  {newWorkerForm.tipoContrato === 'obra_faena' && (
                    <div className="sm:col-span-2">
                      <label className="block text-[13px] font-medium text-gray-700 mb-1.5">Obra o faena determinada *</label>
                      <input
                        aria-label="Obra o faena determinada"
                        type="text"
                        value={newWorkerForm.obraFaenaContrato}
                        onChange={(e) => setNewWorkerForm({...newWorkerForm, obraFaenaContrato: e.target.value})}
                        className="form-input w-full p-2.5 border border-cream3 rounded-lg text-sm"
                        placeholder="Ej. Montaje estructural sector norte"
                        maxLength={240}
                        required
                      />
                      <p className="mt-1 text-[10.5px] leading-relaxed text-gray-400">Debe ser una obra o servicio específico e identificable en su inicio y término.</p>
                    </div>
                  )}

                  <div className="sm:col-span-2">
                    <label className="block text-[13px] font-medium text-gray-700 mb-1.5">Régimen laboral especial <span className="font-normal text-gray-400">(opcional)</span></label>
                    <select
                      aria-label="Régimen laboral especial"
                      value={newWorkerForm.regimenEspecial}
                      onChange={(e) => setNewWorkerForm({
                        ...newWorkerForm,
                        regimenEspecial: e.target.value as '' | RegimenEspecialLaboral,
                        detalleRegimenEspecial: e.target.value === 'otro' ? newWorkerForm.detalleRegimenEspecial : '',
                      })}
                      className="form-input w-full p-2.5 border border-cream3 rounded-lg text-sm"
                    >
                      <option value="">Régimen general / ninguno</option>
                      <option value="servicios_transitorios">Servicios transitorios (EST)</option>
                      <option value="aprendizaje">Contrato de aprendizaje</option>
                      <option value="agricola_temporada">Trabajador agrícola de temporada</option>
                      <option value="casa_particular">Trabajador de casa particular</option>
                      <option value="gente_mar_portuario_buceo">Gente de mar / portuario / buceo y actividades conexas</option>
                      <option value="artes_espectaculos">Trabajador de artes y espectáculos</option>
                      <option value="deportista_profesional">Deportista profesional o actividad conexa</option>
                      <option value="tripulacion_aerea">Tripulación de vuelo o cabina</option>
                      <option value="plataforma_digital_dependiente">Trabajador dependiente de plataforma digital</option>
                      <option value="otro">Otro régimen especial</option>
                    </select>
                  </div>

                  {newWorkerForm.regimenEspecial === 'otro' && (
                    <div className="sm:col-span-2">
                      <label className="block text-[13px] font-medium text-gray-700 mb-1.5">Especificar régimen especial *</label>
                      <input
                        aria-label="Especificar régimen especial"
                        type="text"
                        value={newWorkerForm.detalleRegimenEspecial}
                        onChange={(e) => setNewWorkerForm({...newWorkerForm, detalleRegimenEspecial: e.target.value})}
                        className="form-input w-full p-2.5 border border-cream3 rounded-lg text-sm"
                        maxLength={160}
                        required
                      />
                    </div>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-[13px] font-medium text-gray-700 mb-1.5">Servicio o contrato{servicioObligatorio ? ' *' : ''}</label>
                <select required={servicioObligatorio} value={newWorkerForm.servicioId} onChange={(e) => setNewWorkerForm({...newWorkerForm, servicioId: e.target.value})} className="form-input w-full p-2.5 border border-cream3 rounded-lg text-sm">
                  <option value="">{servicioObligatorio ? 'Selecciona un servicio o contrato' : 'Asignación general al proyecto'}</option>
                  {serviciosDisponibles.map(service => <option key={service.id} value={service.id}>{service.codigo} · {service.nombre}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-[13px] font-medium text-gray-700 mb-1.5">Fecha de ingreso *</label>
                <input
                  aria-label="Fecha de ingreso al proyecto"
                  type="date"
                  min={newWorkerForm.fechaInicioContrato || undefined}
                  max={newWorkerForm.tipoContrato === 'plazo_fijo' ? newWorkerForm.fechaTerminoContrato || undefined : undefined}
                  value={newWorkerForm.fechaIngreso}
                  onChange={(e) => setNewWorkerForm({...newWorkerForm, fechaIngreso: e.target.value})}
                  className="form-input w-full p-2.5 border border-cream3 rounded-lg text-sm"
                  required
                />
              </div>

              <div>
                <div className="mb-1.5 flex items-center justify-between gap-3">
                  <label className="block text-[13px] font-medium text-gray-700">Categorías del trabajador{categoriasObligatorias ? ' *' : ''}</label>
                  <span className="text-[11px] text-gray-400">Definidas por los requisitos del proyecto</span>
                </div>
                {categoriasDisponibles.length > 0 ? (
                  <div className="flex flex-wrap gap-2 rounded-lg border border-cream3 bg-cream2/40 p-3">
                    {categoriasDisponibles.map(categoria => {
                      const selected = categoriasSeleccionadas.has(categoria);
                      return (
                        <button
                          key={categoria}
                          type="button"
                          aria-pressed={selected}
                          onClick={() => toggleCategoria(categoria)}
                          className={`rounded-full border px-3 py-1.5 text-[12px] font-medium transition-colors ${selected ? 'border-brown bg-brown text-white' : 'border-cream3 bg-white text-gray-600 hover:border-brown hover:text-brown'}`}
                        >
                          {selected ? '✓ ' : ''}{categoria}
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div className="rounded-lg border border-dashed border-cream3 bg-cream2/50 p-3 text-[11.5px] leading-relaxed text-gray-500">
                    Este proyecto no tiene categorías especiales configuradas. Se guardará explícitamente la categoría <strong>General</strong>.
                  </div>
                )}
              </div>

              <div className="text-[11px] leading-relaxed bg-cream2 p-3 rounded-lg text-gray-600">
                La asignación es propia de este proyecto. Si el trabajador ya existe en otro proyecto, puede incorporarse aquí igualmente y se generará su checklist documental para este proyecto.
              </div>

              <div className="flex gap-3 mt-4">
                <button 
                  type="button"
                  onClick={() => setShowAddWorkerModal(false)}
                  className="flex-1 btn btn-ghost border border-cream3 text-navy py-2.5 font-medium rounded-lg text-sm"
                >
                  Cancelar
                </button>
                <button 
                  type="submit"
                  disabled={savingWorker}
                  className="flex-1 btn btn-primary py-2.5 font-medium rounded-lg text-sm disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {savingWorker ? 'Guardando…' : editingWorkerRut ? 'Guardar cambios' : 'Agregar trabajador'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
