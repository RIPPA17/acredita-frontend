import { calcularPrioridadDocumento, getRequisitos, vigenciaRequeridaLabel, estadoVencimiento, parseVencimientoDate } from "../../data/businessStore";
import { Contratista, Proyecto, Documento, HistorialVersionDocumento } from "../../types";

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

// Identificador ESTABLE de un documento dentro de la Cola de revisión:
// contratista + (trabajador, si aplica) + documento. Es la misma convención
// que usan claims/escalamientos en ColaRevisionTab (sobrevive a que se
// reconstruya la lista tras cada acción) y la reutiliza Acreditaciones para
// que "Ir al problema" pueda apuntar exactamente al documento correcto.
export function buildDocumentoQueueKey(contratistaId: string, docId: string, trabajadorRut?: string): string {
  return `${contratistaId}::${trabajadorRut ? trabajadorRut + '::' : ''}${docId}`;
}

function buildQueueItem(
  d: Documento,
  origen: 'Empresa' | 'Trabajador',
  c: Contratista,
  proyectos: Proyecto[],
  qId: number,
  worker?: { nombre: string; rut: string; cargo?: string },
  versionOverride?: HistorialVersionDocumento,
) {
  // Nunca inventar un proyecto: usar el proyectoId real del documento, y solo
  // recurrir al único proyecto del contratista si de verdad no hay ambigüedad
  // posible (contratista con un solo proyecto asignado). Si el contratista
  // tiene varios proyectos y el documento no trae proyectoId, no se adivina —
  // se muestra "Proyecto no asignado" más abajo en vez de un proyecto/mandante
  // arbitrario e incorrecto.
  const pId = d.proyectoId || (c.proyectos.length === 1 ? c.proyectos[0] : undefined);
  const project = pId ? proyectos.find(p => p.id === pId) : undefined;
  const prioVal = calcularPrioridadDocumento(d);
  const destino = origen === 'Trabajador' ? 'trabajador' : 'empresa';
  // El requisito real configurado para el proyecto es la fuente principal de
  // "Requisito" y de la frecuencia de vigencia; requisitoDescripcion() solo
  // entra como fallback visual cuando no hay coincidencia.
  const requisitoMatch = pId ? getRequisitos().find(r =>
    r.proyectoId === pId &&
    r.destino === destino &&
    (d.nombre.toLowerCase().includes(r.nombre.toLowerCase()) || r.nombre.toLowerCase().includes(d.nombre.toLowerCase()))
  ) : undefined;
  const versionFecha = versionOverride?.fecha || d.subido;
  const parsedSubido = versionFecha ? parseVencimientoDate(versionFecha) : null;

  return {
    id: qId,
    // Identificador ESTABLE entre reconstrucciones de la lista (buildColaDocs
    // se vuelve a llamar tras cada acción, y el `id` secuencial de arriba se
    // reasigna desde 1 cada vez, así que no sirve como clave persistente para
    // claims/escalamientos). `docId` tampoco alcanza: solo es único dentro de
    // un mismo contratista. Se combina contratista + (trabajador) + docId.
    key: buildDocumentoQueueKey(c.id, d.id, worker?.rut),
    docId: d.id,
    proyectoId: pId,
    origen,
    trabajadorNombre: worker?.nombre,
    trabajadorRut: worker?.rut,
    trabajadorCargo: worker?.cargo || (worker ? 'Operario' : undefined),
    emp: c.nombre,
    rut: c.rut,
    proyecto: project ? project.nombre : 'Proyecto no asignado',
    title: d.nombre,
    type: d.categoria === 'Laboral' ? 'Liquidación mensual' : d.categoria === 'Tributario' ? 'Declaración mensual SII' : 'Certificación prevención',
    requisito: requisitoMatch ? requisitoMatch.nombre : requisitoDescripcion(d.nombre),
    requisitoId: requisitoMatch?.id,
    descripcionRequisito: requisitoMatch?.descripcion,
    criteriosRevision: requisitoMatch?.checklistRevision || [],
    periodoEtiqueta: d.periodoEtiqueta,
    obligacionId: d.obligacionId,
    vigenciaLabel: vigenciaRequeridaLabel(d.nombre, requisitoMatch?.frecuencia),
    validityDays: requisitoMatch?.diasVigencia,
    issuedAt: versionOverride?.emitido || d.emitido,
    expiresAt: versionOverride?.vencimientoIso || d.vencimientoIso,
    vencimiento: versionOverride?.vencimientoIso || d.vencimiento,
    vencEstado: estadoVencimiento(versionOverride?.vencimientoIso || d.vencimiento),
    version: versionOverride?.version || d.version || 1,
    isRenewal: Boolean(versionOverride && d.version && versionOverride.version > d.version),
    activeVersion: d.version || 1,
    activeUntil: d.vencimiento,
    prio: prioVal,
    tag: prioVal === 'Alta' ? 'urgente' : 'normal',
    time: versionFecha || 'Reciente',
    // Antigüedad real: se reutiliza el mismo parser que el resto del
    // frontend (parseVencimientoDate) para no dejar documentos "empatados"
    // en Date.now() cuando el formato de `subido` no se reconoce — esos
    // casos van al final de la cola (Number.MAX_SAFE_INTEGER) en vez de
    // intercalarse al azar entre los documentos con fecha real.
    timeSort: parsedSubido ? parsedSubido.getTime() : Number.MAX_SAFE_INTEGER,
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
      if (d.versionEnTramite?.estado === 'revision') {
        list.push(buildQueueItem(d, 'Empresa', c, proyectos, qId++, undefined, d.versionEnTramite));
      } else if (d.estado === 'revision') {
        list.push(buildQueueItem(d, 'Empresa', c, proyectos, qId++));
      }
    });

    c.trabajadores?.forEach(w => {
      w.documentos?.forEach(wd => {
        if (wd.versionEnTramite?.estado === 'revision') {
          list.push(buildQueueItem(wd, 'Trabajador', c, proyectos, qId++, w, wd.versionEnTramite));
        } else if (wd.estado === 'revision') {
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
      const rejectedVersion = d.versionEnTramite?.estado === 'rechazado' ? d.versionEnTramite : undefined;
      if (rejectedVersion || d.estado === 'rechazado') {
        const item = buildQueueItem(d, 'Empresa', c, proyectos, qId++, undefined, rejectedVersion);
        const rechazoFecha = rejectedVersion?.fecha || d.fechaRevisado;
        const rechazadoEl = rechazoFecha ? parseVencimientoDate(rechazoFecha) : null;
        list.push({
          ...item,
          prio: 'Alta',
          tag: 'urgente',
          time: rechazoFecha || d.subido || 'Reciente',
          timeSort: rechazadoEl ? rechazadoEl.getTime() : item.timeSort,
          motivoRechazo: rejectedVersion?.motivoRechazo || d.motivoRechazo || d.motivo || 'Rechazado',
          explicacionRechazo: rejectedVersion?.explicacionRechazo || d.explicacionRechazo || d.observacion || '',
          revisor: rejectedVersion?.verificador || d.revisor,
          fechaRevisado: rechazoFecha,
        });
      }
    });

    c.trabajadores?.forEach(w => {
      w.documentos?.forEach(wd => {
        const rejectedVersion = wd.versionEnTramite?.estado === 'rechazado' ? wd.versionEnTramite : undefined;
        if (rejectedVersion || wd.estado === 'rechazado') {
          const item = buildQueueItem(wd, 'Trabajador', c, proyectos, qId++, w, rejectedVersion);
          const rechazoFecha = rejectedVersion?.fecha || wd.fechaRevisado;
          const rechazadoEl = rechazoFecha ? parseVencimientoDate(rechazoFecha) : null;
          list.push({
            ...item,
            prio: 'Alta',
            tag: 'urgente',
            time: rechazoFecha || wd.subido || 'Reciente',
            timeSort: rechazadoEl ? rechazadoEl.getTime() : item.timeSort,
            motivoRechazo: rejectedVersion?.motivoRechazo || wd.motivoRechazo || wd.motivo || 'Rechazado',
            explicacionRechazo: rejectedVersion?.explicacionRechazo || wd.explicacionRechazo || wd.observacion || '',
            revisor: rejectedVersion?.verificador || wd.revisor,
            fechaRevisado: rechazoFecha,
          });
        }
      });
    });
  });
  return list;
}
