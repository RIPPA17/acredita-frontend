import { useMemo } from 'react';
import { Verificador } from '../../../types';
import { getSupervisorActual } from '../../../data/localStorageDb';

const BADGE_CLASS: Record<string, string> = {
  green: 'bg-green-100 text-green-800',
  gray: 'bg-gray-100 text-gray-500',
  red: 'bg-red-100 text-red-800',
  blue: 'bg-blue-100 text-blue-800',
};

const ENTORNO: Array<{ label: string; help: string; value: string; color: string }> = [
  { label: 'Etapa', help: 'Versión funcional actual del producto.', value: 'Frontend MVP', color: 'blue' },
  { label: 'Persistencia', help: 'Los cambios de esta demo se guardan localmente en el navegador.', value: 'localStorage', color: 'blue' },
  { label: 'Backend', help: 'La integración con backend se realizará después de cerrar el frontend.', value: 'No conectado', color: 'gray' },
  { label: 'Estado del entorno', help: 'El frontend está listo para pruebas funcionales del MVP.', value: 'Operativo', color: 'green' },
];

export default function GeneralConfig({
  verificadores,
  verificadorActualId,
  onSetVerificadorActual,
}: {
  verificadores: Verificador[];
  verificadorActualId: string | null;
  onSetVerificadorActual: (id: string) => void;
}) {
  const verificadoresDisponibles = verificadores.filter(v => v.rol === 'verificador' && v.activo);
  // Mismo helper central que usa la Cola de revisión para escalamientos —
  // ninguna lógica paralela de selección de supervisor.
  const supervisor = useMemo(() => getSupervisorActual(), [verificadores]);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <div className="text-[15px] font-bold text-navy">General</div>
        <div className="text-[11.5px] text-gray-400 mt-0.5">Ajustes globales mínimos necesarios para operar el frontend MVP.</div>
      </div>

      <div className="border border-cream3 rounded-xl bg-white overflow-hidden">
        <div className="px-4 py-3 border-b border-cream3">
          <div className="text-[13px] font-bold text-navy">Operación del equipo</div>
          <div className="text-[11px] text-gray-400 mt-0.5">Identidad operativa usada por Cola de revisión.</div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-[1.2fr_1fr] gap-3 sm:gap-5 items-center px-4 py-3.5 border-b border-cream2">
          <div>
            <div className="text-[12.5px] font-semibold text-navy">Verificador operativo actual</div>
            <div className="text-[11px] text-gray-400 mt-0.5 leading-relaxed">Es la persona que toma nuevas revisiones y firma las decisiones en esta sesión demo.</div>
          </div>
          <select
            value={verificadorActualId || ''}
            onChange={e => onSetVerificadorActual(e.target.value)}
            className="form-input w-full p-2.5 border border-cream3 rounded-lg focus:border-brown focus:ring-1 focus:ring-brown outline-none transition-all"
          >
            {verificadoresDisponibles.length === 0 && <option value="">Sin verificadores disponibles</option>}
            {verificadoresDisponibles.map(v => (
              <option key={v.id} value={v.id}>{v.nombre} · {v.estado === 'online' ? 'Online' : 'Offline'}</option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-[1.2fr_1fr] gap-3 sm:gap-5 items-center px-4 py-3.5">
          <div>
            <div className="text-[12.5px] font-semibold text-navy">Supervisor disponible</div>
            <div className="text-[11px] text-gray-400 mt-0.5 leading-relaxed">Se resuelve automáticamente desde Verificadores; no se configura manualmente aquí.</div>
          </div>
          <div>
            {supervisor ? (
              <span className={`badge text-[11px] ${BADGE_CLASS[supervisor.estado === 'online' ? 'green' : 'gray']}`}>
                {supervisor.nombre} · {supervisor.estado === 'online' ? 'Online' : 'Offline'}
              </span>
            ) : (
              <span className={`badge text-[11px] ${BADGE_CLASS.red}`}>Supervisor no disponible</span>
            )}
          </div>
        </div>
      </div>

      <div className="border border-cream3 rounded-xl bg-white overflow-hidden">
        <div className="px-4 py-3 border-b border-cream3">
          <div className="text-[13px] font-bold text-navy">Entorno del producto</div>
          <div className="text-[11px] text-gray-400 mt-0.5">Estado técnico visible de esta etapa del proyecto.</div>
        </div>
        {ENTORNO.map((row, i) => (
          <div
            key={row.label}
            className={`grid grid-cols-1 sm:grid-cols-[1.2fr_1fr] gap-3 sm:gap-5 items-center px-4 py-3.5 ${i < ENTORNO.length - 1 ? 'border-b border-cream2' : ''}`}
          >
            <div>
              <div className="text-[12.5px] font-semibold text-navy">{row.label}</div>
              <div className="text-[11px] text-gray-400 mt-0.5 leading-relaxed">{row.help}</div>
            </div>
            <div><span className={`badge text-[11px] ${BADGE_CLASS[row.color]}`}>{row.value}</span></div>
          </div>
        ))}
      </div>

      <div className="bg-gold-soft/40 border border-[#ecdcc4] rounded-lg px-3 py-2.5 text-[12px] text-[#7b5b32] leading-relaxed">
        <b>Importante:</b> vigencia, alertas, obligatoriedad y criticidad no se configuran globalmente aquí. Estos atributos pertenecen al requisito específico en <b>Proyecto → Requisitos</b>.
      </div>
    </div>
  );
}
