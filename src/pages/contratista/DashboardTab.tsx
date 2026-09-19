import { useNavigate } from 'react-router-dom';
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
  contratoTrabajadorVencido,
  esTrabajadorAsignado,
  getProblemasFichaTrabajador,
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
type TipoAccionInicio = 'documento' | 'ficha' | 'contrato' | 'matriz';

interface AccionInicio {
  key: string;
  tipo: TipoAccionInicio;
  owner: string;
  worker?: Trabajador;
  item?: RequisitoConDoc;
  prioridad: number;
  impacto: string;
  titulo: string;
  descripcion: string;
  cta: string;
}

const estadoVisual = (estado: string): EstadoVisual =>
  estado === 'Acreditado' ? 'ok' : estado === 'Bloqueado' ? 'danger' : 'warning';

const proyectoOperativo = (proyecto: Proyecto): boolean =>
  ['activo', 'active'].includes(String(proyecto.estado || '').trim().toLocaleLowerCase('es'));

const textoEstadoDocumento = (item: RequisitoConDoc): string => {
  if (item.estado === 'Rechazado') return item.doc?.motivoRechazo || item.doc?.motivo || 'Documento rechazado por Acredita.';
  if (item.estado === 'Vencido') return 'El documento está vencido y debe renovarse.';
  if (item.estado === 'Por vencer') return `Documento vigente; vence en ${obtenerDiasRestantes(item.doc?.vencimiento || '')} días.`;
  if (item.estado === 'En revisión') return 'Documento enviado correctamente; está esperando revisión de Acredita.';
  if (item.estado === 'Aprobado') return 'Documento aprobado y vigente.';
  return 'Documento obligatorio todavía no cargado.';
};

const impactoPrioridadDocumento = (item: RequisitoConDoc): string => {
  if (item.requisito.criticidad === 'bloquea_ambas') return 'Bloquea acceso y pago';
  if (item.requisito.criticidad === 'bloquea_pago') return 'Bloquea pago';
  if (item.requisito.criticidad === 'bloquea_acceso') return 'Bloquea acceso';
  if (item.estado === 'Rechazado' || item.estado === 'Vencido') return 'Requisito obligatorio';
  if (item.estado === 'Pendiente') return 'Falta obligatoria';
  if (item.estado === 'Por vencer') return 'Vence pronto';
  return 'Sin bloqueo operativo';
};

const accionDocumento = (item: RequisitoConDoc): AccionInicio => ({
  key: `doc:${item.requisito.id}:${item.worker?.rut || 'empresa'}`,
  tipo: 'documento',
  owner: item.worker?.nombre || 'Empresa',
  worker: item.worker,
  item,
  prioridad: prioridadItem(item),
  impacto: impactoPrioridadDocumento(item),
  titulo: item.requisito.nombre,
  descripcion: textoEstadoDocumento(item),
  cta: item.estado === 'Por vencer' ? 'Renovar' : item.estado === 'En revisión' ? 'Ver' : 'Resolver',
});

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
  setActiveTab: (tab: string) => void;
  setShowFichaAcreditacion: (value: boolean) => void;
  setSelectedWorkerForDocs: (trabajador: Trabajador | null) => void;
  setShowAddWorkerModal: (value: boolean) => void;
}) {
  const navigate = useNavigate();

  if (misProyectos.length === 0) {
    return (
      <div className="inicio2-page">
        <section className="inicio2-hero"><div className="inicio2-eyebrow">Portal contratista</div><h1>Inicio</h1><p>Revisa en segundos el estado de tu acreditación, los bloqueos y los próximos vencimientos.</p></section>
        <div className="inicio2-empty inicio2-empty-projects"><FolderOpen size={34} /><strong>Aún no tienes proyectos asignados</strong><p>Cuando un mandante te invite o asigne a un proyecto, aparecerá aquí.</p></div>
      </div>
    );
  }

  const proyectoActual = misProyectos.find(proyecto => proyecto.id === selectedProyectoId) || misProyectos[0];
  const modoConsulta = !proyectoOperativo(proyectoActual);
  const mandanteActual = allMandantes.find(mandante => mandante.id === proyectoActual.mandanteId);
  const row = buildAcreditacionRows([contratistaLogueado], misProyectos, allMandantes).find(item => item.proyectoId === proyectoActual.id);
  const requisitos = getRequisitos();
  const requisitosTrabajadorConfigurados = requisitos.filter(
    requisito => requisito.proyectoId === proyectoActual.id && requisito.destino === 'trabajador' && requisito.activo !== false,
  );
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
  const trabajadoresBloqueados = estadosTrabajadores.filter(item => item.estado === 'rechazado').length;
  const porVencer = estadosTrabajadores.filter(item => item.estado === 'por_vencer').length;
  const empresaRevision = empresaItems.filter(item => item.requisito.obligatorio && item.estado === 'En revisión').length;
  const empresaRechazados = empresaItems.filter(item => item.requisito.obligatorio && ['Rechazado', 'Vencido'].includes(item.estado)).length;
  const empresaPendientes = empresaItems.filter(item => item.requisito.obligatorio && item.estado === 'Pendiente').length;

  const accionesDocumentales = modoConsulta ? [] : todosItems
    .filter(item => item.requisito.obligatorio && ['Pendiente', 'Rechazado', 'Vencido'].includes(item.estado))
    .map(accionDocumento);

  const preventivasDocumentales = modoConsulta ? [] : todosItems
    .filter(item => item.estado === 'Por vencer')
    .map(accionDocumento);

  const esperandoDocumental = modoConsulta ? [] : todosItems
    .filter(item => item.estado === 'En revisión')
    .map(accionDocumento);

  const accionesTrabajador: AccionInicio[] = [];
  const preventivasTrabajador: AccionInicio[] = [];
  const esperandoTrabajador: AccionInicio[] = [];

  if (!modoConsulta) {
    trabajadores.forEach(worker => {
      const problemasFicha = getProblemasFichaTrabajador(worker, proyectoActual.id, contratistaLogueado.id);
      const vencido = contratoTrabajadorVencido(worker);
      const aplicables = buildRequisitosTrabajador(worker, proyectoActual.id, requisitos);

      if (vencido) {
        accionesTrabajador.push({
          key: `contrato:${worker.rut}`,
          tipo: 'contrato',
          owner: worker.nombre,
          worker,
          prioridad: 1,
          impacto: 'Bloquea acceso',
          titulo: 'Contrato laboral vencido',
          descripcion: `El contrato terminó el ${worker.fechaTerminoContrato}. Registra una renovación o un nuevo contrato para recuperar la habilitación.`,
          cta: 'Actualizar ficha',
        });
      } else if (problemasFicha.length > 0) {
        accionesTrabajador.push({
          key: `ficha:${worker.rut}`,
          tipo: 'ficha',
          owner: worker.nombre,
          worker,
          prioridad: 1,
          impacto: 'Impide habilitar trabajador',
          titulo: 'Ficha laboral incompleta',
          descripcion: `Falta completar: ${problemasFicha.join(', ')}.`,
          cta: 'Completar ficha',
        });
      } else if (requisitosTrabajadorConfigurados.length === 0 || aplicables.length === 0) {
        esperandoTrabajador.push({
          key: `matriz:${worker.rut}`,
          tipo: 'matriz',
          owner: worker.nombre,
          worker,
          prioridad: 4,
          impacto: 'Configuración pendiente',
          titulo: 'Sin matriz documental aplicable',
          descripcion: 'La ficha del trabajador está completa, pero no existe una matriz documental aplicable a su servicio/categoría. Acredita o el Mandante debe revisar la configuración.',
          cta: 'Ver trabajador',
        });
      }

      if (!vencido && worker.fechaTerminoContrato) {
        const dias = obtenerDiasRestantes(worker.fechaTerminoContrato);
        if (dias >= 0 && dias <= 30) {
          preventivasTrabajador.push({
            key: `contrato-preventivo:${worker.rut}`,
            tipo: 'contrato',
            owner: worker.nombre,
            worker,
            prioridad: 3,
            impacto: 'Vence pronto',
            titulo: 'Contrato laboral por vencer',
            descripcion: dias === 0
              ? 'El contrato vence hoy. Renueva la relación laboral para evitar que el trabajador pierda acceso.'
              : `El contrato vence en ${dias} días. Puedes renovarlo antes del vencimiento para evitar una interrupción de acceso.`,
            cta: 'Revisar contrato',
          });
        }
      }
    });
  }

  const ordenAcciones = (a: AccionInicio, b: AccionInicio) => a.prioridad - b.prioridad || a.owner.localeCompare(b.owner, 'es') || a.titulo.localeCompare(b.titulo, 'es');
  const accionables = [...accionesDocumentales, ...accionesTrabajador].sort(ordenAcciones);
  const preventivas = [...preventivasDocumentales, ...preventivasTrabajador].sort(ordenAcciones);
  const esperando = [...esperandoDocumental, ...esperandoTrabajador].sort(ordenAcciones);
  const prioridad = accionables[0];
  const preventivaPrincipal = preventivas[0];

  const sinAccionDocumental = modoConsulta
    ? todosItems.length
    : todosItems.filter(item => {
      const requiereAccion = item.requisito.obligatorio && ['Pendiente', 'Rechazado', 'Vencido'].includes(item.estado);
      const preventiva = item.estado === 'Por vencer';
      const espera = item.estado === 'En revisión';
      return !requiereAccion && !preventiva && !espera;
    }).length;

  const vencimientos = modoConsulta ? [] : todosItems
    .filter(item => item.doc && item.estado === 'Por vencer')
    .map(item => ({ item, dias: obtenerDiasRestantes(item.doc!.vencimiento) }))
    .filter(item => item.dias >= 0)
    .sort((a, b) => a.dias - b.dias)
    .slice(0, 3);

  const tieneDocumentosCargados = documentosData.some(doc =>
    doc.estado !== 'pendiente'
    || Boolean(doc.subido && doc.subido !== '—')
    || Boolean(doc.archivoReferencia)
  );
  const proyectoRecienIniciado = !modoConsulta && !tieneDocumentosCargados && trabajadores.length === 0;

  const navegarDocumentos = (estadoFiltro?: 'accion' | 'revision' | 'por_vencer', accion?: AccionInicio) => {
    const params = new URLSearchParams();
    params.set('proyecto', proyectoActual.id);
    if (estadoFiltro) params.set('estado', estadoFiltro);
    if (accion?.item) {
      params.set('requisito', accion.item.requisito.id);
      if (accion.item.worker?.rut) params.set('trabajador', accion.item.worker.rut);
    }
    navigate(`/contratista/documentos?${params.toString()}`);
  };

  const irAAccion = (accion: AccionInicio) => {
    if (accion.tipo === 'documento' && accion.item) {
      const filtro = accion.item.estado === 'En revisión' ? 'revision' : accion.item.estado === 'Por vencer' ? 'por_vencer' : 'accion';
      navegarDocumentos(filtro, accion);
      return;
    }
    if (accion.worker) {
      setSelectedWorkerForDocs(accion.worker);
      setActiveTab('trabajadores');
    }
  };

  const abrirFicha = () => setShowFichaAcreditacion(true);

  const descripcionEstado = modoConsulta
    ? 'Este proyecto ya no está operativo. La información permanece disponible como historial y no genera nuevas acciones, cargas ni bloqueos actuales.'
    : estado === 'Acreditado'
      ? 'Todos los requisitos obligatorios de empresa y trabajadores están aprobados y vigentes.'
      : estado === 'Bloqueado'
        ? `Existen ${empresaRechazados} documento${empresaRechazados === 1 ? '' : 's'} obligatorio${empresaRechazados === 1 ? '' : 's'} rechazado${empresaRechazados === 1 ? '' : 's'} y ${enProceso} trabajador${enProceso === 1 ? '' : 'es'} que requieren atención.`
        : `Tu empresa tiene ${empresaRevision} documento${empresaRevision === 1 ? '' : 's'} en revisión y ${enProceso} trabajador${enProceso === 1 ? '' : 'es'} aún no completa${enProceso === 1 ? '' : 'n'} sus requisitos obligatorios.`;

  const empresaDetalle = empresaRechazados > 0
    ? `${empresaRechazados} rechazado${empresaRechazados === 1 ? '' : 's'}`
    : empresaRevision > 0
      ? `${empresaRevision} en revisión`
      : empresaPendientes > 0
        ? `${empresaPendientes} pendiente${empresaPendientes === 1 ? '' : 's'}`
        : 'Todo al día';

  const accesoCorto = modoConsulta ? 'No operativo' : acceso.estado === 'habilitado' ? 'Habilitado' : acceso.estado === 'bloqueado' ? 'Bloqueado' : acceso.estado === 'pendiente' ? 'Pendiente' : 'Parcial';
  const pagoCorto = modoConsulta ? 'No operativo' : accesoPago.pagoEstado === 'bloqueado' ? 'Retenido' : accesoPago.pagoEstado === 'pendiente' ? 'Pendiente' : 'Habilitado';

  const bloqueosVisibles = modoConsulta ? [] : [
    empresaRechazados > 0 ? { label: 'Empresa', detail: `${empresaRechazados} requisito${empresaRechazados === 1 ? '' : 's'} bloqueante${empresaRechazados === 1 ? '' : 's'}` } : null,
    trabajadoresBloqueados > 0 ? { label: 'Trabajadores', detail: `${trabajadoresBloqueados} bloqueado${trabajadoresBloqueados === 1 ? '' : 's'}` } : null,
    acceso.estado === 'bloqueado' ? { label: 'Acceso', detail: acceso.detalle || 'Ingreso a faena bloqueado' } : null,
    accesoPago.pagoEstado === 'bloqueado' ? { label: 'Pago', detail: accesoPago.motivoPago || 'Pago retenido' } : null,
  ].filter(Boolean) as Array<{ label: string; detail: string }>;

  return (
    <div className="inicio2-page">
      <section className="inicio2-hero">
        <div className="inicio2-hero-inner"><div><div className="inicio2-eyebrow">Portal contratista</div><h1>Inicio</h1><p>Revisa en segundos el estado de tu acreditación, los bloqueos que requieren atención y los próximos vencimientos de tu proyecto.</p></div>
          <div className="inicio2-picker"><div><label htmlFor="inicio2-project">Proyecto activo</label><select id="inicio2-project" value={proyectoActual.id} onChange={event => setSelectedProyectoId(event.target.value)}>{misProyectos.map(proyecto => <option key={proyecto.id} value={proyecto.id}>{proyecto.nombre}{proyectoOperativo(proyecto) ? '' : ' · Histórico'}</option>)}</select></div><div className="inicio2-project-meta">Mandante<strong>{mandanteActual?.nombre || 'Mandante no disponible'}</strong></div></div>
        </div>
      </section>

      <section className="inicio2-floating">
        {showWelcomeAlert && !modoConsulta && <div className="inicio2-welcome"><span><CheckCircle size={16} /> Bienvenido al proyecto. Revisa sus requisitos de acreditación.</span><button type="button" onClick={() => setShowWelcomeAlert(false)} aria-label="Cerrar bienvenida"><X size={15} /></button></div>}
        {modoConsulta && <div className="inicio2-historical-banner"><Clock3 size={17} /><div><strong>Proyecto finalizado · modo consulta</strong><p>Puedes revisar su historial, documentos y ficha de acreditación, pero este proyecto ya no genera nuevas cargas, renovaciones ni acciones operativas.</p></div></div>}

        {proyectoRecienIniciado ? <div className="inicio2-empty inicio2-onboarding"><FileText size={34} /><strong>Comienza la acreditación de {proyectoActual.nombre}</strong><p>Sigue este orden para evitar cargar información fuera de contexto y llegar a la acreditación de forma clara.</p><div className="inicio2-onboarding-steps">
          <button type="button" onClick={() => navegarDocumentos()}><b>1</b><span>Revisar requisitos<small>Conoce qué exige el Mandante.</small></span></button>
          <button type="button" onClick={() => navegarDocumentos('accion')}><b>2</b><span>Completar empresa<small>Sube los documentos corporativos.</small></span></button>
          <button type="button" onClick={() => { setActiveTab('trabajadores'); setShowAddWorkerModal(true); }}><b>3</b><span>Cargar trabajadores<small>Registra y asigna tu equipo.</small></span></button>
          <button type="button" onClick={() => setActiveTab('trabajadores')}><b>4</b><span>Completar trabajadores<small>Resuelve sus requisitos documentales.</small></span></button>
          <button type="button" onClick={abrirFicha}><b>5</b><span>Obtener acreditación<small>Revisa el resultado integral.</small></span></button>
        </div></div> : <>
          <div className={`inicio2-status inicio2-${visual}`}><div className="inicio2-status-main"><div className="inicio2-status-icon">{modoConsulta ? <Clock3 /> : estado === 'Acreditado' ? <CheckCircle /> : estado === 'Bloqueado' ? <XCircle /> : <Clock3 />}</div><div><span>{modoConsulta ? 'Último estado de acreditación' : 'Acreditación del proyecto'}</span><div className="inicio2-status-title"><h2>{estado}</h2><b>{modoConsulta ? 'Histórico' : estado === 'Acreditado' ? 'Todo al día' : estado === 'Bloqueado' ? 'Requiere corrección' : 'Requiere atención'}</b></div><p>{descripcionEstado}</p></div></div><div className="inicio2-progress-zone"><div><span>Obligaciones completadas</span><strong>{obligacionesTotal > 0 ? `${obligacionesOk} de ${obligacionesTotal}` : 'Sin obligaciones'}</strong></div><div className="inicio2-progress"><i style={{ width: `${avance}%` }} /></div><small>{modoConsulta ? 'Snapshot histórico del proyecto' : 'Empresa obligatoria + trabajadores asignados'}</small></div></div>

          <div className="inicio2-metrics">
            <div className="inicio2-metric"><div><span>Empresa</span><strong>{empresaOk} / {empresaTotal}</strong><small>{modoConsulta ? 'Resultado histórico' : empresaDetalle}</small></div><i className="inicio2-blue"><Building2 /></i></div>
            <div className="inicio2-metric"><div><span>Trabajadores</span><strong>{trabajadoresOk} / {trabajadoresTotal}</strong><small>{modoConsulta ? 'Resultado histórico' : `${trabajadoresTotal - trabajadoresOk} requieren completar requisitos`}</small></div><i className="inicio2-green"><Users /></i></div>
            <div className="inicio2-metric"><div><span>Acceso a faena</span><strong>{accesoCorto}</strong><small>{modoConsulta ? 'Sin acceso operativo actual' : `${trabajadoresOk} trabajadores habilitados`}</small></div><i className={modoConsulta ? 'inicio2-blue' : acceso.estado === 'bloqueado' ? 'inicio2-red' : acceso.estado === 'habilitado' ? 'inicio2-green' : 'inicio2-yellow'}><LockKeyhole /></i></div>
            <div className="inicio2-metric"><div><span>Pago</span><strong>{pagoCorto}</strong><small>{modoConsulta ? 'Sin estado de pago operativo actual' : accesoPago.motivoPago || 'Sin restricciones de pago'}</small></div><i className={modoConsulta ? 'inicio2-blue' : accesoPago.pagoEstado === 'bloqueado' ? 'inicio2-red' : accesoPago.pagoEstado === 'pendiente' ? 'inicio2-yellow' : 'inicio2-green'}><WalletCards /></i></div>
          </div>

          {bloqueosVisibles.length > 0 && <section className="inicio2-block-map" aria-label="Impactos bloqueados"><header><strong>Qué está bloqueado</strong><span>Impacto operativo actual del proyecto</span></header><div>{bloqueosVisibles.map(item => <article key={item.label}><b>{item.label}</b><small>{item.detail}</small></article>)}</div></section>}

          <div className="inicio2-responsibility-strip" aria-label="Responsabilidad de pendientes">
            <div className="mine"><strong>Requiere acción</strong><b>{accionables.length}</b><small>Puedes resolverlo ahora.</small></div>
            <div className="preventive"><strong>Acción preventiva</strong><b>{preventivas.length}</b><small>Sigue vigente, pero conviene anticiparse.</small></div>
            <div className="waiting"><strong>Esperando a Acredita</strong><b>{esperando.length}</b><small>Ya hiciste tu parte o falta configuración.</small></div>
            <div className="clear"><strong>Sin acción requerida</strong><b>{sinAccionDocumental}</b><small>Aprobados, opcionales o históricos.</small></div>
          </div>

          {modoConsulta ? <div className="inicio2-priority waiting"><div className="inicio2-priority-copy"><i><Clock3 /></i><div><strong>Modo consulta</strong><p>Este proyecto no tiene acciones operativas pendientes. Puedes revisar su historial y documentación.</p></div></div><button type="button" onClick={abrirFicha}>Ver historial</button></div>
            : prioridad ? <div className="inicio2-priority"><div className="inicio2-priority-copy"><i><AlertTriangle /></i><div><strong>Prioridad 1 · {prioridad.impacto}</strong><p>{prioridad.owner} · {prioridad.titulo}. {prioridad.descripcion}</p></div></div><button type="button" onClick={() => irAAccion(prioridad)}>{prioridad.cta}</button></div>
              : preventivaPrincipal ? <div className="inicio2-priority preventive"><div className="inicio2-priority-copy"><i><Clock3 /></i><div><strong>Acción preventiva · {preventivaPrincipal.impacto}</strong><p>{preventivaPrincipal.owner} · {preventivaPrincipal.titulo}. {preventivaPrincipal.descripcion}</p></div></div><button type="button" onClick={() => irAAccion(preventivaPrincipal)}>{preventivaPrincipal.cta}</button></div>
                : esperando.length > 0 ? <div className="inicio2-priority waiting"><div className="inicio2-priority-copy"><i><Clock3 /></i><div><strong>Esperando a Acredita</strong><p>No tienes una acción pendiente ahora. Hay {esperando.length} asunto{esperando.length === 1 ? '' : 's'} esperando revisión o configuración.</p></div></div><button type="button" onClick={() => irAAccion(esperando[0])}>Ver pendiente</button></div>
                  : <div className="inicio2-priority clear"><div className="inicio2-priority-copy"><i><CheckCircle /></i><div><strong>Sin acción requerida</strong><p>No tienes acciones pendientes en este proyecto.</p></div></div></div>}

          <div className="inicio2-main-grid">
            <section className="inicio2-card"><header><div><h3>Avance de acreditación</h3><p>Progreso real dentro de {proyectoActual.nombre}.</p></div><button type="button" onClick={abrirFicha}>Ver ficha completa</button></header><div className="inicio2-card-body"><div className="inicio2-advance"><div><strong><i />Empresa</strong><span>{empresaOk} de {empresaTotal} obligatorios listos</span></div><div><i style={{ width: `${empresaTotal ? (empresaOk / empresaTotal) * 100 : 0}%` }} /></div></div><div className="inicio2-advance workers"><div><strong><i />Trabajadores</strong><span>{trabajadoresOk} de {trabajadoresTotal} habilitados</span></div><div><i style={{ width: `${trabajadoresTotal ? (trabajadoresOk / trabajadoresTotal) * 100 : 0}%` }} /></div></div><div className="inicio2-minis"><div><span>Aprobados</span><b>{aprobados} trabajadores</b></div><div><span>En proceso</span><b>{enProceso} trabajadores</b></div><div><span>Trabajadores por vencer</span><b>{porVencer} trabajadores</b></div></div></div></section>

            <section className="inicio2-card"><header><div><h3>Requiere atención</h3><p>{modoConsulta ? 'Este proyecto está en modo consulta.' : 'Solo asuntos que puedes resolver ahora.'}</p></div>{!modoConsulta && <button type="button" onClick={() => navegarDocumentos('accion')}>Ver todo</button>}</header><div className="inicio2-card-body inicio2-attention-list">{modoConsulta ? <div className="inicio2-positive"><Clock3 /><strong>Proyecto finalizado</strong><p>No existen acciones operativas que resolver en este proyecto.</p></div> : accionables.length === 0 ? <div className="inicio2-positive"><CheckCircle /><strong>Todo al día</strong><p>No tienes acciones pendientes en este proyecto.</p></div> : accionables.slice(0, 4).map((accion, index) => <div className="inicio2-attention" key={accion.key}><i>{index + 1}</i><div><strong>{accion.owner} · {accion.titulo}</strong><p><b>{accion.impacto}.</b> {accion.descripcion}</p></div><button type="button" onClick={() => irAAccion(accion)}>{accion.cta}</button></div>)}</div></section>
          </div>

          {preventivas.length > 0 && !modoConsulta && <section className="inicio2-waiting preventive"><header><div><Clock3 /><span><strong>Acciones preventivas</strong><small>Elementos vigentes que conviene resolver antes de que generen un bloqueo.</small></span></div><button type="button" onClick={() => navegarDocumentos('por_vencer')}>Ver próximos vencimientos</button></header>{preventivas.slice(0, 3).map(accion => <div className="inicio2-wait-row" key={accion.key}><div><strong>{accion.owner} · {accion.titulo}</strong><p>{accion.descripcion}</p></div><button type="button" onClick={() => irAAccion(accion)}>{accion.cta}</button></div>)}</section>}

          {esperando.length > 0 && !modoConsulta && <section className="inicio2-waiting"><header><div><Clock3 /><span><strong>Esperando a Acredita</strong><small>Asuntos que no requieren una acción tuya en este momento.</small></span></div>{esperando.some(accion => accion.tipo === 'documento') && <button type="button" onClick={() => navegarDocumentos('revision')}>Ver documentos</button>}</header>{esperando.slice(0, 3).map(accion => <div className="inicio2-wait-row" key={accion.key}><div><strong>{accion.owner} · {accion.titulo}</strong><p>{accion.descripcion}</p></div><button type="button" onClick={() => irAAccion(accion)}>{accion.cta}</button></div>)}</section>}

          <div className="inicio2-bottom-grid">
            <section className="inicio2-card"><header><div><h3>Próximos vencimientos</h3><p>{modoConsulta ? 'Sin renovaciones operativas para proyectos históricos.' : 'Documentos vigentes dentro de su ventana preventiva.'}</p></div>{!modoConsulta && <button type="button" onClick={() => navegarDocumentos('por_vencer')}>Ver documentos</button>}</header><div className="inicio2-card-body">{vencimientos.length === 0 ? <div className="inicio2-positive compact"><ShieldCheck /><p>{modoConsulta ? 'Proyecto histórico: no se generan renovaciones.' : 'No hay documentos próximos a vencer.'}</p></div> : vencimientos.map(({ item, dias }) => { const accion = accionDocumento(item); return <div className="inicio2-expiry" key={`${item.requisito.id}:${item.worker?.rut || 'empresa'}`}><div><strong>{item.worker ? `${item.worker.nombre} · ` : ''}{item.requisito.nombre}</strong><small>{item.worker ? 'Trabajador' : 'Empresa'} · {impactoLabel(item.requisito)}</small></div><b>Vence en {dias} día{dias === 1 ? '' : 's'}</b><button type="button" onClick={() => irAAccion(accion)}>Renovar</button></div>; })}</div></section>

            <section className="inicio2-card"><header><div><h3>Acciones rápidas</h3><p>{modoConsulta ? 'Atajos de consulta histórica.' : 'Atajos a las tareas frecuentes.'}</p></div></header><div className="inicio2-card-body inicio2-quick-grid">{!modoConsulta && <button type="button" onClick={() => navegarDocumentos()}><FilePlus2 /><span>Documentos<strong>Subir documento</strong><small>Completa requisitos pendientes.</small></span></button>}{!modoConsulta && <button type="button" onClick={() => { setActiveTab('trabajadores'); setShowAddWorkerModal(true); }}><UserPlus /><span>Equipo<strong>Agregar trabajador</strong><small>Asigna personal al proyecto.</small></span></button>}<button type="button" onClick={() => setActiveTab('proyectos')}><FolderOpen /><span>Proyecto<strong>Ver proyecto</strong><small>Consulta su estado completo.</small></span></button><button type="button" onClick={abrirFicha}><ShieldCheck /><span>Acreditación<strong>Ver ficha</strong><small>Abre el detalle {modoConsulta ? 'histórico' : 'actual'}.</small></span></button></div></section>
          </div>
        </>}
      </section>
    </div>
  );
}
