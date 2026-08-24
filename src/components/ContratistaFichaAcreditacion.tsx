import { useState } from 'react';
import { AlertTriangle, Building2, CheckCircle, Clock3, FileText, LockKeyhole, Users, WalletCards, X } from 'lucide-react';
import { calcularAccesoPago, calcularEstadoTrabajador, esTrabajadorAsignado, getRequisitos, obtenerDiasRestantes } from '../data/localStorageDb';
import { Contratista, Mandante, Proyecto, Trabajador } from '../types';
import { buildAcreditacionRows, DocEstado, estadoUILabel } from '../pages/admin/acreditacionUtils';
import { buildRequisitosEmpresa, buildRequisitosTrabajador, encontrarProximoVencimiento, getEstadoAccesoProyecto, impactoLabel, prioridadItem, RequisitoConDoc } from '../pages/contratista/inicio/inicioUtils';
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

const estadoClass = (estado: string) => estado === 'Acreditado' || estado === 'Aprobado' ? 'ok' : estado === 'Bloqueado' || estado === 'Rechazado' || estado === 'Vencido' ? 'danger' : 'warning';
const estadoTrabajadorLabel = (estado: ReturnType<typeof calcularEstadoTrabajador>) => estado === 'aprobado' ? 'Habilitado' : estado === 'por_vencer' ? 'Por vencer' : estado === 'rechazado' ? 'Bloqueado' : 'En proceso';
const accionLabel = (estado: DocEstado) => estado === 'Pendiente' ? 'Cargar' : estado === 'Rechazado' || estado === 'Vencido' ? 'Corregir' : estado === 'Por vencer' ? 'Renovar' : 'Ver';
const detalleItem = (item: RequisitoConDoc) => {
  if (item.estado === 'En revisión') return 'Enviado; Acredita está revisando el documento.';
  if (item.estado === 'Rechazado') return item.doc?.motivoRechazo || item.doc?.explicacionRechazo || 'Documento rechazado.';
  if (item.estado === 'Vencido') return 'Documento vencido.';
  if (item.estado === 'Por vencer') return `Vence en ${obtenerDiasRestantes(item.doc?.vencimiento || '')} días.`;
  if (item.estado === 'Pendiente') return 'Documento pendiente de carga.';
  return 'Documento aprobado y vigente.';
};

export default function ContratistaFichaAcreditacion({ contratista, proyectoId, proyectos, mandantes, onProyectoChange, onClose, onIrADocumentos, onIrATrabajador }: Props) {
  const [tab, setTab] = useState<'empresa' | 'trabajadores'>('empresa');
  const proyecto = proyectos.find(item => item.id === proyectoId) || proyectos[0];
  if (!proyecto) return null;
  const mandante = mandantes.find(item => item.id === proyecto.mandanteId);
  const row = buildAcreditacionRows([contratista], proyectos, mandantes).find(item => item.proyectoId === proyecto.id);
  const requisitos = getRequisitos();
  const trabajadores = (contratista.trabajadores || []).filter(item => esTrabajadorAsignado(item, proyecto.id, proyectos));
  const empresaItems = buildRequisitosEmpresa(contratista, proyecto.id, requisitos);
  const trabajadorItems = trabajadores.flatMap(item => buildRequisitosTrabajador(item, proyecto.id, requisitos));
  const items = [...empresaItems, ...trabajadorItems];
  const accionables = items.filter(item => item.requisito.obligatorio && ['Pendiente', 'Rechazado', 'Vencido', 'Por vencer'].includes(item.estado)).sort((a, b) => prioridadItem(a) - prioridadItem(b));
  const esperando = items.filter(item => item.requisito.obligatorio && item.estado === 'En revisión').sort((a, b) => prioridadItem(a) - prioridadItem(b));
  const proximo = encontrarProximoVencimiento(items);
  const acceso = getEstadoAccesoProyecto(contratista, proyecto.id, trabajadores);
  const pago = calcularAccesoPago(contratista, proyecto.id);
  const estado = row ? estadoUILabel(row.estado) : 'En proceso';
  const completadas = (row?.company.ok || 0) + (row?.workers.ok || 0);
  const total = (row?.company.total || 0) + (row?.workers.total || 0);
  const pct = total ? Math.round(completadas / total * 100) : 0;

  const navegar = (item: RequisitoConDoc) => {
    onClose();
    if (item.worker) onIrATrabajador(proyecto.id, item.worker);
    else onIrADocumentos(proyecto.id);
  };

  return <div className="ficha2-backdrop" onClick={onClose}>
    <section className="ficha2-modal" role="dialog" aria-modal="true" aria-labelledby="ficha2-title" onClick={event => event.stopPropagation()}>
      <header className="ficha2-hero">
        <div className="ficha2-top"><div><span>Ficha de acreditación</span><h2 id="ficha2-title">{contratista.nombre}</h2><p>RUT {contratista.rut}</p></div><button type="button" onClick={onClose} aria-label="Cerrar ficha"><X /></button></div>
        <div className="ficha2-project"><div><span>Proyecto</span><strong>{proyecto.nombre}</strong><small>Mandante: {mandante?.nombre || 'No disponible'}</small></div><label><span>Cambiar proyecto</span><select value={proyecto.id} onChange={event => onProyectoChange(event.target.value)}>{proyectos.map(item => <option value={item.id} key={item.id}>{item.nombre}</option>)}</select></label></div>
      </header>

      <div className="ficha2-scroll">
        <section className={`ficha2-summary ${estadoClass(estado)}`}>
          <div className="ficha2-state"><i>{estado === 'Acreditado' ? <CheckCircle /> : estado === 'Bloqueado' ? <AlertTriangle /> : <Clock3 />}</i><div><span>Estado del proyecto</span><h3>{estado}</h3><p>{estado === 'Acreditado' ? 'Todas las obligaciones están vigentes.' : `${accionables.length} asunto${accionables.length === 1 ? '' : 's'} requiere${accionables.length === 1 ? '' : 'n'} tu atención.`}</p></div></div>
          <div className="ficha2-progress"><div><span>Obligaciones completadas</span><strong>{completadas} de {total}</strong></div><div><i style={{ width: `${pct}%` }} /></div><small>Empresa obligatoria + trabajadores asignados</small></div>
        </section>

        <div className="ficha2-metrics">
          <article><Building2 /><span>Empresa</span><strong>{row?.company.ok || 0} / {row?.company.total || 0}</strong><small>obligatorios vigentes</small></article>
          <article><Users /><span>Trabajadores</span><strong>{row?.workers.ok || 0} / {row?.workers.total || 0}</strong><small>habilitados</small></article>
          <article className={acceso.estado === 'habilitado' ? 'ok' : acceso.estado === 'bloqueado' ? 'danger' : 'warning'}><LockKeyhole /><span>Acceso a faena</span><strong>{acceso.estado === 'habilitado' ? 'Habilitado' : acceso.estado === 'bloqueado' ? 'Bloqueado' : acceso.estado === 'pendiente' ? 'Pendiente' : 'Parcial'}</strong><small>{acceso.detalle || 'Sin restricciones'}</small></article>
          <article className={pago.pagoEstado === 'bloqueado' ? 'danger' : pago.pagoEstado === 'pendiente' ? 'warning' : 'ok'}><WalletCards /><span>Pago</span><strong>{pago.pagoEstado === 'bloqueado' ? 'Retenido' : pago.pagoEstado === 'pendiente' ? 'Pendiente' : 'Habilitado'}</strong><small>{pago.motivoPago || 'Sin restricciones de pago'}</small></article>
        </div>

        <section className="ficha2-expiry"><Clock3 /><div><span>Próximo vencimiento</span>{proximo ? <><strong>{proximo.trabajadorNombre ? `${proximo.trabajadorNombre} · ` : ''}{proximo.nombre}</strong><small>{proximo.vencimiento} · vence en {proximo.dias} días</small></> : <><strong>Sin vencimientos próximos</strong><small>No hay documentos dentro de su ventana preventiva.</small></>}</div>{proximo && <button type="button" onClick={() => { const target = items.find(item => item.requisito.nombre === proximo.nombre && item.worker?.nombre === proximo.trabajadorNombre); if (target) navegar(target); }}>Renovar</button>}</section>

        <div className="ficha2-action-grid">
          <section><header><AlertTriangle /><div><h3>Requiere tu atención</h3><p>Asuntos que puedes resolver ahora.</p></div></header>{accionables.length ? accionables.slice(0, 4).map(item => <div className="ficha2-action" key={`${item.requisito.id}:${item.worker?.rut || 'empresa'}`}><div><strong>{item.worker?.nombre || 'Empresa'} · {item.requisito.nombre}</strong><p>{detalleItem(item)} · {impactoLabel(item.requisito)}</p></div><button type="button" onClick={() => navegar(item)}>{accionLabel(item.estado)}</button></div>) : <div className="ficha2-clear"><CheckCircle /> No tienes acciones pendientes.</div>}</section>
          <section className="ficha2-waiting"><header><Clock3 /><div><h3>Esperando a Acredita</h3><p>Enviados, sin acción pendiente tuya.</p></div></header>{esperando.length ? esperando.slice(0, 3).map(item => <div className="ficha2-action" key={`${item.requisito.id}:${item.worker?.rut || 'empresa'}`}><div><strong>{item.worker?.nombre || 'Empresa'} · {item.requisito.nombre}</strong><p>La revisión está en curso.</p></div><button type="button" onClick={() => navegar(item)}>Ver</button></div>) : <div className="ficha2-clear">No hay documentos en revisión.</div>}</section>
        </div>

        <nav className="ficha2-tabs" aria-label="Detalle de acreditación" role="tablist"><button type="button" role="tab" aria-selected={tab === 'empresa'} className={tab === 'empresa' ? 'active' : ''} onClick={() => setTab('empresa')}>Empresa <b>{row?.company.ok || 0}/{row?.company.total || 0}</b></button><button type="button" role="tab" aria-selected={tab === 'trabajadores'} className={tab === 'trabajadores' ? 'active' : ''} onClick={() => setTab('trabajadores')}>Trabajadores <b>{row?.workers.ok || 0}/{row?.workers.total || 0}</b></button></nav>

        {tab === 'empresa' ? <section className="ficha2-detail"><header><div><h3>Documentos de empresa</h3><p>Los opcionales se muestran, pero no afectan el avance ni bloquean.</p></div><button type="button" onClick={() => { onClose(); onIrADocumentos(proyecto.id); }}>Ir a Documentos</button></header>{empresaItems.map(item => <div className="ficha2-doc" key={item.requisito.id}><FileText /><div><strong>{item.requisito.nombre}</strong><p>{item.requisito.obligatorio ? 'Obligatorio' : 'Opcional'} · {impactoLabel(item.requisito)}{item.doc?.version ? ` · v${item.doc.version}` : ''}{item.doc?.vencimiento && item.doc.vencimiento !== '—' ? ` · vence ${item.doc.vencimiento}` : ''}</p></div><span className={estadoClass(item.estado)}>{item.estado}</span><button type="button" onClick={() => navegar(item)}>{accionLabel(item.estado)}</button></div>)}</section> : <section className="ficha2-detail"><header><div><h3>Trabajadores asignados</h3><p>Selecciona una persona para abrir su carpeta exacta.</p></div></header>{trabajadores.map(worker => { const workerState = calcularEstadoTrabajador(worker, proyecto.id); const workerItems = buildRequisitosTrabajador(worker, proyecto.id, requisitos).filter(item => item.requisito.obligatorio); const ok = workerItems.filter(item => item.cumplido).length; const habilitado = workerState === 'aprobado' || workerState === 'por_vencer'; return <button type="button" className="ficha2-worker" key={worker.rut} onClick={() => { onClose(); onIrATrabajador(proyecto.id, worker); }}><span><strong>{worker.nombre}</strong><small>{worker.rut} · {worker.cargo || 'Operario'}</small></span><span>{ok}/{workerItems.length} vigentes · Acceso {habilitado ? 'habilitado' : 'bloqueado'}</span><b className={estadoClass(estadoTrabajadorLabel(workerState))}>{estadoTrabajadorLabel(workerState)}</b></button>; })}{trabajadores.length === 0 && <div className="ficha2-clear">No hay trabajadores asignados a este proyecto.</div>}</section>}
      </div>
      <footer className="ficha2-footer"><p>La ficha resume el estado del proyecto. Las correcciones se realizan en Documentos o Trabajadores.</p><button type="button" onClick={onClose}>Cerrar</button></footer>
    </section>
  </div>;
}
