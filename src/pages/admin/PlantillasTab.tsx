import { Plus, Sparkles, Download, Edit2, Trash2, XCircle, FileText } from 'lucide-react';

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
  handleAddTemplate,
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
  handleAddTemplate: () => void;
}) {
  const plantillasFiltradas = PLANTILLAS
    .filter(p => activeFilterPlantillas === "Todas" || p.categoria === activeFilterPlantillas || (activeFilterPlantillas === "Premium / Asesoría" && p.tipo === "upsell"))
    .filter(p => p.nombre.toLowerCase().includes(busquedaPlantilla.toLowerCase()));

  return (
    <div className="fade-in relative">
      <div className="page-header">
        <div>
          <h2 className="page-title">Gestión de Plantillas</h2>
          <p className="page-sub">
            Documentos base y oferta de servicio de redacción para
            contratistas
          </p>
        </div>
        <button onClick={() => setShowSubirPlantillaModal(true)} className="btn btn-primary">
          <Plus size={16} /> Subir nueva plantilla
        </button>
      </div>

      <div className="alert alert-info mb-6">
        <Sparkles size={18} className="shrink-0 text-brown" />
        <div>
          <strong>Servicio de Redacción y Asesoría:</strong> Las
          plantillas complejas pueden ofrecer a los contratistas la
          opción de pagar por nuestra asesoría legal experta, en lugar
          de descargar el formato vacío. Esto representa una oportunidad
          de upsell para la plataforma.
        </div>
      </div>

      <div className="flex gap-2 mb-6">
        {["Todas", "Laboral", "Prevención", "Premium / Asesoría"].map(f => (
          <button
            key={f}
            onClick={() => setActiveFilterPlantillas(f)}
            className={`btn btn-sm ${activeFilterPlantillas === f ? 'bg-white border border-cream3 text-navy font-medium shadow-sm' : 'btn-ghost'}`}>
            {f}
          </button>
        ))}
      </div>

      <div className="card-grid mb-8">
        {plantillasFiltradas.slice(0, 3).map(p => (
          <div key={p.id} className={`card flex flex-col h-full hover:shadow-md transition-shadow ${p.tipo === 'upsell' ? 'border-l-4 border-l-brown bg-gradient-to-br from-white to-orange-50/30' : ''}`}>
            <div className="flex justify-between items-start mb-3">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${p.tipo === 'upsell' ? 'bg-[#f0e4da]' : 'bg-cream'}`}>
                <FileText className={p.tipo === 'upsell' ? 'text-[#9A694E]' : (p.categoria === 'Laboral' ? 'text-blue-600' : 'text-navy')} size={20} />
              </div>
              <span className={`badge border font-medium ${p.tipo === 'upsell' ? 'border-brown/30 bg-[#f0e4da] text-[#7a5038]' : 'border-blue-200 bg-blue-50 text-blue-700'}`}>
                {p.categoria}
              </span>
            </div>
            <h3 className="text-[16.5px] font-semibold text-navy mb-1.5 leading-tight">
              {p.nombre}
            </h3>
            <p className={`text-[13.2px] mb-4 flex-1 ${p.tipo === 'upsell' ? 'text-gray-600' : 'text-gray-500'}`}>
              {p.descripcion}
            </p>
            <div className={`pt-3 flex flex-col gap-2 mt-auto ${p.tipo === 'upsell' ? 'border-t border-brown/10' : 'border-t border-cream'}`}>
              {p.tipo === 'upsell' ? (
                <>
                  <div className="flex items-center gap-1.5 text-brown mb-1.5">
                    <Sparkles size={14} className="fill-brown/20" />
                    <span className="text-[12.1px] font-medium uppercase tracking-wide">
                      Servicio de Redacción Disponible
                    </span>
                  </div>
                  <button className="btn btn-primary btn-sm w-full py-1.5 text-[12.5px] cursor-not-allowed opacity-55" disabled title="Próximamente en producción">Solicitar asesoría [Demo]</button>
                </>
              ) : (
                <div className="flex items-center justify-between">
                   <span className="text-[12.1px] text-gray-400 font-medium tracking-wide uppercase">
                    Plantilla Gratuita
                  </span>
                  <button className="btn btn-secondary btn-sm cursor-not-allowed opacity-55" disabled title="Vista previa no disponible en entorno demo">
                    <Download size={14} /> Ver plantilla
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between mb-4">
        <h3 className="section-title mb-0">Listado de Plantillas Activas</h3>
        <input
          type="text"
          placeholder="Buscar plantilla por nombre..."
          value={busquedaPlantilla}
          onChange={e => setBusquedaPlantilla(e.target.value)}
          className="form-input text-[13px] py-1.5 w-[250px]"
        />
      </div>

      <div className="card p-0 overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr>
              <th className="px-4 py-3 border-b border-cream3 text-[13.2px] text-gray-600 bg-cream2 font-medium">Nombre de Plantilla</th>
              <th className="px-4 py-3 border-b border-cream3 text-[13.2px] text-gray-600 bg-cream2 font-medium">Categoría</th>
              <th className="px-4 py-3 border-b border-cream3 text-[13.2px] text-gray-600 bg-cream2 font-medium">Actualización</th>
              <th className="px-4 py-3 border-b border-cream3 text-[13.2px] text-gray-600 bg-cream2 font-medium">Descargas / Usos</th>
              <th className="px-4 py-3 border-b border-cream3 text-[13.2px] text-gray-600 bg-cream2 font-medium text-right">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {plantillasFiltradas.length > 0 ? plantillasFiltradas.map(p => (
              <tr key={p.id} className="hover:bg-gray-50 border-b border-cream">
                <td className="px-4 py-3 text-[14.3px] font-medium text-navy flex items-center gap-1.5">
                  {p.nombre}
                  {p.tipo === 'upsell' && <Sparkles size={14} className="text-brown shrink-0" />}
                </td>
                <td className="px-4 py-3 text-[14.3px]">
                  <span className={`badge border ${p.tipo === 'upsell' ? 'border-brown/30 bg-[#f0e4da] text-[#7a5038]' : 'border-blue-200 bg-blue-50 text-blue-700'}`}>
                    {p.categoria}
                  </span>
                </td>
                <td className="px-4 py-3 text-[13.2px] text-gray-500">{p.actualizacion}</td>
                <td className="px-4 py-3 text-[13.2px] text-gray-600">{p.descargas}</td>
                <td className="px-4 py-3 text-right whitespace-nowrap">
                  <button className="text-gray-300 cursor-not-allowed mr-3" disabled title="Edición deshabilitada en demo"><Edit2 size={16} /></button>
                  <button className="text-gray-300 cursor-not-allowed" disabled title="Eliminación deshabilitada en demo"><Trash2 size={16} /></button>
                </td>
              </tr>
            )) : (
              <tr>
                <td colSpan={5} className="py-8 text-center text-[13.2px] text-gray-500">
                  No se encontraron plantillas.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {showSubirPlantillaModal && (
        <>
          <div className="fixed inset-0 z-[399] bg-black/20" onClick={() => setShowSubirPlantillaModal(false)} />
          <div className="fixed left-1/2 top-1/2 z-[400] w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-white p-6 shadow-2xl border border-cream3">
            <div className="flex justify-between items-center mb-5">
              <h3 className="text-[18px] font-semibold text-navy">Subir Nueva Plantilla</h3>
              <button onClick={() => setShowSubirPlantillaModal(false)} className="text-gray-400 hover:text-navy"><XCircle size={20}/></button>
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
                  <option value="Prevención">Prevención</option>
                  <option value="Premium / Asesoría">Premium / Asesoría</option>
                </select>
              </div>
              <div>
                <label className="block text-[12.5px] font-medium text-navy mb-1.5">Tipo de plantilla</label>
                <select className="form-input">
                  <option value="gratuita">Gratuita (Descarga directa)</option>
                  <option value="upsell">Upsell (Servicio de redacción)</option>
                </select>
              </div>
              <div>
                <label className="block text-[12.5px] font-medium text-navy mb-1.5">Archivo base</label>
                <div className="border border-dashed border-cream3 rounded-lg p-6 bg-cream2/50 text-center flex flex-col items-center justify-center gap-2 cursor-pointer hover:bg-cream2 transition-colors">
                  <FileText size={24} className="text-gray-400" />
                  <p className="text-[12.5px] text-gray-500">Haz clic para buscar o arrastra el archivo aquí<br/>.docx, .pdf, .xls</p>
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
