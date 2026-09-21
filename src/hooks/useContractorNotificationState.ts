import * as React from 'react';
import type { Contratista, Proyecto } from '../types';
import type { SupabaseUserSession } from '../data/supabaseAuth';
import { getRequisitos } from '../data/businessStore';
import { proyectoOperativoParaContratista } from '../data/operationalCore';
import { buildNotificacionesContratista, type NotificacionContratista } from '../pages/contratista/notificacionesUtils';
import {
  DEFAULT_NOTIFICATION_PREFERENCES,
  loadNotificationPreferences,
  loadReadNotificationKeys,
  loadStoredNotifications,
  markNotificationKeysRead,
  saveNotificationPreferences,
  type StoredNotification,
} from '../data/supabaseNotifications';

interface ContractorNotificationStateInput {
  contratista: Contratista;
  proyectos: Proyecto[];
  session: SupabaseUserSession | null;
  showNotifications: boolean;
  dataRevision: number;
  dataSyncRevision: number;
}

export function useContractorNotificationState({
  contratista,
  proyectos,
  session,
  showNotifications,
  dataRevision,
  dataSyncRevision,
}: ContractorNotificationStateInput) {
  const [readKeys, setReadKeys] = React.useState<Set<string>>(new Set());
  const [storedNotifications, setStoredNotifications] = React.useState<StoredNotification[]>([]);
  const [preferences, setPreferences] = React.useState({ ...DEFAULT_NOTIFICATION_PREFERENCES });

  const contractorProjects = React.useMemo(
    () => proyectos
      .filter(project => project.contratistas.includes(contratista.id))
      .sort((a, b) =>
        Number(proyectoOperativoParaContratista(b, contratista.id))
        - Number(proyectoOperativoParaContratista(a, contratista.id))
        || a.nombre.localeCompare(b.nombre, 'es')
      ),
    [contratista.id, proyectos],
  );

  const activeProjects = React.useMemo(
    () => contractorProjects.filter(project => proyectoOperativoParaContratista(project, contratista.id)),
    [contractorProjects, contratista.id],
  );
  const historicalProjects = React.useMemo(
    () => contractorProjects.filter(project => !proyectoOperativoParaContratista(project, contratista.id)),
    [contractorProjects, contratista.id],
  );
  const projectsKey = React.useMemo(
    () => contractorProjects
      .map(project => `${project.id}:${project.estado}:${proyectoOperativoParaContratista(project, contratista.id)}`)
      .join('|'),
    [contractorProjects, contratista.id],
  );

  React.useEffect(() => {
    if (!session?.profileId) return;
    let cancelled = false;
    Promise.all([
      loadNotificationPreferences(session.profileId, session),
      loadReadNotificationKeys(session.profileId, session),
      loadStoredNotifications(session.profileId, session),
    ]).then(([nextPreferences, nextReadKeys, nextStored]) => {
      if (cancelled) return;
      setPreferences(nextPreferences);
      setReadKeys(nextReadKeys);
      setStoredNotifications(nextStored);
    }).catch(() => {
      if (!cancelled) {
        setReadKeys(new Set());
        setStoredNotifications([]);
      }
    });
    return () => { cancelled = true; };
  }, [session?.profileId]);

  React.useEffect(() => {
    if (!showNotifications || !session?.profileId) return;
    let cancelled = false;
    Promise.all([
      loadStoredNotifications(session.profileId, session),
      loadReadNotificationKeys(session.profileId, session),
    ]).then(([nextStored, nextReadKeys]) => {
      if (cancelled) return;
      setStoredNotifications(nextStored);
      setReadKeys(nextReadKeys);
    }).catch(() => undefined);
    return () => { cancelled = true; };
  }, [showNotifications, session?.profileId, dataRevision, dataSyncRevision]);

  const derived = buildNotificacionesContratista({
    contratista,
    proyectos: contractorProjects,
    requisitos: getRequisitos(),
    preferencias: preferences,
  });

  const derivedEvents = new Set([
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

  const persisted: NotificacionContratista[] = storedNotifications
    .filter(item => {
      if (item.status === 'resolved' || !derivedEvents.has(item.eventType)) return true;
      return !derived.some(actual =>
        actual.eventType === item.eventType
        && actual.proyectoId === item.projectKey
        && (!item.workerRut || actual.trabajadorRut === item.workerRut)
        && (!item.requirementKey || actual.requisitoId === item.requirementKey)
      );
    })
    .map(item => {
      const project = contractorProjects.find(candidate => candidate.id === item.projectKey);
      const worker = item.workerRut
        ? (contratista.trabajadores || []).find(candidate => candidate.rut === item.workerRut)
        : undefined;
      const type = item.category === 'informativa' ? 'informativa' : item.category;
      const priority = item.status === 'resolved'
        ? 9
        : item.severity === 'critical'
          ? 0
          : item.severity === 'action'
            ? 1
            : item.severity === 'preventive'
              ? 2
              : type === 'revision'
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
        tipo: type,
        proyectoId: project?.id || item.projectKey || contractorProjects[0]?.id || '',
        proyectoNombre: project?.nombre || 'Proyecto',
        titulo: item.title,
        descripcion: item.body,
        fecha: new Date(item.occurredAt).toLocaleString('es-CL'),
        cta: item.actionLabel,
        destino,
        prioridad: priority,
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

  const notifications = [...derived, ...persisted]
    .filter(item => Boolean(item.proyectoId))
    .sort((a, b) =>
      a.prioridad - b.prioridad
      || (b.fecha || '').localeCompare(a.fecha || '')
      || a.titulo.localeCompare(b.titulo, 'es')
    );

  const unreadCount = notifications.filter(
    item => item.situacion !== 'resuelta' && !readKeys.has(item.id),
  ).length;

  const markRead = (ids: string[]) => {
    setReadKeys(current => {
      const next = new Set(current);
      ids.forEach(id => next.add(id));
      return next;
    });
    if (session?.profileId) {
      void markNotificationKeysRead(session.profileId, ids, session).catch(() => undefined);
    }
  };

  const savePreferences = async (nextPreferences: typeof preferences) => {
    if (!session?.profileId) throw new Error('Sesión inválida');
    await saveNotificationPreferences(session.profileId, nextPreferences, session);
    setPreferences(nextPreferences);
  };

  return {
    contractorProjects,
    activeProjects,
    historicalProjects,
    projectsKey,
    notifications,
    unreadCount,
    readKeys,
    preferences,
    markRead,
    savePreferences,
  };
}
