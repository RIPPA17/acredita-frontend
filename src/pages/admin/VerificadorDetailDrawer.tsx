import { useMemo } from 'react';
import { XCircle } from 'lucide-react';
import type { ClaimRevision, Contratista, Proyecto, Verificador } from '../../types';
import { getActividadHoyPorVerificador } from '../../data/localStorageDb';
import { resolveCargaPorVerificador } from './verificadorUtils';

type Tab = 'resumen' | 'carga' | 'actividad';

const iniciales = (nombre: string) =>
  nombre.split(' ').filter(Boolean).map(item => item[0]).join('').slice(0, 2).toUpperCase();

export default function VerificadorDetailDrawer({
  verificadorSeleccionado,
  setVerificadorSeleccionado,
  tabVerificador,
  setTabVerificador,
  verificadores,
  claimsRevision,
  GLOBAL_CONTRATISTAS,
  GLOBAL_PROYECTOS,
}: {
  verificadorSeleccionado: any;
  setVerificadorSeleccionado: (value: any) => void;
  tabVerificador: string;
  setTabVerificador: (value: string) => void;
  verificadores: Verificador[];
  setVerificadores: (value: Verificador[]) => void;
  claimsRevision: ClaimRevision[];
  GLOBAL_CONTRATISTAS: Contratista[];
  GLOBAL_PROYECTOS: Proyecto[];
}) {
  const verificador = verificadores.find(item => item.id === verificadorSeleccionado?.id);
  const cargaPorVerificador = useMemo(
    () => resolveCargaPorVerificador(claimsRevision, GLOBAL_CONTRATISTAS, GLOBAL_PROYECTOS),
    [claimsRevision, GLOBAL_CONTRATISTAS, GLOBAL_PROYECTOS],
  );

  if (!verificador) return null;

  const carga = cargaPorVerificador.get(verificador.id) || [];
  const actividad = getActividadHoyPorVerificador(verificador.id);
  const total = actividad.aprobados + actividad.rechazados;
  const tabs: Array<{ id: Tab; label: string }> = [
    { id: 'resumen', label: 'Resumen' },
    { id: 'carga', label: 'Carga actual' },
    { id: 'actividad', label: 'Actividad de hoy' },
  ];

  return (
    <>
      <div className="fixed inset-0 z-[399] bg-black/20" onClick={() => setVerificadorSeleccionado(null)} />
      <div className="fixed left-1/2 top-1/2 z-[400] flex h-[calc(100vh-20px)] sm:h-[88vh] w-[calc(100vw-20px)] sm:w-3/4 max-w-[900px] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-2xl border border-cream3 bg-white shadow-2xl">
        <div className="flex items-center gap-3 px-5 py-4 border-b border-cream3">
          <div className="w-10 h-10 rounded-full bg-navy text-white flex items-center justify-center text-[12px] font-bold">{iniciales(verificador.nombre)}</div>
          <div>
            <div className="text-[15px] font-semibold text-navy">{verificador.nombre}</div>
            <div className="text-[11px] text-gray-400">{verificador.rol === 'supervisor' ? 'Supervisor' : 'Verificador'} · {verificador.activo ? 'Cuenta activa' : 'Cuenta inactiva'}</div>
          </div>
          <div className="flex-1" />
          <button type="button" onClick={() => setVerificadorSeleccionado(null)} className="text-gray-400 hover:text-navy"><XCircle size={20} /></button>
        </div>

        <div className="flex border-b border-cream3 px-4">
          {tabs.map(tab => (
            <button
              type="button"
              key={tab.id}
              onClick={() => setTabVerificador(tab.id)}
              className={`px-4 py-2.5 text-[12.5px] border-b-2 ${tabVerificador === tab.id ? 'border-brown text-brown font-semibold' : 'border-transparent text-gray-400'}`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {tabVerificador === 'resumen' && (
            <div className="flex flex-col gap-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <Metric label="En revisión" value={carga.length} />
                <Metric label="Revisados hoy" value={total} />
                <Metric label="Aprobados" value={actividad.aprobados} tone="green" />
                <Metric label="Rechazados" value={actividad.rechazados} tone="red" />
              </div>
              <div className="border border-cream3 rounded-xl overflow-hidden">
                <InfoRow label="Rol" value={verificador.rol === 'supervisor' ? 'Supervisor' : 'Verificador'} />
                <InfoRow label="Cuenta" value={verificador.activo ? 'Activa' : 'Inactiva'} />
                <InfoRow label="Identidad" value={verificador.email || 'Cuenta interna Acredita'} last />
              </div>
              <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-[11.5px] text-blue-800">
                La carga y las decisiones provienen de Supabase. Esta pantalla ya no modifica estados locales del equipo.
              </div>
            </div>
          )}

          {tabVerificador === 'carga' && (
            <div className="flex flex-col divide-y divide-cream3">
              {carga.map(item => (
                <div key={item.documentoKey} className="py-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-[13px] font-semibold text-navy truncate">{item.documento}</div>
                    <div className="text-[11px] text-gray-400 truncate">{item.contratista} · {item.proyecto}</div>
                  </div>
                  <span className="badge bg-blue-50 text-blue-700 shrink-0">EN REVISIÓN</span>
                </div>
              ))}
              {carga.length === 0 && <div className="py-10 text-center text-[12px] text-gray-400">No tiene documentos tomados actualmente.</div>}
            </div>
          )}

          {tabVerificador === 'actividad' && (
            <div className="border border-cream3 rounded-xl overflow-hidden">
              <InfoRow label="Aprobados" value={String(actividad.aprobados)} />
              <InfoRow label="Rechazados" value={String(actividad.rechazados)} />
              <InfoRow label="Total revisado hoy" value={String(total)} last />
            </div>
          )}
        </div>
      </div>
    </>
  );
}

function Metric({ label, value, tone }: { label: string; value: number; tone?: 'green' | 'red' }) {
  const valueClass = tone === 'green' ? 'text-emerald-700' : tone === 'red' ? 'text-red-700' : 'text-navy';
  return (
    <div className="border border-cream3 rounded-xl p-4 text-center bg-white">
      <div className={`text-[20px] font-bold ${valueClass}`}>{value}</div>
      <div className="text-[10px] uppercase tracking-wide text-gray-400 mt-1">{label}</div>
    </div>
  );
}

function InfoRow({ label, value, last = false }: { label: string; value: string; last?: boolean }) {
  return (
    <div className={`px-4 py-3 flex justify-between gap-4 ${last ? '' : 'border-b border-cream3'}`}>
      <span className="text-[12.5px] font-semibold text-navy">{label}</span>
      <span className="text-[12px] text-gray-500 text-right">{value}</span>
    </div>
  );
}
