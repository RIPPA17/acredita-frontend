import { Sparkles, ShieldCheck, Clock, Banknote, CheckCircle, FileText, Send } from 'lucide-react';

export default function AsesoriaTab() {
  return (
    <div className="fade-in">
      <div className="page-header mb-6">
        <div>
          <h2 className="page-title flex items-center gap-2">
            <Sparkles className="text-brown" size={22} /> Asesoría y Redacción Experta
          </h2>
          <p className="page-sub">Delega la burocracia. Nuestro equipo de especialistas redacta y tramita tus documentos complejos.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">

        {/* COLUMNA IZQUIERDA: PROPUESTA DE VALOR Y BENEFICIOS */}
        <div className="lg:col-span-5 flex flex-col gap-4">
          <div className="bg-navy text-cream rounded-xl p-6 shadow-lg">
            <h3 className="text-[17.6px] font-medium mb-2">¿Documentos rechazados o sin tiempo para redactarlos?</h3>
            <p className="text-[13.2px] text-[#9aabb8] mb-6 leading-relaxed">
              Sabemos que tu foco está en la operación. Nuestro equipo interno de prevención de riesgos y administración asume la carga por ti. Evaluamos tu caso y te entregamos una solución a la medida, garantizando la aprobación por parte del Mandante.
            </p>

            <div className="flex flex-col gap-4">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 bg-cream/10 p-1.5 rounded-lg text-brown"><ShieldCheck size={18} /></div>
                <div>
                  <div className="font-medium text-[14.3px]">Aprobación Garantizada</div>
                  <div className="text-[12.1px] text-[#9aabb8]">Redactamos bajo los estándares exactos que exige tu Mandante.</div>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="mt-0.5 bg-cream/10 p-1.5 rounded-lg text-brown"><Clock size={18} /></div>
                <div>
                  <div className="font-medium text-[14.3px]">Agilidad Operativa</div>
                  <div className="text-[12.1px] text-[#9aabb8]">Tiempos de respuesta rápidos para que no pierdas estados de pago.</div>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="mt-0.5 bg-cream/10 p-1.5 rounded-lg text-brown"><Banknote size={18} /></div>
                <div>
                  <div className="font-medium text-[14.3px]">Cotización a la Medida</div>
                  <div className="text-[12.1px] text-[#9aabb8]">Evaluamos la complejidad de tu requerimiento sin costo inicial.</div>
                </div>
              </div>
            </div>
          </div>

          {/* Casos de uso comunes */}
          <div className="card bg-cream2 border-none">
            <h4 className="text-[13.2px] font-semibold uppercase tracking-wider text-gray-500 mb-3">Servicios más solicitados</h4>
            <ul className="flex flex-col gap-2">
              <li className="flex items-center gap-2 text-[13.2px] text-navy"><CheckCircle size={14} className="text-brown" /> Confección de Reglamento Interno (RIOHS)</li>
              <li className="flex items-center gap-2 text-[13.2px] text-navy"><CheckCircle size={14} className="text-brown" /> Matrices de Riesgo (MIPER) específicas</li>
              <li className="flex items-center gap-2 text-[13.2px] text-navy"><CheckCircle size={14} className="text-brown" /> Redacción de Contratos de Trabajo a trato</li>
              <li className="flex items-center gap-2 text-[13.2px] text-navy"><CheckCircle size={14} className="text-brown" /> Gestión y regularización de F30 / F30-1</li>
            </ul>
          </div>
        </div>

        {/* COLUMNA DERECHA: FORMULARIO DE SOLICITUD */}
        <div className="lg:col-span-7">
          <div className="card p-6">
            <h3 className="section-title mb-1">Cuéntanos qué necesitas</h3>
            <p className="text-[13.2px] text-gray-500 mb-5">Un especialista de Acredita analizará tu solicitud y te enviará una propuesta formal en menos de 24 horas.</p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div className="form-group">
                <label className="form-label">Tipo de Asesoría Principal</label>
                <select className="form-input">
                  <option>Prevención de Riesgos (RIOHS, ODI, MIPER)</option>
                  <option>Laboral y Contratos (Anexos, Liquidaciones)</option>
                  <option>Trámites Externos (Mutual, DT, SII)</option>
                  <option>Otra necesidad específica</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Proyecto o Mandante (Opcional)</label>
                <select className="form-input">
                  <option>-- Seleccionar faena --</option>
                  <option>Proyecto Costanera Norte (Andina SA)</option>
                  <option>Ampliación Bodega Sur (Retail Centro)</option>
                </select>
              </div>
            </div>

            <div className="form-group mb-4">
              <label className="form-label">Nivel de Urgencia</label>
              <div className="flex gap-4 mt-1">
                <label className="flex items-center gap-2 text-[13.2px] cursor-pointer">
                  <input type="radio" name="urgencia" defaultChecked className="accent-brown" />
                  <span>Estándar (3-5 días hábiles)</span>
                </label>
                <label className="flex items-center gap-2 text-[13.2px] cursor-pointer text-[#a07000] font-medium">
                  <input type="radio" name="urgencia" className="accent-[#d4a000]" />
                  <span>Urgente (Bloqueo de acceso/pago)</span>
                </label>
              </div>
            </div>

            <div className="form-group mb-5">
              <label className="form-label">Detalla tu requerimiento</label>
              <textarea
                className="form-input min-h-[120px] resize-y"
                placeholder="Ej: Hola, necesito crear un Reglamento Interno desde cero porque el Mandante me lo rechazó por estar desactualizado a la norma de este año..."
              ></textarea>
            </div>

            <div className="form-group mb-6">
              <label className="form-label">¿Tienes algún documento base? (Opcional)</label>
              <div className="border-2 border-dashed border-cream3 rounded-xl p-4 text-center hover:bg-cream2 transition cursor-pointer">
                <FileText size={24} className="mx-auto mb-2 text-gray-400" />
                <span className="text-[13.2px] text-navy font-medium">Haz clic o arrastra un archivo aquí</span>
                <div className="text-[11px] text-gray-400 mt-1">PDF, Word o imágenes (Max. 10MB)</div>
              </div>
            </div>

            <button className="btn btn-primary w-full py-3 text-[15.4px] justify-center cursor-not-allowed opacity-55" disabled title="No disponible en demo">
              <Send size={18} className="mr-2" /> Solicitar Cotización [Demo]
            </button>

            <p className="text-center text-[11px] text-gray-400 mt-4">
              * El envío de este formulario no genera ningún cobro automático. Pagarás solo si apruebas nuestra cotización.
            </p>
          </div>
        </div>

      </div>
    </div>
  );
}
