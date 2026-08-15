import { CONTRATISTAS, PROYECTOS, MANDANTES, PLANTILLA_DOCUMENTOS } from './mockData';
import { Contratista, Proyecto, Mandante, Documento, Trabajador, Requisito, Invitacion } from '../types';

export function initDb() {
  if (typeof window !== 'undefined' && !localStorage.getItem('acredita_db_initialized')) {
    // 1. Initialize project-specific requirements
    const defaultRequisitos: Requisito[] = [];
    PROYECTOS.forEach(proj => {
      PLANTILLA_DOCUMENTOS.forEach((plantilla) => {
        let alertaDias = 15;
        let criticidad: 'bloquea_pago' | 'bloquea_acceso' | 'advertencia' = 'bloquea_pago';
        let obligatorio = true;

        if (plantilla.id === 'liquidacion') {
          alertaDias = 5;
          criticidad = 'bloquea_pago';
        } else if (plantilla.id === 'f30') {
          alertaDias = 7;
          criticidad = 'bloquea_pago';
        } else if (plantilla.id === 'contrato') {
          alertaDias = 15;
          criticidad = 'bloquea_acceso';
        } else if (plantilla.id === 'mutual') {
          alertaDias = 7;
          criticidad = 'bloquea_pago';
        } else if (plantilla.id === 'antecedentes') {
          alertaDias = 15;
          criticidad = 'advertencia';
          obligatorio = false;
        } else if (plantilla.id === 'odi') {
          alertaDias = 30;
          criticidad = 'bloquea_acceso';
        }

        defaultRequisitos.push({
          id: `${proj.id}_${plantilla.id}`,
          nombre: plantilla.nombre,
          categoria: plantilla.categoria as any,
          destino: plantilla.destino as any,
          obligatorio,
          frecuencia: plantilla.frecuencia,
          alertaDias,
          criticidad,
          proyectoId: proj.id,
          activo: true
        });
      });
    });
    localStorage.setItem('acredita_requisitos', JSON.stringify(defaultRequisitos));

    // 2. Expand mock contractors to assign project-specific documents and workers
    const expandedContratistas = CONTRATISTAS.map(c => {
      const docsWithProject: Documento[] = [];
      c.proyectos.forEach(pId => {
        c.documentos.forEach(d => {
          docsWithProject.push({
            ...d,
            id: `${pId}_${d.id}`,
            proyectoId: pId
          });
        });
      });

      const workersWithProject = c.trabajadores?.map(w => {
        const wDocsWithProject: Documento[] = [];
        c.proyectos.forEach(pId => {
          w.documentos?.forEach(wd => {
            wDocsWithProject.push({
              ...wd,
              id: `${pId}_${wd.id}`,
              proyectoId: pId
            });
          });
        });
        return {
          ...w,
          documentos: wDocsWithProject
        };
      });

      return {
        ...c,
        documentos: docsWithProject,
        trabajadores: workersWithProject
      };
    });

    localStorage.setItem('acredita_contratistas', JSON.stringify(expandedContratistas));
    localStorage.setItem('acredita_proyectos', JSON.stringify(PROYECTOS));
    localStorage.setItem('acredita_mandantes', JSON.stringify(MANDANTES));
    localStorage.setItem('acredita_plantillas', JSON.stringify(PLANTILLA_DOCUMENTOS));
    
    const defaultReglas = [
      { id: 1, documento: "Liquidación de Sueldo", diasVigencia: 30, alertaDias: 5, criticidad: "bloquea_pago" },
      { id: 2, documento: "F30 / F31 SII", diasVigencia: 30, alertaDias: 7, criticidad: "bloquea_pago" },
      { id: 3, documento: "Certificado ODI", diasVigencia: 365, alertaDias: 30, criticidad: "bloquea_acceso" },
      { id: 4, documento: "Certificado Antecedentes", diasVigencia: 180, alertaDias: 15, criticidad: "advertencia" }
    ];
    localStorage.setItem('acredita_reglas', JSON.stringify(defaultReglas));
    localStorage.setItem('acredita_db_initialized', 'true');
  }
}

export function getContratistas(): Contratista[] {
  initDb();
  if (typeof window === 'undefined') return CONTRATISTAS;
  return JSON.parse(localStorage.getItem('acredita_contratistas') || '[]');
}

export function saveContratistas(data: Contratista[]) {
  if (typeof window !== 'undefined') {
    localStorage.setItem('acredita_contratistas', JSON.stringify(data));
  }
}

export function getProyectos(): Proyecto[] {
  initDb();
  if (typeof window === 'undefined') return PROYECTOS;
  return JSON.parse(localStorage.getItem('acredita_proyectos') || '[]');
}

export function saveProyectos(data: Proyecto[]) {
  if (typeof window !== 'undefined') {
    localStorage.setItem('acredita_proyectos', JSON.stringify(data));
  }
}

export function getMandantes(): Mandante[] {
  initDb();
  if (typeof window === 'undefined') return MANDANTES;
  return JSON.parse(localStorage.getItem('acredita_mandantes') || '[]');
}

export function saveMandantes(data: Mandante[]) {
  if (typeof window !== 'undefined') {
    localStorage.setItem('acredita_mandantes', JSON.stringify(data));
  }
}

export function getPlantillas(): any[] {
  initDb();
  if (typeof window === 'undefined') return PLANTILLA_DOCUMENTOS;
  return JSON.parse(localStorage.getItem('acredita_plantillas') || '[]');
}

export function savePlantillas(data: any[]) {
  if (typeof window !== 'undefined') {
    localStorage.setItem('acredita_plantillas', JSON.stringify(data));
  }
}

export function getRequisitos(): Requisito[] {
  initDb();
  if (typeof window === 'undefined') return [];
  return JSON.parse(localStorage.getItem('acredita_requisitos') || '[]');
}

export function saveRequisitos(data: Requisito[]) {
  if (typeof window !== 'undefined') {
    localStorage.setItem('acredita_requisitos', JSON.stringify(data));
  }
}

export function getReglas(): any[] {
  initDb();
  const defaultReglas = [
    { id: 1, documento: "Liquidación de Sueldo", diasVigencia: 30, alertaDias: 5, criticidad: "bloquea_pago" },
    { id: 2, documento: "F30 / F31 SII", diasVigencia: 30, alertaDias: 7, criticidad: "bloquea_pago" },
    { id: 3, documento: "Certificado ODI", diasVigencia: 365, alertaDias: 30, criticidad: "bloquea_acceso" },
    { id: 4, documento: "Certificado Antecedentes", diasVigencia: 180, alertaDias: 15, criticidad: "advertencia" }
  ];
  if (typeof window === 'undefined') return defaultReglas;
  return JSON.parse(localStorage.getItem('acredita_reglas') || JSON.stringify(defaultReglas));
}

export function saveReglas(data: any[]) {
  if (typeof window !== 'undefined') {
    localStorage.setItem('acredita_reglas', JSON.stringify(data));
  }
}

export const DEMO_TODAY = new Date(2026, 4, 18); // 18 de Mayo, 2026

export function parseVencimientoDate(vencimientoStr: string): Date | null {
  if (!vencimientoStr || vencimientoStr === '—') return null;
  if (vencimientoStr.includes('-')) {
    const parts = vencimientoStr.split('-');
    if (parts.length === 3) {
      const year = parseInt(parts[0]);
      const month = parseInt(parts[1]) - 1;
      const day = parseInt(parts[2]);
      return new Date(year, month, day);
    }
  }
  const parts = vencimientoStr.trim().split(/\s+/);
  if (parts.length < 3) return null;
  const day = parseInt(parts[0]);
  const year = parseInt(parts[2]);
  const months: Record<string, number> = {
    'ene': 0, 'feb': 1, 'mar': 2, 'abr': 3, 'may': 4, 'jun': 5,
    'jul': 6, 'ago': 7, 'sep': 8, 'oct': 9, 'nov': 10, 'dic': 11
  };
  const monthStr = parts[1].substring(0, 3).toLowerCase();
  const month = months[monthStr] !== undefined ? months[monthStr] : 0;
  return new Date(year, month, day);
}

export function esVencidoPorFecha(vencimientoStr: string): boolean {
  const vDate = parseVencimientoDate(vencimientoStr);
  if (!vDate) return false;
  return vDate < DEMO_TODAY;
}

export function obtenerDiasRestantes(vencimientoStr: string): number {
  const vDate = parseVencimientoDate(vencimientoStr);
  if (!vDate) return 99999;
  const diffTime = vDate.getTime() - DEMO_TODAY.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
}

export function esPorVencerPorFecha(vencimientoStr: string, alertaDias: number): boolean {
  const diasRestantes = obtenerDiasRestantes(vencimientoStr);
  return diasRestantes >= 0 && diasRestantes <= alertaDias;
}

export function esRequisitoObligatorio(docNombre: string, proyectoId?: string): boolean {
  const reqs = getRequisitos();
  const rule = reqs.find(r => 
    (!proyectoId || r.proyectoId === proyectoId) && 
    (docNombre.toLowerCase().includes(r.nombre.toLowerCase()) || 
     r.nombre.toLowerCase().includes(docNombre.toLowerCase()))
  );
  if (!rule) return true;
  return rule.obligatorio;
}

export function esReglaBloqueante(docNombre: string, proyectoId?: string): boolean {
  const reqs = getRequisitos();
  const rule = reqs.find(r => 
    (!proyectoId || r.proyectoId === proyectoId) && 
    (docNombre.toLowerCase().includes(r.nombre.toLowerCase()) || 
     r.nombre.toLowerCase().includes(docNombre.toLowerCase()))
  );
  if (!rule) return false;
  return rule.criticidad === 'bloquea_acceso' || rule.criticidad === 'bloquea_pago';
}

export function calcularEstadoTrabajador(w: Trabajador, proyectoId?: string): 'aprobado' | 'por_vencer' | 'rechazado' | 'pendiente' {
  if (!proyectoId) {
    const allC = getContratistas();
    const parentC = allC.find(c => c.trabajadores?.some(worker => worker.rut === w.rut));
    proyectoId = parentC?.proyectos[0] || 'costanera';
  }

  const reqs = getRequisitos().filter(r => r.proyectoId === proyectoId && r.destino === 'trabajador' && r.activo !== false);
  const documentos = w.documentos || [];

  if (reqs.length === 0) return 'aprobado';

  let hasRechazado = false;
  let hasPendiente = false;
  let hasPorVencer = false;

  reqs.forEach(req => {
    const doc = documentos.find(d => 
      d.proyectoId === proyectoId &&
      (d.nombre.toLowerCase().includes(req.nombre.toLowerCase()) || 
       req.nombre.toLowerCase().includes(d.nombre.toLowerCase()))
    );
    
    if (!doc) {
      if (req.obligatorio) {
        hasPendiente = true;
      }
      return;
    }

    const isVencido = esVencidoPorFecha(doc.vencimiento);
    const isRechazado = doc.estado === 'rechazado' || isVencido;
    const isPendiente = doc.estado === 'pendiente' || doc.estado === 'revision';
    const isPorVencer = doc.estado === 'por_vencer';

    if (req.obligatorio) {
      if (isRechazado) {
        hasRechazado = true;
      } else if (isPendiente) {
        hasPendiente = true;
      } else if (isPorVencer) {
        hasPorVencer = true;
      }
    }
  });

  if (hasRechazado) return 'rechazado';
  if (hasPendiente) return 'pendiente';
  if (hasPorVencer) return 'por_vencer';
  return 'aprobado';
}

export function esTrabajadorAcreditado(w: Trabajador, proyectoId?: string): boolean {
  return calcularEstadoTrabajador(w, proyectoId) === 'aprobado';
}

export function calcularEstadoAcreditacion(c: Contratista, proyectoId?: string): 'No acreditado' | 'En proceso' | 'Aprobado' | 'Vencido/Bloqueado' {
  if (!proyectoId) {
    proyectoId = c.proyectos[0] || 'costanera';
  }

  const reqs = getRequisitos().filter(r => r.proyectoId === proyectoId && r.destino === 'empresa' && r.activo !== false);
  const documentos = c.documentos || [];
  const trabajadores = c.trabajadores || [];

  const tieneTrabajadorRechazado = trabajadores.some(w => 
    w.documentos?.some(d => d.proyectoId === proyectoId) && 
    calcularEstadoTrabajador(w, proyectoId) === 'rechazado'
  );

  let hasReRechazado = false;
  let hasRePendiente = false;

  reqs.forEach(req => {
    const doc = documentos.find(d => 
      d.proyectoId === proyectoId &&
      (d.nombre.toLowerCase().includes(req.nombre.toLowerCase()) || 
       req.nombre.toLowerCase().includes(d.nombre.toLowerCase()))
    );
    if (!doc) {
      if (req.obligatorio) {
        hasRePendiente = true;
      }
      return;
    }

    const isVencido = esVencidoPorFecha(doc.vencimiento);
    const isRechazado = doc.estado === 'rechazado' || isVencido;
    const isPendiente = doc.estado === 'pendiente' || doc.estado === 'revision';

    if (req.obligatorio) {
      if (isRechazado) {
        hasReRechazado = true;
      } else if (isPendiente) {
        hasRePendiente = true;
      }
    }
  });

  if (hasReRechazado || tieneTrabajadorRechazado) {
    return 'Vencido/Bloqueado';
  }

  const projectWorkers = trabajadores.filter(w => 
    w.documentos?.some(d => d.proyectoId === proyectoId)
  );

  if (projectWorkers.length === 0) {
    return hasRePendiente ? 'No acreditado' : 'En proceso';
  }

  const tieneTrabajadorPendiente = projectWorkers.some(w => calcularEstadoTrabajador(w, proyectoId) === 'pendiente');

  if (hasRePendiente || tieneTrabajadorPendiente) {
    return 'En proceso';
  }

  return 'Aprobado';
}

export function calcularPrioridadDocumento(d: Documento, r?: any): 'Alta' | 'Normal' | 'Baja' {
  let rule = r;
  if (!rule) {
    const reqs = getRequisitos();
    rule = reqs.find(reg => 
      (!d.proyectoId || reg.proyectoId === d.proyectoId) && 
      (d.nombre.toLowerCase().includes(reg.nombre.toLowerCase()) || 
       reg.nombre.toLowerCase().includes(d.nombre.toLowerCase()))
    );
  }

  const criticidad = rule ? rule.criticidad : 'bloquea_acceso';
  const isVencido = esVencidoPorFecha(d.vencimiento);
  const isPorVencer = d.estado === 'por_vencer';

  let esAntiguo = false;
  if (d.subido && d.subido !== '—') {
    const parts = d.subido.trim().split(' ');
    if (parts.length >= 3) {
      const day = parseInt(parts[0]);
      const year = parseInt(parts[2]);
      const months: Record<string, number> = {
        'ene': 0, 'feb': 1, 'mar': 2, 'abr': 3, 'may': 4, 'jun': 5,
        'jul': 6, 'ago': 7, 'sep': 8, 'oct': 9, 'nov': 10, 'dic': 11
      };
      const monthStr = parts[1].substring(0, 3).toLowerCase();
      const month = months[monthStr] !== undefined ? months[monthStr] : 0;
      const uploadDate = new Date(year, month, day);
      const diffTime = Math.abs(DEMO_TODAY.getTime() - uploadDate.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      if (diffDays >= 3) {
        esAntiguo = true;
      }
    }
  }

  if (criticidad === 'bloquea_acceso' || isVencido || esAntiguo) {
    return 'Alta';
  }
  if (criticidad === 'bloquea_pago' || isPorVencer) {
    return 'Normal';
  }
  return 'Baja';
}

export function calcularAccesoPago(c: Contratista, proyectoId?: string): {
  accesoBloqueado: boolean;
  motivoAcceso?: string;
  pagoBloqueado: boolean;
  motivoPago?: string;
} {
  const estado = calcularEstadoAcreditacion(c, proyectoId);
  const isAprobado = estado === 'Aprobado';
  return {
    accesoBloqueado: !isAprobado,
    motivoAcceso: !isAprobado ? `La acreditación no está aprobada` : undefined,
    pagoBloqueado: !isAprobado,
    motivoPago: !isAprobado ? `La acreditación no está aprobada` : undefined
  };
}

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

export function getAlertasVigencia(proyectoId?: string): AlertaVigencia[] {
  const contratistas = getContratistas();
  const proyectos = getProyectos();
  const requisitos = getRequisitos().filter(r => r.activo !== false);
  const alertas: AlertaVigencia[] = [];

  contratistas.forEach(c => {
    const cProjs = c.proyectos || [];
    cProjs.forEach(pId => {
      if (proyectoId && pId !== proyectoId) return;
      const proj = proyectos.find(p => p.id === pId);
      const projNombre = proj ? proj.nombre : pId;

      const companyDocs = c.documentos || [];
      const companyReqs = requisitos.filter(r => r.proyectoId === pId && r.destino === 'empresa');

      companyReqs.forEach(req => {
        const doc = companyDocs.find(d => 
          d.proyectoId === pId &&
          (d.nombre.toLowerCase().includes(req.nombre.toLowerCase()) || 
           req.nombre.toLowerCase().includes(d.nombre.toLowerCase()))
        );
        if (!doc) return;

        const isVencido = esVencidoPorFecha(doc.vencimiento);
        const diasRestantes = obtenerDiasRestantes(doc.vencimiento);
        const isPorVencer = esPorVencerPorFecha(doc.vencimiento, req.alertaDias);

        if (isVencido || isPorVencer) {
          let criticidad: 'Crítica' | 'Atención' | 'Informativa' = 'Informativa';
          let bloquea = false;

          if (isVencido) {
            if (req.obligatorio) {
              criticidad = 'Crítica';
              bloquea = true;
            } else {
              criticidad = 'Informativa';
              bloquea = false;
            }
          } else if (isPorVencer) {
            if (req.obligatorio) {
              criticidad = 'Atención';
              bloquea = false;
            } else {
              criticidad = 'Informativa';
              bloquea = false;
            }
          }

          alertas.push({
            id: `alert_e_${c.id}_${doc.id}`,
            documentoId: doc.id,
            documentoNombre: doc.nombre,
            empresaId: c.id,
            empresaNombre: c.nombre,
            proyectoId: pId,
            proyectoNombre: projNombre,
            vencimiento: doc.vencimiento,
            diasRestantes,
            criticidad,
            bloquea
          });
        }
      });

      const workers = c.trabajadores || [];
      const workerReqs = requisitos.filter(r => r.proyectoId === pId && r.destino === 'trabajador');

      workers.forEach(w => {
        const hasProjDocs = w.documentos?.some(d => d.proyectoId === pId);
        if (!hasProjDocs) return;

        workerReqs.forEach(req => {
          const doc = w.documentos?.find(d => 
            d.proyectoId === pId &&
            (d.nombre.toLowerCase().includes(req.nombre.toLowerCase()) || 
             req.nombre.toLowerCase().includes(d.nombre.toLowerCase()))
          );
          if (!doc) return;

          const isVencido = esVencidoPorFecha(doc.vencimiento);
          const diasRestantes = obtenerDiasRestantes(doc.vencimiento);
          const isPorVencer = esPorVencerPorFecha(doc.vencimiento, req.alertaDias);

          if (isVencido || isPorVencer) {
            let criticidad: 'Crítica' | 'Atención' | 'Informativa' = 'Informativa';
            let bloquea = false;

            if (isVencido) {
              if (req.obligatorio) {
                criticidad = 'Crítica';
                bloquea = true;
              } else {
                criticidad = 'Informativa';
                bloquea = false;
              }
            } else if (isPorVencer) {
              if (req.obligatorio) {
                criticidad = 'Atención';
                bloquea = false;
              } else {
                criticidad = 'Informativa';
                bloquea = false;
              }
            }

            alertas.push({
              id: `alert_w_${c.id}_${w.rut.replace(/[^a-zA-Z0-9]/g, '')}_${doc.id}`,
              documentoId: doc.id,
              documentoNombre: doc.nombre,
              empresaId: c.id,
              empresaNombre: c.nombre,
              trabajadorRut: w.rut,
              trabajadorNombre: w.nombre,
              proyectoId: pId,
              proyectoNombre: projNombre,
              vencimiento: doc.vencimiento,
              diasRestantes,
              criticidad,
              bloquea
            });
          }
        });
      });
    });
  });

  return alertas;
}

export function getMotivoBloqueoTrabajador(w: Trabajador, proyectoId: string): string {
  const reqs = getRequisitos().filter(r => r.proyectoId === proyectoId && r.destino === 'trabajador' && r.activo !== false);
  const docs = w.documentos || [];
  
  let result = '';
  reqs.forEach(req => {
    const doc = docs.find(d => 
      d.proyectoId === proyectoId &&
      (d.nombre.toLowerCase().includes(req.nombre.toLowerCase()) || 
       req.nombre.toLowerCase().includes(d.nombre.toLowerCase()))
    );
    if (!doc) {
      if (req.obligatorio) {
        result = `${req.nombre} pendiente`;
      }
    } else {
      const isVencido = esVencidoPorFecha(doc.vencimiento);
      if (req.obligatorio) {
        if (doc.estado === 'rechazado') {
          result = `${req.nombre} rechazado`;
        } else if (isVencido) {
          result = `${req.nombre} vencido`;
        } else if (doc.estado === 'pendiente' || doc.estado === 'revision') {
          result = `${req.nombre} pendiente`;
        }
      }
    }
  });
  return result || 'Requisitos en proceso';
}

export function getInvitaciones(): Invitacion[] {
  try {
    const raw = localStorage.getItem('acredita_invitaciones');
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

export function saveInvitaciones(list: Invitacion[]): void {
  localStorage.setItem('acredita_invitaciones', JSON.stringify(list));
}

