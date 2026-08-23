import { useState } from 'react';
import { Bell, Building2, LogOut, UserRound } from 'lucide-react';
import {
  getPreferenciasNotificacionesContratista,
  savePreferenciasNotificacionesContratista,
  UserSession,
} from '../../data/localStorageDb';
import { Contratista, Mandante, PreferenciasNotificacionesContratista, Proyecto } from '../../types';

type ConfigSubTab = 'empresa' | 'notificaciones' | 'cuenta';

const PREFERENCIAS = [
  ['documentoRechazado', 'Documento rechazado', 'Avísame cuando Acredita rechace un documento de empresa o trabajador y requiera corrección.'],
  ['documentoPorVencer', 'Documento próximo a vencer', 'Avísame cuando un documento vigente entre en su ventana preventiva de vencimiento.'],
  ['acreditacionAprobada', 'Acreditación aprobada', 'Avísame cuando un proyecto complete todos sus requisitos obligatorios y quede acreditado.'],
  ['cambioEstadoTrabajador', 'Cambios en trabajadores', 'Avísame cuando el estado de un trabajador pase a bloqueado o vuelva a quedar habilitado.'],
] as const;

function iniciales(nombre: string): string {
  return nombre.split(/\s+/).filter(Boolean).slice(0, 2).map(parte => parte[0]).join('').toUpperCase();
}

export default function ConfigTab({ contratistaLogueado, misProyectos, allMandantes, session, onLogout, showToast }: {
  contratistaLogueado: Contratista;
  misProyectos: Proyecto[];
  allMandantes: Mandante[];
  session: UserSession | null;
  onLogout: () => void;
  showToast: (msg: string, type?: 'success' | 'error' | 'warning') => void;
}) {
  const [activeTab, setActiveTab] = useState<ConfigSubTab>('empresa');
  const [preferencias, setPreferencias] = useState<PreferenciasNotificacionesContratista>(() => getPreferenciasNotificacionesContratista(contratistaLogueado.id));
  const [guardadas, setGuardadas] = useState<PreferenciasNotificacionesContratista>(() => getPreferenciasNotificacionesContratista(contratistaLogueado.id));
  const hayCambios = PREFERENCIAS.some(([key]) => preferencias[key] !== guardadas[key]);

  const guardarPreferencias = () => {
    savePreferenciasNotificacionesContratista(contratistaLogueado.id, preferencias);
    setGuardadas(preferencias);
    showToast('Preferencias guardadas');
  };

  return (
    <div className="cfg-page">
      <section className="cfg-hero">
        <div className="cfg-eyebrow">Portal contratista</div>
        <h1>Configuración</h1>
        <p>Consulta los datos de tu empresa y define qué avisos quieres ver en Acredita. Las opciones de esta sección afectan solo a tu experiencia dentro del portal.</p>
      </section>

      <section className="cfg-floating">
        <div className="cfg-account-strip">
          <div className="cfg-company"><div className="cfg-company-icon">{iniciales(contratistaLogueado.nombre)}</div><div><strong>{contratistaLogueado.nombre}</strong><small>RUT {contratistaLogueado.rut}</small></div></div>
          <div className="cfg-stat"><span>Portal</span><b>Contratista</b></div>
          <div className="cfg-stat"><span>Proyectos activos</span><b>{misProyectos.length}</b></div>
          <div className="cfg-stat"><span>Estado de cuenta</span><div><span className="cfg-status">Activa</span></div></div>
        </div>

        <div className="cfg-workspace">
          <nav className="cfg-nav" aria-label="Secciones de configuración">
            {([['empresa', 'Empresa', Building2], ['notificaciones', 'Notificaciones', Bell], ['cuenta', 'Cuenta', UserRound]] as const).map(([id, label, Icon]) => (
              <button key={id} className={activeTab === id ? 'active' : ''} onClick={() => setActiveTab(id)} aria-current={activeTab === id ? 'page' : undefined}><span className="cfg-nav-icon"><Icon size={14} /></span>{label}</button>
            ))}
          </nav>

          <div className="cfg-content">
            {activeTab === 'empresa' && <>
              <section className="cfg-card">
                <header><h2>Datos de la empresa</h2><p>Información utilizada para identificar al contratista dentro de los proyectos y acreditaciones.</p></header>
                <div className="cfg-card-body"><div className="cfg-fields"><label><span>Razón social</span><input value={contratistaLogueado.nombre} readOnly /></label><label><span>RUT empresa</span><input value={contratistaLogueado.rut} readOnly /></label></div><div className="cfg-note">Estos datos son parte de la identidad del contratista en Acredita. Para evitar inconsistencias entre proyectos y acreditaciones, no se modifican desde esta pantalla en el MVP.</div></div>
              </section>
              <section className="cfg-card">
                <header><h2>Proyectos asociados</h2><p>Proyectos en los que actualmente tu empresa participa como contratista.</p></header>
                <div className="cfg-card-body"><div className="cfg-project-list">
                  {misProyectos.length === 0 ? <div className="cfg-empty">Todavía no existen proyectos asociados.</div> : misProyectos.map(proyecto => {
                    const mandante = allMandantes.find(item => item.id === proyecto.mandanteId);
                    return <div className="cfg-project-row" key={proyecto.id}><div><strong>{proyecto.nombre}</strong><small>{mandante?.nombre || 'Mandante no disponible'}</small></div><small>Contexto de acreditación independiente</small><span className={proyecto.estado.toLowerCase() === 'activo' ? 'active' : ''}>{proyecto.estado}</span></div>;
                  })}
                </div></div>
              </section>
            </>}

            {activeTab === 'notificaciones' && <section className="cfg-card">
              <header><h2>Notificaciones en Acredita</h2><p>Elige qué eventos quieres que aparezcan como avisos dentro del portal. No se configuran canales externos en este MVP.</p></header>
              <div className="cfg-card-body"><div className="cfg-pref-list">
                {PREFERENCIAS.map(([key, titulo, descripcion]) => <div className="cfg-pref-row" key={key}><div><strong>{titulo}</strong><p>{descripcion}</p></div><button type="button" role="switch" aria-checked={preferencias[key]} aria-label={titulo} className={`cfg-switch ${preferencias[key] ? 'on' : ''}`} onClick={() => setPreferencias(actual => ({ ...actual, [key]: !actual[key] }))}><span /></button></div>)}
              </div><div className="cfg-pref-foot"><span>Los cambios se guardan localmente para esta cuenta en el frontend MVP.</span><button className="cfg-save" disabled={!hayCambios} onClick={guardarPreferencias}>Guardar preferencias</button></div></div>
            </section>}

            {activeTab === 'cuenta' && <section className="cfg-card">
              <header><h2>Cuenta y sesión</h2><p>Información básica de la sesión actual. La gestión de contraseñas no forma parte del frontend MVP.</p></header>
              <div className="cfg-card-body"><div className="cfg-session-row"><div className="cfg-session-box"><span>Tipo de acceso</span><b>Portal Contratista</b></div><div className="cfg-session-box"><span>Empresa activa</span><b>{contratistaLogueado.nombre}</b></div>{session?.email && <div className="cfg-session-box"><span>Cuenta</span><b>{session.email}</b></div>}</div><div className="cfg-logout"><div><strong>Cerrar sesión</strong><p>Finaliza la sesión actual y vuelve a la pantalla de acceso.</p></div><button onClick={onLogout}><LogOut size={14} />Cerrar sesión</button></div></div>
            </section>}
          </div>
        </div>
      </section>
    </div>
  );
}
