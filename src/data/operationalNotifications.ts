import type { Contratista, Proyecto } from '../types';
import { calcularEstadoAcreditacion, getAlertasVigencia, getRequisitos } from './businessStore';
import type { StoredNotification } from './supabaseNotifications';

export type OperationalNotificationType = 'accion' | 'preventiva' | 'revision' | 'positiva';
export type OperationalNotificationDestination =
  | 'cola'
  | 'acreditacion'
  | 'proyecto'
  | 'trabajador'
  | 'documento'
  | 'operacion'
  | 'soporte';

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
  workerRut?: string;
  requirementId?: string;
  documentId?: string;
  operationMode?: 'evaluacion' | 'pago' | 'ticket';
  operationItemId?: string;
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
  const requisitos = getRequisitos();
  return getAlertasVigencia()
    .filter(alerta => allowed.has(alerta.proyectoId))
    .map(alerta => {
      const requirement = requisitos.find(item =>
        item.proyectoId === alerta.proyectoId
        && item.destino === (alerta.trabajadorRut ? 'trabajador' : 'empresa')
        && item.nombre.trim().toLocaleLowerCase('es') === alerta.documentoNombre.trim().toLocaleLowerCase('es')
      );
      return {
        id: `${alerta.bloquea ? 'vencido' : 'por-vencer'}:${alerta.id}:${alerta.vencimiento}`,
        tipo: alerta.bloquea ? 'accion' as const : 'preventiva' as const,
        titulo: alerta.trabajadorNombre
          ? `${alerta.documentoNombre} de ${alerta.trabajadorNombre} ${alerta.bloquea ? 'está vencido' : `vence en ${alerta.diasRestantes} días`}`
          : `${alerta.documentoNombre} de ${alerta.empresaNombre} ${alerta.bloquea ? 'está vencido' : `vence en ${alerta.diasRestantes} días`}`,
        descripcion: alerta.bloquea
          ? `${alerta.empresaNombre} tiene una obligación vencida en ${alerta.proyectoNombre}.`
          : `Vigencia preventiva en ${alerta.proyectoNombre}; aún no bloquea la acreditación.`,
        fecha: alerta.vencimiento,
        cta: alerta.trabajadorRut ? 'Ver trabajador' : 'Ver documento',
        destino: alerta.trabajadorRut ? 'trabajador' as const : 'documento' as const,
        proyectoId: alerta.proyectoId,
        contratistaId: alerta.empresaId,
        workerRut: alerta.trabajadorRut,
        requirementId: requirement?.id,
        documentId: alerta.documentoId,
        prioridad: alerta.bloquea ? 1 : 2,
      };
    });
}

function storedType(item: StoredNotification): OperationalNotificationType {
  if (item.category === 'preventiva' || item.severity === 'preventive') return 'preventiva';
  if (item.category === 'revision') return 'revision';
  if (item.category === 'positiva') return 'positiva';
  return 'accion';
}

function storedPriority(item: StoredNotification): number {
  if (item.severity === 'critical') return 0;
  if (item.severity === 'action') return 1;
  if (item.severity === 'preventive') return 2;
  if (item.category === 'revision') return 3;
  return 4;
}

function storedDestination(item: StoredNotification): OperationalNotificationDestination {
  if (item.paymentCaseId) return 'operacion';
  if (item.supportTicketId) return 'soporte';
  if (item.actionKind === 'trabajador') return 'trabajador';
  if (item.actionKind === 'documentos') return 'documento';
  if (item.actionKind === 'acreditacion') return 'acreditacion';
  if (item.actionKind === 'operacion') return 'operacion';
  if (item.actionKind === 'soporte') return 'soporte';
  return 'proyecto';
}

function persistedMandanteNotifications(items: StoredNotification[]): OperationalNotification[] {
  return items
    .filter(item => item.status === 'active')
    .map(item => {
      const payload = item.actionPayload || {};
      const evaluationId = typeof payload.evaluationId === 'string' ? payload.evaluationId : undefined;
      const actionPlanId = typeof payload.actionPlanId === 'string' ? payload.actionPlanId : undefined;
      const destination = storedDestination(item);
      const operationMode = item.paymentCaseId
        ? 'pago' as const
        : item.supportTicketId
          ? 'ticket' as const
          : item.eventType.startsWith('action_plan_')
            ? 'evaluacion' as const
            : undefined;
      return {
        id: item.key,
        tipo: storedType(item),
        titulo: item.title,
        descripcion: item.body,
        fecha: item.occurredAt,
        cta: item.actionLabel,
        destino: destination,
        proyectoId: item.projectKey,
        contratistaId: item.contractorKey,
        workerRut: item.workerRut,
        requirementId: item.requirementKey,
        documentId: item.documentId,
        operationMode,
        operationItemId: item.paymentCaseId || item.supportTicketId || evaluationId || actionPlanId,
        prioridad: storedPriority(item),
      };
    });
}

function semanticKey(item: OperationalNotification): string {
  if (item.operationMode && item.operationItemId) return `operation:${item.operationMode}:${item.operationItemId}`;
  if (item.destino === 'documento' || item.destino === 'trabajador') {
    return `document:${item.proyectoId || ''}:${item.contratistaId || ''}:${item.workerRut || ''}:${item.requirementId || item.documentId || item.titulo}`;
  }
  if (item.destino === 'acreditacion') {
    const state = item.tipo === 'positiva' ? 'ok' : 'issue';
    return `accreditation:${item.proyectoId || ''}:${item.contratistaId || ''}:${state}`;
  }
  return item.id;
}

export function mergeMandanteNotifications(
  current: OperationalNotification[],
  stored: StoredNotification[],
): OperationalNotification[] {
  const result: OperationalNotification[] = [];
  const seen = new Set<string>();
  for (const item of [...persistedMandanteNotifications(stored), ...current]) {
    const key = semanticKey(item);
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(item);
  }
  return result.sort((a, b) => a.prioridad - b.prioridad || a.titulo.localeCompare(b.titulo, 'es'));
}

export function buildMandanteNotifications(
  mandanteId: string,
  contratistas: Contratista[],
  proyectos: Proyecto[],
): OperationalNotification[] {
  const propios = proyectos.filter(item => item.mandanteId === mandanteId);
  return [...buildStatusNotifications(contratistas, propios), ...buildExpiryNotifications(propios)]
    .sort((a, b) => a.prioridad - b.prioridad || a.titulo.localeCompare(b.titulo, 'es'));
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
  return items.sort((a, b) => a.prioridad - b.prioridad || a.titulo.localeCompare(b.titulo, 'es'));
}
