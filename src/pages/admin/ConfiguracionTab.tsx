import { useState } from 'react';
import type { Verificador } from '../../types';
import { getPlantillas } from '../../data/localStorageDb';
import GeneralConfig from './configuracion/GeneralConfig';
import PlantillasConfig from './configuracion/PlantillasConfig';

type Tab = 'general' | 'plantillas';

const TABS: Array<{ id: Tab; label: string }> = [
  { id: 'general', label: 'General' },
  { id: 'plantillas', label: 'Plantillas base' },
];

export default function ConfiguracionTab({
  verificadores,
  verificadorActualId,
  showToast,
}: {
  verificadores: Verificador[];
  verificadorActualId: string | null;
  onSetVerificadorActual: (id: string) => void;
  showToast: (msg: string, type?: 'success' | 'error' | 'warning') => void;
}) {
  const [tab, setTab] = useState<Tab>('general');
  const [plantillas, setPlantillas] = useState<any[]>(() => getPlantillas());

  return (
    <div className="fade-in">
      <div className="relative overflow-hidden bg-gradient-to-br from-navy to-navy-2 px-8 py-4 pb-12 -mx-8 -mt-6">
        <div className="max-w-[1200px] mx-auto">
          <span className="text-[11px] tracking-[2px] uppercase font-semibold text-gold-hover">Panel de administración</span>
          <h2 className="text-2xl font-semibold text-white mt-1">Configuración</h2>
          <p className="text-[13.5px] text-gray-300 mt-1.5 max-w-[650px]">Parámetros operativos del producto y catálogo base para requisitos.</p>
        </div>
      </div>

      <div className="relative z-20 -mt-8 max-w-[1200px] mx-auto px-1">
        <div className="bg-white rounded-2xl border border-cream3 shadow-sm overflow-hidden">
          <div className="flex border-b border-cream3 px-4 overflow-x-auto">
            {TABS.map(item => (
              <button
                type="button"
                key={item.id}
                onClick={() => setTab(item.id)}
                className={`px-4 py-3 text-[13px] border-b-2 whitespace-nowrap ${tab === item.id ? 'border-brown text-brown font-semibold' : 'border-transparent text-gray-400 hover:text-navy'}`}
              >
                {item.label}
              </button>
            ))}
          </div>
          <div className="p-5">
            {tab === 'general' ? (
              <GeneralConfig verificadores={verificadores} verificadorActualId={verificadorActualId} onSetVerificadorActual={() => undefined} />
            ) : (
              <PlantillasConfig plantillas={plantillas} setPlantillas={setPlantillas} showToast={showToast} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
