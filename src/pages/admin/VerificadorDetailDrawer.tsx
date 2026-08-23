import { useMemo } from 'react';
import { XCircle } from 'lucide-react';
import { Contratista, Proyecto, Verificador, ClaimRevision } from '../../types';
import { saveVerificadores, getActividadHoyPorVerificador } from '../../data/localStorageDb';
import { resolveCargaPorVerificador, CargaItem } from './verificadorUtils';

type Tab = 'resumen' | 'carga' | 'actividad';

const BADGE_CLASS: Record<string, string> = {
  green: 'b-green bg-green-100 text-green-800',
  amber: 'bg-yellow-100 text-yellow-800',
  gray: 'b-gray bg-gray-100 text-gray-500',
  blue: 'bg-blue-100 text-blue-800',
};

const ROL_LABEL: Record<Verificador['rol'], string> = {
  verificador: 'Verificador',
  supervisor: 'Supervisor',
};

const iniciales = (nombre: string) =>
  nombre.split(' ').filter(Boolean).map(n => n[0]).join('').substring(0, 2).toUpperCase();

function ResumenTab({
  verificador,
  enRevision,
  aprobados,
  rechazados,
}: {
  verificador: Verificador;
  enRevision: number;
  aprobados: number;
  rechazados: number;
}) {
  const revisadosHoy = aprobados + rechazados;
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="card p-4 text-center">
          <div className="text-[20px] font-bold text-navy">{enRevision}</div>
          <div className="text-[11px] text-gray-400 uppercase tracking-wide mt-1">En revisión</div>
        </div>
        <div className="card p-4 text-center">
          <div className="text-[20px] font-bold text-navy">{revisadosHoy}</div>
          <div className="text-[11px] text-gray-400 uppercase tracking-wide mt-1">Revisados hoy</div>
        </div>
        <div className="card p-4 text-center">
          <div className="text-[20px] font-bold text-emerald-700">{aprobados}</div>
          <div className="text-[11px] text-gray-400 uppercase tracking-wide mt-1">Aprobados</div>
        </div>
        <div className="card p-4 text-center">
          <div className="text-[20px] font-bold text-red-700">{rechazados}</div>
          <div className="text-[11px] text-gray-400 uppercase tracking-wide mt-1">Rechazados</div>
        </div>
      </div>

      <div className="card p-4">
        <p className="text-[12px] uppercase tracking-wider text-gray-400 mb-3 font-medium">Información del equipo</p>
        <div className="flex flex-col divide-y divide-cream3">
          <div className="flex justify-between items-center py-2.5">
            <div>
              <div className="text-[13.5px] font-semibold text-navy">Rol</div>
              <div className="text-[11.5px] text-gray-400">Función dentro de la operación</div>
            </div>
            <span className={`badge text-[11px] ${BADGE_CLASS[verificador.rol === 'supervisor' ? 'amber' : 'blue']}`}>
              {ROL_LABEL[verificador.rol]}
            </span>
          </div>
          <div className="flex justify-between items-center py-2.5">
            <div>
              <div className="text-[13.5px] font-semibold text-navy">Estado</div>
              <div className="text-[11.5px] text-gray-400">Disponibilidad actual</div>
            </div>
            <span className={`badge text-[11px] ${BADGE_CLASS[verificador.estado === 'online' ? 'green' : 'gray']}`}>
              {verificador.estado === 'online' ? 'Online' : 'Offline'}
            </span>
          </div>
          <div className="flex justify-between items-center py-2.5">
            <div className="text-[13.5px] font-semibold text-navy">Email</div>
            <span className="text-[12.5px] text-gray-500">{verificador.email}</span>
          </div>
        </div>
      </div>

      <div className="bg-gold-soft/40 border border-[#ecdcc4] rounded-lg px-3 py-2.5 text-[12px] text-[#7b5b32]">
        La cola sigue siendo común. "En revisión" muestra los documentos tomados por esta persona.
      </div>
    </div>
  );
}

function CargaActualTab({ carga }: { carga: CargaItem[] }) {
  if (!carga || carga.length === 0) {
    return <p className="text-[13px] text-gray-400 text-center py-10">Este verificador no tiene documentos en revisión.</p>;
  }
  return (
    <div className="flex flex-col divide-y divide-cream3">
      {carga.map(item => (
        <div key={item.documentoKey} className="flex items-center justify-between gap-3 py-3">
          <div className="min-w-0">
            <div className="text-[13.5px] font-semibold text-navy truncate">{item.documento}</div>
            <div className="text-[11.5px] text-gray-400 truncate">{item.contratista} · {item.proyecto}</div>
          </div>
          <span className={`badge text-[11px] shrink-0 ${BADGE_CLASS.amber}`}>EN REVISIÓN</span>
        </div>
      ))}
    </div>
  );
}

function ActividadHoyTab({ aprobados, rechazados }: { aprobados: number; rechazados: number }) {
  const total = aprobados + rechazados;
  return (
    <div className="flex flex-col gap-4">
      <div className="card p-4">
        <div className="flex flex-col divide-y divide-cream3">
          <div className="flex justify-between items-center py-2.5">
            <span className="text-[13.5px] text-navy">Aprobados</span>
            <span className="text-[15px] font-bold text-emerald-700">{aprobados}</span>
          </div>
          <div className="flex justify-between items-center py-2.5">
            <span className="text-[13.5px] text-navy">Rechazados</span>
            <span className="text-[15px] font-bold text-red-700">{rechazados}</span>
          </div>
          <div className="flex justify-between items-center py-2.5">
            <span className="text-[13.5px] font-semibold text-navy">Total revisado</span>
            <span className="text-[15px] font-bold text-navy">{total}</span>
          </div>
        </div>
      </div>
      <div className="bg-gold-soft/40 border border-[#ecdcc4] rounded-lg px-3 py-2.5 text-[12px] text-[#7b5b32]">
        Sin SLA, ranking ni productividad histórica en el MVP.
      </div>
    </div>
  );
}

export default function VerificadorDetailDrawer({
  verificadorSeleccionado,
  setVerificadorSeleccionado,
  tabVerificador,
  setTabVerificador,
  verificadores,
  setVerificadores,
  claimsRevision,
  GLOBAL_CONTRATISTAS,
  GLOBAL_PROYECTOS,
}: {
  verificadorSeleccionado: any;
  setVerificadorSeleccionado: (v: any) => void;
  tabVerificador: string;
  setTabVerificador: (v: string) => void;
  verificadores: Verificador[];
  setVerificadores: (v: Verificador[]) => void;
  claimsRevision: ClaimRevision[];
  GLOBAL_CONTRATISTAS: Contratista[];
  GLOBAL_PROYECTOS: Proyecto[];
}) {
  // Siempre se re-resuelve el verificador real desde el arreglo vivo (nunca
  // se confía en la instantánea con la que se abrió el drawer), y nunca cae
  // de vuelta al primer verificador del sistema si no se encuentra.
  const verificador = verificadores.find(v => v.id === verificadorSeleccionado?.id);

  const cargaPorVerificador = useMemo(
    () => resolveCargaPorVerificador(claimsRevision, GLOBAL_CONTRATISTAS, GLOBAL_PROYECTOS),
    [claimsRevision, GLOBAL_CONTRATISTAS, GLOBAL_PROYECTOS]
  );

  if (!verificador) {
    return (
      <>
        <div className="fixed inset-0 z-[399] bg-black/20" onClick={() => setVerificadorSeleccionado(null)} />
        <div className="fixed left-1/2 top-1/2 z-[400] -translate-x-1/2 -translate-y-1/2 w-[calc(100vw-32px)] max-w-[420px] bg-white rounded-2xl border border-cream3 shadow-2xl p-6 text-center">
          <p className="text-[13.5px] text-gray-500 mb-4">No se pudo cargar la información del verificador.</p>
          <button onClick={() => setVerificadorSeleccionado(null)} className="btn btn-primary">Cerrar</button>
        </div>
      </>
    );
  }

  const carga = cargaPorVerificador.get(verificador.id) || [];
  const { aprobados, rechazados } = getActividadHoyPorVerificador(verificador.id);

  const cambiarEstado = () => {
    const nuevoEstado: Verificador['estado'] = verificador.estado === 'online' ? 'offline' : 'online';
    const nuevaLista = verificadores.map(v => v.id === verificador.id ? { ...v, estado: nuevoEstado } : v);
    saveVerificadores(nuevaLista);
    setVerificadores(nuevaLista);
  };

  const tabs: Array<{ id: Tab; label: string }> = [
    { id: 'resumen', label: 'Resumen' },
    { id: 'carga', label: 'Carga actual' },
    { id: 'actividad', label: 'Actividad de hoy' },
  ];

  return (
    <>
      <div className="fixed inset-0 z-[399] bg-black/20" onClick={() => setVerificadorSeleccionado(null)} />
      <div className="fixed left-1/2 top-1/2 z-[400] flex h-[calc(100vh-16px)] sm:h-[90vh] w-[calc(100vw-16px)] sm:w-3/4 max-w-[1000px] -translate-x-1/2 -translate-y-1/2 flex-col overflow-y-auto sm:overflow-hidden rounded-2xl border border-cream3 bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center gap-3 py-3.5 px-5 border-b border-cream3 flex-shrink-0">
          <div className="w-[38px] h-[38px] rounded-full bg-navy text-white flex items-center justify-center font-semibold text-[13px] shrink-0">
            {iniciales(verificador.nombre)}
          </div>
          <div className="min-w-0 shrink-0">
            <p className="font-semibold text-navy text-[15px] leading-tight truncate max-w-[260px]">
              {verificador.nombre}
            </p>
            <p className="text-[11.5px] text-gray-400 leading-tight">{ROL_LABEL[verificador.rol]} · {verificador.estado === 'online' ? 'Online' : 'Offline'}</p>
          </div>
          <div className="flex-1" />
          <button
            onClick={cambiarEstado}
            className="text-[12px] font-semibold text-brown hover:underline cursor-pointer border-none bg-transparent whitespace-nowrap shrink-0"
          >
            Cambiar a {verificador.estado === 'online' ? 'Offline' : 'Online'}
          </button>
          <button
            onClick={() => setVerificadorSeleccionado(null)}
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
              onClick={() => setTabVerificador(t.id)}
              className={`px-4 py-2.5 text-[13px] border-b-2 transition-colors ${tabVerificador === t.id ? "border-brown text-brown font-semibold" : "border-transparent text-gray-400 hover:text-navy"}`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5">
          {tabVerificador === 'resumen' && (
            <ResumenTab verificador={verificador} enRevision={carga.length} aprobados={aprobados} rechazados={rechazados} />
          )}
          {tabVerificador === 'carga' && (
            <CargaActualTab carga={carga} />
          )}
          {tabVerificador === 'actividad' && (
            <ActividadHoyTab aprobados={aprobados} rechazados={rechazados} />
          )}
        </div>
      </div>
    </>
  );
}
