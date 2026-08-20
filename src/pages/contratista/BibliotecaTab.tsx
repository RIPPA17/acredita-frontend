import { Info, CloudUpload, FileText, Eye, Clock, Plus, Folder, Upload } from 'lucide-react';

export default function BibliotecaTab({ setShowAddWorkerModal }: { setShowAddWorkerModal: (v: boolean) => void }) {
  return (
    <div className="fade-in">
      <div className="page-header">
        <div>
          <h2 className="page-title">Biblioteca Documental</h2>
          <p className="page-sub">Tu archivo centralizado: sube tus documentos una vez y utilízalos en cualquier faena activa</p>
        </div>
      </div>

      {/* Alerta informativa del beneficio */}
      <div className="alert alert-info mb-5 text-[14.3px]">
        <Info size={16} className="shrink-0" />
        <span>
          <strong>Tip de eficiencia:</strong> Los documentos que subas aquí quedarán disponibles como "formatos maestros". Al asignar personal o carpetas a un nuevo proyecto, el sistema los completará automáticamente sin que tengas que volver a subirlos.
        </span>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-start">

        {/* COLUMNA IZQUIERDA: DOCUMENTOS DE LA EMPRESA (5 Columnas) */}
        <div className="xl:col-span-5 flex flex-col gap-4">
          <div className="card">
            <div className="flex justify-between items-center mb-4">
              <h3 className="section-title mb-0">Documentos de la Empresa</h3>
              <button className="btn btn-ghost btn-sm cursor-not-allowed opacity-50 font-medium" disabled title="No disponible en demo">
                <CloudUpload size={14} className="mr-1" /> Subir Maestro [Demo]
              </button>
            </div>

            <div className="flex flex-col gap-3">
              {/* Documento 1 */}
              <div className="p-3 bg-cream2 rounded-xl border border-cream3 flex items-start gap-3">
                <div className="w-9 h-9 bg-navy text-cream rounded-lg flex items-center justify-center shrink-0">
                  <FileText size={18} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[14.3px] font-semibold text-navy truncate">Certificado de Antecedentes Laborales (F30)</div>
                  <div className="text-[12.1px] text-gray-500 mt-0.5">Período: Abril 2026</div>
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    <span className="badge b-green py-0.5 px-2 text-[11px]">Aprobado Maestro</span>
                    <span className="badge b-gray py-0.5 px-2 text-[11px] text-gray-600">Usado en 2 faenas</span>
                  </div>
                </div>
                <button className="text-gray-300 cursor-not-allowed p-1" disabled title="Visor deshabilitado en demo"><Eye size={15} /></button>
              </div>

              {/* Documento 2 */}
              <div className="p-3 bg-cream2 rounded-xl border border-cream3 flex items-start gap-3">
                <div className="w-9 h-9 bg-navy text-cream rounded-lg flex items-center justify-center shrink-0">
                  <FileText size={18} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[14.3px] font-semibold text-navy truncate">Certificado Adhesión Mutualidad</div>
                  <div className="text-[12.1px] text-gray-500 mt-0.5">Vence: 15 Dic 2026</div>
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    <span className="badge b-green py-0.5 px-2 text-[11px]">Vigente</span>
                    <span className="badge b-gray py-0.5 px-2 text-[11px] text-gray-600">Usado en 3 faenas</span>
                  </div>
                </div>
                <button className="text-gray-300 cursor-not-allowed p-1" disabled title="Visor deshabilitado en demo"><Eye size={15} /></button>
              </div>

              {/* Documento 3 */}
              <div className="p-3 bg-cream2 rounded-xl border border-[#fdf0d0] bg-[#fffdf5] flex items-start gap-3">
                <div className="w-9 h-9 bg-brown text-cream rounded-lg flex items-center justify-center shrink-0">
                  <FileText size={18} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[14.3px] font-semibold text-navy truncate">Patente Municipal Comercial</div>
                  <div className="text-[12.1px] text-[#a07000] font-medium mt-0.5 flex items-center gap-1">
                    <Clock size={12} /> Vence en 14 días
                  </div>
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    <span className="badge b-yellow py-0.5 px-2 text-[11px]">Renovación Requerida</span>
                  </div>
                </div>
                <button className="btn btn-secondary btn-sm px-2 py-1 text-[11px] cursor-not-allowed opacity-50" disabled title="Actualización deshabilitada en demo">Actualizar</button>
              </div>
            </div>
          </div>
        </div>

        {/* COLUMNA DERECHA: CARPETAS DE TRABAJADORES (7 Columnas) */}
        <div className="xl:col-span-7 flex flex-col gap-4">
          <div className="card">
            <div className="flex justify-between items-center mb-4">
              <h3 className="section-title mb-0">Nómina y Carpetas de Trabajadores</h3>
              <button className="btn btn-primary btn-sm flex items-center" onClick={() => setShowAddWorkerModal(true)}>
                <Plus size={14} className="mr-1" /> Registrar Trabajador
              </button>
            </div>

            <div className="flex flex-col gap-2.5">
              {/* Trabajador 1 */}
              <div className="p-3 border border-cream3 rounded-xl hover:bg-cream2/40 transition flex items-center gap-3">
                <div className="avatar text-[12.1px] font-semibold bg-navy text-cream flex items-center justify-center h-10 w-10 rounded-full">JP</div>
                <div className="flex-1 min-w-0">
                  <div className="text-[14.3px] font-medium text-navy truncate">Juan Pérez González</div>
                  <div className="text-[12.1px] text-gray-400">RUT: 18.453.211-0 · Operador de Maquinaria</div>
                </div>
                <div className="text-right shrink-0 px-2">
                  <div className="text-[13.2px] font-semibold text-[#2a6a3a]">4 / 4 Docs</div>
                  <div className="text-[11px] text-gray-400">Habilitado</div>
                </div>
                <button className="btn btn-ghost btn-sm px-2.5 cursor-not-allowed opacity-50" disabled title="No disponible en demo">
                  <Folder size={14} />
                </button>
              </div>

              {/* Trabajador 2 */}
              <div className="p-3 border border-cream3 rounded-xl hover:bg-cream2/40 transition flex items-center gap-3">
                <div className="avatar text-[12.1px] font-semibold bg-navy text-cream flex items-center justify-center h-10 w-10 rounded-full">AM</div>
                <div className="flex-1 min-w-0">
                  <div className="text-[14.3px] font-medium text-navy truncate">Alejandro Muñoz Silva</div>
                  <div className="text-[12.1px] text-gray-400">RUT: 16.784.322-K · Eléctricista Montador</div>
                </div>
                <div className="text-right shrink-0 px-2">
                  <div className="text-[13.2px] font-semibold text-[#a07000]">3 / 4 Docs</div>
                  <div className="text-[11px] text-[#a07000] font-medium">1 por vencer</div>
                </div>
                <button className="btn btn-ghost btn-sm px-2.5 cursor-not-allowed opacity-50" disabled title="No disponible en demo">
                  <Folder size={14} />
                </button>
              </div>

              {/* Trabajador 3 */}
              <div className="p-3 border border-[#fde8e8] bg-[#fff8f8] rounded-xl flex items-center gap-3">
                <div className="avatar text-[12.1px] font-semibold bg-[#7a2020] text-cream flex items-center justify-center h-10 w-10 rounded-full">CR</div>
                <div className="flex-1 min-w-0">
                  <div className="text-[14.3px] font-medium text-navy truncate">Carlos Rojas Méndez</div>
                  <div className="text-[12.1px] text-gray-400">RUT: 19.223.445-8 · Jornalero</div>
                </div>
                <div className="text-right shrink-0 px-2">
                  <div className="text-[13.2px] font-semibold text-[#c02020]">2 / 4 Docs</div>
                  <div className="text-[11px] text-[#c02020] font-medium">1 Rechazado</div>
                </div>
                <button className="btn btn-secondary btn-sm px-2.5 bg-gray-300 text-gray-500 cursor-not-allowed border-none" disabled title="No disponible en demo">
                  <Upload size={14} />
                </button>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
