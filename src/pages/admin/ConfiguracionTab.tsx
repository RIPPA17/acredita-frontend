import { useMemo, useState } from 'react';
import { Verificador } from '../../types';
import { getPlantillas, getVerificadorActual } from '../../data/localStorageDb';
import GeneralConfig from './configuracion/GeneralConfig';
import PlantillasConfig from './configuracion/PlantillasConfig';
import DatosDemoConfig from './configuracion/DatosDemoConfig';

type Tab = 'general' | 'plantillas' | 'datos';

const TABS: Array<{ id: Tab; label: string }> = [
  { id: 'general', label: 'General' },
  { id: 'plantillas', label: 'Plantillas base' },
  { id: 'datos', label: 'Datos demo' },
];

export default function ConfiguracionTab({
  verificadores,
  verificadorActualId,
  onSetVerificadorActual,
  showToast,
}: {
  verificadores: Verificador[];
  verificadorActualId: string | null;
  onSetVerificadorActual: (id: string) => void;
  showToast: (msg: string, type?: 'success' | 'error' | 'warning') => void;
}) {
  const [tab, setTab] = useState<Tab>('general');
  // Plantillas base: estado local a Configuración. Ningún otro módulo
  // cerrado (Proyecto → Requisitos incluido) consume hoy el catálogo de
  // plantillas de forma reactiva, así que no hace falta levantarlo a
  // Admin.tsx — evita una refactorización que no tiene consumidores reales.
  const [plantillas, setPlantillas] = useState<any[]>(() => getPlantillas());

  const currentVerificador = useMemo(
    () => getVerificadorActual(),
    [verificadores, verificadorActualId]
  );

  return (
    <div className="fade-in">
      {/* Premium Dark Brand Band Header */}
      <div className="relative overflow-hidden bg-gradient-to-br from-navy to-navy-2 px-8 py-4 pb-12 -mx-8 -mt-6">
        <div className="absolute top-[-30%] right-[-10%] w-[400px] h-[400px] rounded-full bg-[radial-gradient(circle,rgba(154,105,78,0.15),transparent_70%)] pointer-events-none" />

        <div className="max-w-[1200px] mx-auto flex flex-col md:flex-row justify-between items-start md:items-center gap-4 relative z-10">
          <div>
            <span className="text-[11px] tracking-[2px] uppercase font-semibold text-gold-hover">
              Panel de administración
            </span>
            <h2 className="text-2xl font-semibold text-white mt-1">Configuración</h2>
            <p className="text-[13.5px] text-gray-300 mt-1.5 max-w-[650px]">
              Ajustes generales del frontend MVP, plantillas reutilizables para proyectos y herramientas de datos demo para pruebas.
            </p>
          </div>
        </div>
      </div>

      {/* Main Content Area (floated up) */}
      <div className="relative z-20 -mt-8 max-w-[1200px] mx-auto px-1 flex flex-col gap-5">
        <div className="bg-white rounded-2xl border border-cream3 shadow-sm overflow-hidden flex flex-col">
          <div className="flex border-b border-cream3 px-4 overflow-x-auto">
            {TABS.map(t => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`px-4 py-3 text-[13px] border-b-2 whitespace-nowrap transition-colors ${tab === t.id ? "border-brown text-brown font-semibold" : "border-transparent text-gray-400 hover:text-navy"}`}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div className="p-5">
            {tab === 'general' && (
              <GeneralConfig
                verificadores={verificadores}
                verificadorActualId={verificadorActualId}
                onSetVerificadorActual={onSetVerificadorActual}
              />
            )}
            {tab === 'plantillas' && (
              <PlantillasConfig
                plantillas={plantillas}
                setPlantillas={setPlantillas}
                showToast={showToast}
              />
            )}
            {tab === 'datos' && (
              <DatosDemoConfig
                plantillasCount={plantillas.length}
                verificadorActualNombre={currentVerificador?.nombre || 'No disponible'}
                showToast={showToast}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
