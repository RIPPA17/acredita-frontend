import { calcularPrioridadDocumento, getRequisitos, vigenciaRequeridaLabel, estadoVencimiento } from "../../data/localStorageDb";
import { Contratista, Proyecto, Documento } from "../../types";

// Texto de "qué se está verificando" para cada documento — no siempre coincide
// literalmente con el nombre del archivo (p. ej. "Registro Mutual ACHS" ->
// "Certificado de mutualidad vigente"), así que se resuelve por familia de
// documento en vez de mostrar el nombre crudo dos veces.
function requisitoDescripcion(nombreDoc: string): string {
  const n = nombreDoc.toLowerCase();
  if (n.includes('antecedentes')) return 'Certificado de antecedentes vigente';
  if (n.includes('contrato')) return 'Contrato de trabajo firmado';
  if (n.includes('mutual')) return 'Certificado de mutualidad vigente';
  if (n.includes('f30') || n.includes('f31') || n.includes('declaraci')) return 'Declaración F30 al día ante el SII';
  if (n.includes('liquidaci')) return 'Liquidación de sueldo del mes vigente';
  if (n.includes('odi')) return 'Charla de inducción (ODI) vigente';
  if (n.includes('anexo') && n.includes('hora')) return 'Anexo de horas extraordinarias firmado';
  if (n.includes('afp')) return 'Certificado de afiliación AFP vigente';
  if (n.includes('seguro')) return 'Seguro de responsabilidad civil vigente';
  return `${nombreDoc} vigente`;
}

function buildQueueItem(
  d: Documento,
  origen: 'Empresa' | 'Trabajador',
  c: Contratista,
  proyectos: Proyecto[],
  qId: number,
  worker?: { nombre: string; rut: string; cargo?: string }
) {
  const pId = d.proyectoId || c.proyectos[0] || 'costanera';
  const project = proyectos.find(p => p.id === pId);
  const prioVal = calcularPrioridadDocumento(d);
  const requisitoMatch = getRequisitos().find(r =>
    r.proyectoId === pId &&
    (d.nombre.toLowerCase().includes(r.nombre.toLowerCase()) || r.nombre.toLowerCase().includes(d.nombre.toLowerCase()))
  );

  return {
    id: qId,
    // Identificador ESTABLE entre reconstrucciones de la lista (buildColaDocs
    // se vuelve a llamar tras cada acción, y el `id` secuencial de arriba se
    // reasigna desde 1 cada vez, así que no sirve como clave persistente para
    // claims/escalamientos). `docId` tampoco alcanza: solo es único dentro de
    // un mismo contratista. Se combina contratista + (trabajador) + docId.
    key: `${c.id}::${worker ? worker.rut + '::' : ''}${d.id}`,
    docId: d.id,
    proyectoId: pId,
    origen,
    trabajadorNombre: worker?.nombre,
    trabajadorRut: worker?.rut,
    trabajadorCargo: worker?.cargo || (worker ? 'Operario' : undefined),
    emp: c.nombre,
    rut: c.rut,
    proyecto: project ? project.nombre : 'Costanera Norte',
    title: d.nombre,
    type: d.categoria === 'Laboral' ? 'Liquidación mensual' : d.categoria === 'Tributario' ? 'Declaración mensual SII' : 'Certificación prevención',
    requisito: requisitoDescripcion(d.nombre),
    vigenciaLabel: vigenciaRequeridaLabel(d.nombre, requisitoMatch?.frecuencia),
    vencimiento: d.vencimiento,
    vencEstado: estadoVencimiento(d.vencimiento),
    version: d.version || 1,
    prio: prioVal,
    tag: prioVal === 'Alta' ? 'urgente' : 'normal',
    time: d.subido || 'Reciente',
    timeSort: d.subido && d.subido !== '—' && !d.subido.includes('hr') ? new Date(d.subido).getTime() : Date.now(),
    hint: d.motivo || (worker ? `Verificar documento cargado para el trabajador ${worker.nombre}.` : 'Verificar descuentos legales y base imponible del contratista.'),
    contratistaId: c.id,
    raw: d,
  };
}

export function buildColaDocs(contratistas: Contratista[], proyectos: Proyecto[]) {
  const list: any[] = [];
  let qId = 1;
  contratistas.forEach(c => {
    c.documentos.forEach(d => {
      if (d.estado === 'revision') {
        list.push(buildQueueItem(d, 'Empresa', c, proyectos, qId++));
      }
    });

    c.trabajadores?.forEach(w => {
      w.documentos?.forEach(wd => {
        if (wd.estado === 'revision') {
          list.push(buildQueueItem(wd, 'Trabajador', c, proyectos, qId++, w));
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
        const item = buildQueueItem(d, 'Empresa', c, proyectos, qId++);
        list.push({
          ...item,
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
          const item = buildQueueItem(wd, 'Trabajador', c, proyectos, qId++, w);
          list.push({
            ...item,
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
