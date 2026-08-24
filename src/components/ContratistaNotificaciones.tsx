import { AlertTriangle, Check, CheckCircle, Clock3, FileSearch } from 'lucide-react';
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

const GRUPOS: Array<{ label: string; tipos: TipoNotificacionContratista[] }> = [
  { label: 'Requieren tu atención', tipos: ['accion'] },
  { label: 'Preventivas', tipos: ['preventiva'] },
  { label: 'Informativas', tipos: ['revision', 'positiva'] },
];

const Icono = ({ tipo }: { tipo: TipoNotificacionContratista }) => tipo === 'accion' ? <AlertTriangle /> : tipo === 'preventiva' ? <Clock3 /> : tipo === 'revision' ? <FileSearch /> : <CheckCircle />;

export default function ContratistaNotificaciones({ contratistaNombre, notificaciones, leidas, onMarcarLeida, onMarcarTodas, onAbrir }: Props) {
  const sinLeer = notificaciones.filter(item => !leidas.has(item.id)).length;
  return <aside className="notif2-panel" aria-label="Notificaciones del contratista">
    <header className="notif2-head"><div><h2>Notificaciones</h2><p>{sinLeer ? `${sinLeer} sin leer` : 'Todo leído'} · {contratistaNombre}</p></div>{sinLeer > 0 && <button type="button" onClick={onMarcarTodas}>Marcar todas como leídas</button>}</header>
    <div className="notif2-list">
      {notificaciones.length === 0 ? <div className="notif2-empty"><Check /><b>Todo al día</b><p>No hay notificaciones para tus proyectos con las preferencias actuales.</p></div> : GRUPOS.map(grupo => {
        const items = notificaciones.filter(item => grupo.tipos.includes(item.tipo));
        if (!items.length) return null;
        return <section key={grupo.label}><h3>{grupo.label}</h3>{items.map(item => <article key={item.id} className={`notif2-item notif2-${item.tipo} ${leidas.has(item.id) ? '' : 'unread'}`} onClick={() => onMarcarLeida(item.id)}><i><Icono tipo={item.tipo} /></i><div><span>{item.proyectoNombre}</span><strong>{item.titulo}</strong><p>{item.descripcion}</p><footer><small>{item.fecha || 'Estado actual'}</small><button type="button" onClick={event => { event.stopPropagation(); onAbrir(item); }}>{item.cta}</button></footer></div></article>)}</section>;
      })}
    </div>
    <footer className="notif2-foot">Las notificaciones se generan desde el estado real de tus proyectos.</footer>
  </aside>;
}
