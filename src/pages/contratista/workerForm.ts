import type { RegimenEspecialLaboral, TipoContratoLaboral } from '../../types';
import { isValidRut } from '../../utils/rut';

export type WorkerFormState = {
  nombre: string;
  rut: string;
  cargo: string;
  servicioId: string;
  categorias: string;
  fechaIngreso: string;
  tipoContrato: TipoContratoLaboral;
  fechaInicioContrato: string;
  fechaTerminoContrato: string;
  obraFaenaContrato: string;
  regimenEspecial: '' | RegimenEspecialLaboral;
  detalleRegimenEspecial: string;
};

export function createWorkerFormDefaults(today = new Date().toISOString().slice(0, 10)): WorkerFormState {
  return {
    nombre: '',
    rut: '',
    cargo: '',
    servicioId: '',
    categorias: '',
    fechaIngreso: today,
    tipoContrato: 'indefinido',
    fechaInicioContrato: today,
    fechaTerminoContrato: '',
    obraFaenaContrato: '',
    regimenEspecial: '',
    detalleRegimenEspecial: '',
  };
}

export type WorkerFormValidationContext = {
  projectOperational: boolean;
  serviceRequired: boolean;
  availableServices: number;
  categoriesRequired: boolean;
  selectedCategories: number;
};

export function validateWorkerForm(
  form: WorkerFormState,
  context: WorkerFormValidationContext,
): { message: string; type: 'error' | 'warning' } | null {
  if (!isValidRut(form.rut)) {
    return { message: 'RUT inválido, revisa el formato y dígito verificador', type: 'error' };
  }
  if (!context.projectOperational) {
    return { message: 'Este proyecto está en modo histórico y solo permite consultar el historial.', type: 'warning' };
  }
  if (!form.fechaInicioContrato) {
    return { message: 'Debes indicar la fecha de inicio del contrato.', type: 'error' };
  }
  if (!form.fechaIngreso) {
    return { message: 'Debes indicar la fecha de ingreso al proyecto.', type: 'error' };
  }
  if (form.tipoContrato === 'plazo_fijo' && !form.fechaTerminoContrato) {
    return { message: 'El contrato a plazo fijo requiere fecha de término.', type: 'error' };
  }
  if (form.fechaTerminoContrato && form.fechaTerminoContrato < form.fechaInicioContrato) {
    return { message: 'La fecha de término no puede ser anterior a la fecha de inicio.', type: 'error' };
  }
  if (form.fechaIngreso < form.fechaInicioContrato) {
    return { message: 'La fecha de ingreso al proyecto no puede ser anterior al inicio del contrato.', type: 'error' };
  }
  if (
    form.tipoContrato === 'plazo_fijo'
    && form.fechaTerminoContrato
    && form.fechaIngreso > form.fechaTerminoContrato
  ) {
    return { message: 'La fecha de ingreso al proyecto no puede ser posterior al término del contrato.', type: 'error' };
  }
  if (form.tipoContrato === 'obra_faena' && !form.obraFaenaContrato.trim()) {
    return { message: 'Describe la obra o faena determinada asociada al contrato.', type: 'error' };
  }
  if (form.regimenEspecial === 'otro' && !form.detalleRegimenEspecial.trim()) {
    return { message: 'Especifica el régimen laboral especial.', type: 'error' };
  }
  if (context.serviceRequired && context.availableServices === 0) {
    return {
      message: 'El proyecto tiene requisitos asociados a servicios, pero no hay servicios activos configurados. Solicita configurar el servicio antes de continuar.',
      type: 'error',
    };
  }
  if (context.serviceRequired && !form.servicioId) {
    return { message: 'Debes seleccionar el servicio o contrato del trabajador.', type: 'error' };
  }
  if (context.categoriesRequired && context.selectedCategories === 0) {
    return { message: 'Debes seleccionar al menos una categoría del trabajador.', type: 'error' };
  }
  return null;
}
