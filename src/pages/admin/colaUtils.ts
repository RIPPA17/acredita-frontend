import { calcularPrioridadDocumento } from "../../data/localStorageDb";
import { Contratista, Proyecto } from "../../types";

export function buildColaDocs(contratistas: Contratista[], proyectos: Proyecto[]) {
  const list: any[] = [];
  let qId = 1;
  contratistas.forEach(c => {
    // 1. Empresa
    c.documentos.forEach(d => {
      if (d.estado === 'revision') {
        const pId = d.proyectoId || c.proyectos[0] || 'costanera';
        const project = proyectos.find(p => p.id === pId);
        const prioVal = calcularPrioridadDocumento(d);

        list.push({
          id: qId++,
          docId: d.id,
          proyectoId: pId,
          origen: 'Empresa',
          emp: c.nombre,
          rut: c.rut,
          proyecto: project ? project.nombre : 'Costanera Norte',
          title: d.nombre,
          type: d.categoria === 'Laboral' ? 'Liquidación mensual' : d.categoria === 'Tributario' ? 'Declaración mensual SII' : 'Certificación prevención',
          prio: prioVal,
          tag: prioVal === 'Alta' ? 'urgente' : 'normal',
          time: d.subido || 'Reciente',
          timeSort: d.subido && d.subido !== '—' && !d.subido.includes('hr') ? new Date(d.subido).getTime() : Date.now(),
          hint: d.motivo || 'Verificar descuentos legales y base imponible del contratista.',
          historial: [
            {
              type: 'uploaded',
              who: c.nombre,
              when: d.subido || 'Reciente',
              msg: 'Subido por portal contratista'
            }
          ]
        });
      }
    });

    // 2. Trabajadores
    c.trabajadores?.forEach(w => {
      w.documentos?.forEach(wd => {
        if (wd.estado === 'revision') {
          const pId = wd.proyectoId || c.proyectos[0] || 'costanera';
          const project = proyectos.find(p => p.id === pId);
          const prioVal = calcularPrioridadDocumento(wd);

          list.push({
            id: qId++,
            docId: wd.id,
            proyectoId: pId,
            origen: 'Trabajador',
            trabajadorNombre: w.nombre,
            trabajadorRut: w.rut,
            trabajadorCargo: w.cargo || 'Operario',
            emp: c.nombre,
            rut: c.rut,
            proyecto: project ? project.nombre : 'Costanera Norte',
            title: wd.nombre,
            type: wd.categoria === 'Laboral' ? 'Documento laboral trabajador' : 'Prevención de riesgos',
            prio: prioVal,
            tag: prioVal === 'Alta' ? 'urgente' : 'normal',
            time: wd.subido || 'Reciente',
            timeSort: wd.subido && wd.subido !== '—' && !wd.subido.includes('hr') ? new Date(wd.subido).getTime() : Date.now(),
            hint: wd.motivo || `Verificar documento cargado para el trabajador ${w.nombre}.`,
            historial: [
              {
                type: 'uploaded',
                who: c.nombre,
                when: wd.subido || 'Reciente',
                msg: `Subido por portal contratista para trabajador: ${w.nombre}`
              }
            ]
          });
        }
      });
    });
  });
  return list;
}

// Documentos rechazados: misma forma que buildColaDocs, para la pestaña
// "Esperando corrección" — el contratista debe subir una nueva versión.
export function buildCorrectionDocs(contratistas: Contratista[], proyectos: Proyecto[]) {
  const list: any[] = [];
  let qId = 1;
  contratistas.forEach(c => {
    c.documentos.forEach(d => {
      if (d.estado === 'rechazado') {
        const pId = d.proyectoId || c.proyectos[0] || 'costanera';
        const project = proyectos.find(p => p.id === pId);

        list.push({
          id: qId++,
          docId: d.id,
          proyectoId: pId,
          origen: 'Empresa',
          emp: c.nombre,
          rut: c.rut,
          proyecto: project ? project.nombre : 'Costanera Norte',
          title: d.nombre,
          type: d.categoria === 'Laboral' ? 'Liquidación mensual' : d.categoria === 'Tributario' ? 'Declaración mensual SII' : 'Certificación prevención',
          prio: 'Alta',
          tag: 'urgente',
          time: d.fechaRevisado || d.subido || 'Reciente',
          timeSort: Date.now(),
          motivoRechazo: d.motivoRechazo || d.motivo || 'Rechazado',
          explicacionRechazo: d.explicacionRechazo || d.observacion || '',
        });
      }
    });

    c.trabajadores?.forEach(w => {
      w.documentos?.forEach(wd => {
        if (wd.estado === 'rechazado') {
          const pId = wd.proyectoId || c.proyectos[0] || 'costanera';
          const project = proyectos.find(p => p.id === pId);

          list.push({
            id: qId++,
            docId: wd.id,
            proyectoId: pId,
            origen: 'Trabajador',
            trabajadorNombre: w.nombre,
            trabajadorRut: w.rut,
            trabajadorCargo: w.cargo || 'Operario',
            emp: c.nombre,
            rut: c.rut,
            proyecto: project ? project.nombre : 'Costanera Norte',
            title: wd.nombre,
            type: wd.categoria === 'Laboral' ? 'Documento laboral trabajador' : 'Prevención de riesgos',
            prio: 'Alta',
            tag: 'urgente',
            time: wd.fechaRevisado || wd.subido || 'Reciente',
            timeSort: Date.now(),
            motivoRechazo: wd.motivoRechazo || wd.motivo || 'Rechazado',
            explicacionRechazo: wd.explicacionRechazo || wd.observacion || '',
          });
        }
      });
    });
  });
  return list;
}
