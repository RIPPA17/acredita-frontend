import React, { useState } from 'react';
import {
  Search,
  Building2,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Download,
  UserPlus,
  MessageSquare,
  Eye,
  TrendingUp,
  TrendingDown,
} from 'lucide-react';
import { Proyecto } from '../../types';
import SeverityBadge, {
  Severidad,
  SEVERIDAD_LABEL,
  SEVERIDAD_ORDEN,
  severidadDeCumplimiento,
} from '../../components/SeverityBadge';
import { getContratistas } from '../../data/localStorageDb';

function getAvatarBgColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const colors = [
    'bg-indigo-600',
    'bg-cyan-700',
    'bg-teal-700',
    'bg-blue-600',
    'bg-violet-700',
    'bg-pink-700',
    'bg-orange-700',
    'bg-emerald-700',
  ];
  const idx = Math.abs(hash) % colors.length;
  return colors[idx];
}

function getUltimaActividad(rut: string, originalList: any[]): string {
  const dbC = originalList.find(c => c.rut === rut);
  if (!dbC || !dbC.documentos || dbC.documentos.length === 0) return '—';
  
  const validDocs = dbC.documentos.filter((d: any) => d.subido && d.subido !== '—');
  if (validDocs.length === 0) return '—';
  
  const parseDate = (dStr?: string) => {
    if (!dStr) return 0;
    const parts = dStr.split(' ');
    if (parts.length < 3) return 0;
    const day = parseInt(parts[0], 10);
    const year = parseInt(parts[2], 10);
    const months: Record<string, number> = {
      'Ene': 0, 'Jan': 0,
      'Feb': 1,
      'Mar': 2,
      'Abr': 3, 'Apr': 3,
      'May': 4,
      'Jun': 5,
      'Jul': 6,
      'Ago': 7, 'Aug': 7,
      'Sep': 8,
      'Oct': 9,
      'Nov': 10,
      'Dic': 11, 'Dec': 11
    };
    const month = months[parts[1]] || 0;
    return new Date(year, month, day).getTime();
  };

  const sorted = [...validDocs].sort((a: any, b: any) => parseDate(b.subido) - parseDate(a.subido));
  return sorted[0].subido || '—';
}

export default function ContratistasTab({
  EMPRESAS_CONTRATISTAS,
  setClienteSeleccionado,
  GLOBAL_PROYECTOS = [],
}: {
  EMPRESAS_CONTRATISTAS: any[];
  setClienteSeleccionado: (v: any) => void;
  GLOBAL_PROYECTOS?: Proyecto[];
}) {
  const [busqueda, setBusqueda] = useState('');
  const [proyectoFiltro, setProyectoFiltro] = useState('todos');
  const [sevFiltro, setSevFiltro] = useState<Severidad | null>(null);

  const dbContratistas = getContratistas();

  const conSeveridad = EMPRESAS_CONTRATISTAS.map(c => ({
    ...c,
    sev: severidadDeCumplimiento(c.cumplimiento),
  }));

  const conteo: Record<Severidad, number> = {
    critico: conSeveridad.filter(c => c.sev === 'critico').length,
    atencion: conSeveridad.filter(c => c.sev === 'atencion').length,
    normal: conSeveridad.filter(c => c.sev === 'normal').length,
  };

  const termino = busqueda.trim().toLowerCase();
  const visibles = conSeveridad
    .filter(c => {
      const coincideBusqueda =
        !termino ||
        c.empresa?.toLowerCase().includes(termino) ||
        c.rut?.toLowerCase().includes(termino);
      const coincideProyecto =
        proyectoFiltro === 'todos' || (c.proyectos || []).includes(proyectoFiltro);
      const coincideSev = !sevFiltro || c.sev === sevFiltro;
      return coincideBusqueda && coincideProyecto && coincideSev;
    })
    .sort(
      (a, b) =>
        SEVERIDAD_ORDEN[a.sev as Severidad] - SEVERIDAD_ORDEN[b.sev as Severidad] ||
        String(a.empresa).localeCompare(String(b.empresa))
    );

  const hayFiltros = termino !== '' || proyectoFiltro !== 'todos' || sevFiltro !== null;

  const limpiarFiltros = () => {
    setBusqueda('');
    setProyectoFiltro('todos');
    setSevFiltro(null);
  };

  // KPI Calculations
  const totalActivos = EMPRESAS_CONTRATISTAS.length;
  const totalAprobadosDocs = EMPRESAS_CONTRATISTAS.reduce((acc, c) => acc + c.docsAprobados, 0);
  const totalDocs = EMPRESAS_CONTRATISTAS.reduce((acc, c) => acc + c.docsTotal, 0);
  const pctCumplimientoPromedio = totalDocs > 0 ? Math.round((totalAprobadosDocs / totalDocs) * 100) : 0;
  const documentosPendientes = totalDocs - totalAprobadosDocs;
  const countCriticos = conSeveridad.filter(c => c.sev === 'critico').length;

  const renderProgressRing = (pct: number, sev: Severidad) => {
    const size = 32;
    const stroke = 3;
    const r = (size - stroke) / 2;
    const strokeLength = 2 * Math.PI * r;
    const strokeOffset = strokeLength - (pct / 100) * strokeLength;
    
    const strokeColor =
      sev === 'critico'
        ? 'stroke-[#a32d2d]'
        : sev === 'atencion'
        ? 'stroke-[#b58600]'
        : 'stroke-[#1e7a3c]';

    return (
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="rotate-[-90deg] shrink-0">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          className="stroke-gray-100"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          className={`${strokeColor} transition-all duration-300`}
          strokeWidth={stroke}
          strokeDasharray={strokeLength}
          strokeDashoffset={strokeOffset}
          strokeLinecap="round"
        />
      </svg>
    );
  };

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
            <h2 className="text-2xl font-semibold text-white mt-1">Contratistas</h2>
            <p className="text-[13.5px] text-gray-300 mt-1.5 max-w-[550px]">
              Empresas contratistas y subcontratistas asignadas a proyectos, con su estado de acreditación en tiempo real.
            </p>
          </div>
          
          <div className="flex gap-2.5 shrink-0">
            <button className="px-4.5 py-2.5 rounded-xl border border-white/20 bg-white/5 text-gray-100 hover:bg-white/10 text-[13.5px] font-semibold flex items-center gap-2 cursor-pointer transition-all">
              <Download size={15} />
              Exportar
            </button>
            <button className="px-4.5 py-2.5 rounded-xl bg-gradient-to-r from-gold-hover to-gold text-white hover:brightness-105 text-[13.5px] font-semibold flex items-center gap-2 cursor-pointer transition-all shadow-[0_6px_16px_rgba(179,137,63,0.35)] border-none">
              <UserPlus size={15} />
              Invitar contratista
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Area (floated up) */}
      <div className="relative z-20 -mt-8 max-w-[1200px] mx-auto px-1 flex flex-col gap-5">
        
        {/* KPI Cards Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          
          {/* Card 1: Activos */}
          <div className="bg-white rounded-2xl p-4.5 shadow-[0_14px_30px_rgba(20,25,30,0.08)] border border-cream3 flex flex-col gap-2.5">
            <div className="flex justify-between items-center">
              <div className="w-9 h-9 rounded-xl bg-gray-100 text-navy flex items-center justify-center shrink-0">
                <Building2 size={16} />
              </div>
              {/* TODO: Implement real trend calculation when historical data is added to DB */}
              <span className="text-[11px] text-emerald-600 font-bold flex items-center gap-0.5">
                <TrendingUp size={12} />
                +2 este mes
              </span>
            </div>
            <div>
              <div className="text-2xl font-bold text-navy tracking-tight">{totalActivos}</div>
              <div className="text-[12px] text-gray-500 font-medium mt-0.5">Contratistas activos</div>
            </div>
          </div>
          
          {/* Card 2: % Cumplimiento */}
          <div className="bg-white rounded-2xl p-4.5 shadow-[0_14px_30px_rgba(20,25,30,0.08)] border border-cream3 flex flex-col gap-2.5">
            <div className="flex justify-between items-center">
              <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0">
                <CheckCircle2 size={16} />
              </div>
              {/* TODO: Implement real trend calculation when historical data is added to DB */}
              <span className="text-[11px] text-emerald-600 font-bold flex items-center gap-0.5">
                <TrendingUp size={12} />
                +3% vs mes ant.
              </span>
            </div>
            <div>
              <div className="text-2xl font-bold text-navy tracking-tight">{pctCumplimientoPromedio}%</div>
              <div className="text-[12px] text-gray-500 font-medium mt-0.5">Cumplimiento promedio</div>
            </div>
          </div>
          
          {/* Card 3: Pendientes */}
          <div className="bg-white rounded-2xl p-4.5 shadow-[0_14px_30px_rgba(20,25,30,0.08)] border border-cream3 flex flex-col gap-2.5">
            <div className="flex justify-between items-center">
              <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center shrink-0">
                <Clock size={16} />
              </div>
              {/* TODO: Implement real trend calculation when historical data is added to DB */}
              <span className="text-[11px] text-emerald-600 font-bold flex items-center gap-0.5">
                <TrendingUp size={12} />
                -5 esta semana
              </span>
            </div>
            <div>
              <div className="text-2xl font-bold text-navy tracking-tight">{documentosPendientes}</div>
              <div className="text-[12px] text-gray-500 font-medium mt-0.5">Documentos pendientes</div>
            </div>
          </div>
          
          {/* Card 4: Críticos */}
          <div className="bg-white rounded-2xl p-4.5 shadow-[0_14px_30px_rgba(20,25,30,0.08)] border border-cream3 flex flex-col gap-2.5">
            <div className="flex justify-between items-center">
              <div className="w-9 h-9 rounded-xl bg-red-50 text-red-700 flex items-center justify-center shrink-0">
                <AlertTriangle size={16} />
              </div>
              {/* TODO: Implement real trend calculation when historical data is added to DB */}
              <span className="text-[11px] text-red-600 font-bold flex items-center gap-0.5">
                <TrendingDown size={12} />
                +1 hoy
              </span>
            </div>
            <div>
              <div className="text-2xl font-bold text-navy tracking-tight">{countCriticos}</div>
              <div className="text-[12px] text-gray-500 font-medium mt-0.5">Requieren atención urgente</div>
            </div>
          </div>
          
        </div>

        {/* Toolbar & Table Panel */}
        <div className="bg-white rounded-2xl border border-cream3 shadow-sm overflow-hidden flex flex-col">
          
          {/* Toolbar */}
          <div className="p-4 border-b border-cream3 flex flex-wrap items-center justify-between gap-3">
            
            {/* Segmented Control */}
            <div className="flex bg-[#f1efe6] border border-cream3 rounded-xl p-1 gap-1">
              <button
                onClick={() => setSevFiltro(null)}
                className={`px-3.5 py-1.5 rounded-lg text-[12.5px] font-semibold transition-all cursor-pointer border-none flex items-center gap-1 ${
                  sevFiltro === null
                    ? 'bg-white text-navy shadow-sm'
                    : 'text-gray-500 hover:text-navy hover:bg-white/40'
                }`}
              >
                Todos <span className="opacity-60 text-xs ml-0.5">{EMPRESAS_CONTRATISTAS.length}</span>
              </button>
              <button
                onClick={() => setSevFiltro('critico')}
                className={`px-3.5 py-1.5 rounded-lg text-[12.5px] font-semibold transition-all cursor-pointer border-none flex items-center gap-1.5 ${
                  sevFiltro === 'critico'
                    ? 'bg-white text-navy shadow-sm'
                    : 'text-gray-500 hover:text-navy hover:bg-white/40'
                }`}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-[#a32d2d]" />
                Críticos <span className="opacity-60 text-xs">{conteo.critico}</span>
              </button>
              <button
                onClick={() => setSevFiltro('atencion')}
                className={`px-3.5 py-1.5 rounded-lg text-[12.5px] font-semibold transition-all cursor-pointer border-none flex items-center gap-1.5 ${
                  sevFiltro === 'atencion'
                    ? 'bg-white text-navy shadow-sm'
                    : 'text-gray-500 hover:text-navy hover:bg-white/40'
                }`}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-[#b58600]" />
                Atención <span className="opacity-60 text-xs">{conteo.atencion}</span>
              </button>
              <button
                onClick={() => setSevFiltro('normal')}
                className={`px-3.5 py-1.5 rounded-lg text-[12.5px] font-semibold transition-all cursor-pointer border-none flex items-center gap-1.5 ${
                  sevFiltro === 'normal'
                    ? 'bg-white text-navy shadow-sm'
                    : 'text-gray-500 hover:text-navy hover:bg-white/40'
                }`}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-[#1e7a3c]" />
                Al día <span className="opacity-60 text-xs">{conteo.normal}</span>
              </button>
            </div>
            
            {/* Search & Project Filter */}
            <div className="flex items-center gap-2 flex-wrap flex-1 justify-end max-w-full">
              <div className="relative min-w-[200px] flex-1 max-w-[320px]">
                <Search
                  size={15}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
                />
                <input
                  type="text"
                  value={busqueda}
                  onChange={e => setBusqueda(e.target.value)}
                  placeholder="Buscar por empresa o RUT..."
                  className="form-input w-full pl-9 py-2 text-[13px] bg-[#f1efe6] border-cream3 focus:bg-white transition-all rounded-xl"
                />
              </div>
              
              <select
                value={proyectoFiltro}
                onChange={e => setProyectoFiltro(e.target.value)}
                className="form-input py-2 text-[13px] min-w-[180px] bg-[#f1efe6] border-cream3 rounded-xl cursor-pointer"
              >
                <option value="todos">Todos los proyectos</option>
                {GLOBAL_PROYECTOS.map(p => (
                  <option key={p.id} value={p.nombre}>{p.nombre}</option>
                ))}
              </select>
            </div>
            
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-cream3">
                  <th className="px-4 py-3.5 text-[10.5px] uppercase font-bold tracking-wider text-gray-500 bg-cream2">Empresa</th>
                  <th className="px-4 py-3.5 text-[10.5px] uppercase font-bold tracking-wider text-gray-500 bg-cream2">Proyectos</th>
                  <th className="px-4 py-3.5 text-[10.5px] uppercase font-bold tracking-wider text-gray-500 bg-cream2">Documentación</th>
                  <th className="px-4 py-3.5 text-[10.5px] uppercase font-bold tracking-wider text-gray-500 bg-cream2">Estado</th>
                  <th className="px-4 py-3.5 text-[10.5px] uppercase font-bold tracking-wider text-gray-500 bg-cream2">Última actividad</th>
                  <th className="px-4 py-3.5 text-[10.5px] uppercase font-bold tracking-wider text-gray-500 bg-cream2 text-right"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {visibles.map((c, i) => {
                  const total = c.docsTotal ?? 0;
                  const aprobados = c.docsAprobados ?? 0;
                  const pct = total > 0 ? Math.round((aprobados / total) * 100) : 0;
                  const sev = c.sev as Severidad;
                  const avatarBg = getAvatarBgColor(c.empresa || '');
                  const ultimaActividad = getUltimaActividad(c.rut, dbContratistas);

                  return (
                    <tr
                      key={`${c.rut}-${i}`}
                      onClick={() => setClienteSeleccionado(c)}
                      className="hover:bg-[#fbfaf6] cursor-pointer transition-colors"
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-xl ${avatarBg} text-white flex items-center justify-center font-bold text-[13px] tracking-wide shrink-0 shadow-sm`}>
                            {c.iniciales}
                          </div>
                          <div>
                            <div className="text-[14px] font-semibold text-navy tracking-tight">{c.empresa}</div>
                            <div className="text-[11.5px] text-gray-400 font-medium mt-0.5">{c.rut}</div>
                          </div>
                        </div>
                      </td>
                      
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1 max-w-[220px]">
                          {(c.proyectos || []).map((p: string, j: number) => (
                            <span
                              key={j}
                              className="text-[10.5px] bg-cream2 text-navy border border-cream3 rounded-md px-2 py-0.5 font-medium"
                            >
                              {p}
                            </span>
                          ))}
                        </div>
                      </td>
                      
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3 min-w-[140px]">
                          {renderProgressRing(pct, sev)}
                          <div>
                            <div className="text-[13px] font-bold text-navy">{aprobados}/{total}</div>
                            <div className="text-[11px] text-gray-500 font-medium">{pct}% completo</div>
                          </div>
                        </div>
                      </td>
                      
                      <td className="px-4 py-3">
                        <SeverityBadge severidad={sev} formato="corto" />
                      </td>
                      
                      <td className="px-4 py-3">
                        <span className="text-[12px] text-gray-500 font-medium">{ultimaActividad}</span>
                      </td>
                      
                      <td className="px-4 py-3 text-right" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-2">
                          <button
                            title="Enviar mensaje"
                            className="w-8 h-8 rounded-lg border border-cream3 bg-white text-navy flex items-center justify-center cursor-pointer hover:bg-navy hover:text-white transition-all shrink-0"
                          >
                            <MessageSquare size={14} />
                          </button>
                          <button
                            title="Ver ficha"
                            onClick={() => setClienteSeleccionado(c)}
                            className="w-8 h-8 rounded-lg bg-gold-soft border border-gold-soft text-gold flex items-center justify-center cursor-pointer hover:bg-gold hover:text-white transition-all shrink-0"
                          >
                            <Eye size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {visibles.length === 0 && (
            <div className="text-center py-12 px-4">
              <p className="text-[13.5px] text-gray-400 font-medium">
                No hay contratistas que coincidan con la búsqueda o los filtros.
              </p>
              {hayFiltros && (
                <button onClick={limpiarFiltros} className="text-brown text-[12.5px] mt-2 hover:underline cursor-pointer font-semibold border-none bg-transparent">
                  Limpiar filtros
                </button>
              )}
            </div>
          )}

          <div className="text-[12px] text-gray-400 px-4 py-3.5 border-t border-cream2 font-medium">
            Mostrando {visibles.length} de {EMPRESAS_CONTRATISTAS.length} contratistas
            {sevFiltro && ` · filtrando por ${SEVERIDAD_LABEL[sevFiltro]}`}
          </div>

        </div>

      </div>
    </div>
  );
}
