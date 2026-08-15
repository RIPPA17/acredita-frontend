import React from 'react';

/**
 * Reusable utility types and shared constants
 */
export type NavItem = {
  id: string;
  label: string;
  icon: React.ElementType;
  badge?: string | number;
  badgeVariant?: 'danger' | 'warning';
};

export interface Mandante {
  id: string;
  nombre: string;
  rut: string;
  plan: string;
  proyectos: string[]; // IDs de proyectos asociados
}

export interface Proyecto {
  id: string;
  nombre: string;
  mandanteId: string;
  estado: string; // e.g. "Activo"
  urgenciaBadge?: string; // "b-red" | "b-yellow" | "b-green"
  urgenciaLabel?: string; // e.g. "3 urgentes", "1 normal", "Al día"
  contratistas: string[]; // IDs de contratistas asociados
}

export interface Trabajador {
  nombre: string;
  rut: string;
  estado: 'aprobado' | 'por_vencer' | 'rechazado' | 'pendiente';
  cargo?: string;
  faena?: string;
  cumplimiento?: number;
  detalle?: string;
  documentos?: Documento[];
}

export interface Documento {
  id: string; // e.g. "d1", "d2"
  nombre: string;
  categoria: 'Laboral' | 'Tributario' | 'Prevención';
  estado: 'aprobado' | 'por_vencer' | 'rechazado' | 'pendiente' | 'revision';
  vencimiento: string;
  subido?: string;
  motivo?: string;      // Explicación de rechazo (también usado como observacion)
  observacion?: string; // Alias o copia para compatibilidad con vistas contratista
  revisor?: string;
  fechaRevisado?: string;
  motivoRechazo?: string;
  explicacionRechazo?: string;
  solucionRechazo?: string;
  proyectoId?: string;  // Associated project context
  archivoReferencia?: string;
}

export interface Requisito {
  id: string; // e.g. `${proyectoId}_${plantillaId}`
  nombre: string;
  categoria: 'Laboral' | 'Tributario' | 'Prevención';
  destino: 'empresa' | 'trabajador';
  obligatorio: boolean;
  frecuencia: string;
  alertaDias: number;
  criticidad: 'bloquea_pago' | 'bloquea_acceso' | 'advertencia';
  proyectoId: string;
  activo?: boolean;
}

export interface Contratista {
  id: string;
  nombre: string;
  rut: string;
  proyectos: string[]; // IDs de proyectos asociados
  documentos: Documento[];
  trabajadores?: Trabajador[];
  isNew?: boolean;
}

export interface Invitacion {
  id: string;
  contratistaId: string;
  contratistaNombre: string;
  contratistaRut: string;
  proyectoId: string;
  proyectoNombre: string;
  mandanteId: string;
  mandanteNombre: string;
  estado: 'pendiente' | 'aceptada' | 'rechazada';
  mensaje?: string;
  fecha: string;
}
