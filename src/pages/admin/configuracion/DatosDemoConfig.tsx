import { useState } from 'react';
import { X } from 'lucide-react';
import { resetDemoData, limpiarDatosLocales } from '../../../data/localStorageDb';

type Accion = 'reset' | 'clear';

export default function DatosDemoConfig({
  plantillasCount,
  verificadorActualNombre,
  showToast,
}: {
  plantillasCount: number;
  verificadorActualNombre: string;
  showToast: (msg: string, type?: 'success' | 'error' | 'warning') => void;
}) {
  const [confirmando, setConfirmando] = useState<Accion | null>(null);

  const ejecutar = (accion: Accion) => {
    if (accion === 'reset') {
      resetDemoData();
      showToast('Datos demo restablecidos');
    } else {
      limpiarDatosLocales();
      showToast('Datos locales eliminados');
    }
    setConfirmando(null);
    // Acción destructiva de desarrollo: recargar es la forma más simple y
    // confiable de que toda la app (no solo Configuración) refleje el
    // estado recién sembrado/vaciado, sin tener que resincronizar a mano
    // cada estado reactivo de Admin.tsx.
    setTimeout(() => window.location.reload(), 500);
  };

  return (
    <div className="flex flex-col gap-4">
      <div>
        <div className="text-[15px] font-bold text-navy">Datos demo</div>
        <div className="text-[11.5px] text-gray-400 mt-0.5 max-w-[600px] leading-relaxed">
          Herramientas exclusivas de desarrollo para volver rápidamente a un estado conocido durante las pruebas del frontend.
        </div>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg px-3 py-2.5 text-[12px] text-blue-800 leading-relaxed">
        Estas acciones afectan únicamente los datos locales del navegador. No existe backend conectado en esta etapa.
      </div>

      <div className="border border-cream3 rounded-xl bg-white overflow-hidden">
        <div className="px-4 py-3 border-b border-cream3">
          <div className="text-[13px] font-bold text-navy">Estado local</div>
          <div className="text-[11px] text-gray-400 mt-0.5">Resumen de la información guardada actualmente.</div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-[1.2fr_1fr] gap-3 sm:gap-5 items-center px-4 py-3.5 border-b border-cream2">
          <div>
            <div className="text-[12.5px] font-semibold text-navy">Persistencia activa</div>
            <div className="text-[11px] text-gray-400 mt-0.5">Datos del MVP guardados en el navegador.</div>
          </div>
          <div><span className="badge text-[11px] bg-green-100 text-green-800">localStorage disponible</span></div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-[1.2fr_1fr] gap-3 sm:gap-5 items-center px-4 py-3.5 border-b border-cream2">
          <div>
            <div className="text-[12.5px] font-semibold text-navy">Plantillas base</div>
            <div className="text-[11px] text-gray-400 mt-0.5">Catálogo disponible para crear requisitos.</div>
          </div>
          <div className="text-[13px] text-navy"><b>{plantillasCount}</b> registradas</div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-[1.2fr_1fr] gap-3 sm:gap-5 items-center px-4 py-3.5">
          <div>
            <div className="text-[12.5px] font-semibold text-navy">Verificador operativo</div>
            <div className="text-[11px] text-gray-400 mt-0.5">Identidad actual utilizada por Cola.</div>
          </div>
          <div className="text-[13px] font-semibold text-navy">{verificadorActualNombre}</div>
        </div>
      </div>

      <div className="border border-red-200 rounded-xl bg-red-50/30 overflow-hidden">
        <div className="px-4 py-3 border-b border-red-200/70">
          <div className="text-[13px] font-bold text-red-900">Herramientas de prueba</div>
          <div className="text-[11px] text-red-800/70 mt-0.5">Acciones destructivas para desarrollo. Siempre requieren confirmación.</div>
        </div>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 py-3.5 border-b border-red-200/50">
          <div>
            <div className="text-[12.5px] font-bold text-red-900">Restablecer datos demo</div>
            <div className="text-[11px] text-red-800/70 mt-0.5 leading-relaxed">Vuelve a cargar los datos iniciales del MVP y elimina los cambios realizados durante las pruebas.</div>
          </div>
          <button
            onClick={() => setConfirmando('reset')}
            className="px-3.5 py-2 rounded-lg border border-red-300 bg-white text-red-700 text-[12.5px] font-semibold cursor-pointer hover:bg-red-50 transition-all shrink-0"
          >
            Restablecer datos demo
          </button>
        </div>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 py-3.5">
          <div>
            <div className="text-[12.5px] font-bold text-red-900">Limpiar datos locales</div>
            <div className="text-[11px] text-red-800/70 mt-0.5 leading-relaxed">Elimina los datos de Acredita guardados en este navegador.</div>
          </div>
          <button
            onClick={() => setConfirmando('clear')}
            className="px-3.5 py-2 rounded-lg bg-red-700 text-white text-[12.5px] font-semibold cursor-pointer hover:bg-red-800 transition-all shrink-0 border-none"
          >
            Limpiar datos locales
          </button>
        </div>
      </div>

      <div className="bg-gold-soft/40 border border-[#ecdcc4] rounded-lg px-3 py-2.5 text-[12px] text-[#7b5b32] leading-relaxed">
        Estas herramientas son exclusivas del frontend MVP y deberán retirarse cuando exista backend real.
      </div>

      {confirmando && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-[440px] max-h-[calc(100vh-24px)] overflow-y-auto">
            <div className="flex justify-between items-center p-4 border-b border-cream">
              <h3 className="font-medium text-navy text-[17.6px]">
                {confirmando === 'reset' ? '¿Restablecer datos demo?' : '¿Limpiar datos locales?'}
              </h3>
              <button onClick={() => setConfirmando(null)} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>
            <div className="p-6">
              <p className="text-[13px] text-gray-600 leading-relaxed mb-4">
                {confirmando === 'reset'
                  ? 'Se perderán los cambios realizados en este navegador y se volverá al estado inicial del MVP.'
                  : 'Se eliminarán los datos del frontend MVP guardados en este navegador.'}
              </p>
              <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2.5 text-[12px] text-red-800 font-medium mb-2">
                Esta acción no se puede deshacer desde la interfaz.
              </div>
              <div className="flex justify-end gap-3 mt-4 pt-4 border-t border-cream">
                <button type="button" onClick={() => setConfirmando(null)} className="btn btn-ghost font-medium">
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={() => ejecutar(confirmando)}
                  className="px-4 py-2 rounded-lg bg-red-700 text-white text-[13px] font-semibold cursor-pointer hover:bg-red-800 transition-all border-none"
                >
                  {confirmando === 'reset' ? 'Restablecer' : 'Limpiar datos'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
