import { Contratista, Proyecto, ClaimRevision } from '../../types';
import { buildColaDocs } from './colaUtils';

export interface CargaItem {
  documentoKey: string;
  documento: string;
  contratista: string;
  proyecto: string;
  claimedAt: number;
}

// Reconstruye, a partir de los claims persistidos, qué documentos tiene
// tomados cada verificador — resolviendo el contexto real (documento,
// contratista, proyecto) con la misma estructura que ya usa la Cola de
// revisión (buildColaDocs), nunca datos inventados. Un claim cuyo
// documentoKey ya no exista en la cola (documento aprobado/rechazado por
// otra vía, o eliminado) se descarta silenciosamente: no debe mostrarse como
// carga fantasma.
export function resolveCargaPorVerificador(
  claimsRevision: ClaimRevision[],
  contratistas: Contratista[],
  proyectos: Proyecto[]
): Map<string, CargaItem[]> {
  const pendientes = buildColaDocs(contratistas, proyectos);
  const porKey = new Map(pendientes.map(d => [d.key, d]));

  const porVerificador = new Map<string, CargaItem[]>();
  claimsRevision.forEach(claim => {
    const doc = porKey.get(claim.documentoKey);
    if (!doc) return;
    const item: CargaItem = {
      documentoKey: claim.documentoKey,
      documento: doc.title,
      contratista: doc.emp,
      proyecto: doc.proyecto,
      claimedAt: claim.claimedAt,
    };
    const lista = porVerificador.get(claim.verificadorId) || [];
    lista.push(item);
    porVerificador.set(claim.verificadorId, lista);
  });
  return porVerificador;
}

// Descarta del arreglo persistido los claims cuyo documentoKey ya no exista
// en la cola actual (documento aprobado/rechazado por fuera del flujo normal
// de "Aprobar"/"Rechazar", o eliminado). Se usa en los puntos de
// sincronización (cambio de pestaña) como red de seguridad — el flujo normal
// ya elimina el claim al aprobar/rechazar.
export function pruneClaimsRevision(
  claimsRevision: ClaimRevision[],
  contratistas: Contratista[],
  proyectos: Proyecto[]
): ClaimRevision[] {
  const pendientes = buildColaDocs(contratistas, proyectos);
  const keysValidas = new Set(pendientes.map(d => d.key));
  return claimsRevision.filter(c => keysValidas.has(c.documentoKey));
}
