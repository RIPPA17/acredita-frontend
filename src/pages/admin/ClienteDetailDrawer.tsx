import { useMemo } from 'react';
import { XCircle } from 'lucide-react';
import { Contratista, Proyecto, Mandante, Trabajador } from '../../types';
import { buildAcreditacionRows, AcredRow, docEstadoLabel, estadoUILabel, badgeClass } from './acreditacionUtils';
import { buildDocumentoQueueKey } from './colaUtils';

type Tab = 'resumen' | 'acreditaciones' | 'trabajadores' | 'documentos';

const BADGE_CLASS: Record<string, string> = {
  green: 'b-green bg-green-100 text-green-800',
  amber: 'bg-yellow-100 text-yellow-800',
  red: 'b-red bg-red-100 text-red-800',
  gray: 'b-gray bg-gray-100 text-gray-500',
};

const iniciales = (nombre: string) =>
  nombre.split(' ').filter(Boolean).map(n => n[0]).join('').substring(0, 2).toUpperCase();

const EstadoBadge = ({ estado }: { estado: string }) => (
  <span className={`badge text-[11px] shrink-0 ${BADGE_CLASS[badgeClass(estado)]}`}>{estado}</span>
);

function ResumenTab({
  contratista,
  rows,
  acreditadas,
  enProceso,
  bloqueadas,
}: {
  contratista: Contratista;
  rows: AcredRow[];
  acreditadas: number;
  enProceso: number;
  bloqueadas: number;
}) {
  const trabajadoresCount = (contratista.trabajadores || []).length;
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="card p-4 text-center">
          <div className="text-[20px] font-bold text-navy">{contratista.proyectos.length}</div>
          <div className="text-[11px] text-gray-400 uppercase tracking-wide mt-1">Proyecto{contratista.proyectos.length === 1 ? '' : 's'}</div>
        </div>
        <div className="card p-4 text-center">
          <div className="text-[20px] font-bold text-navy">{trabajadoresCount}</div>
          <div className="text-[11px] text-gray-400 uppercase tracking-wide mt-1">Trabajador{trabajadoresCount === 1 ? '' : 'es'}</div>
        </div>
      </div>

      <div className="card p-4">
        <p className="text-[12px] uppercase tracking-wider text-gray-400 mb-3 font-medium">Acreditaciones</p>
        {rows.length === 0 ? (
          <p className="text-[13px] text-gray-400">Sin acreditaciones.</p>
        ) : (
          <>
            <div className="flex gap-4 text-[13px] font-medium mb-3">
              <span className="text-emerald-700">{acreditadas} acreditada{acreditadas === 1 ? '' : 's'}</span>
              <span className="text-amber-700">{enProceso} en proceso</span>
              <span className="text-red-700">{bloqueadas} bloqueada{bloqueadas === 1 ? '' : 's'}</span>
            </div>
            <div className="flex flex-col divide-y divide-cream3">
              {rows.map(r => (
                <div key={r.key} className="flex justify-between items-center py-2 text-[13px]">
                  <span className="text-navy font-medium">{r.proyectoNombre}</span>
                  <EstadoBadge estado={estadoUILabel(r.estado)} />
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function AcreditacionesTab({
  contratista,
  rows,
  proyectoContexto,
  onVerAcreditacion,
}: {
  contratista: Contratista;
  rows: AcredRow[];
  proyectoContexto?: string | null;
  onVerAcreditacion: (contratista: Contratista, proyectoId: string, trabajador?: Trabajador) => void;
}) {
  if (contratista.proyectos.length === 0) {
    return <p className="text-[13px] text-gray-400 text-center py-10">Este contratista todavía no tiene proyectos asignados.</p>;
  }
  // Si el drawer se abrió desde un proyecto filtrado, esa acreditación se
  // muestra primero y destacada — sin que eso cambie qué proyecto abre
  // "Ver acreditación" en cada tarjeta (cada una sigue usando su propio
  // r.proyectoId, nunca el contexto).
  const ordenadas = proyectoContexto
    ? [...rows].sort((a, b) => (a.proyectoId === proyectoContexto ? -1 : 0) - (b.proyectoId === proyectoContexto ? -1 : 0))
    : rows;
  return (
    <div className="flex flex-col gap-3">
      {ordenadas.map(r => (
        <div
          key={r.key}
          className={`card p-4 flex flex-col gap-2 ${r.proyectoId === proyectoContexto ? 'ring-2 ring-brown/40' : ''}`}
        >
          <div className="flex justify-between items-start gap-3">
            <div className="min-w-0">
              <div className="text-[11px] text-gray-400 uppercase tracking-wide truncate">{r.mandanteNombre}</div>
              <div className="text-[14px] font-semibold text-navy truncate">{r.proyectoNombre}</div>
            </div>
            <EstadoBadge estado={estadoUILabel(r.estado)} />
          </div>
          <div className="flex gap-4 text-[12.5px] text-gray-600 font-medium">
            <span>Empresa {r.company.ok}/{r.company.total}</span>
            <span>Trabajadores {r.workers.ok}/{r.workers.total}</span>
          </div>
          <button
            onClick={() => onVerAcreditacion(contratista, r.proyectoId)}
            className="self-start text-brown text-[12.5px] font-semibold hover:underline cursor-pointer border-none bg-transparent"
          >
            Ver acreditación
          </button>
        </div>
      ))}
    </div>
  );
}

function TrabajadoresTab({
  contratista,
  rows,
  onVerAcreditacion,
}: {
  contratista: Contratista;
  rows: AcredRow[];
  onVerAcreditacion: (contratista: Contratista, proyectoId: string, trabajador?: Trabajador) => void;
}) {
  const trabajadores = contratista.trabajadores || [];
  const entries = rows.flatMap(r => r.workerList.map(w => ({ ...w, proyectoId: r.proyectoId, proyectoNombre: r.proyectoNombre })));

  if (trabajadores.length === 0 || entries.length === 0) {
    return <p className="text-[13px] text-gray-400 text-center py-10">Sin trabajadores registrados.</p>;
  }

  return (
    <div className="flex flex-col divide-y divide-cream3">
      {entries.map((w, i) => {
        const trabajadorObj = trabajadores.find(t => t.rut === w.rut);
        return (
          <div
            key={i}
            onClick={() => trabajadorObj && onVerAcreditacion(contratista, w.proyectoId, trabajadorObj)}
            className="flex items-center justify-between gap-3 py-2.5 cursor-pointer hover:bg-[#fbfaf6] -mx-2 px-2 rounded-lg transition-colors"
          >
            <div className="min-w-0">
              <div className="text-[13px] font-medium text-navy truncate">{w.nombre}</div>
              <div className="text-[11.5px] text-gray-400 truncate">{w.rut} · {w.proyectoNombre}</div>
            </div>
            <EstadoBadge estado={w.estado} />
          </div>
        );
      })}
    </div>
  );
}

function DocumentosTab({
  contratista,
  GLOBAL_PROYECTOS,
  onIrARevision,
}: {
  contratista: Contratista;
  GLOBAL_PROYECTOS: Proyecto[];
  onIrARevision: (docKey: string) => void;
}) {
  const docs = contratista.documentos || [];
  if (docs.length === 0) {
    return <p className="text-[13px] text-gray-400 text-center py-10">Sin documentos cargados.</p>;
  }
  return (
    <div className="flex flex-col divide-y divide-cream3">
      {docs.map(d => {
        const proyecto = d.proyectoId ? GLOBAL_PROYECTOS.find(p => p.id === d.proyectoId) : undefined;
        const estado = docEstadoLabel(d);
        const puedeRevisar = d.estado === 'revision' || d.estado === 'rechazado';
        return (
          <div key={d.id} className="flex items-center justify-between gap-3 py-2.5">
            <div className="min-w-0">
              <div className="text-[13px] font-medium text-navy truncate">{d.nombre}</div>
              <div className="text-[11.5px] text-gray-400 truncate">
                {proyecto ? proyecto.nombre : 'Proyecto no asignado'} · {d.vencimiento && d.vencimiento !== '—' ? `Vence ${d.vencimiento}` : 'Sin vencimiento'} · v{d.version || 1}
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <EstadoBadge estado={estado} />
              {puedeRevisar && (
                <button
                  onClick={() => onIrARevision(buildDocumentoQueueKey(contratista.id, d.id))}
                  className="text-brown text-[12px] font-semibold hover:underline whitespace-nowrap cursor-pointer border-none bg-transparent"
                >
                  Ir a revisión
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function ClienteDetailDrawer({
  clienteSeleccionado,
  setClienteSeleccionado,
  tabCliente,
  setTabCliente,
  GLOBAL_CONTRATISTAS,
  GLOBAL_PROYECTOS,
  GLOBAL_MANDANTES,
  proyectoContexto,
  onVerAcreditacion,
  onIrARevision,
}: {
  clienteSeleccionado: any;
  setClienteSeleccionado: (v: any) => void;
  tabCliente: string;
  setTabCliente: (v: string) => void;
  GLOBAL_CONTRATISTAS: Contratista[];
  GLOBAL_PROYECTOS: Proyecto[];
  GLOBAL_MANDANTES: Mandante[];
  proyectoContexto?: string | null;
  onVerAcreditacion: (contratista: Contratista, proyectoId: string, trabajador?: Trabajador) => void;
  onIrARevision: (docKey: string) => void;
}) {
  // Siempre se re-resuelve el contratista real desde el arreglo vivo (nunca
  // se confía en la instantánea con la que se abrió el drawer) para que
  // refleje aprobaciones/rechazos hechos mientras estuvo abierto, y nunca
  // cae de vuelta al primer contratista del sistema si no se encuentra.
  const contratista = GLOBAL_CONTRATISTAS.find(c => c.id === clienteSeleccionado?.id);

  const acreditacionRows = useMemo(
    () => buildAcreditacionRows(GLOBAL_CONTRATISTAS, GLOBAL_PROYECTOS, GLOBAL_MANDANTES),
    [GLOBAL_CONTRATISTAS, GLOBAL_PROYECTOS, GLOBAL_MANDANTES]
  );

  if (!contratista) {
    return (
      <>
        <div className="fixed inset-0 z-[399] bg-black/20" onClick={() => setClienteSeleccionado(null)} />
        <div className="fixed left-1/2 top-1/2 z-[400] -translate-x-1/2 -translate-y-1/2 w-[calc(100vw-32px)] max-w-[420px] bg-white rounded-2xl border border-cream3 shadow-2xl p-6 text-center">
          <p className="text-[13.5px] text-gray-500 mb-4">No se pudo cargar la información del contratista.</p>
          <button onClick={() => setClienteSeleccionado(null)} className="btn btn-primary">Cerrar</button>
        </div>
      </>
    );
  }

  const rows = acreditacionRows.filter(r => r.contratista.id === contratista.id);
  const bloqueadas = rows.filter(r => r.estado === 'Vencido/Bloqueado').length;
  const enProceso = rows.filter(r => r.estado === 'En proceso').length;
  const acreditadas = rows.filter(r => r.estado === 'Aprobado').length;

  const tabs: Array<{ id: Tab; label: string }> = [
    { id: 'resumen', label: 'Resumen' },
    { id: 'acreditaciones', label: 'Acreditaciones' },
    { id: 'trabajadores', label: 'Trabajadores' },
    { id: 'documentos', label: 'Documentos' },
  ];

  return (
    <>
      <div className="fixed inset-0 z-[399] bg-black/20" onClick={() => setClienteSeleccionado(null)} />
      <div className="fixed left-1/2 top-1/2 z-[400] flex h-[calc(100vh-16px)] sm:h-[90vh] w-[calc(100vw-16px)] sm:w-3/4 max-w-[1000px] -translate-x-1/2 -translate-y-1/2 flex-col overflow-y-auto sm:overflow-hidden rounded-2xl border border-cream3 bg-white shadow-2xl">
        {/* Header — single row: avatar, name/RUT, close */}
        <div className="flex items-center gap-3 py-3.5 px-5 border-b border-cream3 flex-shrink-0">
          <div className="w-[38px] h-[38px] rounded-full bg-brown text-white flex items-center justify-center font-semibold text-[13px] shrink-0">
            {iniciales(contratista.nombre)}
          </div>
          <div className="min-w-0 shrink-0">
            <p className="font-semibold text-navy text-[15px] leading-tight truncate max-w-[260px]">
              {contratista.nombre}
            </p>
            <p className="text-[11.5px] text-gray-400 leading-tight">{contratista.rut}</p>
          </div>
          <div className="flex-1" />
          <button
            onClick={() => setClienteSeleccionado(null)}
            className="text-gray-400 hover:text-navy shrink-0"
          >
            <XCircle size={20} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-cream3 px-4 flex-shrink-0">
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => setTabCliente(t.id)}
              className={`px-4 py-2.5 text-[13px] border-b-2 transition-colors ${tabCliente === t.id ? "border-brown text-brown font-semibold" : "border-transparent text-gray-400 hover:text-navy"}`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5">
          {tabCliente === 'resumen' && (
            <ResumenTab contratista={contratista} rows={rows} acreditadas={acreditadas} enProceso={enProceso} bloqueadas={bloqueadas} />
          )}
          {tabCliente === 'acreditaciones' && (
            <AcreditacionesTab contratista={contratista} rows={rows} proyectoContexto={proyectoContexto} onVerAcreditacion={onVerAcreditacion} />
          )}
          {tabCliente === 'trabajadores' && (
            <TrabajadoresTab contratista={contratista} rows={rows} onVerAcreditacion={onVerAcreditacion} />
          )}
          {tabCliente === 'documentos' && (
            <DocumentosTab contratista={contratista} GLOBAL_PROYECTOS={GLOBAL_PROYECTOS} onIrARevision={onIrARevision} />
          )}
        </div>
      </div>
    </>
  );
}
