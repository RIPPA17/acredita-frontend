import { Search, Building2, MapPin, AlertCircle, Clock, CheckCircle, ArrowRight } from 'lucide-react';

export default function MisProyectosTab({ setActiveTab }: { setActiveTab: (v: string) => void }) {
  return (
    <div className="fade-in">
      <div className="page-header">
        <div>
          <h2 className="page-title">Mis Proyectos Asignados</h2>
          <p className="page-sub">Obras y faenas donde prestas servicios</p>
        </div>
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input type="text" className="form-input pl-9 w-64" placeholder="Buscar proyecto..." />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {/* Critical */}
        <div className="card !p-0 border-l-4 border-l-[#c02020] overflow-hidden flex flex-col h-full bg-white shadow-sm">
          <div className="p-4 border-b border-cream">
            <div className="flex justify-between items-start mb-2">
               <div className="flex gap-2 items-center text-gray-500 uppercase text-[11px] font-bold tracking-wider">
                 <Building2 size={14} /> CONSTRUCTORA ANDINA SA
               </div>
            </div>
            <h3 className="text-[18px] font-bold text-navy flex items-center gap-2">
              <MapPin size={18} className="text-gray-400"/> Proyecto Costanera Norte
            </h3>
          </div>

          <div className="p-4 flex-1 flex flex-col justify-center">
            <div className="bg-[#fff8f8] border border-[#f5e6e6] rounded-lg p-4 mb-2">
               <div className="flex items-center gap-2 text-[#c02020] font-medium text-[13.2px] mb-3">
                 <AlertCircle size={16} /> Requiere tu atención
               </div>
               <div className="prog-wrap !m-0 mb-3 border border-cream/50 bg-white"><div className="prog-fill w-[71%] bg-[#c02020]"></div></div>
               <div className="text-[12.1px] flex items-center gap-2 flex-wrap">
                 <span className="text-[#c02020] font-semibold">1 Rechazado</span>
                 <span className="text-gray-400 text-[10px]">●</span>
                 <span className="text-gray-500">2 Pendientes</span>
                 <span className="text-gray-400 text-[10px]">●</span>
                 <span className="text-[#2a6a3a]">5 Aprobados</span>
               </div>
            </div>
          </div>

          <div className="p-4 pt-0 mt-auto">
            <button className="btn btn-primary w-full py-2.5 font-medium" onClick={() => setActiveTab('subir')}>
              Corregir documentos <ArrowRight size={16} className="ml-2" />
            </button>
          </div>
        </div>

        {/* Warning */}
        <div className="card !p-0 border-l-4 border-l-[#d4a000] overflow-hidden flex flex-col h-full bg-white shadow-sm">
          <div className="p-4 border-b border-cream">
            <div className="flex justify-between items-start mb-2">
               <div className="flex gap-2 items-center text-gray-500 uppercase text-[11px] font-bold tracking-wider">
                 <Building2 size={14} /> INMOBILIARIA PACÍFICO
               </div>
            </div>
            <h3 className="text-[18px] font-bold text-navy flex items-center gap-2">
              <MapPin size={18} className="text-gray-400"/> Edificio Vista Mar
            </h3>
          </div>

          <div className="p-4 flex-1 flex flex-col justify-center">
            <div className="bg-[#fffdf5] border border-[#f5f0e6] rounded-lg p-4 mb-2">
               <div className="flex items-center gap-2 text-[#d4a000] font-medium text-[13.2px] mb-3">
                 <Clock size={16} /> Vencimientos próximos
               </div>
               <div className="prog-wrap !m-0 mb-3 border border-cream/50 bg-white"><div className="prog-fill w-[88%] bg-[#d4a000]"></div></div>
               <div className="text-[12.1px] flex items-center gap-2 flex-wrap">
                 <span className="text-gray-500">0 Rechazados</span>
                 <span className="text-gray-400 text-[10px]">●</span>
                 <span className="text-[#d4a000] font-semibold">1 Pendiente</span>
                 <span className="text-gray-400 text-[10px]">●</span>
                 <span className="text-[#2a6a3a]">7 Aprobados</span>
               </div>
            </div>
          </div>

          <div className="p-4 pt-0 mt-auto">
            <button className="btn btn-secondary w-full py-2.5 font-medium" onClick={() => setActiveTab('subir')}>
              Renovar documentos <ArrowRight size={16} className="ml-2" />
            </button>
          </div>
        </div>

        {/* OK */}
        <div className="card !p-0 border-l-4 border-l-[#2a6a3a] overflow-hidden flex flex-col h-full bg-white shadow-sm">
          <div className="p-4 border-b border-cream">
            <div className="flex justify-between items-start mb-2">
               <div className="flex gap-2 items-center text-gray-500 uppercase text-[11px] font-bold tracking-wider">
                 <Building2 size={14} /> MINERA LOS ANDES
               </div>
            </div>
            <h3 className="text-[18px] font-bold text-navy flex items-center gap-2">
              <MapPin size={18} className="text-gray-400"/> Faena Atacama 2
            </h3>
          </div>

          <div className="p-4 flex-1 flex flex-col justify-center">
            <div className="bg-[#f5fbf6] border border-[#e6f5e9] rounded-lg p-4 mb-2">
               <div className="flex items-center gap-2 text-[#2a6a3a] font-medium text-[13.2px] mb-3">
                 <CheckCircle size={16} /> Todo al día (Pago habilitado)
               </div>
               <div className="prog-wrap !m-0 mb-3 border border-cream/50 bg-white"><div className="prog-fill w-[100%] bg-[#2a6a3a]"></div></div>
               <div className="text-[12.1px] flex items-center gap-2 flex-wrap">
                 <span className="text-gray-500">0 Rechazados</span>
                 <span className="text-gray-400 text-[10px]">●</span>
                 <span className="text-gray-500">0 Pendientes</span>
                 <span className="text-gray-400 text-[10px]">●</span>
                 <span className="text-[#2a6a3a] font-semibold">8 Aprobados</span>
               </div>
            </div>
          </div>

          <div className="p-4 pt-0 mt-auto">
            <button className="btn btn-ghost w-full py-2.5 border border-cream hover:bg-cream font-medium" onClick={() => setActiveTab('subir')}>
              Ver carpeta del proyecto
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
