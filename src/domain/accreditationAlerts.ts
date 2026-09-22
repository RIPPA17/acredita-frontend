import type { Contratista, Documento, Proyecto, Requisito } from '../types';
import { esPorVencerPorFecha, esVencidoPorFecha, nombresDocumentoCoinciden, obtenerDiasRestantes } from './documentRules';

export interface AlertaVigencia {
  id: string;
  documentoId: string;
  documentoNombre: string;
  empresaId: string;
  empresaNombre: string;
  trabajadorRut?: string;
  trabajadorNombre?: string;
  proyectoId: string;
  proyectoNombre: string;
  vencimiento: string;
  diasRestantes: number;
  criticidad: 'Crítica' | 'Atención' | 'Informativa';
  bloquea: boolean;
}

function findRequirementDocument(documentos: Documento[], req: Requisito, proyectoId: string): Documento | undefined {
  return documentos.find(doc =>
    doc.proyectoId === proyectoId
    && nombresDocumentoCoinciden(doc.nombre, req.nombre)
  );
}

function alertSeverity(req: Requisito, expired: boolean): Pick<AlertaVigencia, 'criticidad' | 'bloquea'> {
  if (expired && req.obligatorio) return { criticidad: 'Crítica', bloquea: true };
  if (!expired && req.obligatorio) return { criticidad: 'Atención', bloquea: false };
  return { criticidad: 'Informativa', bloquea: false };
}

export function buildValidityAlerts(
  contratistas: Contratista[],
  proyectos: Proyecto[],
  requisitos: Requisito[],
  proyectoId?: string,
): AlertaVigencia[] {
  const activeRequirements = requisitos.filter(req => req.activo !== false);
  const alertas: AlertaVigencia[] = [];

  contratistas.forEach(contractor => {
    (contractor.proyectos || []).forEach(projectId => {
      if (proyectoId && projectId !== proyectoId) return;
      const project = proyectos.find(item => item.id === projectId);
      const projectName = project ? project.nombre : projectId;

      const companyRequirements = activeRequirements.filter(
        req => req.proyectoId === projectId && req.destino === 'empresa',
      );
      companyRequirements.forEach(req => {
        const doc = findRequirementDocument(contractor.documentos || [], req, projectId);
        if (!doc) return;

        const expired = esVencidoPorFecha(doc.vencimiento);
        const nearExpiry = esPorVencerPorFecha(doc.vencimiento, req.alertaDias);
        if (!expired && !nearExpiry) return;

        alertas.push({
          id: `alert_e_${contractor.id}_${doc.id}`,
          documentoId: doc.id,
          documentoNombre: doc.nombre,
          empresaId: contractor.id,
          empresaNombre: contractor.nombre,
          proyectoId: projectId,
          proyectoNombre: projectName,
          vencimiento: doc.vencimiento,
          diasRestantes: obtenerDiasRestantes(doc.vencimiento),
          ...alertSeverity(req, expired),
        });
      });

      const workerRequirements = activeRequirements.filter(
        req => req.proyectoId === projectId && req.destino === 'trabajador',
      );
      (contractor.trabajadores || []).forEach(worker => {
        const hasProjectDocuments = worker.documentos?.some(doc => doc.proyectoId === projectId);
        if (!hasProjectDocuments) return;

        workerRequirements.forEach(req => {
          const doc = findRequirementDocument(worker.documentos || [], req, projectId);
          if (!doc) return;

          const expired = esVencidoPorFecha(doc.vencimiento);
          const nearExpiry = esPorVencerPorFecha(doc.vencimiento, req.alertaDias);
          if (!expired && !nearExpiry) return;

          alertas.push({
            id: `alert_w_${contractor.id}_${worker.rut.replace(/[^a-zA-Z0-9]/g, '')}_${doc.id}`,
            documentoId: doc.id,
            documentoNombre: doc.nombre,
            empresaId: contractor.id,
            empresaNombre: contractor.nombre,
            trabajadorRut: worker.rut,
            trabajadorNombre: worker.nombre,
            proyectoId: projectId,
            proyectoNombre: projectName,
            vencimiento: doc.vencimiento,
            diasRestantes: obtenerDiasRestantes(doc.vencimiento),
            ...alertSeverity(req, expired),
          });
        });
      });
    });
  });

  return alertas;
}
