import {
  AlertTriangle,
  Building2,
  CheckCircle,
  Clock3,
  FilePlus2,
  FileText,
  FolderOpen,
  LockKeyhole,
  ShieldCheck,
  UserPlus,
  Users,
  WalletCards,
  X,
  XCircle,
} from 'lucide-react';
import {
  calcularAccesoPago,
  calcularEstadoTrabajador,
  esTrabajadorAsignado,
  getRequisitos,
  obtenerDiasRestantes,
} from '../../data/localStorageDb';
import { Contratista, Documento, Mandante, Proyecto, Trabajador } from '../../types';
import { buildAcreditacionRows, estadoUILabel } from '../admin/acreditacionUtils';
import {
  buildRequisitosEmpresa,
  buildRequisitosTrabajador,
  getEstadoAccesoProyecto,
  impactoLabel,
  prioridadItem,
  RequisitoConDoc,
} from './inicio/inicioUtils';

type EstadoVisual = 'ok' | 'warning' | 'danger';

interface AccionInicio {
  key: string;
  item: RequisitoConDoc;
  owner: string;
  worker?: Trabajador;
  prioridad: number;
}

const estadoVisual = (estado: string): EstadoVisual =>
  estado === 'Acreditado' ? 'ok' : estado === 'Bloqueado' ? 'danger' : 'warning';

const textoEstadoDocumento = (item: RequisitoConDoc): string => {
  if (item.estado === 'Rechazado') return item.doc?.motivoRechazo || item.doc?.motivo || 'Documento rechazado por Acredita.';
  if (item.estado === 'Vencido') return 'El documento está vencido y debe renovarse.';
  if (item.estado === 'Por vencer') return `Documento vigente; vence en ${obtenerDiasRestantes(item.doc?.vencimiento || '')} días.`;
  return 'Documento obligatorio todavía no cargado.';
};

export default function DashboardTab({
  contratistaLogueado,
  selectedProyectoId,
  setSelectedProyectoId,
  misProyectos,
  allMandantes,
  showWelcomeAlert,
  setShowWelcomeAlert,
  documentosData,
  setActiveTab,
  setShowFichaAcreditacion,
  setSelectedWorkerForDocs,
  setShowAddWorkerModal,
}: {
  contratistaLogueado: Contratista;
  selectedProyectoId: string;
  setSelectedProyectoId: (id: string) => void;
  misProyectos: Proyecto[];
  allMandantes: Mandante[];
  showWelcomeAlert: boolean;
  setShowWelcomeAlert: (value: boolean) => void;
  documentosData: Documento[];
  trabajadoresData: Trabajador[];
  numAprobados: number;
  numRechazados: number;
  numPendientes: number;
  numPorVencer: number;
  approvedWorkers: number;
  totalWorkers: number;
  pendingWorkers: number;
  setActiveTab: (tab: string) => void;
  setSelectedDocumentForPanel: (documento: Documento | null) => void;
  setShowFichaAcreditacion: (value: boolean) => void;
  setSelectedWorkerForDocs: (trabajador: Trabajador | null) => void;
  setShowAddWorkerModal: (value: boolean) => void;
}) {
  if (misProyectos.length === 0) {
    return (
      <div className="inicio2-page">
        <section className="inicio2-hero"><div className="inicio2-eyebrow">Portal contratista</div><h1>Inicio</h1><p>Revisa en segundos el estado de tu acreditación, los bloqueos y los próximos vencimientos.</p></section>
        <div className="inicio2-empty inicio2-empty-projects"><FolderOpen size={34} /><strong>Todavía no tienes proyectos asociados</strong><p>Cuando un mandante te asigne a un proyecto, aquí verás su acreditación y requisitos.</p></div>
      </div>
    );
  }

  const proyectoActual = misProyectos.find(proyecto => proyecto.id === selectedProyectoId) || misProyectos[0];
  const mandanteActual = allMandantes.find(mandante => mandante.id === proyectoActual.mandanteId);
  const row = buildAcreditacionRows([contratistaLogueado], misProyectos, allMandantes).find(item => item.proyectoId === proyectoActual.id);
  const requisitos = getRequisitos();
  const trabajadores = (contratistaLogueado.trabajadores || []).filter(trabajador => esTrabajadorAsignado(trabajador, proyectoActual.id, misProyectos));
  const empresaItems = buildRequisitosEmpresa(contratistaLogueado, proyectoActual.id, requisitos);
  const trabajadorItems = trabajadores.flatMap(trabajador => buildRequisitosTrabajador(trabajador, proyectoActual.id, requisitos));
  const todosItems = [...empresaItems, ...trabajadorItems];
  const accesoPago = calcularAccesoPago(contratistaLogueado, proyectoActual.id);
  const acceso = getEstadoAccesoProyecto(contratistaLogueado, proyectoActual.id, trabajadores);
  const estado = row ? estadoUILabel(row.estado) : 'En proceso';
  const visual = estadoVisual(estado);

  const empresaOk = row?.company.ok || 0;
  const empresaTotal = row?.company.total || 0;
  const trabajadoresOk = row?.workers.ok || 0;
  const trabajadoresTotal = row?.workers.total || 0;
  const obligacionesOk = empresaOk + trabajadoresOk;
  const obligacionesTotal = empresaTotal + trabajadoresTotal;
  const avance = obligacionesTotal > 0 ? Math.round((obligacionesOk / obligacionesTotal) * 100) : 0;

  const estadosTrabajadores = trabajadores.map(trabajador => ({ trabajador, estado: calcularEstadoTrabajador(trabajador, proyectoActual.id) }));
  const aprobados = estadosTrabajadores.filter(item => item.estado === 'aprobado').length;
  const enProceso = estadosTrabajadores.filter(item => item.estado === 'pendiente' || item.estado === 'rechazado').length;
  const porVencer = estadosTrabajadores.filter(item => item.estado === 'por_vencer').length;
  const empresaRevision = empresaItems.filter(item => item.requisito.obligatorio && item.estado === 'En revisión').length;
  const empresaRechazados = empresaItems.filter(item => item.requisito.obligatorio && ['Rechazado', 'Vencido'].includes(item.estado)).length;
  const empresaPendientes = empresaItems.filter(item => item.requisito.obligatorio && item.estado === 'Pendiente').length;

  const accionables: AccionInicio[] = todosItems
    .filter(item => item.requisito.obligatorio && ['Pendiente', 'Rechazado', 'Vencido', 'Por vencer'].includes(item.estado))
    .map(item => ({ key: `${item.requisito.id}:${item.worker?.rut || 'empresa'}`, item, owner: item.worker?.nombre || 'Empresa', worker: item.worker, prioridad: prioridadItem(item) }))
    .sort((a, b) => {
      const stateRank = (value: string) => value === 'Rechazado' || value === 'Vencido' ? 0 : value === 'Pendiente' ? 1 : 2;
      return a.prioridad - b.prioridad || stateRank(a.item.estado) - stateRank(b.item.estado);
    });
  const esperando: AccionInicio[] = todosItems
    .filter(item => item.requisito.obligatorio && item.estado === 'En revisión')
    .map(item => ({ key: `${item.requisito.id}:${item.worker?.rut || 'empresa'}`, item, owner: item.worker?.nombre || 'Empresa', worker: item.worker, prioridad: prioridadItem(item) }))
    .sort((a, b) => a.prioridad - b.prioridad);
  const prioridad = [...accionables, ...esperando].sort((a, b) => a.prioridad - b.prioridad)[0];
  const vencimientos = todosItems
    .filter(item => item.doc && item.estado === 'Por vencer')
    .map(item => ({ item, dias: obtenerDiasRestantes(item.doc!.vencimiento) }))
    .filter(item => item.dias >= 0)
    .sort((a, b) => a.dias - b.dias)
    .slice(0, 3);

  const proyectoRecienIniciado = documentosData.length === 0 && trabajadores.length === 0;
  const irAItem = (accion: AccionInicio) => {
    if (accion.worker) {
      setSelectedWorkerForDocs(accion.worker);
      setActiveTab('trabajadores');
    } else {
      setActiveTab('subir');
    }
  };
  const abrirFicha = () => setShowFichaAcreditacion(true);

  const descripcionEstado = estado === 'Acreditado'
    ? 'Todos los requisitos obligatorios de empresa y trabajadores están aprobados y vigentes.'
    : estado === 'Bloqueado'
      ? `Existen ${empresaRechazados} documento${empresaRechazados === 1 ? '' : 's'} obligatorio${empresaRechazados === 1 ? '' : 's'} rechazado${empresaRechazados === 1 ? '' : 's'} y ${enProceso} trabajador${enProceso === 1 ? '' : 'es'} que requieren atención.`
      : `Tu empresa tiene ${empresaRevision} documento${empresaRevision === 1 ? '' : 's'} en revisión y ${enProceso} trabajador${enProceso === 1 ? '' : 'es'} aún no completa${enProceso === 1 ? '' : 'n'} sus requisitos obligatorios.`;
  const empresaDetalle = empresaRechazados > 0 ? `${empresaRechazados} rechazado${empresaRechazados === 1 ? '' : 's'}` : empresaRevision > 0 ? `${empresaRevision} en revisión` : empresaPendientes > 0 ? `${empresaPendientes} pendiente${empresaPendientes === 1 ? '' : 's'}` : 'Todo al día';
  const accesoCorto = acceso.estado === 'habilitado' ? 'Habilitado' : acceso.estado === 'bloqueado' ? 'Bloqueado' : 'Parcial';

  return (
    <div className="inicio2-page">
      <section className="inicio2-hero">
        <div className="inicio2-hero-inner"><div><div className="inicio2-eyebrow">Portal contratista</div><h1>Inicio</h1><p>Revisa en segundos el estado de tu acreditación, los bloqueos que requieren atención y los próximos vencimientos de tu proyecto.</p></div>
          <div className="inicio2-picker"><div><label htmlFor="inicio2-project">Proyecto activo</label><select id="inicio2-project" value={proyectoActual.id} onChange={event => setSelectedProyectoId(event.target.value)}>{misProyectos.map(proyecto => <option key={proyecto.id} value={proyecto.id}>{proyecto.nombre}</option>)}</select></div><div className="inicio2-project-meta">Mandante<strong>{mandanteActual?.nombre || 'Mandante no disponible'}</strong></div></div>
        </div>
      </section>

      <section className="inicio2-floating">
        {showWelcomeAlert && <div className="inicio2-welcome"><span><CheckCircle size={16} /> Bienvenido al proyecto. Revisa sus requisitos de acreditación.</span><button type="button" onClick={() => setShowWelcomeAlert(false)} aria-label="Cerrar bienvenida"><X size={15} /></button></div>}

        {proyectoRecienIniciado ? <div className="inicio2-empty"><FileText size={34} /><strong>Proyecto recién iniciado</strong><p>Aún no hay documentos ni trabajadores cargados para {proyectoActual.nombre}.</p><div><button type="button" onClick={() => setActiveTab('subir')}>Subir primer documento</button><button type="button" onClick={() => { setActiveTab('trabajadores'); setShowAddWorkerModal(true); }}>Agregar trabajador</button></div></div> : <>
          <div className={`inicio2-status inicio2-${visual}`}><div className="inicio2-status-main"><div className="inicio2-status-icon">{estado === 'Acreditado' ? <CheckCircle /> : estado === 'Bloqueado' ? <XCircle /> : <Clock3 />}</div><div><span>Acreditación del proyecto</span><div className="inicio2-status-title"><h2>{estado}</h2><b>{estado === 'Acreditado' ? 'Todo al día' : estado === 'Bloqueado' ? 'Requiere corrección' : 'Requiere atención'}</b></div><p>{descripcionEstado}</p></div></div><div className="inicio2-progress-zone"><div><span>Obligaciones completadas</span><strong>{obligacionesTotal > 0 ? `${obligacionesOk} de ${obligacionesTotal}` : 'Sin obligaciones'}</strong></div><div className="inicio2-progress"><i style={{ width: `${avance}%` }} /></div><small>Empresa obligatoria + trabajadores asignados</small></div></div>

          <div className="inicio2-metrics">
            <div className="inicio2-metric"><div><span>Empresa</span><strong>{empresaOk} / {empresaTotal}</strong><small>{empresaDetalle}</small></div><i className="inicio2-blue"><Building2 /></i></div>
            <div className="inicio2-metric"><div><span>Trabajadores</span><strong>{trabajadoresOk} / {trabajadoresTotal}</strong><small>{trabajadoresTotal - trabajadoresOk} requieren completar requisitos</small></div><i className="inicio2-green"><Users /></i></div>
            <div className="inicio2-metric"><div><span>Acceso a faena</span><strong>{accesoCorto}</strong><small>{trabajadoresOk} trabajadores habilitados</small></div><i className={acceso.estado === 'bloqueado' ? 'inicio2-red' : acceso.estado === 'habilitado' ? 'inicio2-green' : 'inicio2-yellow'}><LockKeyhole /></i></div>
            <div className="inicio2-metric"><div><span>Pago</span><strong>{accesoPago.pagoBloqueado ? 'Retenido' : 'Habilitado'}</strong><small>{accesoPago.motivoPago || 'Sin bloqueos de pago'}</small></div><i className={accesoPago.pagoBloqueado ? 'inicio2-red' : 'inicio2-green'}><WalletCards /></i></div>
          </div>

          {prioridad ? <div className={`inicio2-priority ${prioridad.item.estado === 'En revisión' ? 'waiting' : ''}`}><div className="inicio2-priority-copy"><i>{prioridad.item.estado === 'En revisión' ? <Clock3 /> : <AlertTriangle />}</i><div><strong>Prioridad de hoy</strong><p>{prioridad.item.estado === 'En revisión' ? `${prioridad.item.requisito.nombre} ya fue enviado y está siendo revisado por Acredita. No necesitas hacer nada mientras permanezca en revisión.` : `${prioridad.owner} · ${prioridad.item.requisito.nombre}. ${textoEstadoDocumento(prioridad.item)}`}</p></div></div><button type="button" onClick={() => irAItem(prioridad)}>{prioridad.item.estado === 'En revisión' ? 'Ver documento' : prioridad.item.estado === 'Por vencer' ? 'Renovar' : 'Resolver'}</button></div> : <div className="inicio2-priority clear"><div className="inicio2-priority-copy"><i><CheckCircle /></i><div><strong>Todo al día</strong><p>No tienes acciones pendientes en este proyecto.</p></div></div></div>}

          <div className="inicio2-main-grid">
            <section className="inicio2-card"><header><div><h3>Avance de acreditación</h3><p>Progreso real dentro de {proyectoActual.nombre}.</p></div><button type="button" onClick={abrirFicha}>Ver ficha completa</button></header><div className="inicio2-card-body"><div className="inicio2-advance"><div><strong><i />Empresa</strong><span>{empresaOk} de {empresaTotal} obligatorios listos</span></div><div><i style={{ width: `${empresaTotal ? (empresaOk / empresaTotal) * 100 : 0}%` }} /></div></div><div className="inicio2-advance workers"><div><strong><i />Trabajadores</strong><span>{trabajadoresOk} de {trabajadoresTotal} habilitados</span></div><div><i style={{ width: `${trabajadoresTotal ? (trabajadoresOk / trabajadoresTotal) * 100 : 0}%` }} /></div></div><div className="inicio2-minis"><div><span>Aprobados</span><b>{aprobados} trabajadores</b></div><div><span>En proceso</span><b>{enProceso} trabajadores</b></div><div><span>Trabajadores por vencer</span><b>{porVencer} trabajadores</b></div></div></div></section>

            <section className="inicio2-card"><header><div><h3>Requiere atención</h3><p>Solo asuntos que puedes resolver ahora.</p></div><button type="button" onClick={() => setActiveTab('subir')}>Ver todo</button></header><div className="inicio2-card-body inicio2-attention-list">{accionables.length === 0 ? <div className="inicio2-positive"><CheckCircle /><strong>Todo al día</strong><p>No tienes acciones pendientes en este proyecto.</p></div> : accionables.slice(0, 4).map((accion, index) => <div className="inicio2-attention" key={accion.key}><i>{index + 1}</i><div><strong>{accion.owner} · {accion.item.requisito.nombre}</strong><p>{textoEstadoDocumento(accion.item)}</p></div><button type="button" onClick={() => irAItem(accion)}>{accion.item.estado === 'Por vencer' ? 'Renovar' : 'Resolver'}</button></div>)}</div></section>
          </div>

          {esperando.length > 0 && <section className="inicio2-waiting"><header><div><Clock3 /><span><strong>Esperando a Acredita</strong><small>Documentos enviados que no requieren una acción tuya.</small></span></div><button type="button" onClick={() => setActiveTab('subir')}>Ver documentos</button></header>{esperando.slice(0, 3).map(accion => <div className="inicio2-wait-row" key={accion.key}><div><strong>{accion.owner} · {accion.item.requisito.nombre}</strong><p>La corrección ya fue enviada. No necesitas hacer nada mientras Acredita la revisa.</p></div><button type="button" onClick={() => irAItem(accion)}>Ver</button></div>)}</section>}

          <div className="inicio2-bottom-grid">
            <section className="inicio2-card"><header><div><h3>Próximos vencimientos</h3><p>Documentos vigentes dentro de su ventana preventiva.</p></div><button type="button" onClick={() => setActiveTab('subir')}>Ver documentos</button></header><div className="inicio2-card-body">{vencimientos.length === 0 ? <div className="inicio2-positive compact"><ShieldCheck /><p>No hay documentos próximos a vencer.</p></div> : vencimientos.map(({ item, dias }) => <div className="inicio2-expiry" key={`${item.requisito.id}:${item.worker?.rut || 'empresa'}`}><div><strong>{item.worker ? `${item.worker.nombre} · ` : ''}{item.requisito.nombre}</strong><small>{item.worker ? 'Trabajador' : 'Empresa'} · {impactoLabel(item.requisito)}</small></div><b>Vence en {dias} día{dias === 1 ? '' : 's'}</b><button type="button" onClick={() => irAItem({ key: '', item, owner: item.worker?.nombre || 'Empresa', worker: item.worker, prioridad: 3 })}>Renovar</button></div>)}</div></section>

            <section className="inicio2-card"><header><div><h3>Acciones rápidas</h3><p>Atajos a las tareas frecuentes.</p></div></header><div className="inicio2-card-body inicio2-quick-grid"><button type="button" onClick={() => setActiveTab('subir')}><FilePlus2 /><span>Documentos<strong>Subir documento</strong><small>Completa requisitos pendientes.</small></span></button><button type="button" onClick={() => { setActiveTab('trabajadores'); setShowAddWorkerModal(true); }}><UserPlus /><span>Equipo<strong>Agregar trabajador</strong><small>Asigna personal al proyecto.</small></span></button><button type="button" onClick={() => setActiveTab('proyectos')}><FolderOpen /><span>Proyecto<strong>Ver proyecto</strong><small>Consulta su estado completo.</small></span></button><button type="button" onClick={abrirFicha}><ShieldCheck /><span>Acreditación<strong>Ver ficha</strong><small>Abre el detalle actual.</small></span></button></div></section>
          </div>
        </>}
      </section>
    </div>
  );
}
