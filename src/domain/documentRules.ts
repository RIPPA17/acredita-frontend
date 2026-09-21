import type { Documento, Requisito } from '../types';

export function getBusinessToday(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

function createCalendarDate(year: number, month: number, day: number): Date | null {
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return null;
  const date = new Date(year, month, day);
  return date.getFullYear() === year && date.getMonth() === month && date.getDate() === day ? date : null;
}

export function parseVencimientoDate(vencimientoStr: string): Date | null {
  if (!vencimientoStr || vencimientoStr === '—') return null;

  if (vencimientoStr.includes('-')) {
    const parts = vencimientoStr.split('-');
    if (parts.length === 3) {
      if (parts[0].length === 4) {
        return createCalendarDate(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
      }
      return createCalendarDate(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0]));
    }
  }

  if (vencimientoStr.includes('/')) {
    const parts = vencimientoStr.split('/');
    if (parts.length === 3) {
      if (parts[0].length === 4) {
        return createCalendarDate(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
      }
      return createCalendarDate(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0]));
    }
  }

  const parts = vencimientoStr.trim().split(/\s+/);
  if (parts.length < 3) return null;

  const months: Record<string, number> = {
    ene: 0, feb: 1, mar: 2, abr: 3, may: 4, jun: 5,
    jul: 6, ago: 7, sep: 8, oct: 9, nov: 10, dic: 11,
  };
  const month = months[parts[1].substring(0, 3).toLowerCase()];
  if (month === undefined) return null;

  return createCalendarDate(Number(parts[2]), month, Number(parts[0]));
}

export function esVencidoPorFecha(vencimientoStr: string): boolean {
  const expiration = parseVencimientoDate(vencimientoStr);
  return Boolean(expiration && expiration < getBusinessToday());
}

export function obtenerDiasRestantes(vencimientoStr: string): number {
  const expiration = parseVencimientoDate(vencimientoStr);
  if (!expiration) return 99999;
  return Math.ceil((expiration.getTime() - getBusinessToday().getTime()) / (1000 * 60 * 60 * 24));
}

export function esPorVencerPorFecha(vencimientoStr: string, alertaDias: number): boolean {
  const remaining = obtenerDiasRestantes(vencimientoStr);
  return remaining >= 0 && remaining <= alertaDias;
}

export function nombresDocumentoCoinciden(a: string, b: string): boolean {
  const normalize = (value: string) => value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');

  return normalize(a) === normalize(b);
}

export function esDocumentoCumplido(doc: Documento | undefined, req: Requisito): boolean {
  if (!doc || !nombresDocumentoCoinciden(doc.nombre, req.nombre)) return false;
  if (doc.proyectoId !== req.proyectoId) return false;
  if (doc.estado !== 'aprobado' && doc.estado !== 'por_vencer') return false;
  return !esVencidoPorFecha(doc.vencimiento);
}
