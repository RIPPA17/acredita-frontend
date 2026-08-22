import { useState } from 'react';
import { Plus, Sparkles, XCircle, FileText, Search, Eye, RefreshCcw, AlertTriangle } from 'lucide-react';
import { Contratista, Proyecto } from '../../types';

const CATEGORIA_COLOR: Record<string, string> = {
  Laboral: 'border-blue-200 bg-blue-50 text-blue-700',
  Tributario: 'border-purple-200 bg-purple-50 text-purple-700',
  Prevención: 'border-emerald-200 bg-emerald-50 text-emerald-700',
};

const PILLS = ['Todas', 'Activas', 'Inactivas', 'Servicio Acredita'];

// Illustrative doc-request metadata paired with real contratistas below —
// there's no "solicitud" concept in the data model yet, this previews the
// feature using companies and projects that already exist in the system.
const SOLICITUD_DEMO_META = [
  { docs: 8, hace: 'Hoy 11:42', prioridad: 'alta' as const },
  { docs: 5, hace: 'Hoy 10:18', prioridad: 'alta' as const },
  { docs: 3, hace: 'Ayer 17:26', prioridad: 'media' as const },
];

function prevVersionLabel(version: string, stepsBack: number): string {
  const match = version.replace('v', '').split('.').map(Number);
  const major = match[0] ?? 1;
  const minor = match[1] ?? 0;
  const total = Math.max(0, major * 10 + minor - stepsBack);
  return `v${Math.max(1, Math.floor(total / 10))}.${total % 10}`;
}

export default function PlantillasTab({
  PLANTILLAS,
  activeFilterPlantillas,
  setActiveFilterPlantillas,
  busquedaPlantilla,
  setBusquedaPlantilla,
  showSubirPlantillaModal,
  setShowSubirPlantillaModal,
  newTemplateName,
  setNewTemplateName,
  newTemplateCategory,
  setNewTemplateCategory,
  newTemplateTipo,
  setNewTemplateTipo,
  handleAddTemplate,
  GLOBAL_CONTRATISTAS,
  GLOBAL_PROYECTOS,
  showToast,
}: {
  PLANTILLAS: any[];
  activeFilterPlantillas: string;
  setActiveFilterPlantillas: (v: string) => void;
  busquedaPlantilla: string;
  setBusquedaPlantilla: (v: string) => void;
  showSubirPlantillaModal: boolean;
  setShowSubirPlantillaModal: (v: boolean) => void;
  newTemplateName: string;
  setNewTemplateName: (v: string) => void;
  newTemplateCategory: string;
  setNewTemplateCategory: (v: string) => void;
  newTemplateTipo: string;
  setNewTemplateTipo: (v: string) => void;
  handleAddTemplate: () => void;
  GLOBAL_CONTRATISTAS: Contratista[];
  GLOBAL_PROYECTOS: Proyecto[];
  showToast: (msg: string, type?: 'success' | 'error' | 'warning') => void;
}) {
  const [categoriaFiltro, setCategoriaFiltro] = useState('Todas');
  const [plantillaSeleccionada, setPlantillaSeleccionada] = useState<any>(null);
  const [showUpdateModal, setShowUpdateModal] = useState(false);

  const categorias = Array.from(new Set(PLANTILLAS.map(p => p.categoria)));

  const plantillasFiltradas = PLANTILLAS
    .filter(p => {
      if (activeFilterPlantillas === 'Activas') return p.estado === 'Activa';
      if (activeFilterPlantillas === 'Inactivas') return p.estado !== 'Activa';
      if (activeFilterPlantillas === 'Servicio Acredita') return p.modalidad !== 'Plantilla gratuita';
      return true;
    })
    .filter(p => categoriaFiltro === 'Todas' || p.categoria === categoriaFiltro)
    .filter(p => p.nombre.toLowerCase().includes(busquedaPlantilla.toLowerCase()));

  // Metrics
  const plantillasActivas = PLANTILLAS.filter(p => p.estado === 'Activa').length;
  const descargasEsteMes = PLANTILLAS.reduce((acc, p) => acc + (p.descargasMes || 0), 0);
  const servicioAcreditaCount = PLANTILLAS.filter(p => p.modalidad !== 'Plantilla gratuita').length;
  const porActualizar = PLANTILLAS.filter(p => p.porActualizar);

  const alertItems: Array<{ color: string; title: string; sub: string }> = [];
  if (porActualizar.length > 0) {
    alertItems.push({
      color: '#a32d2d',
      title: `${porActualizar.length} plantilla${porActualizar.length === 1 ? '' : 's'} necesita${porActualizar.length === 1 ? '' : 'n'} actualización`,
      sub: porActualizar.map((p: any) => p.nombre).join(' · '),
    });
  }
  if (servicioAcreditaCount > 0) {
    alertItems.push({
      color: '#1e7a3c',
      title: `${servicioAcreditaCount} plantilla${servicioAcreditaCount === 1 ? '' : 's'} ofrece${servicioAcreditaCount === 1 ? '' : 'n'} Servicio Acredita`,
      sub: 'Configuradas para derivar a solicitud de documentación.',
    });
  }

  const solicitudes = GLOBAL_CONTRATISTAS.slice(0, 3).map((c, i) => {
    const proyecto = GLOBAL_PROYECTOS.find(p => c.proyectos?.includes(p.id));
    const meta = SOLICITUD_DEMO_META[i % SOLICITUD_DEMO_META.length];
    return { ...meta, empresa: c.nombre, proyecto: proyecto?.nombre || '—' };
  });

  return (
    <div className="fade-in relative">
      {/* Premium Dark Brand Band Header */}
      <div className="relative overflow-hidden bg-gradient-to-br from-navy to-navy-2 px-8 py-4 pb-12 -mx-8 -mt-6">
        <div className="absolute top-[-30%] right-[-10%] w-[400px] h-[400px] rounded-full bg-[radial-gradient(circle,rgba(154,105,78,0.15),transparent_70%)] pointer-events-none" />

        <div className="max-w-[1200px] mx-auto flex flex-col md:flex-row justify-between items-start md:items-center gap-4 relative z-10">
          <div>
            <span className="text-[11px] tracking-[2px] uppercase font-semibold text-gold-hover">
              Administración · Documentación
            </span>
            <h2 className="text-2xl font-semibold text-white mt-1">Gestión de plantillas</h2>
            <p className="text-[13.5px] text-gray-300 mt-1.5 max-w-[550px]">
              Administra los modelos de documentos y la oferta de Servicio Acredita que se publica para los contratistas.
            </p>
          </div>

          <div className="flex gap-2.5 shrink-0">
            <button className="px-4.5 py-2.5 rounded-xl border border-white/20 bg-white/5 text-gray-100 hover:bg-white/10 text-[13.5px] font-semibold flex items-center gap-2 cursor-pointer transition-all">
              Exportar datos
            </button>
            <button
              onClick={() => setShowSubirPlantillaModal(true)}
              className="px-4.5 py-2.5 rounded-xl bg-gradient-to-r from-gold-hover to-gold text-white hover:brightness-105 text-[13.5px] font-semibold flex items-center gap-2 cursor-pointer transition-all shadow-[0_6px_16px_rgba(179,137,63,0.35)] border-none"
            >
              <Plus size={15} />
              Nueva plantilla
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Area (floated up) */}
      <div className="relative z-20 -mt-8 max-w-[1200px] mx-auto px-1 flex flex-col gap-5">

        {/* Metric Cards Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-2xl p-4.5 shadow-[0_14px_30px_rgba(20,25,30,0.08)] border border-cream3 flex flex-col gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-cream text-navy flex items-center justify-center shrink-0">
              <FileText size={16} />
            </div>
            <div>
              <div className="text-2xl font-bold text-navy tracking-tight">{plantillasActivas}</div>
              <div className="text-[12px] text-gray-500 font-medium mt-0.5">Plantillas activas</div>
              <div className="text-[10.5px] text-gray-400 mt-0.5">Disponibles para contratistas</div>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-4.5 shadow-[0_14px_30px_rgba(20,25,30,0.08)] border border-cream3 flex flex-col gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0">
              <RefreshCcw size={16} />
            </div>
            <div>
              <div className="text-2xl font-bold text-navy tracking-tight">{descargasEsteMes}</div>
              <div className="text-[12px] text-gray-500 font-medium mt-0.5">Descargas este mes</div>
              <div className="text-[10.5px] text-gray-400 mt-0.5">Suma de todas las plantillas</div>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-4.5 shadow-[0_14px_30px_rgba(20,25,30,0.08)] border border-cream3 flex flex-col gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#f0e4da] text-[#7a5038] flex items-center justify-center shrink-0">
              <Sparkles size={16} />
            </div>
            <div>
              <div className="text-2xl font-bold text-navy tracking-tight">{servicioAcreditaCount}</div>
              <div className="text-[12px] text-gray-500 font-medium mt-0.5">Servicio Acredita</div>
              <div className="text-[10.5px] text-gray-400 mt-0.5">Asociadas a documentación por encargo</div>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-4.5 shadow-[0_14px_30px_rgba(20,25,30,0.08)] border border-cream3 flex flex-col gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center shrink-0">
              <AlertTriangle size={16} />
            </div>
            <div>
              <div className="text-2xl font-bold text-navy tracking-tight">{porActualizar.length}</div>
              <div className="text-[12px] text-gray-500 font-medium mt-0.5">Por actualizar</div>
              <div className="text-[10.5px] text-gray-400 mt-0.5">Requieren revisión del modelo</div>
            </div>
          </div>
        </div>

        {/* Attention + Requests row */}
        <div className="grid grid-cols-1 md:grid-cols-[1fr_1.3fr] gap-4">

          <section className="bg-white rounded-2xl border border-cream3 shadow-sm overflow-hidden flex flex-col">
            <div className="p-4 border-b border-cream3 flex justify-between items-start gap-3">
              <div>
                <div className="text-[14px] font-bold text-navy">Atención del catálogo</div>
                <div className="text-[11px] text-gray-500 mt-0.5">Elementos que conviene revisar antes de publicar cambios.</div>
              </div>
              {alertItems.length > 0 && (
                <span className="badge border border-brown/30 bg-[#f0e4da] text-[#7a5038] font-semibold shrink-0 whitespace-nowrap">
                  {alertItems.length} {alertItems.length === 1 ? 'pendiente' : 'pendientes'}
                </span>
              )}
            </div>
            <div className="p-2 flex flex-col flex-1">
              {alertItems.length > 0 ? alertItems.map((item, i) => (
                <div key={i} className="flex items-center gap-2.5 px-3 py-2.5 border-b border-cream2 last:border-b-0">
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ background: item.color }} />
                  <div className="flex-1 min-w-0">
                    <div className="text-[12px] font-semibold text-navy truncate">{item.title}</div>
                    <div className="text-[10.5px] text-gray-500 truncate">{item.sub}</div>
                  </div>
                </div>
              )) : (
                <p className="text-[12.5px] text-gray-400 text-center py-8">El catálogo está al día.</p>
              )}
            </div>
          </section>

          <section className="bg-white rounded-2xl border border-cream3 shadow-sm overflow-hidden flex flex-col">
            <div className="p-4 border-b border-cream3 flex justify-between items-start gap-3">
              <div>
                <div className="text-[14px] font-bold text-navy">Solicitudes de documentación</div>
                <div className="text-[11px] text-gray-500 mt-0.5">Contratistas que piden que Acredita prepare su documentación vía Servicio Acredita.</div>
              </div>
              <span className="badge border border-cream3 bg-cream2 text-navy font-semibold shrink-0 whitespace-nowrap">
                {solicitudes.length} pendientes
              </span>
            </div>
            <div className="p-2 flex flex-col">
              {solicitudes.map((s, i) => (
                <div key={i} className="flex items-center gap-2.5 px-3 py-2.5 border-b border-cream2 last:border-b-0">
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ background: s.prioridad === 'alta' ? '#a32d2d' : '#b58600' }} />
                  <div className="flex-1 min-w-0">
                    <div className="text-[12px] font-semibold text-navy truncate">{s.empresa}</div>
                    <div className="text-[10.5px] text-gray-500 truncate">Solicita {s.docs} documentos · {s.proyecto} · {s.hace}</div>
                  </div>
                  <button
                    onClick={() => showToast(`Cotización de ${s.empresa}: función disponible próximamente`, 'warning')}
                    className="text-[10.5px] font-bold text-brown shrink-0 cursor-pointer bg-transparent border-none whitespace-nowrap"
                  >
                    Ver cotización →
                  </button>
                </div>
              ))}
            </div>
            <div className="px-4 py-3 border-t border-cream3 flex items-center justify-between gap-3 flex-wrap">
              <span className="text-[10.5px] text-gray-500">También puedes responder, cotizar y cambiar el estado de cada solicitud.</span>
              <button
                onClick={() => showToast('Bandeja de solicitudes disponible próximamente', 'warning')}
                className="btn btn-ghost btn-sm whitespace-nowrap"
              >
                Ver todas las solicitudes
              </button>
            </div>
          </section>
        </div>

        {/* Toolbar & Table Panel */}
        <div className="bg-white rounded-2xl border border-cream3 shadow-sm overflow-hidden flex flex-col">
          <div className="p-4 border-b border-cream3 flex flex-wrap items-center justify-between gap-3">
            <div className="flex bg-[#f1efe6] border border-cream3 rounded-xl p-1 gap-1 flex-wrap">
              {PILLS.map(f => (
                <button
                  key={f}
                  onClick={() => setActiveFilterPlantillas(f)}
                  className={`px-3.5 py-1.5 rounded-lg text-[12.5px] font-semibold transition-all cursor-pointer border-none whitespace-nowrap ${
                    activeFilterPlantillas === f
                      ? 'bg-white text-navy shadow-sm'
                      : 'text-gray-500 hover:text-navy hover:bg-white/40'
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2 flex-wrap flex-1 justify-end max-w-full">
              <div className="relative min-w-[200px] flex-1 max-w-[320px]">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                <input
                  type="text"
                  value={busquedaPlantilla}
                  onChange={e => setBusquedaPlantilla(e.target.value)}
                  placeholder="Buscar por nombre o categoría..."
                  className="form-input w-full pl-9 py-2 text-[13px] bg-[#f1efe6] border-cream3 focus:bg-white transition-all rounded-xl"
                />
              </div>
              <select
                value={categoriaFiltro}
                onChange={e => setCategoriaFiltro(e.target.value)}
                className="form-input py-2 text-[13px] min-w-[170px] bg-[#f1efe6] border-cream3 rounded-xl cursor-pointer"
              >
                <option value="Todas">Todas las categorías</option>
                {categorias.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-cream3">
                  <th className="px-4 py-3.5 text-[10.5px] uppercase font-bold tracking-wider text-gray-500 bg-cream2">Plantilla</th>
                  <th className="px-4 py-3.5 text-[10.5px] uppercase font-bold tracking-wider text-gray-500 bg-cream2">Categoría</th>
                  <th className="px-4 py-3.5 text-[10.5px] uppercase font-bold tracking-wider text-gray-500 bg-cream2">Modalidad</th>
                  <th className="px-4 py-3.5 text-[10.5px] uppercase font-bold tracking-wider text-gray-500 bg-cream2">Versión</th>
                  <th className="px-4 py-3.5 text-[10.5px] uppercase font-bold tracking-wider text-gray-500 bg-cream2">Estado</th>
                  <th className="px-4 py-3.5 text-[10.5px] uppercase font-bold tracking-wider text-gray-500 bg-cream2">Actualización</th>
                  <th className="px-4 py-3.5 text-[10.5px] uppercase font-bold tracking-wider text-gray-500 bg-cream2">Descargas</th>
                  <th className="px-4 py-3.5 text-[10.5px] uppercase font-bold tracking-wider text-gray-500 bg-cream2 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {plantillasFiltradas.length > 0 ? plantillasFiltradas.map((p: any) => (
                  <tr key={p.id} className="hover:bg-[#fbfaf6] transition-colors">
                    <td className="px-4 py-3 max-w-[260px]">
                      <div className="text-[13.5px] font-semibold text-navy flex items-center gap-1.5">
                        {p.nombre}
                        {p.modalidad !== 'Plantilla gratuita' && <Sparkles size={13} className="text-brown shrink-0" />}
                      </div>
                      <div className="text-[11px] text-gray-400 mt-0.5 truncate">{p.descripcion}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`badge border ${CATEGORIA_COLOR[p.categoria] || 'border-cream3 bg-cream2 text-gray-600'}`}>
                        {p.categoria}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`badge border ${p.modalidad === 'Plantilla gratuita' ? 'border-cream3 bg-cream2 text-gray-600' : 'border-brown/30 bg-[#f0e4da] text-[#7a5038]'}`}>
                        {p.modalidad}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-[12.5px] font-semibold text-navy whitespace-nowrap">{p.version}</td>
                    <td className="px-4 py-3">
                      <span className={`badge border ${p.estado === 'Activa' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-cream3 bg-cream2 text-gray-500'}`}>
                        {p.estado}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-[12px] text-gray-500 whitespace-nowrap">{p.actualizacion}</td>
                    <td className="px-4 py-3 text-[12.5px] text-gray-600 whitespace-nowrap">
                      <b className="text-navy">{p.descargasMes}</b> <span className="text-gray-400">({p.descargasTotal} total)</span>
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => { setPlantillaSeleccionada(p); setShowUpdateModal(false); }}
                          title="Gestionar"
                          className="w-8 h-8 rounded-lg border border-cream3 bg-white text-navy flex items-center justify-center cursor-pointer hover:bg-navy hover:text-white transition-all shrink-0"
                        >
                          <Eye size={14} />
                        </button>
                        <button
                          onClick={() => { setPlantillaSeleccionada(p); setShowUpdateModal(true); }}
                          title="Actualizar versión"
                          className="w-8 h-8 rounded-lg bg-gold-soft border border-gold-soft text-gold flex items-center justify-center cursor-pointer hover:bg-gold hover:text-white transition-all shrink-0"
                        >
                          <RefreshCcw size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={8} className="py-10 text-center text-[13px] text-gray-400">
                      No se encontraron plantillas.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="text-[12px] text-gray-400 px-4 py-3.5 border-t border-cream2 font-medium">
            Mostrando {plantillasFiltradas.length} de {PLANTILLAS.length} plantillas
          </div>
        </div>

      </div>

      {/* Gestionar plantilla — detail modal */}
      {plantillaSeleccionada && !showUpdateModal && (
        <>
          <div className="fixed inset-0 z-[399] bg-black/20" onClick={() => setPlantillaSeleccionada(null)} />
          <div className="fixed left-1/2 top-1/2 z-[400] w-full max-w-lg -translate-x-1/2 -translate-y-1/2 max-h-[90vh] overflow-y-auto rounded-2xl bg-white shadow-2xl border border-cream3">
            <div className="flex justify-between items-start p-5 border-b border-cream3">
              <div>
                <div className="text-[11px] uppercase tracking-wide text-gray-400 font-semibold">Detalle de plantilla</div>
                <div className="text-[18px] font-semibold text-navy mt-0.5">{plantillaSeleccionada.nombre}</div>
                <div className="text-[12px] text-gray-500 mt-0.5">{plantillaSeleccionada.categoria} · {plantillaSeleccionada.version}</div>
              </div>
              <button onClick={() => setPlantillaSeleccionada(null)} className="text-gray-400 hover:text-navy shrink-0">
                <XCircle size={20} />
              </button>
            </div>

            <div className="p-5">
              <h4 className="section-title">Configuración</h4>
              <div className="flex flex-col mb-5">
                {[
                  ['Categoría', plantillaSeleccionada.categoria],
                  ['Modalidad', plantillaSeleccionada.modalidad],
                  ['Estado', plantillaSeleccionada.estado],
                  ['Última actualización', plantillaSeleccionada.actualizacion],
                ].map(([label, value]) => (
                  <div key={label} className="flex justify-between py-2 border-b border-cream2 text-[12.5px]">
                    <span className="text-gray-500">{label}</span>
                    <span className="font-semibold text-navy">{value}</span>
                  </div>
                ))}
              </div>

              <h4 className="section-title">Uso y demanda</h4>
              <div className="flex flex-col mb-5">
                {[
                  ['Descargas totales', plantillaSeleccionada.descargasTotal],
                  ['Descargas este mes', plantillaSeleccionada.descargasMes],
                ].map(([label, value]) => (
                  <div key={label} className="flex justify-between py-2 border-b border-cream2 text-[12.5px]">
                    <span className="text-gray-500">{label}</span>
                    <span className="font-semibold text-navy">{value}</span>
                  </div>
                ))}
              </div>

              <h4 className="section-title">Historial de versiones</h4>
              <div className="flex flex-col gap-2 mb-2">
                <div className="flex items-center justify-between px-3 py-2.5 border border-cream3 rounded-lg bg-cream2/40">
                  <div>
                    <div className="text-[12.5px] font-bold text-navy">{plantillaSeleccionada.version}</div>
                    <div className="text-[10.5px] text-gray-500">Versión actual · {plantillaSeleccionada.actualizacion}</div>
                  </div>
                  <span className="badge border border-emerald-200 bg-emerald-50 text-emerald-700">Actual</span>
                </div>
                {[1, 2].map(n => (
                  <div key={n} className="flex items-center justify-between px-3 py-2.5 border border-cream3 rounded-lg bg-cream2/40">
                    <div className="text-[12.5px] font-bold text-navy">{prevVersionLabel(plantillaSeleccionada.version, n)}</div>
                    <button
                      className="text-gray-300 cursor-not-allowed text-[11px] font-semibold"
                      disabled
                      title="Historial de versiones no disponible en el entorno demo"
                    >
                      Ver
                    </button>
                  </div>
                ))}
              </div>

              <button
                onClick={() => setShowUpdateModal(true)}
                className="btn btn-primary w-full mt-3 py-2.5"
              >
                Subir nueva versión
              </button>
            </div>
          </div>
        </>
      )}

      {/* Actualizar documento modal */}
      {showUpdateModal && plantillaSeleccionada && (
        <>
          <div className="fixed inset-0 z-[409] bg-black/20" onClick={() => setShowUpdateModal(false)} />
          <div className="fixed left-1/2 top-1/2 z-[410] w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-white p-6 shadow-2xl border border-cream3">
            <div className="flex justify-between items-center mb-5">
              <h3 className="text-[18px] font-semibold text-navy">Actualizar {plantillaSeleccionada.nombre}</h3>
              <button onClick={() => setShowUpdateModal(false)} className="text-gray-400 hover:text-navy"><XCircle size={20} /></button>
            </div>

            <div className="flex flex-col gap-4">
              <div>
                <label className="block text-[12.5px] font-medium text-navy mb-1.5">Archivo nuevo</label>
                <div className="border border-dashed border-cream3 rounded-lg p-6 bg-cream2/50 text-center flex flex-col items-center justify-center gap-2 cursor-pointer hover:bg-cream2 transition-colors">
                  <FileText size={24} className="text-gray-400" />
                  <p className="text-[12.5px] text-gray-500">Haz clic para buscar o arrastra el archivo aquí<br />.docx, .pdf, .xls</p>
                </div>
              </div>
              <div>
                <label className="block text-[12.5px] font-medium text-navy mb-1.5">Notas de actualización</label>
                <textarea className="form-input min-h-[75px]" placeholder="Describe qué cambió en esta versión..." />
              </div>
              <button
                onClick={() => {
                  showToast(`Nueva versión de ${plantillaSeleccionada.nombre} guardada`, 'success');
                  setShowUpdateModal(false);
                }}
                className="btn btn-primary w-full mt-2 py-2.5"
              >
                Guardar nueva versión
              </button>
            </div>
          </div>
        </>
      )}

      {/* Nueva plantilla modal */}
      {showSubirPlantillaModal && (
        <>
          <div className="fixed inset-0 z-[399] bg-black/20" onClick={() => setShowSubirPlantillaModal(false)} />
          <div className="fixed left-1/2 top-1/2 z-[400] w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-white p-6 shadow-2xl border border-cream3">
            <div className="flex justify-between items-center mb-5">
              <h3 className="text-[18px] font-semibold text-navy">Nueva plantilla</h3>
              <button onClick={() => setShowSubirPlantillaModal(false)} className="text-gray-400 hover:text-navy"><XCircle size={20} /></button>
            </div>

            <div className="flex flex-col gap-4">
              <div>
                <label className="block text-[12.5px] font-medium text-navy mb-1.5">Nombre de la plantilla</label>
                <input
                  type="text"
                  value={newTemplateName}
                  onChange={(e) => setNewTemplateName(e.target.value)}
                  className="form-input"
                  placeholder="Ej: Contrato de confidencialidad"
                />
              </div>
              <div>
                <label className="block text-[12.5px] font-medium text-navy mb-1.5">Categoría</label>
                <select
                  value={newTemplateCategory}
                  onChange={(e) => setNewTemplateCategory(e.target.value)}
                  className="form-input"
                >
                  <option value="Laboral">Laboral</option>
                  <option value="Tributario">Tributario</option>
                  <option value="Prevención">Prevención</option>
                </select>
              </div>
              <div>
                <label className="block text-[12.5px] font-medium text-navy mb-1.5">Modalidad</label>
                <select
                  value={newTemplateTipo}
                  onChange={(e) => setNewTemplateTipo(e.target.value)}
                  className="form-input"
                >
                  <option value="gratuita">Plantilla gratuita</option>
                  <option value="upsell">Servicio Acredita</option>
                </select>
              </div>
              <div>
                <label className="block text-[12.5px] font-medium text-navy mb-1.5">Archivo base</label>
                <div className="border border-dashed border-cream3 rounded-lg p-6 bg-cream2/50 text-center flex flex-col items-center justify-center gap-2 cursor-pointer hover:bg-cream2 transition-colors">
                  <FileText size={24} className="text-gray-400" />
                  <p className="text-[12.5px] text-gray-500">Haz clic para buscar o arrastra el archivo aquí<br />.docx, .pdf, .xls</p>
                </div>
              </div>
              <button onClick={handleAddTemplate} className="btn btn-primary w-full mt-2 py-2.5">
                Guardar plantilla
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
