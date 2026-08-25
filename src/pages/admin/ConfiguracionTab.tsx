import { useEffect, useState } from 'react';
import type { PlantillaBase, Verificador } from '../../types';
import { loadDocumentTemplates } from '../../data/supabaseTemplates';
import GeneralConfig from './configuracion/GeneralConfig';
import PlantillasSupabaseConfig from './configuracion/PlantillasSupabaseConfig';

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
  const [plantillas, setPlantillas] = useState<PlantillaBase[]>([]);
  const [loadingPlantillas, setLoadingPlantillas] = useState(true);
  const [plantillasError, setPlantillasError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoadingPlantillas(true);
      setPlantillasError(null);
      try {
        const rows = await loadDocumentTemplates();
        if (active) setPlantillas(rows);
      } catch (error) {
        if (active) setPlantillasError(error instanceof Error ? error.message : 'No fue posible cargar las plantillas.');
      } finally {
        if (active) setLoadingPlantillas(false);
      }
    };
    void load();
    return () => { active = false; };
  }, []);

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
            ) : loadingPlantillas ? (
              <div className="py-14 text-center text-[13px] text-gray-400">Cargando plantillas desde Supabase…</div>
            ) : plantillasError ? (
              <div className="py-14 text-center">
                <p className="text-[13px] text-red-700 font-semibold">No fue posible cargar las plantillas.</p>
                <p className="text-[11.5px] text-gray-400 mt-1">{plantillasError}</p>
              </div>
            ) : (
              <PlantillasSupabaseConfig plantillas={plantillas} setPlantillas={setPlantillas} showToast={showToast} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
