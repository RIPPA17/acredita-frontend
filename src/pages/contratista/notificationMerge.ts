import type { Contratista, Proyecto } from '../../types';
import type { StoredNotification } from '../../data/supabaseNotifications';
import type { NotificacionContratista } from './notificacionesUtils';

const DERIVED_EVENT_TYPES = new Set([
  'document_rejected',
  'document_expired',
  'document_expiring',
  'document_in_review',
  'accreditation_approved',
  'worker_blocked',
  'worker_enabled',
  'worker_contract_expiring',
  'worker_contract_expired',
]);

export function mergeContractorNotifications(params: {
  actuales: NotificacionContratista[];
  persistidas: StoredNotification[];
  proyectos: Proyecto[];
  contratista: Contratista;
}): NotificacionContratista[] {
  const { actuales, persistidas, proyectos, contratista } = params;

  const persistedVisible: NotificacionContratista[] = persistidas
    .filter(item => {
      if (item.status === 'resolved' || !DERIVED_EVENT_TYPES.has(item.eventType)) return true;
      const alreadyDerived = actuales.some(actual =>
        actual.eventType === item.eventType
        && actual.proyectoId === item.projectKey
        && (!item.workerRut || actual.trabajadorRut === item.workerRut)
        && (!item.requirementKey || actual.requisitoId === item.requirementKey)
      );
      return !alreadyDerived;
    })
    .map(item => {
      const proyecto = proyectos.find(candidate => candidate.id === item.projectKey);
      const worker = item.workerRut
        ? (contratista.trabajadores || []).find(candidate => candidate.rut === item.workerRut)
        : undefined;
      const tipo = item.category === 'informativa' ? 'informativa' : item.category;
      const prioridad = item.status === 'resolved'
        ? 9
        : item.severity === 'critical'
          ? 0
          : item.severity === 'action'
            ? 1
            : item.severity === 'preventive'
              ? 2
              : tipo === 'revision'
                ? 3
                : 5;
      const actionPlanId = item.eventType.match(/^action_plan_[^:]+:(.+)$/)?.[1];
      const evaluationId = item.eventType.match(/^evaluation_[^:]+:(.+)$/)?.[1];
      const paymentCaseId = item.paymentCaseId || item.key.match(/^payment_(?:blocked|released|paid|voided):(.+)$/)?.[1];
      const destino = item.actionKind === 'trabajador' && worker
        ? { tipo: 'trabajador' as const, trabajador: worker }
        : item.actionKind === 'operacion' || item.actionKind === 'soporte'
          ? { tipo: 'operacion' as const }
          : item.actionKind === 'proyecto'
            ? { tipo: 'proyecto' as const }
            : item.actionKind === 'acreditacion'
              ? { tipo: 'acreditacion' as const }
              : { tipo: 'documentos' as const };

      return {
        id: item.key,
        tipo,
        proyectoId: proyecto?.id || item.projectKey || proyectos[0]?.id || '',
        proyectoNombre: proyecto?.nombre || 'Proyecto',
        titulo: item.title,
        descripcion: item.body,
        fecha: new Date(item.occurredAt).toLocaleString('es-CL'),
        cta: item.actionLabel,
        destino,
        prioridad,
        eventType: item.eventType,
        nivel: item.severity,
        situacion: item.status === 'resolved' ? 'resuelta' as const : 'activa' as const,
        persistida: true,
        requisitoId: item.requirementKey,
        trabajadorRut: item.workerRut,
        actionPlanId,
        evaluationId,
        paymentCaseId,
        supportTicketId: item.supportTicketId,
      };
    });

  return [...actuales, ...persistedVisible]
    .filter(item => Boolean(item.proyectoId))
    .sort((a, b) =>
      a.prioridad - b.prioridad
      || (b.fecha || '').localeCompare(a.fecha || '')
      || a.titulo.localeCompare(b.titulo, 'es')
    );
}
