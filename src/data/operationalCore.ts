import type { CierreDocumental, ObligacionDocumental, Proyecto, ServicioContrato, Trabajador } from '../types';
import { getRuntimeArray, setRuntimeArray } from './businessRuntimeCache';
import { requestBusinessPersistence } from './supabasePersistence';

const SERVICES_KEY = 'acredita_servicios';
const OBLIGATIONS_KEY = 'acredita_obligaciones';
const CLOSURES_KEY = 'acredita_cierres';

export function getServicios(): ServicioContrato[] {
  return getRuntimeArray<ServicioContrato>(SERVICES_KEY, []);
}

export function saveServicios(items: ServicioContrato[]): void {
  setRuntimeArray(SERVICES_KEY, items);
  requestBusinessPersistence('core');
}

export function proyectoOperativoParaContratista(proyecto: Proyecto | undefined, contratistaId: string): boolean {
  if (!proyecto) return false;
  const proyectoActivo = ['activo', 'active'].includes(String(proyecto.estado || '').trim().toLocaleLowerCase('es'));
  if (!proyectoActivo) return false;
  // Las hidrataciones nuevas conservan la relación activa Contratista–Proyecto
  // separada de la visibilidad histórica. En datos legados sin ese campo,
  // mantenemos compatibilidad usando la asociación visible existente.
  if (Array.isArray(proyecto.contratistasActivos)) return proyecto.contratistasActivos.includes(contratistaId);
  return proyecto.contratistas.includes(contratistaId);
}

export function getServiciosProyecto(
  proyectoId: string,
  contratistaId?: string,
  incluirInactivos = false,
): ServicioContrato[] {
  return getServicios().filter(item =>
    item.proyectoId === proyectoId
    && (incluirInactivos || item.activo)
    && (!contratistaId || item.contratistaId === contratistaId)
  );
}

export function getObligacionesDocumentales(): ObligacionDocumental[] {
  return getRuntimeArray<ObligacionDocumental>(OBLIGATIONS_KEY, []);
}

export function setObligacionesDocumentales(items: ObligacionDocumental[]): void {
  setRuntimeArray(OBLIGATIONS_KEY, items);
}

export function getCierresDocumentales(): CierreDocumental[] {
  return getRuntimeArray<CierreDocumental>(CLOSURES_KEY, []);
}

export function setCierresDocumentales(items: CierreDocumental[]): void {
  setRuntimeArray(CLOSURES_KEY, items);
}

export function getAsignacionProyecto(trabajador: Trabajador, proyectoId: string) {
  return trabajador.asignaciones?.find(item => item.proyectoId === proyectoId && item.estado === 'activa');
}

export function formatPeriodo(inicio: string, fin: string): string {
  const start = new Date(`${inicio}T12:00:00Z`);
  const end = new Date(`${fin}T12:00:00Z`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return `${inicio} – ${fin}`;
  const monthly = start.getUTCDate() === 1
    && end.getUTCDate() >= 28
    && start.getUTCMonth() === end.getUTCMonth()
    && start.getUTCFullYear() === end.getUTCFullYear();
  if (monthly) {
    const label = new Intl.DateTimeFormat('es-CL', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(start);
    return label.charAt(0).toUpperCase() + label.slice(1);
  }
  const formatter = new Intl.DateTimeFormat('es-CL', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' });
  return `${formatter.format(start).replace(/\./g, '')} – ${formatter.format(end).replace(/\./g, '')}`;
}

export function buildComplianceCsv(
  obligations: ObligacionDocumental[],
  requirementNames: Map<string, string>,
  contractorNames: Map<string, string>,
): string {
  const escape = (value: unknown) => `"${String(value ?? '').replaceAll('"', '""')}"`;
  const rows = obligations.map(item => [
    contractorNames.get(item.contratistaId) || item.contratistaId,
    requirementNames.get(item.requisitoId) || item.requisitoId,
    item.periodoEtiqueta,
    item.trabajadorRut || 'Empresa',
    item.estado,
    item.fechaLimite,
  ]);
  return [
    ['Contratista', 'Requisito', 'Periodo', 'Destino', 'Estado', 'Fecha limite'],
    ...rows,
  ].map(row => row.map(escape).join(';')).join('\n');
}

export function downloadCsv(filename: string, contents: string): void {
  const blob = new Blob([`\ufeff${contents}`], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
