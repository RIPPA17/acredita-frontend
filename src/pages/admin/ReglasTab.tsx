import { useMemo } from 'react';
import { Trash2, Plus } from 'lucide-react';
import { saveReglas, obtenerDiasRestantes, REGLAS_DEFAULT } from '../../data/localStorageDb';
import { Contratista, Proyecto } from '../../types';

type Regla = {
  id: number;
  documento: string;
  diasVigencia: number;
  alertaDias: number;
  criticidad: "bloquea_pago" | "bloquea_acceso" | "advertencia";
  isNew?: boolean;
};

const BADGE_CLASS: Record<'red' | 'amber' | 'green' | 'gray', string> = {
  red: 'border-red-200 bg-red-50 text-red-700',
  amber: 'border-amber-200 bg-amber-50 text-amber-700',
  green: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  gray: 'border-cream3 bg-cream2 text-gray-600',
};

const DOT_COLOR: Record<'red' | 'amber' | 'green', string> = {
  red: '#a32d2d',
  amber: '#b58600',
  green: '#1e7a3c',
};

function effectLabel(c: Regla['criticidad']) {
  return c === 'bloquea_pago' ? 'Bloquea pago' : c === 'bloquea_acceso' ? 'Bloquea acceso' : 'Solo advertencia';
}

function effectBadgeClass(c: Regla['criticidad']) {
  return c === 'bloquea_acceso' ? BADGE_CLASS.red : c === 'bloquea_pago' ? BADGE_CLASS.amber : BADGE_CLASS.gray;
}

function evaluarRegla(r: Regla): { level: 'red' | 'amber' | 'green'; badge: string; msg: string } {
  if (r.alertaDias >= r.diasVigencia) {
    return {
      level: 'red',
      badge: 'Revisar',
      msg: `La alerta está configurada para el mismo día o después de que vence su vigencia (${r.diasVigencia} días).`,
    };
  }
  if (r.alertaDias < Math.max(1, Math.round(r.diasVigencia * 0.12))) {
    return {
      level: 'amber',
      badge: 'Atención',
      msg: `La alerta se activa solo ${r.alertaDias} día${r.alertaDias === 1 ? '' : 's'} antes del vencimiento.`,
    };
  }
  return { level: 'green', badge: 'Correcta', msg: 'Configuración consistente con su efecto operativo.' };
}

function riskClass(dias: number): 'red' | 'amber' | 'gray' {
  return dias <= 3 ? 'red' : dias <= 7 ? 'amber' : 'gray';
}

function riskLabel(dias: number) {
  return dias <= 0 ? 'Vencido' : dias === 1 ? 'Vence mañana' : `Vence en ${dias} días`;
}

function riskEffectLabel(c: Regla['criticidad']) {
  return c === 'bloquea_acceso' ? 'Riesgo de acceso' : c === 'bloquea_pago' ? 'Riesgo de pago' : 'Advertencia';
}

export default function ReglasTab({
  reglas,
  setReglas,
  showToast,
  GLOBAL_CONTRATISTAS,
  GLOBAL_PROYECTOS,
}: {
  reglas: Regla[];
  setReglas: (v: Regla[]) => void;
  showToast: (msg: string, type?: 'success' | 'error' | 'warning') => void;
  GLOBAL_CONTRATISTAS: Contratista[];
  GLOBAL_PROYECTOS: Proyecto[];
}) {
  const hasError = reglas.some(r => r.alertaDias >= r.diasVigencia);

  const alertItems = reglas.map(r => ({ regla: r, ...evaluarRegla(r) }));
  const avisos = alertItems.filter(a => a.level !== 'green').length;

  const documentosEnRiesgo = useMemo(() => {
    const result: Array<{ key: string; titular: string; docNombre: string; dias: number; vencimiento: string; criticidad: Regla['criticidad'] }> = [];
    GLOBAL_CONTRATISTAS.forEach(c => {
      const docs = [
        ...(c.documentos || []).map(d => ({ d, quien: c.nombre })),
        ...((c.trabajadores || []).flatMap(w => (w.documentos || []).map(d => ({ d, quien: `${c.nombre} · ${w.nombre}` })))),
      ];
      docs.forEach(({ d, quien }) => {
        if (d.estado === 'rechazado' || d.estado === 'revision') return;
        const regla = reglas.find(r =>
          r.documento &&
          (d.nombre.toLowerCase().includes(r.documento.toLowerCase()) || r.documento.toLowerCase().includes(d.nombre.toLowerCase()))
        );
        if (!regla) return;
        const dias = obtenerDiasRestantes(d.vencimiento);
        if (dias <= regla.alertaDias) {
          const proyecto = GLOBAL_PROYECTOS.find(p => p.id === d.proyectoId);
          result.push({
            key: `${c.id}-${quien}-${d.id}`,
            titular: proyecto ? `${quien} · ${proyecto.nombre}` : quien,
            docNombre: d.nombre,
            dias,
            vencimiento: d.vencimiento,
            criticidad: regla.criticidad,
          });
        }
      });
    });
    return result.sort((a, b) => a.dias - b.dias);
  }, [GLOBAL_CONTRATISTAS, GLOBAL_PROYECTOS, reglas]);

  const restaurarPredeterminadas = () => {
    if (window.confirm('¿Restaurar las reglas a sus valores predeterminados? Se perderán los cambios y reglas personalizadas no guardadas.')) {
      setReglas(REGLAS_DEFAULT.map(r => ({ ...r, criticidad: r.criticidad as Regla['criticidad'] })));
      showToast('Reglas restauradas a sus valores predeterminados', 'warning');
    }
  };

  const guardarCambios = () => {
    saveReglas(reglas);
    showToast('Cambios guardados con éxito');
  };

  return (
    <div className="fade-in relative">
      {/* Premium Dark Brand Band Header */}
      <div className="relative overflow-hidden bg-gradient-to-br from-navy to-navy-2 px-8 py-4 pb-12 -mx-8 -mt-6">
        <div className="absolute top-[-30%] right-[-10%] w-[400px] h-[400px] rounded-full bg-[radial-gradient(circle,rgba(154,105,78,0.15),transparent_70%)] pointer-events-none" />

        <div className="max-w-[1200px] mx-auto flex flex-col md:flex-row justify-between items-start md:items-center gap-4 relative z-10">
          <div>
            <span className="text-[11px] tracking-[2px] uppercase font-semibold text-gold-hover">
              Administración · Configuración documental
            </span>
            <h2 className="text-2xl font-semibold text-white mt-1">Reglas de vigencia</h2>
            <p className="text-[13.5px] text-gray-300 mt-1.5 max-w-[560px]">
              Define cuánto dura cada tipo de documento, cuándo alertar y qué efecto tiene un incumplimiento sobre la operación.
            </p>
          </div>

          <div className="flex gap-2.5 shrink-0">
            <button
              onClick={restaurarPredeterminadas}
              className="px-4.5 py-2.5 rounded-xl border border-white/20 bg-white/5 text-gray-100 hover:bg-white/10 text-[13.5px] font-semibold flex items-center gap-2 cursor-pointer transition-all"
            >
              Restaurar predeterminadas
            </button>
            <button
              onClick={guardarCambios}
              disabled={hasError}
              className={`px-4.5 py-2.5 rounded-xl bg-gradient-to-r from-gold-hover to-gold text-white hover:brightness-105 text-[13.5px] font-semibold flex items-center gap-2 cursor-pointer transition-all shadow-[0_6px_16px_rgba(179,137,63,0.35)] border-none ${hasError ? 'opacity-50 pointer-events-none' : ''}`}
            >
              Guardar cambios
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Area (floated up) */}
      <div className="relative z-20 -mt-8 max-w-[1200px] mx-auto px-1 flex flex-col gap-5">

        {/* Alertas + Efectos row */}
        <div className="grid grid-cols-1 md:grid-cols-[1.35fr_0.85fr] gap-4">

          <section className="bg-white rounded-2xl border border-cream3 shadow-sm overflow-hidden flex flex-col">
            <div className="p-4 border-b border-cream3 flex justify-between items-start gap-3">
              <div>
                <div className="text-[14px] font-bold text-navy">Alertas de configuración</div>
                <div className="text-[11px] text-gray-500 mt-0.5">Revisa reglas que pueden generar comportamientos inesperados.</div>
              </div>
              {avisos > 0 && (
                <span className={`badge border font-semibold shrink-0 whitespace-nowrap ${BADGE_CLASS.amber}`}>
                  {avisos} {avisos === 1 ? 'aviso' : 'avisos'}
                </span>
              )}
            </div>
            <div className="p-2 flex flex-col">
              {alertItems.map(item => (
                <div key={item.regla.id} className="flex items-center gap-2.5 px-3 py-2.5 border-b border-cream2 last:border-b-0">
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ background: DOT_COLOR[item.level] }} />
                  <div className="flex-1 min-w-0">
                    <div className="text-[12px] font-semibold text-navy truncate">{item.regla.documento || 'Documento sin nombre'}</div>
                    <div className="text-[10.5px] text-gray-500 truncate">{item.msg}</div>
                  </div>
                  <span className={`badge border font-semibold shrink-0 whitespace-nowrap ${BADGE_CLASS[item.level]}`}>
                    {item.badge}
                  </span>
                </div>
              ))}
            </div>
          </section>

          <section className="bg-white rounded-2xl border border-cream3 shadow-sm overflow-hidden flex flex-col">
            <div className="p-4 border-b border-cream3 flex justify-between items-start gap-3">
              <div>
                <div className="text-[14px] font-bold text-navy">Efectos operativos</div>
                <div className="text-[11px] text-gray-500 mt-0.5">Documentos que están en riesgo por proximidad de vencimiento.</div>
              </div>
              <span className={`badge border font-semibold shrink-0 whitespace-nowrap ${documentosEnRiesgo.length > 0 ? BADGE_CLASS.amber : BADGE_CLASS.green}`}>
                {documentosEnRiesgo.length} {documentosEnRiesgo.length === 1 ? 'documento' : 'documentos'} en riesgo
              </span>
            </div>
            <div className="p-2 flex flex-col">
              {documentosEnRiesgo.length > 0 ? (
                <>
                  {documentosEnRiesgo.slice(0, 6).map(d => (
                    <div key={d.key} className="flex items-center gap-2.5 px-3 py-2.5 border-b border-cream2 last:border-b-0">
                      <div className="flex-1 min-w-0">
                        <div className="text-[12px] font-semibold text-navy truncate">{d.docNombre}</div>
                        <div className="text-[10.5px] text-gray-500 truncate">{riskLabel(d.dias)} · {d.titular}</div>
                      </div>
                      <span className={`badge border font-semibold shrink-0 whitespace-nowrap ${BADGE_CLASS[riskClass(d.dias)]}`}>
                        {riskEffectLabel(d.criticidad)}
                      </span>
                    </div>
                  ))}
                  {documentosEnRiesgo.length > 6 && (
                    <div className="text-[11px] text-gray-400 text-center py-2">
                      +{documentosEnRiesgo.length - 6} más
                    </div>
                  )}
                </>
              ) : (
                <div className="flex items-center gap-2.5 px-3 py-4">
                  <div className="flex-1 min-w-0">
                    <div className="text-[12px] font-semibold text-navy">Sin documentos en riesgo</div>
                    <div className="text-[10.5px] text-gray-500">No hay documentos dentro de su período de alerta de vigencia.</div>
                  </div>
                  <span className={`badge border font-semibold shrink-0 whitespace-nowrap ${BADGE_CLASS.green}`}>Todo al día</span>
                </div>
              )}
            </div>
          </section>
        </div>

        {/* Rules table */}
        <div className="bg-white rounded-2xl border border-cream3 shadow-sm overflow-hidden flex flex-col">
          <div className="p-4 border-b border-cream3 flex justify-between items-start gap-3 flex-wrap">
            <div>
              <div className="text-[14px] font-bold text-navy">Configuración de reglas</div>
              <div className="text-[11px] text-gray-500 mt-0.5">Edita directamente la vigencia, la anticipación de alerta y el efecto operacional.</div>
            </div>
            <button
              onClick={() => setReglas([...reglas, { id: Date.now(), documento: "", diasVigencia: 30, alertaDias: 7, criticidad: "advertencia", isNew: true }])}
              className="btn btn-primary btn-sm whitespace-nowrap"
            >
              <Plus size={14} /> Añadir regla
            </button>
          </div>

          <div className="alert alert-warn mb-0 rounded-none border-l-0 border-t-0 border-r-0">
            La alerta anticipada debe ser menor que los días de vigencia. Los cambios se aplican a los cálculos futuros de acreditación.
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-cream3">
                  <th className="px-4 py-3.5 text-[10.5px] uppercase font-bold tracking-wider text-gray-500 bg-cream2">Documento</th>
                  <th className="px-4 py-3.5 text-[10.5px] uppercase font-bold tracking-wider text-gray-500 bg-cream2">Vigencia</th>
                  <th className="px-4 py-3.5 text-[10.5px] uppercase font-bold tracking-wider text-gray-500 bg-cream2">Alertar antes</th>
                  <th className="px-4 py-3.5 text-[10.5px] uppercase font-bold tracking-wider text-gray-500 bg-cream2">Criticidad</th>
                  <th className="px-4 py-3.5 text-[10.5px] uppercase font-bold tracking-wider text-gray-500 bg-cream2">Efecto</th>
                  <th className="px-4 py-3.5 text-[10.5px] uppercase font-bold tracking-wider text-gray-500 bg-cream2">Estado</th>
                  <th className="px-4 py-3.5 text-[10.5px] uppercase font-bold tracking-wider text-gray-500 bg-cream2 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {reglas.map(regla => {
                  const rowErr = regla.alertaDias >= regla.diasVigencia;
                  return (
                    <tr key={regla.id} className="hover:bg-[#fbfaf6] transition-colors">
                      <td className="px-4 py-3">
                        {regla.isNew ? (
                          <input
                            type="text"
                            className="form-input w-full min-w-[160px]"
                            placeholder="Nombre de documento..."
                            value={regla.documento}
                            onChange={(e) => setReglas(reglas.map(r => r.id === regla.id ? { ...r, documento: e.target.value } : r))}
                          />
                        ) : (
                          <>
                            <div className="text-[13.5px] font-semibold text-navy">{regla.documento}</div>
                            <div className="text-[10.5px] text-gray-400 mt-0.5">{rowErr ? '⚠ revisar configuración' : 'Regla activa'}</div>
                          </>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <input
                          type="number"
                          min={1}
                          className="form-input w-20"
                          value={regla.diasVigencia}
                          onChange={(e) => setReglas(reglas.map(r => r.id === regla.id ? { ...r, diasVigencia: Number(e.target.value) } : r))}
                        />
                      </td>
                      <td className="px-4 py-3">
                        <input
                          type="number"
                          min={0}
                          className={`form-input w-20 ${rowErr ? 'border-red-400 bg-red-50' : ''}`}
                          value={regla.alertaDias}
                          onChange={(e) => setReglas(reglas.map(r => r.id === regla.id ? { ...r, alertaDias: Number(e.target.value) } : r))}
                        />
                      </td>
                      <td className="px-4 py-3">
                        <select
                          className="form-input w-full min-w-[160px]"
                          value={regla.criticidad}
                          onChange={(e) => setReglas(reglas.map(r => r.id === regla.id ? { ...r, criticidad: e.target.value as Regla['criticidad'] } : r))}
                        >
                          <option value="bloquea_pago">Bloquea pago</option>
                          <option value="bloquea_acceso">Bloquea acceso</option>
                          <option value="advertencia">Solo advertencia</option>
                        </select>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`badge border font-semibold whitespace-nowrap ${effectBadgeClass(regla.criticidad)}`}>
                          {effectLabel(regla.criticidad)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`badge border font-semibold whitespace-nowrap ${rowErr ? BADGE_CLASS.red : BADGE_CLASS.green}`}>
                          {rowErr ? 'Revisar' : 'Activa'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => {
                            if (window.confirm(`¿Eliminar la regla de "${regla.documento || 'este documento'}"? Esta acción no se puede deshacer.`)) {
                              setReglas(reglas.filter(r => r.id !== regla.id));
                            }
                          }}
                          className="text-gray-400 hover:text-red-500"
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="px-4 py-3.5 border-t border-cream3 flex items-center justify-between gap-3 flex-wrap">
            <span className="text-[11px] text-gray-400">Los cambios pendientes se guardan al presionar "Guardar cambios".</span>
            <span className="text-[11px] text-gray-400">Los cambios se guardan en este navegador.</span>
          </div>
        </div>

      </div>
    </div>
  );
}
