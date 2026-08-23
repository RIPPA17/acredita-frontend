import {
  getRequisitos,
  esDocumentoCumplido,
  esVencidoPorFecha,
  esTrabajadorAsignado,
  calcularEstadoTrabajador,
  calcularEstadoAcreditacion,
} from '../../data/localStorageDb';
import { Contratista, Proyecto, Mandante, Documento } from '../../types';

export type Estado = 'Aprobado' | 'En proceso' | 'Vencido/Bloqueado';
export type DocEstado = 'Aprobado' | 'Rechazado' | 'Vencido' | 'En revisión' | 'Por vencer' | 'Pendiente';

export interface Blocker {
  tipo: 'Empresa' | 'Trabajador';
  nombre: string;
  detalle: string;
  estado: DocEstado;
}

export interface AcredRow {
  key: string;
  contratista: Contratista;
  proyectoId: string;
  mandanteId: string;
  entity: string;
  rut: string;
  mandanteNombre: string;
  proyectoNombre: string;
  company: { ok: number; total: number };
  workers: { ok: number; total: number };
  estado: Estado;
  blockers: Blocker[];
  companyDocs: Array<{ nombre: string; estado: DocEstado }>;
  workerList: Array<{ nombre: string; estado: DocEstado }>;
}

const matchDoc = (docs: Documento[] | undefined, proyectoId: string, reqNombre: string) =>
  (docs || []).find(d =>
    d.proyectoId === proyectoId &&
    (d.nombre.toLowerCase().includes(reqNombre.toLowerCase()) || reqNombre.toLowerCase().includes(d.nombre.toLowerCase()))
  );

const docEstadoLabel = (doc: Documento | undefined): DocEstado => {
  if (!doc) return 'Pendiente';
  if (doc.estado === 'revision') return 'En revisión';
  if (doc.estado === 'rechazado') return 'Rechazado';
  if (esVencidoPorFecha(doc.vencimiento)) return 'Vencido';
  if (doc.estado === 'por_vencer') return 'Por vencer';
  return 'Aprobado';
};

export const badgeClass = (s: string) => {
  if (s === 'Aprobado') return 'green';
  if (s === 'En proceso' || s === 'Pendiente' || s === 'Por vencer' || s === 'En revisión') return 'amber';
  if (s === 'Vencido/Bloqueado' || s === 'Vencido' || s === 'Rechazado') return 'red';
  return 'gray';
};

// One row per (contratista, proyecto asignado). Underpins both the
// Acreditaciones tab's table and the Inicio dashboard's KPIs/attention list,
// so the counts always agree between the two screens.
export function buildAcreditacionRows(
  contratistas: Contratista[],
  proyectos: Proyecto[],
  mandantes: Mandante[]
): AcredRow[] {
  const reqsAll = getRequisitos();

  return contratistas.flatMap(c =>
    c.proyectos.map(proyectoId => {
      const proyecto = proyectos.find(p => p.id === proyectoId);
      if (!proyecto) return null;
      const mandante = mandantes.find(m => m.id === proyecto.mandanteId);

      const reqs = reqsAll.filter(r => r.proyectoId === proyectoId && r.activo !== false);
      const companyReqs = reqs.filter(r => r.destino === 'empresa');
      const workerReqs = reqs.filter(r => r.destino === 'trabajador');

      const companyDocs = companyReqs.map(req => {
        const doc = matchDoc(c.documentos, proyectoId, req.nombre);
        return { nombre: req.nombre, estado: docEstadoLabel(doc), obligatorio: req.obligatorio, cumplido: esDocumentoCumplido(doc, req) };
      });
      const companyOk = companyDocs.filter(d => d.cumplido).length;
      const companyTotal = companyDocs.length;

      const projectWorkers = (c.trabajadores || []).filter(w => esTrabajadorAsignado(w, proyectoId, proyectos));
      const workerList: Array<{ nombre: string; estado: DocEstado }> = projectWorkers.map(w => {
        const wState = calcularEstadoTrabajador(w, proyectoId);
        const estado: DocEstado = wState === 'aprobado' ? 'Aprobado' : wState === 'rechazado' ? 'Rechazado' : wState === 'por_vencer' ? 'Por vencer' : 'Pendiente';
        return { nombre: w.nombre, estado };
      });
      const workerOk = workerList.filter(w => w.estado === 'Aprobado' || w.estado === 'Por vencer').length;
      const workerTotal = workerList.length;

      const estadoAcred = calcularEstadoAcreditacion(c, proyectoId);
      const estado: Estado = estadoAcred === 'No acreditado' ? 'En proceso' : estadoAcred;

      const blockers: Blocker[] = [];
      companyDocs.forEach(d => {
        if (d.obligatorio && !d.cumplido) {
          blockers.push({ tipo: 'Empresa', nombre: c.nombre, detalle: `${d.nombre} · ${d.estado.toLowerCase()}`, estado: d.estado });
        }
      });
      workerList.forEach(w => {
        if (w.estado === 'Rechazado' || w.estado === 'Pendiente') {
          const failingReq = workerReqs.find(req => {
            const doc = matchDoc(c.trabajadores?.find(t => t.nombre === w.nombre)?.documentos, proyectoId, req.nombre);
            return req.obligatorio && !esDocumentoCumplido(doc, req);
          });
          blockers.push({
            tipo: 'Trabajador',
            nombre: w.nombre,
            detalle: failingReq ? `${failingReq.nombre} · ${w.estado.toLowerCase()}` : `Requisitos ${w.estado.toLowerCase()}`,
            estado: w.estado,
          });
        }
      });

      return {
        key: `${c.id}::${proyectoId}`,
        contratista: c,
        proyectoId,
        mandanteId: proyecto.mandanteId,
        entity: c.nombre,
        rut: c.rut,
        mandanteNombre: mandante ? mandante.nombre : '—',
        proyectoNombre: proyecto.nombre,
        company: { ok: companyOk, total: companyTotal },
        workers: { ok: workerOk, total: workerTotal },
        estado,
        blockers,
        companyDocs: companyDocs.map(d => ({ nombre: d.nombre, estado: d.estado })),
        workerList,
      };
    })
  ).filter((r): r is AcredRow => r !== null);
}
