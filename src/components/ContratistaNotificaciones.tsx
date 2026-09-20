import { useState } from 'react';
import { AlertTriangle, Check, CheckCircle, Clock3, FileSearch, History, Info, ShieldAlert } from 'lucide-react';
import { NotificacionContratista, TipoNotificacionContratista } from '../pages/contratista/notificacionesUtils';
import './ContratistaNotificaciones.css';

interface Props {
  contratistaNombre: string;
  notificaciones: NotificacionContratista[];
  leidas: Set<string>;
  onMarcarLeida: (id: string) => void;
  onMarcarTodas: () => void;
  onAbrir: (notificacion: NotificacionContratista) => void;
}

type Filtro = 'todas' | 'accion' | 'preventiva' | 'revision' | 'resueltas';

const GRUPOS: Array<{ label: string; tipos: TipoNotificacionContratista[] }> = [
  { label: 'Requieren tu atención', tipos: ['accion'] },
  { label: 'Preventivas', tipos: ['preventiva'] },
  { label: 'En revisión', tipos: ['revision'] },
  { label: 'Informativas', tipos: ['informativa', 'positiva'] },
];

const Icono = ({ item }: { item: NotificacionContratista }) => {
  if (item.situacion === 'resuelta') return <History />;
  if (item.nivel === 'critical') return <ShieldAlert />;
  if (item.tipo === 'accion') return <AlertTriangle />;
  if (item.tipo === 'preventiva') return <Clock3 />;
  if (item.tipo === 'revision') return <FileSearch />;
  if (item.tipo === 'informativa') return <Info />;
  return <CheckCircle />;
};

export default function ContratistaNotificaciones({ contratistaNombre, notificaciones, leidas, onMarcarLeida, onMarcarTodas, onAbrir }: Props) {
  const [filtro, setFiltro] = useState<Filtro>('todas');
  const activas = notificaciones.filter(item => item.situacion !== 'resuelta');
  const resueltas = notificaciones.filter(item => item.situacion === 'resuelta');
  const sinLeer = activas.filter(item => !leidas.has(item.id)).length;
  const requierenAccion = activas.filter(item => item.tipo === 'accion').length;
  const preventivas = activas.filter(item => item.tipo === 'preventiva').length;
  const enRevision = activas.filter(item => item.tipo === 'revision').length;

  const visibles = filtro === 'resueltas'
    ? resueltas
    : activas.filter(item => filtro === 'todas' || item.tipo === filtro);

  return <aside className="notif2-panel" aria-label="Notificaciones del contratista">
    <header className="notif2-head">
      <div><h2>Notificaciones</h2><p>{sinLeer ? `${sinLeer} sin leer` : 'Todo leído'} · {contratistaNombre}</p></div>
      {sinLeer > 0 && <button type="button" onClick={onMarcarTodas}>Marcar activas como leídas</button>}
    </header>

    <div className="notif2-summary" aria-label="Resumen de notificaciones">
      <span><b>{requierenAccion}</b> acción</span>
      <span><b>{preventivas}</b> preventivas</span>
      <span><b>{enRevision}</b> revisión</span>
      <span><b>{resueltas.length}</b> resueltas</span>
    </div>

    <nav className="notif2-filters" aria-label="Filtrar notificaciones">
      {([
        ['todas', 'Todas'],
        ['accion', 'Acción'],
        ['preventiva', 'Preventivas'],
        ['revision', 'En revisión'],
        ['resueltas', 'Resueltas'],
      ] as const).map(([id, label]) => <button
        type="button"
        key={id}
        className={filtro === id ? 'active' : ''}
        aria-pressed={filtro === id}
        onClick={() => setFiltro(id)}
      >{label}</button>)}
    </nav>

    <div className="notif2-list">
      {visibles.length === 0 ? <div className="notif2-empty"><Check /><b>Sin resultados</b><p>No hay notificaciones en este filtro.</p></div> : (
        filtro === 'resueltas'
          ? <section><h3>Historial resuelto</h3>{visibles.map(item => <NotificationItem key={item.id} item={item} leida={leidas.has(item.id)} onMarcarLeida={onMarcarLeida} onAbrir={onAbrir} />)}</section>
          : GRUPOS.map(grupo => {
            const items = visibles.filter(item => grupo.tipos.includes(item.tipo));
            if (!items.length) return null;
            return <section key={grupo.label}><h3>{grupo.label}</h3>{items.map(item => <NotificationItem key={item.id} item={item} leida={leidas.has(item.id)} onMarcarLeida={onMarcarLeida} onAbrir={onAbrir} />)}</section>;
          })
      )}
    </div>
    <footer className="notif2-foot">Marcar una alerta como leída no resuelve el problema. El estado activo o resuelto depende del documento, trabajador, pago o proceso que originó el aviso.</footer>
  </aside>;
}

function NotificationItem({ item, leida, onMarcarLeida, onAbrir }: {
  item: NotificacionContratista;
  leida: boolean;
  onMarcarLeida: (id: string) => void;
  onAbrir: (notificacion: NotificacionContratista) => void;
}) {
  const situacion = item.situacion === 'resuelta'
    ? 'Resuelta'
    : item.nivel === 'critical'
      ? 'Problema crítico activo'
      : item.tipo === 'accion'
        ? 'Requiere acción'
        : item.tipo === 'preventiva'
          ? 'Preventiva'
          : item.tipo === 'revision'
            ? 'En revisión'
            : 'Informativa';
  return <article
    className={`notif2-item notif2-${item.tipo} ${item.nivel === 'critical' ? 'notif2-critical' : ''} ${item.situacion === 'resuelta' ? 'resolved' : ''} ${leida ? '' : 'unread'}`}
    onClick={() => onMarcarLeida(item.id)}
  >
    <i><Icono item={item} /></i>
    <div>
      <div className="notif2-meta"><span>{item.proyectoNombre}</span><em className={item.situacion === 'resuelta' ? 'resolved' : item.nivel === 'critical' ? 'critical' : ''}>{situacion}</em></div>
      <strong>{item.titulo}</strong>
      <p>{item.descripcion}</p>
      <footer><small>{item.fecha || 'Estado actual'}{item.persistida ? ' · Historial guardado' : ''}</small><button type="button" onClick={event => { event.stopPropagation(); onMarcarLeida(item.id); onAbrir(item); }}>{item.cta}</button></footer>
    </div>
  </article>;
}
