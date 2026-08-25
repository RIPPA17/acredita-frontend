import type { Contratista, Proyecto } from '../types';
import { calcularEstadoAcreditacion, getAlertasVigencia } from './localStorageDb';

export type OperationalNotificationType = 'accion' | 'preventiva' | 'revision' | 'positiva';
export type OperationalNotificationDestination = 'cola' | 'acreditacion' | 'proyecto';

export interface OperationalNotification {
  id: string;
  tipo: OperationalNotificationType;
  titulo: string;
  descripcion: string;
  fecha?: string;
  cta: string;
  destino: OperationalNotificationDestination;
  proyectoId?: string;
  contratistaId?: string;
  prioridad: number;
}

function stateSignature(contratista: Contratista, proyectoId: string): string {
  const entries: string[] = [];
  for (const doc of contratista.documentos || []) {
    if (doc.proyectoId === proyectoId) entries.push(`${doc.id}:${doc.version || 1}:${doc.estado}:${doc.vencimiento || ''}`);
  }
  for (const worker of contratista.trabajadores || []) {
    for (const doc of worker.documentos || []) {
      if (doc.proyectoId === proyectoId) entries.push(`${worker.rut}:${doc.id}:${doc.version || 1}:${doc.estado}:${doc.vencimiento || ''}`);
    }
  }
  let hash = 2166136261;
  for (const char of entries.sort().join('|')) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

function buildStatusNotifications(contratistas: Contratista[], proyectos: Proyecto[]): OperationalNotification[] {
  const result: OperationalNotification[] = [];
  for (const proyecto of proyectos) {
    for (const contratista of contratistas.filter(item => (item.proyectos || []).includes(proyecto.id))) {
      const estado = calcularEstadoAcreditacion(contratista, proyecto.id);
      const signature = stateSignature(contratista, proyecto.id);
      if (estado === 'Vencido/Bloqueado') {
        result.push({
          id: `acreditacion-bloqueada:${proyecto.id}:${contratista.id}:${signature}`,
          tipo: 'accion',
          titulo: `${contratista.nombre} está bloqueado`,
          descripcion: `La acreditación en ${proyecto.nombre} tiene un requisito obligatorio rechazado o vencido. Acceso y/o pago permanecen bloqueados.`,
          cta: 'Ver acreditación',
          destino: 'acreditacion',
          proyectoId: proyecto.id,
          contratistaId: contratista.id,
          prioridad: 0,
        });
      } else if (estado === 'Aprobado') {
        result.push({
          id: `acreditacion-aprobada:${proyecto.id}:${contratista.id}:${signature}`,
          tipo: 'positiva',
          titulo: `${contratista.nombre} quedó acreditado`,
          descripcion: `La acreditación de ${proyecto.nombre} cumple todos los requisitos obligatorios y tiene acceso/pago habilitados.`,
          cta: 'Ver acreditación',
          destino: 'acreditacion',
          proyectoId: proyecto.id,
          contratistaId: contratista.id,
          prioridad: 4,
        });
      }
    }
  }
  return result;
}

function buildExpiryNotifications(proyectos: Proyecto[]): OperationalNotification[] {
  const allowed = new Set(proyectos.map(item => item.id));
  return getAlertasVigencia()
    .filter(alerta => allowed.has(alerta.proyectoId))
    .map(alerta => ({
      id: `${alerta.bloquea ? 'vencido' : 'por-vencer'}:${alerta.id}:${alerta.vencimiento}`,
      tipo: alerta.bloquea ? 'accion' as const : 'preventiva' as const,
      titulo: alerta.trabajadorNombre
        ? `${alerta.documentoNombre} de ${alerta.trabajadorNombre} ${alerta.bloquea ? 'está vencido' : `vence en ${alerta.diasRestantes} días`}`
        : `${alerta.documentoNombre} de ${alerta.empresaNombre} ${alerta.bloquea ? 'está vencido' : `vence en ${alerta.diasRestantes} días`}`,
      descripcion: alerta.bloquea
        ? `${alerta.empresaNombre} tiene una obligación vencida en ${alerta.proyectoNombre}.`
        : `Vigencia preventiva en ${alerta.proyectoNombre}; aún no bloquea la acreditación.`,
      fecha: alerta.vencimiento,
      cta: 'Ver proyecto',
      destino: 'proyecto' as const,
      proyectoId: alerta.proyectoId,
      contratistaId: alerta.empresaId,
      prioridad: alerta.bloquea ? 1 : 2,
    }));
}

export function buildMandanteNotifications(
  mandanteId: string,
  contratistas: Contratista[],
  proyectos: Proyecto[],
): OperationalNotification[] {
  const propios = proyectos.filter(item => item.mandanteId === mandanteId);
  return [...buildStatusNotifications(contratistas, propios), ...buildExpiryNotifications(propios)]
    .sort((a, b) => a.prioridad - b.prioridad || a.titulo.localeCompare(b.titulo));
}

export function buildAdminNotifications(
  contratistas: Contratista[],
  proyectos: Proyecto[],
  pendingReviewCount: number,
): OperationalNotification[] {
  const items = [...buildStatusNotifications(contratistas, proyectos), ...buildExpiryNotifications(proyectos)];
  if (pendingReviewCount > 0) {
    items.push({
      id: `cola-revision:${pendingReviewCount}`,
      tipo: 'revision',
      titulo: `${pendingReviewCount} documento${pendingReviewCount === 1 ? '' : 's'} esperando revisión`,
      descripcion: 'La cola operativa tiene documentos pendientes de decisión por Acredita.',
      cta: 'Abrir cola',
      destino: 'cola',
      prioridad: 1,
    });
  }
  return items.sort((a, b) => a.prioridad - b.prioridad || a.titulo.localeCompare(b.titulo));
}
