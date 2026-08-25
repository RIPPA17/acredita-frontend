import { useState } from 'react';
import { Building2, CheckCircle, FolderPlus } from 'lucide-react';
import MandantePortal from '../pages/Mandante';
import { getMandantes, getProyectos, saveProyectos } from '../data/localStorageDb';
import { getStoredSupabaseSession } from '../data/supabaseAuth';
import { hydrateCoreDataFromSupabase, pushCoreDataToSupabase } from '../data/supabaseCoreData';
import type { Proyecto } from '../types';

function projectKey(name: string): string {
  const base = name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 42) || 'proyecto';
  return `${base}-${Date.now().toString(36)}`;
}

export default function MandanteRoute() {
  const session = getStoredSupabaseSession();
  const [refreshKey, setRefreshKey] = useState(0);
  const [nombreProyecto, setNombreProyecto] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!session || session.role !== 'mandante' || !session.mandanteId) return <MandantePortal />;

  const mandante = getMandantes().find(item => item.id === session.mandanteId);
  const projects = getProyectos().filter(item => item.mandanteId === session.mandanteId);
  void refreshKey;

  if (projects.length > 0) return <MandantePortal />;

  const crearPrimerProyecto = async (event: React.FormEvent) => {
    event.preventDefault();
    const nombre = nombreProyecto.trim();
    if (nombre.length < 3) {
      setError('Escribe un nombre de proyecto de al menos 3 caracteres.');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const proyecto: Proyecto = {
        id: projectKey(nombre),
        nombre,
        mandanteId: session.mandanteId!,
        estado: 'Activo',
        contratistas: [],
      };
      saveProyectos([...getProyectos(), proyecto]);
      await pushCoreDataToSupabase(session);
      await hydrateCoreDataFromSupabase(session);
      setRefreshKey(value => value + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No fue posible crear el proyecto.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-cream2 flex items-center justify-center p-5 text-navy">
      <div className="w-full max-w-[680px] bg-white rounded-2xl border border-cream3 shadow-xl overflow-hidden">
        <div className="bg-navy px-7 py-6 text-white">
          <div className="text-[22px] tracking-[2px] mb-5">Acre<b className="text-brown font-normal">dita</b></div>
          <div className="text-[11px] uppercase tracking-[1.6px] text-white/60 mb-2">Primera configuración</div>
          <h1 className="text-2xl font-semibold">Crea tu primer proyecto</h1>
          <p className="text-[13px] text-white/70 mt-2 max-w-[540px] leading-relaxed">Tu empresa ya está asociada a la cuenta. El primer paso operativo es crear un proyecto real; luego podrás definir requisitos e invitar contratistas desde el portal.</p>
        </div>

        <div className="p-7">
          <div className="grid sm:grid-cols-3 gap-3 mb-6">
            <Step icon={<Building2 size={18} />} title="Empresa" detail={mandante?.nombre || session.nombre || 'Mandante'} done />
            <Step icon={<FolderPlus size={18} />} title="Proyecto" detail="Crear ahora" active />
            <Step icon={<CheckCircle size={18} />} title="Operación" detail="Requisitos e invitaciones" />
          </div>

          <form onSubmit={crearPrimerProyecto} className="border border-cream3 rounded-xl p-5 bg-[#fbfaf7]">
            <label className="block text-[12.5px] font-semibold text-navy mb-1.5" htmlFor="first-project-name">Nombre del proyecto</label>
            <input
              id="first-project-name"
              value={nombreProyecto}
              onChange={event => { setNombreProyecto(event.target.value); setError(''); }}
              className="form-input w-full"
              placeholder="Ej. Ampliación Planta Norte"
              autoFocus
              required
            />
            <p className="text-[11px] text-gray-400 mt-2">El proyecto se guardará en Supabase y quedará asociado únicamente a {mandante?.nombre || 'tu empresa'}.</p>
            {error && <div role="alert" className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[12px] text-red-700">{error}</div>}
            <button type="submit" disabled={loading} className="btn btn-primary w-full justify-center mt-4 py-2.5 disabled:opacity-60">
              {loading ? 'Creando proyecto…' : 'Crear proyecto y entrar al portal'}
            </button>
          </form>

          <div className="mt-5 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2.5 text-[11.5px] text-blue-800 leading-relaxed">
            Después de crear el proyecto podrás ir a <b>Proyecto → Requisitos</b> para configurar el checklist y a <b>Contratistas</b> para enviar invitaciones reales.
          </div>
        </div>
      </div>
    </div>
  );
}

function Step({ icon, title, detail, active = false, done = false }: { icon: React.ReactNode; title: string; detail: string; active?: boolean; done?: boolean }) {
  return (
    <div className={`rounded-xl border p-3 ${active ? 'border-brown bg-gold-soft/30' : done ? 'border-emerald-200 bg-emerald-50' : 'border-cream3 bg-white'}`}>
      <div className={`mb-2 ${active ? 'text-brown' : done ? 'text-emerald-700' : 'text-gray-400'}`}>{icon}</div>
      <div className="text-[11px] uppercase tracking-wide text-gray-400">{title}</div>
      <div className="text-[12px] font-semibold text-navy mt-0.5 truncate" title={detail}>{detail}</div>
    </div>
  );
}
