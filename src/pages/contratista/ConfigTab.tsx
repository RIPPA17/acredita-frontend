import { useEffect, useState } from 'react';
import { Bell, Building2, KeyRound, LogOut, Mail, UserRound, Users } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { SupabaseUserSession as UserSession } from '../../data/supabaseAuth';
import { Contratista, Mandante, PreferenciasNotificacionesContratista, Proyecto } from '../../types';
import BulkWorkersConfig from './BulkWorkersConfig';
import { proyectoOperativoParaContratista } from '../../data/operationalCore';

type ConfigSubTab = 'empresa' | 'notificaciones' | 'carga' | 'cuenta';

const PREFERENCIAS = [
  ['documentoRechazado', 'Documento rechazado o vencido', 'Avísame cuando un documento de empresa o trabajador requiera corrección o renovación.'],
  ['documentoPorVencer', 'Documento próximo a vencer', 'Avísame cuando un documento vigente entre en su ventana preventiva de vencimiento.'],
  ['documentoActualizado', 'Revisión y aprobación documental', 'Avísame cuando una carga entre a revisión o sea aprobada por Acredita.'],
  ['acreditacionAprobada', 'Estado de acreditación', 'Avísame cuando una acreditación quede aprobada o pierda cumplimiento por un bloqueo.'],
  ['cambioEstadoTrabajador', 'Cambios en trabajadores', 'Avísame cuando un trabajador quede bloqueado, habilitado o su contrato esté próximo a vencer.'],
  ['estadoPago', 'Estado de pagos', 'Avísame cuando un período sea observado, retenido, liberado o pagado.'],
  ['soporteActualizado', 'Respuestas de soporte', 'Avísame cuando Acredita responda una conversación de soporte.'],
] as const;

function iniciales(nombre: string): string {
  return nombre.split(/\s+/).filter(Boolean).slice(0, 2).map(parte => parte[0]).join('').toUpperCase();
}

export default function ConfigTab({ contratistaLogueado, misProyectos, allMandantes, session, onLogout, showToast, preferenciasNotificaciones, onGuardarPreferencias }: {
  contratistaLogueado: Contratista;
  misProyectos: Proyecto[];
  allMandantes: Mandante[];
  session: UserSession | null;
  onLogout: () => void;
  showToast: (msg: string, type?: 'success' | 'error' | 'warning') => void;
  preferenciasNotificaciones: PreferenciasNotificacionesContratista;
  onGuardarPreferencias: (preferencias: PreferenciasNotificacionesContratista) => Promise<void>;
}) {
  const [activeTab, setActiveTab] = useState<ConfigSubTab>('empresa');
  const [preferencias, setPreferencias] = useState<PreferenciasNotificacionesContratista>(preferenciasNotificaciones);
  const [guardadas, setGuardadas] = useState<PreferenciasNotificacionesContratista>(preferenciasNotificaciones);
  const [guardando, setGuardando] = useState(false);
  const hayCambios = PREFERENCIAS.some(([key]) => preferencias[key] !== guardadas[key])
    || preferencias.correoHabilitado !== guardadas.correoHabilitado
    || preferencias.correoSoloCriticas !== guardadas.correoSoloCriticas;
  const proyectosActivos = misProyectos.filter(proyecto =>
    proyectoOperativoParaContratista(proyecto, contratistaLogueado.id),
  );

  useEffect(() => {
    setPreferencias(preferenciasNotificaciones);
    setGuardadas(preferenciasNotificaciones);
  }, [preferenciasNotificaciones]);

  const guardarPreferencias = async () => {
    setGuardando(true);
    try {
      await onGuardarPreferencias(preferencias);
      setGuardadas(preferencias);
      showToast('Preferencias guardadas');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'No fue posible guardar las preferencias', 'error');
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="cfg-page">
      <section className="cfg-hero">
        <div className="cfg-eyebrow">Portal contratista</div>
        <h1>Configuración</h1>
        <p>Consulta los datos de tu empresa, administra avisos, carga personal en forma masiva y gestiona tu cuenta.</p>
      </section>

      <section className="cfg-floating">
        <div className="cfg-account-strip">
          <div className="cfg-company"><div className="cfg-company-icon">{iniciales(contratistaLogueado.nombre)}</div><div><strong>{contratistaLogueado.nombre}</strong><small>RUT {contratistaLogueado.rut}</small></div></div>
          <div className="cfg-stat"><span>Portal</span><b>Contratista</b></div>
          <div className="cfg-stat"><span>Proyectos activos</span><b>{proyectosActivos.length}</b></div>
          <div className="cfg-stat"><span>Estado de cuenta</span><div><span className="cfg-status">Activa</span></div></div>
        </div>

        <div className="cfg-workspace">
          <nav className="cfg-nav" aria-label="Secciones de configuración">
            {([['empresa', 'Empresa', Building2], ['notificaciones', 'Notificaciones', Bell], ['carga', 'Carga masiva', Users], ['cuenta', 'Cuenta', UserRound]] as const).map(([id, label, Icon]) => (
              <button key={id} className={activeTab === id ? 'active' : ''} onClick={() => setActiveTab(id)} aria-current={activeTab === id ? 'page' : undefined}><span className="cfg-nav-icon"><Icon size={14} /></span>{label}</button>
            ))}
          </nav>

          <div className="cfg-content">
            {activeTab === 'empresa' && <>
              <section className="cfg-card">
                <header><h2>Datos de la empresa</h2><p>Información utilizada para identificar al contratista dentro de los proyectos y acreditaciones.</p></header>
                <div className="cfg-card-body"><div className="cfg-fields"><label><span>Razón social</span><input value={contratistaLogueado.nombre} readOnly /></label><label><span>RUT empresa</span><input value={contratistaLogueado.rut} readOnly /></label></div><div className="cfg-note">Estos datos forman parte de la identidad de la empresa en Acredita. Para evitar inconsistencias entre proyectos y acreditaciones, su modificación se gestiona mediante administración.</div></div>
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

            {activeTab === 'notificaciones' && <div className="space-y-4">
              <section className="cfg-card">
                <header><h2>Notificaciones en Acredita</h2><p>Elige qué eventos operativos quieres ver en la campana y en el historial de la cuenta.</p></header>
                <div className="cfg-card-body"><div className="cfg-pref-list">
                  {PREFERENCIAS.map(([key, titulo, descripcion]) => <div className="cfg-pref-row" key={key}><div><strong>{titulo}</strong><p>{descripcion}</p></div><button type="button" role="switch" aria-checked={preferencias[key]} aria-label={titulo} className={`cfg-switch ${preferencias[key] ? 'on' : ''}`} onClick={() => setPreferencias(actual => ({ ...actual, [key]: !actual[key] }))}><span /></button></div>)}
                </div></div>
              </section>

              <section className="cfg-card">
                <header><h2><span className="inline-flex items-center gap-2"><Mail size={16} /> Avisos por correo</span></h2><p>Los correos son un canal adicional. El estado oficial siempre permanece dentro de Acredita.</p></header>
                <div className="cfg-card-body"><div className="cfg-pref-list">
                  <div className="cfg-pref-row"><div><strong>Recibir correos de Acredita</strong><p>{session?.email ? `Se enviarán a ${session.email}.` : 'Se utilizará el correo asociado a la cuenta.'} Los avisos quedan registrados aunque el correo falle.</p></div><button type="button" role="switch" aria-checked={preferencias.correoHabilitado} aria-label="Recibir correos de Acredita" className={`cfg-switch ${preferencias.correoHabilitado ? 'on' : ''}`} onClick={() => setPreferencias(actual => ({ ...actual, correoHabilitado: !actual.correoHabilitado }))}><span /></button></div>
                  <div className="cfg-pref-row"><div><strong>Solo alertas críticas y acciones</strong><p>Evita correos por eventos informativos. Mantiene rechazos, vencimientos, bloqueos y pagos retenidos.</p></div><button type="button" role="switch" aria-checked={preferencias.correoSoloCriticas} aria-label="Solo alertas críticas y acciones" disabled={!preferencias.correoHabilitado} className={`cfg-switch ${preferencias.correoSoloCriticas ? 'on' : ''}`} onClick={() => setPreferencias(actual => ({ ...actual, correoSoloCriticas: !actual.correoSoloCriticas }))}><span /></button></div>
                </div><div className="cfg-note">El envío transaccional requiere que Acredita tenga configurado y verificado su dominio de correo. Si el proveedor está temporalmente fuera de servicio, la alerta queda en cola para reintento.</div></div>
              </section>

              <div className="cfg-pref-foot"><span>Lectura y resolución son estados distintos: leer un aviso no elimina un bloqueo.</span><button className="cfg-save" disabled={!hayCambios || guardando} onClick={guardarPreferencias}>{guardando ? 'Guardando…' : 'Guardar preferencias'}</button></div>
            </div>}

            {activeTab === 'carga' && <BulkWorkersConfig contratista={contratistaLogueado} proyectos={proyectosActivos} showToast={showToast} />}

            {activeTab === 'cuenta' && <section className="cfg-card">
              <header><h2>Cuenta y sesión</h2><p>Gestiona el acceso a tu cuenta y la sesión actual.</p></header>
              <div className="cfg-card-body">
                <div className="cfg-session-row"><div className="cfg-session-box"><span>Tipo de acceso</span><b>Portal Contratista</b></div><div className="cfg-session-box"><span>Empresa activa</span><b>{contratistaLogueado.nombre}</b></div>{session?.email && <div className="cfg-session-box"><span>Cuenta</span><b>{session.email}</b></div>}</div>
                {session?.email && <div className="cfg-logout"><div><strong>Contraseña</strong><p>Solicita un enlace seguro por correo para definir una nueva contraseña.</p></div><Link to={`/recuperar?email=${encodeURIComponent(session.email)}`}><KeyRound size={14} />Cambiar contraseña</Link></div>}
                <div className="cfg-logout"><div><strong>Cerrar sesión</strong><p>Finaliza la sesión actual y vuelve a la pantalla de acceso.</p></div><button onClick={onLogout}><LogOut size={14} />Cerrar sesión</button></div>
              </div>
            </section>}
          </div>
        </div>
      </section>
    </div>
  );
}
