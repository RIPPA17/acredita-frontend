import { CONTRATISTAS, PROYECTOS, MANDANTES, PLANTILLA_DOCUMENTOS } from './mockData';
import { Contratista, Proyecto, Mandante, Documento, Trabajador } from '../types';

export function initDb() {
  if (typeof window !== 'undefined' && !localStorage.getItem('acredita_db_initialized')) {
    localStorage.setItem('acredita_contratistas', JSON.stringify(CONTRATISTAS));
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

export function esVencidoPorFecha(vencimientoStr: string): boolean {
  if (!vencimientoStr || vencimientoStr === '—' || vencimientoStr.includes('-')) return false;
  const parts = vencimientoStr.trim().split(' ');
  if (parts.length < 3) return false;
  const day = parseInt(parts[0]);
  const year = parseInt(parts[2]);
  const months: Record<string, number> = {
    'ene': 0, 'feb': 1, 'mar': 2, 'abr': 3, 'may': 4, 'jun': 5,
    'jul': 6, 'ago': 7, 'sep': 8, 'oct': 9, 'nov': 10, 'dic': 11
  };
  const monthStr = parts[1].substring(0, 3).toLowerCase();
  const month = months[monthStr] !== undefined ? months[monthStr] : 0;
  const vDate = new Date(year, month, day);
  return vDate < DEMO_TODAY;
}

export function esRequisitoObligatorio(docNombre: string): boolean {
  const reglas = getReglas();
  const regla = reglas.find(r => 
    docNombre.toLowerCase().includes(r.documento.toLowerCase()) || 
    r.documento.toLowerCase().includes(docNombre.toLowerCase())
  );
  if (!regla) return true;
  return regla.criticidad !== 'advertencia';
}

export function esReglaBloqueante(docNombre: string): boolean {
  const reglas = getReglas();
  const regla = reglas.find(r => 
    docNombre.toLowerCase().includes(r.documento.toLowerCase()) || 
    r.documento.toLowerCase().includes(docNombre.toLowerCase())
  );
  if (!regla) return false;
  return regla.criticidad === 'bloquea_acceso' || regla.criticidad === 'bloquea_pago';
}

export function calcularEstadoTrabajador(w: Trabajador): 'aprobado' | 'por_vencer' | 'rechazado' | 'pendiente' {
  const docs = w.documentos || [];
  if (docs.length === 0) return 'pendiente';

  // 1. Algún documento obligatorio rechazado o vencido -> rechazado
  const tieneObligatorioRechazadoOVencido = docs.some(d => {
    const obligatorio = esRequisitoObligatorio(d.nombre);
    if (!obligatorio) return false;
    return d.estado === 'rechazado' || esVencidoPorFecha(d.vencimiento);
  });
  if (tieneObligatorioRechazadoOVencido) return 'rechazado';

  // 2. Algún documento obligatorio pendiente o en revisión -> pendiente
  const tieneObligatorioPendienteORevision = docs.some(d => {
    const obligatorio = esRequisitoObligatorio(d.nombre);
    if (!obligatorio) return false;
    return d.estado === 'pendiente' || d.estado === 'revision';
  });
  if (tieneObligatorioPendienteORevision) return 'pendiente';

  // 3. Algún documento obligatorio por_vencer -> por_vencer
  const tieneObligatorioPorVencer = docs.some(d => {
    const obligatorio = esRequisitoObligatorio(d.nombre);
    if (!obligatorio) return false;
    return d.estado === 'por_vencer';
  });
  if (tieneObligatorioPorVencer) return 'por_vencer';

  // 4. Todos los obligatorios aprobados -> aprobado
  return 'aprobado';
}

export function esTrabajadorAcreditado(w: Trabajador): boolean {
  return calcularEstadoTrabajador(w) === 'aprobado';
}

export function calcularEstadoAcreditacion(c: Contratista): 'No acreditado' | 'En proceso' | 'Aprobado' | 'Vencido/Bloqueado' {
  const documentos = c.documentos || [];
  const trabajadores = c.trabajadores || [];

  // 1. Si existe algún requisito obligatorio RECHAZADO o VENCIDO -> "Vencido/Bloqueado"
  // O si algún trabajador está rechazado.
  const tieneRequisitoObligatorioBloqueado = documentos.some(d => {
    const obligatorio = esRequisitoObligatorio(d.nombre);
    if (!obligatorio) return false;

    const isRechazado = d.estado === 'rechazado';
    const isVencido = esVencidoPorFecha(d.vencimiento);

    return isRechazado || isVencido;
  });

  const tieneTrabajadorRechazado = trabajadores.some(w => calcularEstadoTrabajador(w) === 'rechazado');

  if (tieneRequisitoObligatorioBloqueado || tieneTrabajadorRechazado) {
    return 'Vencido/Bloqueado';
  }

  // 2. Una empresa sin trabajadores no puede ser Aprobada. Queda en "No acreditado" o "En proceso"
  if (trabajadores.length === 0) {
    const obligatorios = documentos.filter(d => esRequisitoObligatorio(d.nombre));
    const todosAprobados = obligatorios.length > 0 && obligatorios.every(d => d.estado === 'aprobado');
    return todosAprobados ? 'En proceso' : 'No acreditado';
  }

  // 3. Faltan requisitos obligatorios de empresa o trabajadores por revisar -> "En proceso"
  const tieneObligatorioPendiente = documentos.some(d => {
    const obligatorio = esRequisitoObligatorio(d.nombre);
    return obligatorio && (d.estado === 'revision' || d.estado === 'pendiente');
  });

  const tieneTrabajadorPendiente = trabajadores.some(w => calcularEstadoTrabajador(w) === 'pendiente');

  if (tieneObligatorioPendiente || tieneTrabajadorPendiente) {
    return 'En proceso';
  }

  // 4. Si 100% de obligatorios de empresa y trabajadores están Aprobados (o en advertencia no bloqueante) -> "Aprobado"
  const obligatorios = documentos.filter(d => esRequisitoObligatorio(d.nombre));
  const obligatoriosAprobados = obligatorios.length > 0 && obligatorios.every(d => d.estado === 'aprobado' || d.estado === 'por_vencer');
  const trabajadoresAprobados = trabajadores.every(w => esTrabajadorAcreditado(w) || calcularEstadoTrabajador(w) === 'por_vencer');

  if (obligatoriosAprobados && trabajadoresAprobados) {
    return 'Aprobado';
  }

  return 'En proceso';
}
