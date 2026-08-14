import { CONTRATISTAS, PROYECTOS, MANDANTES, PLANTILLA_DOCUMENTOS } from './mockData';
import { Contratista, Proyecto, Mandante, Documento } from '../types';

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
