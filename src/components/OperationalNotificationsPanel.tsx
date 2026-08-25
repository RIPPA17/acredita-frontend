import { AlertTriangle, Check, CheckCircle, Clock3, FileSearch } from 'lucide-react';
import type { OperationalNotification, OperationalNotificationType } from '../data/operationalNotifications';
import './ContratistaNotificaciones.css';

interface Props {
  contextLabel: string;
  notificaciones: OperationalNotification[];
  leidas: Set<string>;
  onMarcarLeida: (id: string) => void;
  onMarcarTodas: () => void;
  onAbrir: (notificacion: OperationalNotification) => void;
}

const GRUPOS: Array<{ label: string; tipos: OperationalNotificationType[] }> = [
  { label: 'Requieren atención', tipos: ['accion'] },
  { label: 'Preventivas', tipos: ['preventiva'] },
  { label: 'Operación', tipos: ['revision'] },
  { label: 'Estados positivos', tipos: ['positiva'] },
];

const Icono = ({ tipo }: { tipo: OperationalNotificationType }) => tipo === 'accion'
  ? <AlertTriangle />
  : tipo === 'preventiva'
    ? <Clock3 />
    : tipo === 'revision'
      ? <FileSearch />
      : <CheckCircle />;

export default function OperationalNotificationsPanel({ contextLabel, notificaciones, leidas, onMarcarLeida, onMarcarTodas, onAbrir }: Props) {
  const sinLeer = notificaciones.filter(item => !leidas.has(item.id)).length;
  return <aside className="notif2-panel" aria-label="Notificaciones operativas">
    <header className="notif2-head">
      <div><h2>Notificaciones</h2><p>{sinLeer ? `${sinLeer} sin leer` : 'Todo leído'} · {contextLabel}</p></div>
      {sinLeer > 0 && <button type="button" onClick={onMarcarTodas}>Marcar todas como leídas</button>}
    </header>
    <div className="notif2-list">
      {notificaciones.length === 0
        ? <div className="notif2-empty"><Check /><b>Todo al día</b><p>No hay alertas operativas con el estado actual.</p></div>
        : GRUPOS.map(grupo => {
          const items = notificaciones.filter(item => grupo.tipos.includes(item.tipo));
          if (!items.length) return null;
          return <section key={grupo.label}><h3>{grupo.label}</h3>{items.map(item => <article
            key={item.id}
            className={`notif2-item notif2-${item.tipo} ${leidas.has(item.id) ? '' : 'unread'}`}
            onClick={() => onMarcarLeida(item.id)}
          >
            <i><Icono tipo={item.tipo} /></i>
            <div>
              <strong>{item.titulo}</strong>
              <p>{item.descripcion}</p>
              <footer><small>{item.fecha || 'Estado actual'}</small><button type="button" onClick={event => { event.stopPropagation(); onAbrir(item); }}>{item.cta}</button></footer>
            </div>
          </article>)}</section>;
        })}
    </div>
    <footer className="notif2-foot">Avisos generados desde el estado real de Supabase.</footer>
  </aside>;
}
