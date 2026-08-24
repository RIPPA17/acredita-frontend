import {
  getRequisitos,
  esDocumentoCumplido,
  esVencidoPorFecha,
  esPorVencerPorFecha,
  esTrabajadorAsignado,
  calcularEstadoAcreditacion,
} from '../../data/localStorageDb';
import { Contratista, Proyecto, Mandante, Documento, Requisito } from '../../types';
import { buildDocumentoQueueKey } from './colaUtils';

export type Estado = 'Aprobado' | 'En proceso' | 'Vencido/Bloqueado';
export type DocEstado = 'Aprobado' | 'Rechazado' | 'Vencido' | 'En revisión' | 'Por vencer' | 'Pendiente';
// Color de las barras/indicadores de Empresa y Trabajadores en la tabla:
// 'ok' (verde) todos los obligatorios cumplidos, 'warn' (ámbar) hay
// pendientes/en revisión, 'danger' (rojo) hay un obligatorio rechazado o
// vencido — nunca solamente "porcentaje < 100".
export type Visual = 'ok' | 'warn' | 'danger';

// Identifica sin ambigüedad qué elemento concreto genera un bloqueo, para
// que "Ir al problema" pueda navegar directo a él (Cola de revisión si el
// documento está vivo ahí, o la ficha de acreditación en su defecto).
export interface Blocker {
  tipo: 'Empresa' | 'Trabajador';
  nombre: string;
  detalle: string;
  estado: DocEstado;
  contratistaId: string;
  proyectoId: string;
  docId?: string;
  docKey?: string;
  trabajadorRut?: string;
  trabajadorNombre?: string;
  requisitoId?: string;
  requisitoNombre?: string;
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
  companyVisual: Visual;
  workersVisual: Visual;
  estado: Estado;
  blockers: Blocker[];
  companyDocs: Array<{ nombre: string; estado: DocEstado; obligatorio: boolean }>;
  workerList: Array<{ nombre: string; rut: string; estado: DocEstado }>;
}

const normalizarNombre = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase().replace(/\s+/g, ' ');
const matchDoc = (docs: Documento[] | undefined, proyectoId: string, reqNombre: string) =>
  (docs || []).find(d =>
    d.proyectoId === proyectoId &&
    normalizarNombre(d.nombre) === normalizarNombre(reqNombre)
  );

export const docEstadoLabel = (doc: Documento | undefined, requisito?: Requisito): DocEstado => {
  if (!doc) return 'Pendiente';
  if (doc.estado === 'pendiente') return 'Pendiente';
  if (doc.estado === 'revision') return 'En revisión';
  if (doc.estado === 'rechazado') return 'Rechazado';
  if (esVencidoPorFecha(doc.vencimiento)) return 'Vencido';
  if (doc.estado === 'por_vencer' || (requisito && esPorVencerPorFecha(doc.vencimiento, requisito.alertaDias))) return 'Por vencer';
  return 'Aprobado';
};

// Un documento solo se puede resolver directamente en Cola de revisión
// mientras siga "vivo" ahí: en revisión (Por revisar/En revisión) o
// rechazado (Esperando corrección). Un documento aprobado pero vencido por
// fecha, o uno que nunca se cargó, no existe en la cola — para esos casos
// "Ir al problema" debe abrir la ficha de acreditación en su lugar.
const docKeyIfRevisable = (doc: Documento | undefined, contratistaId: string, trabajadorRut?: string): string | undefined => {
  if (!doc) return undefined;
  if (doc.estado !== 'revision' && doc.estado !== 'rechazado') return undefined;
  return buildDocumentoQueueKey(contratistaId, doc.id, trabajadorRut);
};

// Toda la aplicación habla el mismo idioma de estados visibles
// (Acreditado / En proceso / Bloqueado), sea cual sea la pantalla.
export type EstadoUI = 'Acreditado' | 'En proceso' | 'Bloqueado';

export const estadoUILabel = (estado: Estado): EstadoUI =>
  estado === 'Aprobado' ? 'Acreditado' : estado === 'Vencido/Bloqueado' ? 'Bloqueado' : 'En proceso';

export const badgeClass = (s: string) => {
  if (s === 'Aprobado' || s === 'Acreditado') return 'green';
  if (s === 'En proceso' || s === 'Pendiente' || s === 'Por vencer' || s === 'En revisión') return 'amber';
  if (s === 'Vencido/Bloqueado' || s === 'Bloqueado' || s === 'Vencido' || s === 'Rechazado') return 'red';
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

      // --- Empresa: el score principal (X/Y) y el color solo consideran
      // requisitos obligatorios. Uno opcional puede aparecer en la lista de
      // Empresa marcado "Opcional", pero nunca baja el score ni bloquea.
      const companyDocsFull = companyReqs.map(req => {
        const doc = matchDoc(c.documentos, proyectoId, req.nombre);
        return { req, doc, nombre: req.nombre, estado: docEstadoLabel(doc, req), obligatorio: req.obligatorio, cumplido: esDocumentoCumplido(doc, req) };
      });
      const mandatoryCompanyDocs = companyDocsFull.filter(d => d.obligatorio);
      const companyOk = mandatoryCompanyDocs.filter(d => d.cumplido).length;
      const companyTotal = mandatoryCompanyDocs.length;
      const companyVisual: Visual = mandatoryCompanyDocs.some(d => d.estado === 'Rechazado' || d.estado === 'Vencido')
        ? 'danger'
        : mandatoryCompanyDocs.some(d => !d.cumplido)
          ? 'warn'
          : 'ok';

      // --- Trabajadores: estado granular por trabajador (Aprobado / En
      // revisión / Pendiente / Rechazado / Vencido / Por vencer), calculado
      // sobre sus propios requisitos obligatorios en este proyecto. Se
      // guarda además el primer requisito obligatorio incumplido de cada
      // trabajador, para poder construir un blocker concreto.
      const projectWorkers = (c.trabajadores || []).filter(w => esTrabajadorAsignado(w, proyectoId, proyectos));
      const workerList: Array<{ nombre: string; rut: string; estado: DocEstado }> = [];
      const workerIssues = new Map<string, { req: Requisito; doc?: Documento; estado: DocEstado }>();

      projectWorkers.forEach(w => {
        const wDocs = workerReqs.map(req => {
          const doc = matchDoc(w.documentos, proyectoId, req.nombre);
          return { req, doc, estado: docEstadoLabel(doc, req), cumplido: esDocumentoCumplido(doc, req) };
        });
        const mandatory = wDocs.filter(d => d.req.obligatorio);

        const rechazadoOVencido = mandatory.find(d => d.estado === 'Rechazado' || d.estado === 'Vencido');
        const enRevision = mandatory.find(d => d.estado === 'En revisión');
        const faltante = mandatory.find(d => d.estado === 'Pendiente' && !d.cumplido);
        const porVencer = mandatory.find(d => d.estado === 'Por vencer');

        let estado: DocEstado;
        let issue: { req: Requisito; doc?: Documento; estado: DocEstado } | undefined;
        if (rechazadoOVencido) { estado = rechazadoOVencido.estado; issue = rechazadoOVencido; }
        else if (enRevision) { estado = 'En revisión'; issue = enRevision; }
        else if (faltante) { estado = 'Pendiente'; issue = faltante; }
        else if (porVencer) { estado = 'Por vencer'; }
        else { estado = 'Aprobado'; }

        workerList.push({ nombre: w.nombre, rut: w.rut, estado });
        if (issue) workerIssues.set(w.rut, issue);
      });

      // "Por vencer" sigue siendo válido mientras el documento no haya
      // vencido, así que cuenta como trabajador acreditado.
      const workerOk = workerList.filter(w => w.estado === 'Aprobado' || w.estado === 'Por vencer').length;
      const workerTotal = workerList.length;
      const workersVisual: Visual = workerList.some(w => w.estado === 'Rechazado' || w.estado === 'Vencido')
        ? 'danger'
        : workerList.some(w => w.estado === 'Pendiente' || w.estado === 'En revisión')
          ? 'warn'
          : 'ok';

      // --- Estado general: única fuente de verdad, sin lógica paralela ---
      const estadoAcred = calcularEstadoAcreditacion(c, proyectoId);
      const estado: Estado = estadoAcred === 'No acreditado' ? 'En proceso' : estadoAcred;

      // --- Blockers: solo requisitos obligatorios incumplidos, cada uno con
      // suficiente información para navegar directo al problema.
      const blockers: Blocker[] = [];
      mandatoryCompanyDocs.forEach(d => {
        if (d.cumplido) return;
        blockers.push({
          tipo: 'Empresa',
          nombre: d.nombre,
          detalle: `Documento ${d.estado.toLowerCase()}`,
          estado: d.estado,
          contratistaId: c.id,
          proyectoId,
          docId: d.doc?.id,
          docKey: docKeyIfRevisable(d.doc, c.id),
          requisitoId: d.req.id,
          requisitoNombre: d.req.nombre,
        });
      });
      workerList.forEach(w => {
        if (w.estado === 'Aprobado' || w.estado === 'Por vencer') return;
        const issue = workerIssues.get(w.rut);
        blockers.push({
          tipo: 'Trabajador',
          nombre: w.nombre,
          detalle: issue ? `${issue.req.nombre} · ${issue.estado.toLowerCase()}` : `Requisitos ${w.estado.toLowerCase()}`,
          estado: w.estado,
          contratistaId: c.id,
          proyectoId,
          docId: issue?.doc?.id,
          docKey: issue ? docKeyIfRevisable(issue.doc, c.id, w.rut) : undefined,
          trabajadorRut: w.rut,
          trabajadorNombre: w.nombre,
          requisitoId: issue?.req.id,
          requisitoNombre: issue?.req.nombre,
        });
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
        companyVisual,
        workersVisual,
        estado,
        blockers,
        companyDocs: companyDocsFull.map(d => ({ nombre: d.nombre, estado: d.estado, obligatorio: d.obligatorio })),
        workerList,
      };
    })
  ).filter((r): r is AcredRow => r !== null);
}
