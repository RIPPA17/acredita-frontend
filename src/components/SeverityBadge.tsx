/**
 * Shared 3-level severity taxonomy (Crítico / Atención / Al día), the same
 * language the admin dashboard queue uses.
 *
 * This replaces the colour logic that was copy-pasted inline in
 * ContratistasTab, MandantesTab and ClienteDetailDrawer. That copy tested
 * `cumplimiento.includes("Vencido")` for its red branch, but `cumplimiento` is
 * only ever "100% Aprobado", "Con Docs. Rechazados" or "Con Docs. por Vencer"
 * — none of which contain "Vencido" ("Vencer" != "Vencido") — so the red branch
 * was unreachable and rejected documents rendered the same yellow as documents
 * merely about to expire.
 */

export type Severidad = 'critico' | 'atencion' | 'normal';

export const SEVERIDAD_LABEL: Record<Severidad, string> = {
  critico: 'Crítico',
  atencion: 'Atención',
  normal: 'Al día',
};

export const SEVERIDAD_ORDEN: Record<Severidad, number> = {
  critico: 0,
  atencion: 1,
  normal: 2,
};

export function severidadDeCumplimiento(cumplimiento?: string): Severidad {
  if (cumplimiento === 'Con Docs. Rechazados' || cumplimiento?.includes('Vencido')) return 'critico';
  if (cumplimiento === '100% Aprobado') return 'normal';
  // Anything else (including "Con Docs. por Vencer" and unknown states) is
  // flagged rather than silently reported as compliant.
  return 'atencion';
}

export default function SeverityBadge({
  cumplimiento,
  severidad,
  formato = 'completo',
  className = '',
}: {
  cumplimiento?: string;
  severidad?: Severidad;
  /** 'completo' keeps the original wording; 'corto' shows Crítico / Atención / Al día. */
  formato?: 'completo' | 'corto';
  className?: string;
}) {
  const sev = severidad ?? severidadDeCumplimiento(cumplimiento);
  const texto = formato === 'corto' ? SEVERIDAD_LABEL[sev] : (cumplimiento ?? SEVERIDAD_LABEL[sev]);
  // 'normal' means "compliant" here, so it reads green rather than the neutral
  // grey the dashboard queue uses for low-priority pending work.
  const clase = sev === 'normal' ? 'sev-ok' : `sev-${sev}`;

  return <span className={`sev ${clase} ${className}`}>{texto}</span>;
}
