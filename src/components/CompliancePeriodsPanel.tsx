import { useState } from 'react';
import { CalendarClock, CheckCircle2, LockKeyhole, RotateCcw } from 'lucide-react';
import type { CierreDocumental } from '../types';
import { closeCompliancePeriod, updateCompliancePeriodStatus } from '../data/supabaseCompliancePeriods';
import { formatPeriodo } from '../data/operationalCore';

const LABEL: Record<CierreDocumental['estado'], string> = {
  abierto: 'Carga abierta',
  en_revision: 'En revisión',
  cerrado: 'Cerrado',
  reabierto: 'Reabierto',
};

export default function CompliancePeriodsPanel({
  periods,
  onChanged,
  showToast,
}: {
  periods: CierreDocumental[];
  onChanged: () => void;
  showToast: (message: string, type?: 'success' | 'error' | 'warning') => void;
}) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const today = new Date().toISOString().slice(0, 10);
  const visiblePeriods = periods
    .filter(period => period.periodoInicio <= today)
    .sort((a, b) => b.periodoInicio.localeCompare(a.periodoInicio))
    .slice(0, 12);

  const act = async (period: CierreDocumental, action: 'review' | 'close' | 'reopen') => {
    if (busyId) return;
    setBusyId(period.id);
    try {
      if (action === 'close') await closeCompliancePeriod(period.id);
      else await updateCompliancePeriodStatus(period.id, action === 'review' ? 'en_revision' : 'reabierto');
      onChanged();
      showToast(action === 'close' ? 'Período cerrado y fotografía histórica guardada.' : action === 'review' ? 'Período enviado a revisión.' : 'Período reabierto.', action === 'reopen' ? 'warning' : 'success');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'No fue posible actualizar el período.', 'error');
    } finally {
      setBusyId(null);
    }
  };

  return <article className="mandante-proyectos-section-card mandante-proyectos-panel">
    <div className="mandante-proyectos-section-head"><div><h2>Cierres documentales</h2><p>Cada cierre conserva una fotografía histórica del cumplimiento del proyecto.</p></div></div>
    <div className="mandante-proyectos-table-wrap"><table><thead><tr><th>Período</th><th>Carga hasta</th><th>Estado</th><th>Cierre</th><th>Acción</th></tr></thead><tbody>{visiblePeriods.map(period => <tr key={period.id}>
      <td><strong>{formatPeriodo(period.periodoInicio, period.periodoFin)}</strong><small>{period.periodoInicio} al {period.periodoFin}</small></td>
      <td>{period.fechaCargaHasta || 'Sin fecha límite'}</td>
      <td><b className={`mandante-proyectos-badge ${period.estado === 'cerrado' ? 'green' : period.estado === 'en_revision' ? 'yellow' : 'gray'}`}>{LABEL[period.estado]}</b></td>
      <td>{period.fechaCierre ? new Date(period.fechaCierre).toLocaleString('es-CL') : '—'}</td>
      <td>{period.estado === 'abierto' || period.estado === 'reabierto'
        ? <button type="button" disabled={busyId === period.id} onClick={() => void act(period, 'review')}><CalendarClock size={14} /> Enviar a revisión</button>
        : period.estado === 'en_revision'
          ? <button type="button" disabled={busyId === period.id} onClick={() => void act(period, 'close')}><LockKeyhole size={14} /> Cerrar período</button>
          : <button type="button" disabled={busyId === period.id} onClick={() => void act(period, 'reopen')}><RotateCcw size={14} /> Reabrir</button>}</td>
    </tr>)}</tbody></table></div>
    {visiblePeriods.length === 0 && <div className="mandante-proyectos-empty"><CheckCircle2 /> El proyecto todavía no tiene períodos operacionales generados.</div>}
  </article>;
}
