import { esVencidoPorFecha, getRequisitos, nombresDocumentoCoinciden } from '../../data/businessStore';
import type { Contratista } from '../../types';

export type MandanteContractorMatrixRow = {
  id: string;
  name: string;
  rut: string;
  reqs: Record<string, boolean>;
  status: Record<string, string>;
  isNew?: boolean;
};

export function buildMandanteContractorsData(
  contratistasList: Contratista[],
  projectId: string,
): MandanteContractorMatrixRow[] {
  const projectRequirements = getRequisitos().filter(
    requirement => requirement.proyectoId === projectId && requirement.activo !== false,
  );

  return contratistasList
    .filter(contractor => contractor.proyectos.includes(projectId))
    .map(contractor => {
      const reqs: Record<string, boolean> = {};
      const status: Record<string, string> = {};

      projectRequirements.forEach(requirement => {
        reqs[requirement.id] = requirement.obligatorio;

        if (requirement.destino === 'empresa') {
          const document = contractor.documentos.find(item =>
            item.proyectoId === projectId
            && nombresDocumentoCoinciden(item.nombre, requirement.nombre)
          );
          status[requirement.id] = document
            ? document.estado === 'aprobado'
              ? 'ok'
              : document.estado === 'por_vencer'
                ? 'warn'
                : document.estado === 'rechazado'
                  ? 'error'
                  : 'pending'
            : 'na';
          return;
        }

        const workers = contractor.trabajadores || [];
        if (workers.length === 0) {
          status[requirement.id] = 'na';
          return;
        }

        let hasError = false;
        let hasPending = false;
        let hasWarning = false;

        workers.forEach(worker => {
          const document = worker.documentos?.find(item =>
            item.proyectoId === projectId
            && nombresDocumentoCoinciden(item.nombre, requirement.nombre)
          );

          if (!document) {
            if (requirement.obligatorio) hasPending = true;
            return;
          }

          if (document.estado === 'rechazado' || esVencidoPorFecha(document.vencimiento)) hasError = true;
          else if (document.estado === 'pendiente' || document.estado === 'revision') hasPending = true;
          else if (document.estado === 'por_vencer') hasWarning = true;
        });

        if (hasError) status[requirement.id] = 'error';
        else if (hasPending) status[requirement.id] = 'pending';
        else if (hasWarning) status[requirement.id] = 'warn';
        else status[requirement.id] = 'ok';
      });

      return {
        id: contractor.id,
        name: contractor.nombre,
        rut: contractor.rut,
        reqs,
        status,
        isNew: contractor.isNew,
      };
    });
}
