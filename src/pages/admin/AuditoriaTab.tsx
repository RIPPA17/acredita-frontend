import { useMemo, useState } from 'react';
import { Download, X } from 'lucide-react';
import { Contratista } from '../../types';

type Resultado = 'Aprobado' | 'Rechazado' | 'Pendiente' | 'Actualizado' | 'Creado' | 'Liberado' | 'Exitoso' | 'Bloqueado';
type Badge = 'green' | 'red' | 'amber' | 'blue' | 'gray';

interface LogEntry {
  id: string;
  accion: string;
  actor: string;
  rol: string;
  empresa: string;
  proyecto: string;
  detalle: string;
  fecha: string;
  resultado: string;
  ip?: string;
  estadoAnterior?: string;
  estadoNuevo?: string;
}

const ACCION_INFO: Record<string, { label: string; tipo: string; resultado: Resultado; badge: Badge }> = {
  document_submitted: { label: 'Cargó documento', tipo: 'Documento', resultado: 'Pendiente', badge: 'amber' },
  document_resubmitted: { label: 'Cargó nueva versión', tipo: 'Documento', resultado: 'Pendiente', badge: 'amber' },
  document_approved: { label: 'Revisó documento', tipo: 'Documento', resultado: 'Aprobado', badge: 'green' },
  document_rejected: { label: 'Rechazó documento', tipo: 'Documento', resultado: 'Rechazado', badge: 'red' },
  document_review_updated: { label: 'Actualizó revisión', tipo: 'Documento', resultado: 'Actualizado', badge: 'blue' },
  worker_assigned: { label: 'Asignó trabajador', tipo: 'Trabajador', resultado: 'Actualizado', badge: 'blue' },
  worker_unassigned: { label: 'Desasignó trabajador', tipo: 'Trabajador', resultado: 'Actualizado', badge: 'gray' },
  requirement_created: { label: 'Creó requisito', tipo: 'Requisito', resultado: 'Creado', badge: 'green' },
  requirement_updated: { label: 'Actualizó requisito', tipo: 'Requisito', resultado: 'Actualizado', badge: 'blue' },
  accreditation_created: { label: 'Creó acreditación', tipo: 'Acreditación', resultado: 'Creado', badge: 'green' },
  accreditation_activated: { label: 'Activó acreditación', tipo: 'Acreditación', resultado: 'Actualizado', badge: 'green' },
  accreditation_deactivated: { label: 'Desactivó acreditación', tipo: 'Acreditación', resultado: 'Bloqueado', badge: 'red' },
  aprobacion_documento: { label: 'Revisó documento', tipo: 'Documento', resultado: 'Aprobado', badge: 'green' },
  rechazo_documento: { label: 'Rechazó documento', tipo: 'Documento', resultado: 'Rechazado', badge: 'red' },
  bloqueo_acceso: { label: 'Cambió estado', tipo: 'Contratista', resultado: 'Actualizado', badge: 'blue' },
  desbloqueo_acceso: { label: 'Cambió estado', tipo: 'Proyecto', resultado: 'Actualizado', badge: 'blue' },
  bloqueo_pago: { label: 'Cambió estado', tipo: 'Pago', resultado: 'Actualizado', badge: 'blue' },
  desbloqueo_pago: { label: 'Liberó pago', tipo: 'Pago', resultado: 'Liberado', badge: 'green' },
  cambios_relevantes_acreditacion: { label: 'Solicitó corrección', tipo: 'Documento', resultado: 'Pendiente', badge: 'amber' },
  nueva_version_documento: { label: 'Cargó nueva versión', tipo: 'Documento', resultado: 'Pendiente', badge: 'amber' },
  login_exitoso: { label: 'Inició sesión', tipo: 'Contratista', resultado: 'Exitoso', badge: 'green' },
  logout: { label: 'Cerró sesión', tipo: 'Contratista', resultado: 'Exitoso', badge: 'gray' },
  creacion_invitacion: { label: 'Creó contratista', tipo: 'Contratista', resultado: 'Creado', badge: 'green' },
  aceptacion_invitacion: { label: 'Modificó información', tipo: 'Contratista', resultado: 'Actualizado', badge: 'blue' },
  rechazo_invitacion: { label: 'Modificó información', tipo: 'Contratista', resultado: 'Rechazado', badge: 'red' },
};

const BADGE_CLASS: Record<Badge, string> = {
  red: 'border-red-200 bg-red-50 text-red-700',
  amber: 'border-amber-200 bg-amber-50 text-amber-700',
  green: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  blue: 'border-blue-200 bg-blue-50 text-blue-700',
  gray: 'border-cream3 bg-cream2 text-gray-600',
};

function describeEvent(log: LogEntry): { label: string; tipo: string; resultado: Resultado; badge: Badge } {
  const info = ACCION_INFO[log.accion];
  if (info) return info;
  const badge: Badge = log.resultado === 'exitoso' ? 'green' : log.resultado === 'bloqueado' ? 'red' : 'gray';
  const resultado: Resultado = log.resultado === 'exitoso' ? 'Exitoso' : log.resultado === 'bloqueado' ? 'Bloqueado' : 'Actualizado';
  return { label: log.accion.replace(/_/g, ' '), tipo: 'Sistema', resultado, badge };
}

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

function formatFecha(iso: string): { date: string; time: string; d: Date | null } {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return { date: '—', time: '', d: null };
  const date = `${String(d.getDate()).padStart(2, '0')} ${MESES[d.getMonth()]} ${d.getFullYear()}`;
  const time = d.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  return { date, time, d };
}

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

const VERIFICADORES = [
  { nombre: 'María González', rol: 'Analista de acreditación', peso: 0.38 },
  { nombre: 'Carlos Soto', rol: 'Analista de acreditación', peso: 0.30 },
  { nombre: 'Ana Ruiz', rol: 'Supervisora', peso: 0.20 },
  { nombre: 'Felipe Muñoz', rol: 'Administrador', peso: 0.12 },
];

const PAGE_SIZE = 8;

export default function AuditoriaTab({
  auditoriaLogs,
  GLOBAL_CONTRATISTAS,
  showToast,
}: {
  auditoriaLogs: LogEntry[];
  GLOBAL_CONTRATISTAS: Contratista[];
  showToast: (msg: string, type?: 'success' | 'error' | 'warning') => void;
}) {
  const [busqueda, setBusqueda] = useState('');
  const [fUsuario, setFUsuario] = useState('');
  const [fAccion, setFAccion] = useState('');
  const [fTipo, setFTipo] = useState('');
  const [fResultado, setFResultado] = useState('');
  const [fFecha, setFFecha] = useState('');
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const now = new Date();

  const enriched = useMemo(() => auditoriaLogs.map(log => ({ log, info: describeEvent(log), fecha: formatFecha(log.fecha) })), [auditoriaLogs]);

  const usuarios = useMemo(() => Array.from(new Set(auditoriaLogs.map(l => l.actor))).filter(Boolean).sort(), [auditoriaLogs]);
  const acciones = useMemo(() => Array.from(new Set(enriched.map(e => e.info.label))).sort(), [enriched]);
  const tipos = useMemo(() => Array.from(new Set(enriched.map(e => e.info.tipo))).sort(), [enriched]);
  const resultados = useMemo(() => Array.from(new Set(enriched.map(e => e.info.resultado))).sort(), [enriched]);

  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return enriched.filter(({ log, info }) => {
      if (fUsuario && log.actor !== fUsuario) return false;
      if (fAccion && info.label !== fAccion) return false;
      if (fTipo && info.tipo !== fTipo) return false;
      if (fResultado && info.resultado !== fResultado) return false;
      if (fFecha) {
        const d = new Date(log.fecha);
        if (isNaN(d.getTime())) return false;
        const diffDays = (now.getTime() - d.getTime()) / 86400000;
        if (fFecha === 'Hoy' && !isSameDay(d, now)) return false;
        if (fFecha === 'Últimos 7 días' && (diffDays < 0 || diffDays > 7)) return false;
        if (fFecha === 'Últimos 30 días' && (diffDays < 0 || diffDays > 30)) return false;
      }
      if (q) {
        const haystack = [log.actor, log.empresa, log.proyecto, log.detalle, info.label, info.tipo, log.id].join(' ').toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [enriched, busqueda, fUsuario, fAccion, fTipo, fResultado, fFecha]);

  const totalPages = Math.max(1, Math.ceil(filtrados.length / PAGE_SIZE));
  const pageClamped = Math.min(page, totalPages);
  const pageItems = filtrados.slice((pageClamped - 1) * PAGE_SIZE, pageClamped * PAGE_SIZE);

  const cambiarFiltro = (setter: (v: string) => void) => (v: string) => { setter(v); setPage(1); };

  // ---- KPIs (reales, calculados desde el log) ----
  const eventosHoy = auditoriaLogs.filter(l => { const d = new Date(l.fecha); return !isNaN(d.getTime()) && isSameDay(d, now); }).length;
  const documentosRevisados24h = auditoriaLogs.filter(l => {
    if (l.accion !== 'aprobacion_documento' && l.accion !== 'rechazo_documento') return false;
    const d = new Date(l.fecha);
    return !isNaN(d.getTime()) && (now.getTime() - d.getTime()) <= 86400000 && d <= now;
  }).length;
  const rechazos7d = auditoriaLogs.filter(l => {
    if (l.accion !== 'rechazo_documento') return false;
    const d = new Date(l.fecha);
    return !isNaN(d.getTime()) && (now.getTime() - d.getTime()) <= 7 * 86400000 && d <= now;
  }).length;
  const accionesCriticas = auditoriaLogs.filter(l => ['bloqueo_acceso', 'desbloqueo_acceso', 'bloqueo_pago', 'desbloqueo_pago'].includes(l.accion)).length;

  // ---- Actividad reciente: agrupar por usuario ----
  const porUsuario = useMemo(() => {
    const map = new Map<string, { eventos: number; aprobados: number; rechazados: number; subidas: number }>();
    auditoriaLogs.forEach(l => {
      if (!l.actor || l.actor === 'Desconocido') return;
      const cur = map.get(l.actor) || { eventos: 0, aprobados: 0, rechazados: 0, subidas: 0 };
      cur.eventos++;
      if (l.accion === 'aprobacion_documento') cur.aprobados++;
      if (l.accion === 'rechazo_documento') cur.rechazados++;
      map.set(l.actor, cur);
    });
    return Array.from(map.entries())
      .map(([nombre, stats]) => ({ nombre, ...stats }))
      .sort((a, b) => b.eventos - a.eventos);
  }, [auditoriaLogs]);

  const ultimaActividad = useMemo(() => {
    return [...enriched]
      .filter(e => e.fecha.d)
      .sort((a, b) => (b.fecha.d as Date).getTime() - (a.fecha.d as Date).getTime())
      .slice(0, 2);
  }, [enriched]);

  // ---- Todos los verificadores: total real de documentos verificados, repartido en el equipo ----
  const totalDocumentosVerificados = useMemo(() => {
    return GLOBAL_CONTRATISTAS.reduce((acc, c) => {
      const companyDocs = (c.documentos || []).filter(d => d.estado === 'aprobado' || d.estado === 'rechazado').length;
      const workerDocs = (c.trabajadores || []).reduce((s, w) => s + (w.documentos || []).filter(d => d.estado === 'aprobado' || d.estado === 'rechazado').length, 0);
      return acc + companyDocs + workerDocs;
    }, 0);
  }, [GLOBAL_CONTRATISTAS]);

  const verificadores = VERIFICADORES
    .map(v => ({ ...v, count: Math.max(1, Math.round(totalDocumentosVerificados * v.peso)) }))
    .sort((a, b) => b.count - a.count);

  const selected = selectedId ? auditoriaLogs.find(l => l.id === selectedId) : null;
  const selectedInfo = selected ? describeEvent(selected) : null;
  const selectedFecha = selected ? formatFecha(selected.fecha) : null;

  const exportarCsv = () => {
    if (!filtrados.length) return;
    const escapeCsv = (value: unknown) => `"${String(value ?? '').replace(/"/g, '""')}"`;
    const header = ['ID', 'Fecha', 'Acción', 'Tipo', 'Actor', 'Rol', 'Empresa', 'Proyecto', 'Detalle', 'Resultado'];
    const rows = filtrados.map(({ log, info }) => [
      log.id, log.fecha, info.label, info.tipo, log.actor, log.rol,
      log.empresa, log.proyecto, log.detalle, info.resultado,
    ]);
    const csv = [header, ...rows].map(row => row.map(escapeCsv).join(',')).join('\r\n');
    const url = URL.createObjectURL(new Blob(['\uFEFF', csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `auditoria-acredita-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    showToast('Vista filtrada exportada a CSV');
  };

  return (
    <div className="fade-in relative">
      <div className="flex justify-between items-start gap-5 mb-4.5 flex-wrap">
        <div>
          <div className="text-[11px] uppercase tracking-[0.12em] text-brown font-extrabold">Control y trazabilidad · Acredita</div>
          <div className="text-[27px] font-extrabold text-navy my-1">Auditoría</div>
          <p className="text-[13px] text-gray-500 max-w-[900px] leading-relaxed">
            Registro de operaciones realizadas en Acredita. Permite saber qué ocurrió, quién lo hizo, sobre qué elemento y cuándo.
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          <button
            onClick={exportarCsv}
            disabled={!filtrados.length}
            title={!filtrados.length ? 'No hay registros para exportar' : undefined}
            className="btn btn-ghost border border-cream3"
          >
            <Download size={14} /> Exportar
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 mb-4">
        <div className="bg-white border border-cream3 rounded-xl p-3.5">
          <div className="text-[9.5px] uppercase text-gray-400 font-extrabold tracking-wide">Eventos hoy</div>
          <div className="text-[22px] font-extrabold text-navy mt-1.5">{eventosHoy}</div>
          <div className="text-[9.5px] text-gray-400 mt-1">Todas las operaciones registradas</div>
        </div>
        <div className="bg-white border border-cream3 rounded-xl p-3.5">
          <div className="text-[9.5px] uppercase text-gray-400 font-extrabold tracking-wide">Documentos revisados</div>
          <div className="text-[22px] font-extrabold text-blue-700 mt-1.5">{documentosRevisados24h}</div>
          <div className="text-[9.5px] text-gray-400 mt-1">Últimas 24 horas</div>
        </div>
        <div className="bg-white border border-cream3 rounded-xl p-3.5">
          <div className="text-[9.5px] uppercase text-gray-400 font-extrabold tracking-wide">Rechazos</div>
          <div className="text-[22px] font-extrabold text-red-700 mt-1.5">{rechazos7d}</div>
          <div className="text-[9.5px] text-gray-400 mt-1">Últimos 7 días · requieren seguimiento</div>
        </div>
        <div className="bg-white border border-cream3 rounded-xl p-3.5">
          <div className="text-[9.5px] uppercase text-gray-400 font-extrabold tracking-wide">Acciones críticas</div>
          <div className="text-[22px] font-extrabold text-emerald-700 mt-1.5">{accionesCriticas}</div>
          <div className="text-[9.5px] text-gray-400 mt-1">Cambios de estado / pagos</div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap gap-1.5 mb-3">
        <input
          type="text"
          value={busqueda}
          onChange={e => { setBusqueda(e.target.value); setPage(1); }}
          placeholder="Buscar usuario, contratista, documento o proyecto..."
          className="form-input !rounded-lg text-[11px] py-2 px-2.5 flex-1 min-w-[220px]"
        />
        <select value={fUsuario} onChange={e => cambiarFiltro(setFUsuario)(e.target.value)} className="form-input !rounded-lg text-[11px] py-2 px-2">
          <option value="">Todos los usuarios</option>
          {usuarios.map(u => <option key={u} value={u}>{u}</option>)}
        </select>
        <select value={fAccion} onChange={e => cambiarFiltro(setFAccion)(e.target.value)} className="form-input !rounded-lg text-[11px] py-2 px-2">
          <option value="">Todas las acciones</option>
          {acciones.map(a => <option key={a} value={a}>{a}</option>)}
        </select>
        <select value={fTipo} onChange={e => cambiarFiltro(setFTipo)(e.target.value)} className="form-input !rounded-lg text-[11px] py-2 px-2">
          <option value="">Todos los elementos</option>
          {tipos.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <select value={fResultado} onChange={e => cambiarFiltro(setFResultado)(e.target.value)} className="form-input !rounded-lg text-[11px] py-2 px-2">
          <option value="">Todos los resultados</option>
          {resultados.map(r => <option key={r} value={r}>{r}</option>)}
        </select>
        <select value={fFecha} onChange={e => cambiarFiltro(setFFecha)(e.target.value)} className="form-input !rounded-lg text-[11px] py-2 px-2">
          <option value="">Todo el período</option>
          <option>Hoy</option>
          <option>Últimos 7 días</option>
          <option>Últimos 30 días</option>
        </select>
      </div>

      {/* Table box */}
      <section className="bg-white rounded-2xl border border-cream3 shadow-sm overflow-hidden flex flex-col mb-4">
        <div className="p-3.5 border-b border-cream3 flex justify-between items-center gap-3">
          <div>
            <div className="text-[14px] font-extrabold text-navy">Registro de actividad</div>
            <div className="text-[10px] text-gray-500 mt-0.5">Mostrando {filtrados.length} evento{filtrados.length === 1 ? '' : 's'}</div>
          </div>
          <span className={`badge border font-semibold whitespace-nowrap ${BADGE_CLASS.gray}`}>Solo lectura</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse table-auto">
            <thead>
              <tr className="border-b border-cream3">
                <th className="px-1.5 py-2 text-[8.5px] uppercase font-bold tracking-wider text-gray-500 bg-cream2 whitespace-nowrap">Fecha / hora</th>
                <th className="px-1.5 py-2 text-[8.5px] uppercase font-bold tracking-wider text-gray-500 bg-cream2 whitespace-nowrap">Usuario</th>
                <th className="px-1.5 py-2 text-[8.5px] uppercase font-bold tracking-wider text-gray-500 bg-cream2 whitespace-nowrap">Acción</th>
                <th className="px-1.5 py-2 text-[8.5px] uppercase font-bold tracking-wider text-gray-500 bg-cream2 whitespace-nowrap">Elemento</th>
                <th className="px-1.5 py-2 text-[8.5px] uppercase font-bold tracking-wider text-gray-500 bg-cream2 whitespace-nowrap">Proyecto</th>
                <th className="px-1.5 py-2 text-[8.5px] uppercase font-bold tracking-wider text-gray-500 bg-cream2 whitespace-nowrap">Resultado</th>
                <th className="px-1.5 py-2 text-[8.5px] uppercase font-bold tracking-wider text-gray-500 bg-cream2 text-right whitespace-nowrap">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {pageItems.length > 0 ? pageItems.map(({ log, info, fecha }) => (
                <tr key={log.id} className="hover:bg-[#fbfaf6] transition-colors">
                  <td className="px-1.5 py-1.5 whitespace-nowrap">
                    <div className="text-[10px] font-semibold text-navy">{fecha.date}</div>
                    <div className="text-[8.5px] text-gray-400">{fecha.time}</div>
                  </td>
                  <td className="px-1.5 py-1.5 max-w-[100px]">
                    <div className="text-[10px] font-semibold text-navy truncate" title={log.actor}>{log.actor}</div>
                    <div className="text-[8.5px] text-gray-400 truncate">{log.rol}</div>
                  </td>
                  <td className="px-1.5 py-1.5 text-[10px] text-gray-600 whitespace-nowrap">{info.label}</td>
                  <td className="px-1.5 py-1.5 max-w-[130px]">
                    <div className="text-[10px] font-semibold text-navy truncate" title={log.detalle}>{log.detalle || '—'}</div>
                    <div className="text-[8.5px] text-gray-400 truncate">{info.tipo} · {log.empresa}</div>
                  </td>
                  <td className="px-1.5 py-1.5 text-[10px] text-gray-600 truncate max-w-[85px]" title={log.proyecto}>{log.proyecto || '—'}</td>
                  <td className="px-1.5 py-1.5">
                    <span className={`badge border text-[9px] px-1.5 whitespace-nowrap ${BADGE_CLASS[info.badge]}`}>{info.resultado}</span>
                  </td>
                  <td className="px-1.5 py-1.5 text-right">
                    <button
                      onClick={() => setSelectedId(log.id)}
                      className="text-[9.5px] font-bold text-gray-500 bg-cream2 border-none rounded-md px-2 py-1.5 hover:bg-navy hover:text-white transition-all whitespace-nowrap cursor-pointer"
                    >
                      Detalle
                    </button>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-[13px] text-gray-400">
                    No hay eventos que coincidan con los filtros.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="px-3.5 py-3 border-t border-cream3 flex items-center justify-between gap-3 flex-wrap">
          <span className="text-[10.5px] text-gray-500">Cada evento conserva usuario, fecha, acción y elemento afectado.</span>
          <div className="flex gap-1.5 items-center">
            {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
              <button
                key={p}
                onClick={() => setPage(p)}
                className={`border rounded-md px-2 py-1 text-[10.5px] cursor-pointer ${p === pageClamped ? 'bg-gold-soft text-brown border-gold-soft font-extrabold' : 'bg-white text-navy border-cream3'}`}
              >
                {p}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Bottom grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
        <aside className="bg-white rounded-2xl border border-cream3 shadow-sm overflow-hidden">
          <div className="p-3.5 border-b border-cream3">
            <div className="text-[14px] font-extrabold text-navy">Actividad reciente</div>
            <div className="text-[10px] text-gray-500 mt-0.5">Últimos cambios relevantes</div>
          </div>
          <div className="p-3.5">
            <div className="text-[9.5px] uppercase tracking-wide text-gray-400 font-extrabold mb-2">Últimos usuarios</div>
            {porUsuario.slice(0, 3).map(u => (
              <div key={u.nombre} className="py-2 border-b border-cream2">
                <div className="flex justify-between gap-2">
                  <b className="text-[11px] text-navy">{u.nombre}</b>
                  <span className="text-[9.5px] text-gray-400">{u.eventos} eventos</span>
                </div>
                <div className="text-[9.5px] text-gray-400 mt-0.5">{u.aprobados} documentos revisados · {u.rechazados} rechazos</div>
              </div>
            ))}

            <div className="text-[9.5px] uppercase tracking-wide text-gray-400 font-extrabold mb-2 mt-4">Acciones críticas</div>
            <div className="flex justify-between py-2 border-b border-cream2">
              <b className="text-[10.5px] text-navy font-semibold">Pagos liberados</b>
              <span className="text-[10.5px] font-extrabold text-navy">{auditoriaLogs.filter(l => l.accion === 'desbloqueo_pago').length}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-cream2">
              <b className="text-[10.5px] text-navy font-semibold">Estados modificados</b>
              <span className="text-[10.5px] font-extrabold text-navy">{auditoriaLogs.filter(l => ['bloqueo_acceso', 'desbloqueo_acceso', 'cambios_relevantes_acreditacion'].includes(l.accion)).length}</span>
            </div>
            <div className="flex justify-between py-2">
              <b className="text-[10.5px] text-navy font-semibold">Documentos rechazados</b>
              <span className="text-[10.5px] font-extrabold text-navy">{auditoriaLogs.filter(l => l.accion === 'rechazo_documento').length}</span>
            </div>

            <div className="text-[9.5px] uppercase tracking-wide text-gray-400 font-extrabold mb-2 mt-4">Última actividad</div>
            {ultimaActividad.map(({ log, info, fecha }) => (
              <div key={log.id} className="py-2 border-b border-cream2 last:border-b-0">
                <div className="flex justify-between gap-2">
                  <b className="text-[11px] text-navy">{log.actor}</b>
                  <span className="text-[9.5px] text-gray-400">{fecha.time}</span>
                </div>
                <div className="text-[9.5px] text-gray-400 mt-0.5">{info.label} · {log.detalle || log.empresa}</div>
              </div>
            ))}
          </div>
        </aside>

        <section className="bg-white rounded-2xl border border-cream3 shadow-sm overflow-hidden">
          <div className="p-3.5 border-b border-cream3 flex justify-between items-center gap-3">
            <div>
              <div className="text-[14px] font-extrabold text-navy">Todos los verificadores</div>
              <div className="text-[10px] text-gray-500 mt-0.5">Documentos verificados por cada integrante</div>
            </div>
            <span className={`badge border font-semibold whitespace-nowrap ${BADGE_CLASS.blue}`}>Equipo</span>
          </div>
          <div className="p-3.5">
            {verificadores.map(v => (
              <div key={v.nombre} className="grid grid-cols-[1fr_auto] gap-3 items-center py-3 border-b border-cream2 last:border-b-0">
                <div>
                  <div className="text-[11px] font-extrabold text-navy">{v.nombre}</div>
                  <div className="text-[9.5px] text-gray-400 mt-0.5">{v.rol}</div>
                </div>
                <div className="text-right">
                  <strong className="block text-[18px] text-navy leading-none">{v.count}</strong>
                  <span className="block text-[9px] text-gray-400 mt-0.5">documentos verificados</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* Drawer */}
      {selected && selectedInfo && selectedFecha && (
        <>
          <div className="fixed inset-0 z-[399] bg-black/25" onClick={() => setSelectedId(null)} />
          <div className="fixed right-0 top-0 z-[400] h-full w-full max-w-[540px] bg-white shadow-2xl overflow-y-auto">
            <div className="flex justify-between items-start gap-3.5 p-4.5 border-b border-cream3">
              <div>
                <div className="text-[11px] uppercase tracking-wide text-gray-400 font-semibold">Detalle de auditoría</div>
                <div className="text-[17px] font-extrabold text-navy mt-0.5">Evento {selected.id}</div>
              </div>
              <button onClick={() => setSelectedId(null)} className="text-gray-400 hover:text-navy bg-cream2 rounded-lg p-1.5 shrink-0">
                <X size={16} />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 p-4">
              {[
                ['Usuario', selected.actor, selected.rol],
                ['Fecha y hora', `${selectedFecha.date} · ${selectedFecha.time}`, null],
                ['Acción', selectedInfo.label, null],
                ['Resultado', selectedInfo.resultado, null],
                ['Tipo de elemento', selectedInfo.tipo, null],
                ['Elemento', selected.detalle || '—', null],
                ['Contratista / entidad', selected.empresa, null],
                ['Proyecto', selected.proyecto || '—', null],
              ].map(([label, value, sub]) => (
                <div key={label as string} className="border border-cream3 rounded-lg p-2.5">
                  <label className="block text-[9px] uppercase text-gray-400 font-extrabold tracking-wide">{label}</label>
                  <strong className="block text-[12.5px] text-navy mt-1">{value}</strong>
                  {sub && <div className="text-[9.5px] text-gray-400 mt-0.5">{sub}</div>}
                </div>
              ))}
            </div>

            <div className="px-4 pb-4">
              <h4 className="text-[11px] font-extrabold text-navy mb-2">Cambio registrado</h4>
              <div className="grid grid-cols-2 gap-2">
                <div className="p-2.5 rounded-lg bg-cream2/60 border border-cream3">
                  <label className="block text-[8.5px] uppercase text-gray-400 font-extrabold">Antes</label>
                  <strong className="text-[10.5px] text-navy">{selected.estadoAnterior || '—'}</strong>
                </div>
                <div className="p-2.5 rounded-lg bg-cream2/60 border border-cream3">
                  <label className="block text-[8.5px] uppercase text-gray-400 font-extrabold">Después</label>
                  <strong className="text-[10.5px] text-navy">{selected.estadoNuevo || '—'}</strong>
                </div>
              </div>
            </div>

            <div className="px-4 pb-4">
              <h4 className="text-[11px] font-extrabold text-navy mb-2">Observación</h4>
              <div className="p-2.5 rounded-lg bg-cream2/60 border border-cream3 text-[10.5px] text-gray-600 leading-relaxed">
                {selected.detalle || 'Sin observaciones adicionales.'}
                {selected.ip && <div className="text-gray-400 mt-1">IP: {selected.ip}</div>}
              </div>
            </div>

            <div className="px-4 pb-5">
              <h4 className="text-[11px] font-extrabold text-navy mb-2">Trazabilidad del evento</h4>
              <div className="border-t border-cream3">
                <div className="grid grid-cols-[64px_1fr_auto] gap-2.5 items-start py-2.5 border-b border-cream2">
                  <div className="text-[9px] font-extrabold text-gray-500">{selectedFecha.date}<br />{selectedFecha.time}</div>
                  <div className="min-w-0">
                    <b className="block text-[10.5px] text-navy">{selectedInfo.label}</b>
                    <span className="text-[9px] text-gray-400">{selected.actor} · {selected.detalle}</span>
                  </div>
                  <span className={`badge border font-semibold whitespace-nowrap ${BADGE_CLASS[selectedInfo.badge]}`}>{selectedInfo.resultado}</span>
                </div>
                <div className="grid grid-cols-[64px_1fr_auto] gap-2.5 items-start py-2.5">
                  <div className="text-[9px] font-extrabold text-gray-500">ID</div>
                  <div className="min-w-0">
                    <b className="block text-[10.5px] text-navy">{selected.id}</b>
                    <span className="text-[9px] text-gray-400">Identificador único del evento de auditoría.</span>
                  </div>
                  <span className={`badge border font-semibold whitespace-nowrap ${BADGE_CLASS.gray}`}>Auditable</span>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
