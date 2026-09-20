import { useState } from 'react';
import {
  AlertTriangle,
  Archive,
  BriefcaseBusiness,
  Building2,
  CalendarDays,
  CheckCircle,
  Clock3,
  FileText,
  History,
  Layers3,
  LockKeyhole,
  Users,
  WalletCards,
  X,
} from 'lucide-react';
import {
  calcularAccesoPago,
  calcularEstadoTrabajador,
  esTrabajadorAsignado,
  getRequisitos,
  obtenerDiasRestantes,
} from '../data/localStorageDb';
import {
  getObligacionesDocumentales,
  getServiciosProyecto,
  proyectoOperativoParaContratista,
} from '../data/operationalCore';
import {
  Contratista,
  Documento,
  HistorialVersionDocumento,
  Mandante,
  Proyecto,
  Trabajador,
} from '../types';
import { buildAcreditacionRows, DocEstado, estadoUILabel } from '../pages/admin/acreditacionUtils';
import {
  buildRequisitosEmpresa,
  buildRequisitosTrabajador,
  encontrarProximoVencimiento,
  getEstadoAccesoProyecto,
  impactoLabel,
  prioridadItem,
  RequisitoConDoc,
} from '../pages/contratista/inicio/inicioUtils';
import './ContratistaFichaAcreditacion.css';

interface Props {
  contratista: Contratista;
  proyectoId: string;
  proyectos: Proyecto[];
  mandantes: Mandante[];
  onProyectoChange: (id: string) => void;
  onClose: () => void;
  onIrADocumentos: (proyectoId: string) => void;
  onIrATrabajador: (proyectoId: string, trabajador: Trabajador) => void;
}

type FichaTab = 'empresa' | 'trabajadores' | 'historial';

type VersionVisible = HistorialVersionDocumento & {
  actual?: boolean;
  enTramite?: boolean;
};

const estadoClass = (estado: string) =>
  estado === 'Acreditado' || estado === 'Aprobado' || estado === 'Habilitado'
    ? 'ok'
    : estado === 'Bloqueado' || estado === 'Rechazado' || estado === 'Vencido'
      ? 'danger'
      : 'warning';

const estadoTrabajadorLabel = (estado: ReturnType<typeof calcularEstadoTrabajador>) =>
  estado === 'aprobado' ? 'Habilitado' : estado === 'por_vencer' ? 'Por vencer' : estado === 'rechazado' ? 'Bloqueado' : 'En proceso';

const accionLabel = (estado: DocEstado, modoConsulta: boolean) => {
  if (modoConsulta) return 'Ver historial';
  if (estado === 'Pendiente') return 'Cargar';
  if (estado === 'Rechazado' || estado === 'Vencido') return 'Corregir';
  if (estado === 'Por vencer') return 'Renovar';
  return 'Ver';
};

const detalleItem = (item: RequisitoConDoc) => {
  if (item.estado === 'En revisión') return 'Enviado; Acredita está revisando el documento.';
  if (item.estado === 'Rechazado') return item.doc?.motivoRechazo || item.doc?.explicacionRechazo || 'Documento rechazado.';
  if (item.estado === 'Vencido') return 'Documento vencido.';
  if (item.estado === 'Por vencer') return `Vence en ${obtenerDiasRestantes(item.doc?.vencimiento || '')} días.`;
  if (item.estado === 'Pendiente') return 'Documento pendiente de carga.';
  return 'Documento aprobado y vigente.';
};

const formatIsoDate = (value?: string) => {
  if (!value) return '—';
  const iso = value.slice(0, 10);
  const date = new Date(`${iso}T12:00:00Z`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('es-CL', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' })
    .format(date)
    .replace(/\./g, '');
};

const contractLabel = (worker: Trabajador, assignment?: NonNullable<Trabajador['asignaciones']>[number]) => {
  const type = assignment?.tipoContrato || worker.tipoContrato;
  if (!type) return 'Contrato no informado';
  if (type === 'indefinido') return 'Indefinido';
  if (type === 'plazo_fijo') return `Plazo fijo${assignment?.fechaTerminoContrato || worker.fechaTerminoContrato ? ` · hasta ${assignment?.fechaTerminoContrato || worker.fechaTerminoContrato}` : ''}`;
  return `Obra o faena${assignment?.obraFaenaContrato || worker.obraFaenaContrato ? ` · ${assignment?.obraFaenaContrato || worker.obraFaenaContrato}` : ''}`;
};

const versionesDocumento = (doc: Documento): VersionVisible[] => {
  const current: VersionVisible = {
    version: doc.version || 1,
    estado: doc.estado,
    fecha: doc.fechaRevisado || doc.subido || 'Versión actual',
    emitido: doc.emitido,
    vencimientoIso: doc.vencimientoIso,
    archivoReferencia: doc.archivoReferencia,
    motivoRechazo: doc.motivoRechazo,
    explicacionRechazo: doc.explicacionRechazo,
    solucionRechazo: doc.solucionRechazo,
    verificador: doc.revisor,
    actual: true,
  };
  return [
    ...(doc.versionEnTramite ? [{ ...doc.versionEnTramite, enTramite: true }] : []),
    current,
    ...(doc.historial || []),
  ].sort((a, b) => b.version - a.version);
};

export default function ContratistaFichaAcreditacion({
  contratista,
  proyectoId,
  proyectos,
  mandantes,
  onProyectoChange,
  onClose,
  onIrADocumentos,
  onIrATrabajador,
}: Props) {
  const [tab, setTab] = useState<FichaTab>('empresa');
  const proyecto = proyectos.find(item => item.id === proyectoId) || proyectos[0];
  if (!proyecto) return null;

  const modoConsulta = !proyectoOperativoParaContratista(proyecto, contratista.id);
  const mandante = mandantes.find(item => item.id === proyecto.mandanteId);
  const row = buildAcreditacionRows([contratista], proyectos, mandantes).find(item => item.proyectoId === proyecto.id);
  const requisitos = getRequisitos();
  const requisitosPorId = new Map(requisitos.map(item => [item.id, item]));
  const servicios = getServiciosProyecto(proyecto.id, contratista.id, true);

  const trabajadoresExpediente = (contratista.trabajadores || []).filter(worker => {
    if (worker.asignaciones?.some(assignment => assignment.proyectoId === proyecto.id)) return true;
    return esTrabajadorAsignado(worker, proyecto.id, proyectos)
      || Boolean(worker.documentos?.some(doc => doc.proyectoId === proyecto.id));
  });
  const trabajadoresActivos = trabajadoresExpediente.filter(worker => esTrabajadorAsignado(worker, proyecto.id, proyectos));
  const trabajadoresEstado = modoConsulta ? trabajadoresExpediente : trabajadoresActivos;

  const empresaItems = buildRequisitosEmpresa(contratista, proyecto.id, requisitos);
  const trabajadorItems = trabajadoresActivos.flatMap(item => buildRequisitosTrabajador(item, proyecto.id, requisitos));
  const items = [...empresaItems, ...trabajadorItems];

  const accionables = modoConsulta ? [] : items
    .filter(item => item.requisito.obligatorio && ['Pendiente', 'Rechazado', 'Vencido', 'Por vencer'].includes(item.estado))
    .sort((a, b) => prioridadItem(a) - prioridadItem(b));
  const esperando = modoConsulta ? [] : items
    .filter(item => item.requisito.obligatorio && item.estado === 'En revisión')
    .sort((a, b) => prioridadItem(a) - prioridadItem(b));
  const proximo = modoConsulta ? undefined : encontrarProximoVencimiento(items);
  const acceso = getEstadoAccesoProyecto(contratista, proyecto.id, trabajadoresActivos);
  const pago = calcularAccesoPago(contratista, proyecto.id);
  const estado = modoConsulta ? 'Histórico' : row ? estadoUILabel(row.estado) : 'En proceso';

  const completadas = (row?.company.ok || 0) + (row?.workers.ok || 0);
  const total = (row?.company.total || 0) + (row?.workers.total || 0);
  const pct = total ? Math.round((completadas / total) * 100) : 0;

  const obligaciones = getObligacionesDocumentales()
    .filter(item => item.proyectoId === proyecto.id && item.contratistaId === contratista.id)
    .sort((a, b) => b.periodoInicio.localeCompare(a.periodoInicio) || a.requisitoId.localeCompare(b.requisitoId));

  const asignaciones = trabajadoresExpediente
    .flatMap(worker => (worker.asignaciones || [])
      .filter(assignment => assignment.proyectoId === proyecto.id)
      .map(assignment => ({
        worker,
        assignment,
        service: servicios.find(service => service.id === assignment.servicioId),
      })))
    .sort((a, b) => (b.assignment.fechaIngreso || '').localeCompare(a.assignment.fechaIngreso || ''));

  const documentosExpediente = [
    ...(contratista.documentos || [])
      .filter(doc => doc.proyectoId === proyecto.id)
      .map(doc => ({ owner: 'Empresa', doc })),
    ...trabajadoresExpediente.flatMap(worker => (worker.documentos || [])
      .filter(doc => doc.proyectoId === proyecto.id)
      .map(doc => ({ owner: worker.nombre, doc }))),
  ].sort((a, b) => a.owner.localeCompare(b.owner, 'es') || a.doc.nombre.localeCompare(b.doc.nombre, 'es'));

  const navegar = (item: RequisitoConDoc) => {
    onClose();
    if (item.worker) onIrATrabajador(proyecto.id, item.worker);
    else onIrADocumentos(proyecto.id);
  };

  return <div className="ficha2-backdrop" onClick={onClose}>
    <section className="ficha2-modal" role="dialog" aria-modal="true" aria-labelledby="ficha2-title" onClick={event => event.stopPropagation()}>
      <header className="ficha2-hero">
        <div className="ficha2-top">
          <div>
            <span>{modoConsulta ? 'Expediente histórico de acreditación' : 'Expediente de acreditación'}</span>
            <h2 id="ficha2-title">{contratista.nombre}</h2>
            <p>RUT {contratista.rut}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Cerrar ficha"><X /></button>
        </div>
        <div className="ficha2-project">
          <div>
            <span>Proyecto</span>
            <strong>{proyecto.nombre}</strong>
            <small>Mandante: {mandante?.nombre || 'No disponible'} · {modoConsulta ? 'Solo consulta' : 'Operativo'}</small>
          </div>
          <label>
            <span>Cambiar proyecto</span>
            <select aria-label="Cambiar proyecto del expediente" value={proyecto.id} onChange={event => { setTab('empresa'); onProyectoChange(event.target.value); }}>
              {proyectos.map(item => <option value={item.id} key={item.id}>{item.nombre}{proyectoOperativoParaContratista(item, contratista.id) ? '' : ' · Histórico'}</option>)}
            </select>
          </label>
        </div>
      </header>

      <div className="ficha2-scroll">
        {modoConsulta && <div className="ficha2-readonly"><Archive /><div><strong>Proyecto histórico · modo consulta</strong><p>Este expediente conserva servicios, trabajadores, períodos y versiones documentales. No genera nuevas cargas, correcciones ni renovaciones.</p></div></div>}

        <section className={`ficha2-summary ${modoConsulta ? '' : estadoClass(estado)}`}>
          <div className="ficha2-state">
            <i>{modoConsulta ? <History /> : estado === 'Acreditado' ? <CheckCircle /> : estado === 'Bloqueado' ? <AlertTriangle /> : <Clock3 />}</i>
            <div>
              <span>{modoConsulta ? 'Estado del expediente' : 'Estado del proyecto'}</span>
              <h3>{estado}</h3>
              <p>{modoConsulta
                ? `${trabajadoresExpediente.length} trabajador${trabajadoresExpediente.length === 1 ? '' : 'es'} y ${documentosExpediente.length} documento${documentosExpediente.length === 1 ? '' : 's'} conservados.`
                : estado === 'Acreditado'
                  ? 'Todas las obligaciones están vigentes.'
                  : `${accionables.length} asunto${accionables.length === 1 ? '' : 's'} requiere${accionables.length === 1 ? '' : 'n'} tu atención.`}</p>
            </div>
          </div>
          <div className="ficha2-progress">
            <div><span>{modoConsulta ? 'Trazabilidad conservada' : 'Obligaciones completadas'}</span><strong>{modoConsulta ? `${obligaciones.length} períodos` : `${completadas} de ${total}`}</strong></div>
            {!modoConsulta && <><div><i style={{ width: `${pct}%` }} /></div><small>Empresa obligatoria + trabajadores asignados</small></>}
            {modoConsulta && <small>{asignaciones.length} asignaciones registradas · {servicios.length} servicios</small>}
          </div>
        </section>

        <div className="ficha2-metrics">
          <article><Building2 /><span>Empresa</span><strong>{row?.company.ok || 0} / {row?.company.total || 0}</strong><small>{modoConsulta ? 'último registro documental' : 'obligatorios vigentes'}</small></article>
          <article><Users /><span>Trabajadores</span><strong>{modoConsulta ? trabajadoresExpediente.length : `${row?.workers.ok || 0} / ${row?.workers.total || 0}`}</strong><small>{modoConsulta ? 'registrados en expediente' : 'habilitados'}</small></article>
          <article className={!modoConsulta && acceso.estado === 'habilitado' ? 'ok' : !modoConsulta && acceso.estado === 'bloqueado' ? 'danger' : 'warning'}><LockKeyhole /><span>Acceso a faena</span><strong>{modoConsulta ? 'No operativo' : acceso.estado === 'habilitado' ? 'Habilitado' : acceso.estado === 'bloqueado' ? 'Bloqueado' : acceso.estado === 'pendiente' ? 'Pendiente' : 'Parcial'}</strong><small>{modoConsulta ? 'Relación histórica' : acceso.detalle || 'Sin restricciones'}</small></article>
          <article className={!modoConsulta && pago.pagoEstado === 'bloqueado' ? 'danger' : !modoConsulta && pago.pagoEstado === 'pendiente' ? 'warning' : 'ok'}><WalletCards /><span>Pago</span><strong>{modoConsulta ? 'No operativo' : pago.pagoEstado === 'bloqueado' ? 'Retenido' : pago.pagoEstado === 'pendiente' ? 'Pendiente' : 'Habilitado'}</strong><small>{modoConsulta ? 'Solo consulta histórica' : pago.motivoPago || 'Sin restricciones de pago'}</small></article>
        </div>

        {!modoConsulta && <section className="ficha2-expiry"><Clock3 /><div><span>Próximo vencimiento</span>{proximo ? <><strong>{proximo.trabajadorNombre ? `${proximo.trabajadorNombre} · ` : ''}{proximo.nombre}</strong><small>{proximo.vencimiento} · vence en {proximo.dias} días</small></> : <><strong>Sin vencimientos próximos</strong><small>No hay documentos dentro de su ventana preventiva.</small></>}</div>{proximo && <button type="button" onClick={() => { const target = items.find(item => item.requisito.nombre === proximo.nombre && item.worker?.nombre === proximo.trabajadorNombre); if (target) navegar(target); }}>Renovar</button>}</section>}

        {!modoConsulta && <div className="ficha2-action-grid">
          <section><header><AlertTriangle /><div><h3>Requiere tu atención</h3><p>Asuntos que puedes resolver ahora.</p></div></header>{accionables.length ? accionables.slice(0, 4).map(item => <div className="ficha2-action" key={`${item.requisito.id}:${item.worker?.rut || 'empresa'}`}><div><strong>{item.worker?.nombre || 'Empresa'} · {item.requisito.nombre}</strong><p>{detalleItem(item)} · {impactoLabel(item.requisito)}</p></div><button type="button" onClick={() => navegar(item)}>{accionLabel(item.estado, false)}</button></div>) : <div className="ficha2-clear"><CheckCircle /> No tienes acciones pendientes.</div>}</section>
          <section className="ficha2-waiting"><header><Clock3 /><div><h3>Esperando a Acredita</h3><p>Enviados, sin acción pendiente tuya.</p></div></header>{esperando.length ? esperando.slice(0, 3).map(item => <div className="ficha2-action" key={`${item.requisito.id}:${item.worker?.rut || 'empresa'}`}><div><strong>{item.worker?.nombre || 'Empresa'} · {item.requisito.nombre}</strong><p>La revisión está en curso.</p></div><button type="button" onClick={() => navegar(item)}>Ver</button></div>) : <div className="ficha2-clear">No hay documentos en revisión.</div>}</section>
        </div>}

        <section className="ficha2-context-grid">
          <article><BriefcaseBusiness /><div><span>Servicios / contratos</span><strong>{servicios.length}</strong><small>{servicios.filter(item => item.activo && item.estado === 'activo').length} activos</small></div></article>
          <article><Layers3 /><div><span>Períodos documentales</span><strong>{obligaciones.length}</strong><small>{obligaciones.filter(item => item.activo).length} vigentes/activos</small></div></article>
          <article><CalendarDays /><div><span>Asignaciones</span><strong>{asignaciones.length}</strong><small>{asignaciones.filter(item => item.assignment.estado === 'activa').length} activas</small></div></article>
          <article><History /><div><span>Versiones documentales</span><strong>{documentosExpediente.reduce((sum, item) => sum + versionesDocumento(item.doc).length, 0)}</strong><small>actuales + historial</small></div></article>
        </section>

        <nav className="ficha2-tabs" aria-label="Detalle de acreditación" role="tablist">
          <button type="button" role="tab" aria-selected={tab === 'empresa'} className={tab === 'empresa' ? 'active' : ''} onClick={() => setTab('empresa')}>Empresa <b>{row?.company.ok || 0}/{row?.company.total || 0}</b></button>
          <button type="button" role="tab" aria-selected={tab === 'trabajadores'} className={tab === 'trabajadores' ? 'active' : ''} onClick={() => setTab('trabajadores')}>Trabajadores <b>{trabajadoresEstado.length}</b></button>
          <button type="button" role="tab" aria-selected={tab === 'historial'} className={tab === 'historial' ? 'active' : ''} onClick={() => setTab('historial')}>Historial <b>{obligaciones.length + asignaciones.length}</b></button>
        </nav>

        {tab === 'empresa' && <section className="ficha2-detail">
          <header><div><h3>Documentos de empresa</h3><p>Incluye período, versión vigente y renovaciones/correcciones en trámite.</p></div><button type="button" onClick={() => { onClose(); onIrADocumentos(proyecto.id); }}>{modoConsulta ? 'Ver historial documental' : 'Ir a Documentos'}</button></header>
          {empresaItems.map(item => <div className="ficha2-doc" key={item.requisito.id}><FileText /><div><strong>{item.requisito.nombre}</strong><p>{item.requisito.obligatorio ? 'Obligatorio' : 'Opcional'} · {impactoLabel(item.requisito)}{item.doc?.periodoEtiqueta ? ` · ${item.doc.periodoEtiqueta}` : ''}{item.doc?.version ? ` · v${item.doc.version}` : ''}{item.doc?.versionEnTramite ? ` · renovación v${item.doc.versionEnTramite.version} en trámite` : ''}{item.doc?.vencimiento && item.doc.vencimiento !== '—' ? ` · vence ${item.doc.vencimiento}` : ''}</p></div><span className={estadoClass(item.estado)}>{item.estado}</span><button type="button" onClick={() => navegar(item)}>{accionLabel(item.estado, modoConsulta)}</button></div>)}
          {empresaItems.length === 0 && <div className="ficha2-clear">No hay requisitos de empresa configurados para este proyecto.</div>}
        </section>}

        {tab === 'trabajadores' && <section className="ficha2-detail">
          <header><div><h3>{modoConsulta ? 'Trabajadores del expediente' : 'Trabajadores asignados'}</h3><p>{modoConsulta ? 'Incluye períodos finalizados y contrato conservado por asignación.' : 'Selecciona una persona para abrir su carpeta exacta.'}</p></div></header>
          {trabajadoresEstado.map(worker => {
            const activeAssignment = worker.asignaciones?.find(assignment => assignment.proyectoId === proyecto.id && assignment.estado === 'activa');
            const latestAssignment = [...(worker.asignaciones || [])]
              .filter(assignment => assignment.proyectoId === proyecto.id)
              .sort((a, b) => (b.fechaIngreso || '').localeCompare(a.fechaIngreso || ''))[0];
            const assignment = activeAssignment || latestAssignment;
            const service = servicios.find(item => item.id === assignment?.servicioId);
            const workerItems = !modoConsulta ? buildRequisitosTrabajador(worker, proyecto.id, requisitos).filter(item => item.requisito.obligatorio) : [];
            const ok = workerItems.filter(item => item.cumplido).length;
            const workerState = !modoConsulta && activeAssignment ? calcularEstadoTrabajador(worker, proyecto.id) : undefined;
            return <button type="button" className="ficha2-worker" key={worker.rut} onClick={() => { onClose(); onIrATrabajador(proyecto.id, worker); }}>
              <span><strong>{worker.nombre}</strong><small>{worker.rut} · {assignment?.cargo || worker.cargo || 'Cargo no informado'}{service ? ` · ${service.codigo} ${service.nombre}` : ''}</small><small>{contractLabel(worker, assignment)}{assignment?.fechaIngreso ? ` · ingreso ${assignment.fechaIngreso}` : ''}{assignment?.fechaSalida ? ` · salida ${assignment.fechaSalida}` : ''}</small></span>
              <span>{modoConsulta ? `${(worker.documentos || []).filter(doc => doc.proyectoId === proyecto.id).length} documentos · ${(worker.asignaciones || []).filter(item => item.proyectoId === proyecto.id).length} período(s)` : `${ok}/${workerItems.length} vigentes · Acceso ${workerState === 'aprobado' || workerState === 'por_vencer' ? 'habilitado' : 'bloqueado'}`}</span>
              <b className={workerState ? estadoClass(estadoTrabajadorLabel(workerState)) : ''}>{workerState ? estadoTrabajadorLabel(workerState) : 'Histórico'}</b>
            </button>;
          })}
          {trabajadoresEstado.length === 0 && <div className="ficha2-clear">No hay trabajadores vinculados a este proyecto.</div>}
        </section>}

        {tab === 'historial' && <section className="ficha2-history">
          <div className="ficha2-history-grid">
            <article className="ficha2-history-card">
              <header><BriefcaseBusiness /><div><h3>Servicios y contratos</h3><p>Contexto contractual del expediente.</p></div></header>
              {servicios.length ? servicios.map(service => <div className="ficha2-history-row" key={service.id}><div><strong>{service.codigo} · {service.nombre}</strong><small>{service.categoria || 'Sin categoría'} · {formatIsoDate(service.fechaInicio)} → {service.fechaTermino ? formatIsoDate(service.fechaTermino) : 'sin término'}</small></div><b>{service.activo && service.estado === 'activo' ? 'Activo' : service.estado}</b></div>) : <div className="ficha2-clear">No hay servicios registrados.</div>}
            </article>

            <article className="ficha2-history-card">
              <header><Users /><div><h3>Períodos de trabajadores</h3><p>Altas, bajas y snapshots de contrato.</p></div></header>
              {asignaciones.length ? asignaciones.map(({ worker, assignment, service }) => <div className="ficha2-history-row" key={assignment.id}><div><strong>{worker.nombre}</strong><small>{assignment.cargo || worker.cargo || 'Cargo no informado'}{service ? ` · ${service.codigo}` : ''} · {contractLabel(worker, assignment)}</small><small>{formatIsoDate(assignment.fechaIngreso)} → {assignment.fechaSalida ? formatIsoDate(assignment.fechaSalida) : assignment.estado === 'activa' ? 'vigente' : 'sin fecha de salida'}</small></div><b>{assignment.estado === 'activa' ? 'Activo' : 'Histórico'}</b></div>) : <div className="ficha2-clear">No hay períodos de trabajadores registrados.</div>}
            </article>
          </div>

          <article className="ficha2-history-card ficha2-history-wide">
            <header><Layers3 /><div><h3>Obligaciones por período</h3><p>Cada requisito queda asociado a su período, destino y fecha límite.</p></div></header>
            {obligaciones.length ? <div className="ficha2-history-table-wrap"><table className="ficha2-history-table"><thead><tr><th>Período</th><th>Destino</th><th>Requisito</th><th>Fecha límite</th><th>Estado</th></tr></thead><tbody>{obligaciones.map(item => {
              const worker = item.trabajadorRut ? trabajadoresExpediente.find(candidate => candidate.rut === item.trabajadorRut) : undefined;
              return <tr key={item.id}><td>{item.periodoEtiqueta}</td><td>{worker ? worker.nombre : 'Empresa'}</td><td>{requisitosPorId.get(item.requisitoId)?.nombre || item.requisitoId}</td><td>{formatIsoDate(item.fechaLimite)}</td><td><span className={estadoClass(item.estado === 'aprobado' ? 'Aprobado' : item.estado === 'rechazado' || item.estado === 'vencido' ? 'Bloqueado' : 'En proceso')}>{item.estado.replace('_', ' ')}</span></td></tr>;
            })}</tbody></table></div> : <div className="ficha2-clear">No hay obligaciones periódicas registradas para este expediente.</div>}
          </article>

          <article className="ficha2-history-card ficha2-history-wide">
            <header><History /><div><h3>Trazabilidad documental</h3><p>Versiones actuales, renovaciones en trámite, rechazos y versiones reemplazadas.</p></div></header>
            {documentosExpediente.length ? documentosExpediente.map(({ owner, doc }) => <div className="ficha2-version-group" key={`${owner}:${doc.id}`}>
              <div className="ficha2-version-title"><div><strong>{owner} · {doc.nombre}</strong><small>{doc.periodoEtiqueta || 'Sin período explícito'} · obligación {doc.obligacionId || 'legado'}</small></div><span>{versionesDocumento(doc).length} versión{versionesDocumento(doc).length === 1 ? '' : 'es'}</span></div>
              <div className="ficha2-version-list">{versionesDocumento(doc).map(version => <div className="ficha2-version" key={`${doc.id}:${version.version}:${version.enTramite ? 'tramite' : version.actual ? 'actual' : 'hist'}`}><b>v{version.version}</b><span className={estadoClass(version.estado === 'aprobado' || version.estado === 'por_vencer' ? 'Aprobado' : version.estado === 'rechazado' ? 'Rechazado' : 'En proceso')}>{version.enTramite ? 'En trámite' : version.actual ? 'Actual' : version.estado}</span><small>{version.fecha}{version.vencimientoIso ? ` · vence ${formatIsoDate(version.vencimientoIso)}` : ''}{version.verificador ? ` · ${version.verificador}` : ''}</small>{(version.motivoRechazo || version.explicacionRechazo) && <p>{version.motivoRechazo || version.explicacionRechazo}</p>}</div>)}</div>
            </div>) : <div className="ficha2-clear">No hay versiones documentales registradas.</div>}
          </article>
        </section>}
      </div>

      <footer className="ficha2-footer"><p>{modoConsulta ? 'Expediente histórico: la información se conserva solo para consulta y trazabilidad.' : 'La ficha resume y documenta el estado integral del proyecto. Las correcciones se realizan en Documentos o Trabajadores.'}</p><button type="button" onClick={onClose}>Cerrar</button></footer>
    </section>
  </div>;
}
