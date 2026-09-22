import { useEffect, useMemo, useState, type ChangeEvent } from 'react';
import { Download, FileSpreadsheet, Upload, Users } from 'lucide-react';
import {
  calcularEstadoTrabajador,
  esTrabajadorAsignado,
  getContratistas,
  getRequisitos,
  requisitoAplicaATrabajador,
  saveContratistas,
} from '../../data/businessStore';
import { confirmBusinessPersistence } from '../../data/supabasePersistence';
import { getServiciosProyecto, proyectoOperativoParaContratista } from '../../data/operationalCore';
import { useDataSync } from '../../components/DataSyncContext';
import { isValidRut } from '../../utils/rut';
import type {
  Contratista,
  Proyecto,
  RegimenEspecialLaboral,
  Requisito,
  ServicioContrato,
  TipoContratoLaboral,
  Trabajador,
} from '../../types';
import { crearDocumentosPendientesProyecto } from './documentosUtils';

type ParsedWorker = {
  line: number;
  nombre: string;
  rut: string;
  cargo: string;
  servicio: string;
  categorias: string[];
  fechaIngreso: string;
  tipoContratoRaw: string;
  fechaInicioContrato: string;
  fechaTerminoContrato: string;
  obraFaenaContrato: string;
  regimenEspecialRaw: string;
  detalleRegimenEspecial: string;
  baseErrors: string[];
};

type ValidatedWorker = ParsedWorker & {
  errors: string[];
  warnings: string[];
  status: 'nuevo' | 'reingreso' | 'ya_asignado';
  servicioId?: string;
  servicioLabel?: string;
  categoriasAsignacion: string[];
  tipoContrato?: TipoContratoLaboral;
  regimenEspecial?: RegimenEspecialLaboral;
  requisitosAplicables: Requisito[];
};

function normalizeHeader(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase().replace(/[\s_-]+/g, '');
}

function normalizeLookup(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLocaleLowerCase('es')
    .replace(/[^a-z0-9k]+/g, '');
}

function normalizeRut(value: string): string {
  return value.replace(/[^0-9kK]/g, '').toUpperCase();
}

function parseCsvRow(line: string, delimiter: string): string[] {
  const result: string[] = [];
  let current = '';
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"') {
      if (quoted && line[index + 1] === '"') {
        current += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (char === delimiter && !quoted) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

function validIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parts = value.split('-').map(Number);
  const date = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]));
  return date.getUTCFullYear() === parts[0]
    && date.getUTCMonth() === parts[1] - 1
    && date.getUTCDate() === parts[2];
}

function parseContractType(value: string): TipoContratoLaboral | undefined {
  const key = normalizeLookup(value);
  if (key === 'indefinido') return 'indefinido';
  if (key === 'plazofijo' || key === 'plazo') return 'plazo_fijo';
  if (key === 'obrafaena' || key === 'obraofaena' || key === 'obrafenadeterminada' || key === 'obra') return 'obra_faena';
  return undefined;
}

function parseSpecialRegime(value: string): RegimenEspecialLaboral | undefined {
  const key = normalizeLookup(value);
  if (!key || key === 'ninguno' || key === 'no' || key === 'noaplica' || key === 'na') return undefined;
  const values: Record<string, RegimenEspecialLaboral> = {
    serviciostransitorios: 'servicios_transitorios',
    aprendizaje: 'aprendizaje',
    agricolatemporada: 'agricola_temporada',
    casaparticular: 'casa_particular',
    gentemarportuariobuceo: 'gente_mar_portuario_buceo',
    gentedemarportuariobuceo: 'gente_mar_portuario_buceo',
    artesespectaculos: 'artes_espectaculos',
    deportistaprofesional: 'deportista_profesional',
    tripulacionaerea: 'tripulacion_aerea',
    plataformadigitaldependiente: 'plataforma_digital_dependiente',
    otro: 'otro',
  };
  return values[key];
}

function parseCsv(text: string): ParsedWorker[] {
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/).filter(line => line.trim());
  if (lines.length < 2) return [];
  const delimiter = (lines[0].match(/;/g)?.length || 0) > (lines[0].match(/,/g)?.length || 0) ? ';' : ',';
  const headers = parseCsvRow(lines[0], delimiter).map(normalizeHeader);
  const index = (names: string[]) => headers.findIndex(header => names.includes(header));

  const indexes = {
    nombre: index(['nombre', 'nombrecompleto', 'trabajador']),
    rut: index(['rut']),
    cargo: index(['cargo', 'puesto']),
    servicio: index(['servicio', 'contrato', 'serviciocontrato']),
    categorias: index(['categorias', 'categoria']),
    fechaIngreso: index(['fechaingreso', 'ingreso', 'fecha']),
    tipoContrato: index(['tipocontrato', 'contratolaboral']),
    fechaInicioContrato: index(['fechainiciocontrato', 'iniciocontrato']),
    fechaTerminoContrato: index(['fechaterminocontrato', 'terminocontrato']),
    obraFaenaContrato: index(['obrafenacontrato', 'obrafaena', 'faenacontrato']),
    regimenEspecial: index(['regimenespecial', 'regimenlaboral']),
    detalleRegimenEspecial: index(['detalleregimenespecial', 'detalleregimen']),
  };

  const required = [
    [indexes.nombre, 'Nombre'],
    [indexes.rut, 'RUT'],
    [indexes.cargo, 'Cargo'],
    [indexes.fechaIngreso, 'FechaIngreso'],
    [indexes.tipoContrato, 'TipoContrato'],
    [indexes.fechaInicioContrato, 'FechaInicioContrato'],
  ] as const;
  const missing = required.filter(item => item[0] < 0).map(item => item[1]);
  if (missing.length > 0) throw new Error('El CSV debe incluir: ' + missing.join(', ') + '.');

  const seen = new Set<string>();
  return lines.slice(1).map((line, offset) => {
    const cells = parseCsvRow(line, delimiter);
    const read = (position: number) => position >= 0 ? (cells[position] || '').trim() : '';
    const row: ParsedWorker = {
      line: offset + 2,
      nombre: read(indexes.nombre),
      rut: read(indexes.rut),
      cargo: read(indexes.cargo),
      servicio: read(indexes.servicio),
      categorias: read(indexes.categorias).split('|').map(value => value.trim()).filter(Boolean),
      fechaIngreso: read(indexes.fechaIngreso),
      tipoContratoRaw: read(indexes.tipoContrato),
      fechaInicioContrato: read(indexes.fechaInicioContrato),
      fechaTerminoContrato: read(indexes.fechaTerminoContrato),
      obraFaenaContrato: read(indexes.obraFaenaContrato),
      regimenEspecialRaw: read(indexes.regimenEspecial),
      detalleRegimenEspecial: read(indexes.detalleRegimenEspecial),
      baseErrors: [],
    };

    if (!row.nombre) row.baseErrors.push('Falta nombre');
    if (!row.rut) row.baseErrors.push('Falta RUT');
    else if (!isValidRut(row.rut)) row.baseErrors.push('RUT inválido');
    if (!row.cargo) row.baseErrors.push('Falta cargo');
    if (!row.fechaIngreso) row.baseErrors.push('Falta FechaIngreso');
    else if (!validIsoDate(row.fechaIngreso)) row.baseErrors.push('FechaIngreso debe usar AAAA-MM-DD');
    if (!row.tipoContratoRaw) row.baseErrors.push('Falta TipoContrato');
    if (!row.fechaInicioContrato) row.baseErrors.push('Falta FechaInicioContrato');
    else if (!validIsoDate(row.fechaInicioContrato)) row.baseErrors.push('FechaInicioContrato debe usar AAAA-MM-DD');
    if (row.fechaTerminoContrato && !validIsoDate(row.fechaTerminoContrato)) row.baseErrors.push('FechaTerminoContrato debe usar AAAA-MM-DD');

    const rutKey = normalizeRut(row.rut);
    if (rutKey && seen.has(rutKey)) row.baseErrors.push('RUT duplicado en el archivo');
    if (rutKey) seen.add(rutKey);
    return row;
  });
}

function resolveService(raw: string, services: ServicioContrato[]) {
  if (!raw) return {} as { id?: string; label?: string; error?: string };
  const key = normalizeLookup(raw);
  const matches = services.filter(service =>
    normalizeLookup(service.id) === key
    || normalizeLookup(service.codigo) === key
    || normalizeLookup(service.nombre) === key
  );
  if (matches.length === 0) return { error: 'Servicio "' + raw + '" no existe o no está activo' };
  if (matches.length > 1) return { error: 'Servicio "' + raw + '" es ambiguo; usa su código' };
  return { id: matches[0].id, label: matches[0].codigo + ' · ' + matches[0].nombre };
}

function sameContract(worker: Trabajador, row: ValidatedWorker): boolean {
  return worker.tipoContrato === row.tipoContrato
    && (worker.fechaInicioContrato || '') === row.fechaInicioContrato
    && (worker.fechaTerminoContrato || '') === (row.tipoContrato === 'plazo_fijo' ? row.fechaTerminoContrato : '')
    && (worker.obraFaenaContrato || '') === (row.tipoContrato === 'obra_faena' ? row.obraFaenaContrato.trim() : '')
    && (worker.regimenEspecial || '') === (row.regimenEspecial || '')
    && (worker.detalleRegimenEspecial || '') === (row.regimenEspecial === 'otro' ? row.detalleRegimenEspecial.trim() : '');
}

function downloadTemplate() {
  const rows = [
    'Nombre;RUT;Cargo;Servicio;Categorias;FechaIngreso;TipoContrato;FechaInicioContrato;FechaTerminoContrato;ObraFaenaContrato;RegimenEspecial;DetalleRegimenEspecial',
    'Juan Pérez;12.345.678-5;Operador;SRV-01;General;2026-09-20;indefinido;2026-09-01;;;;',
    'María Soto;17.654.321-3;Técnica;SRV-01;altura|electrico;2026-09-20;plazo_fijo;2026-09-01;2026-12-31;;;',
  ];
  const blob = new Blob(['\ufeff' + rows.join('\n') + '\n'], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = 'plantilla_trabajadores_acredita.csv';
  anchor.click();
  URL.revokeObjectURL(url);
}

export default function BulkWorkersConfig({
  contratista,
  proyectos,
  showToast,
}: {
  contratista: Contratista;
  proyectos: Proyecto[];
  showToast: (msg: string, type?: 'success' | 'error' | 'warning') => void;
}) {
  const { refreshNow } = useDataSync();
  const activeProjects = useMemo(
    () => proyectos.filter(project => proyectoOperativoParaContratista(project, contratista.id)),
    [proyectos, contratista.id],
  );
  const [projectId, setProjectId] = useState(activeProjects[0]?.id || '');
  const [serviceId, setServiceId] = useState('');
  const [rows, setRows] = useState<ParsedWorker[]>([]);
  const [filename, setFilename] = useState('');
  const [parsingError, setParsingError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);

  useEffect(() => {
    if (!activeProjects.some(project => project.id === projectId)) {
      setProjectId(activeProjects[0]?.id || '');
      setServiceId('');
      setRows([]);
      setFilename('');
    }
  }, [activeProjects, projectId]);

  const services = useMemo(
    () => projectId ? getServiciosProyecto(projectId, contratista.id) : [],
    [projectId, contratista.id],
  );
  const requirements = useMemo(
    () => getRequisitos().filter(req => req.proyectoId === projectId && req.destino === 'trabajador' && req.activo !== false),
    [projectId],
  );
  const categories = useMemo<string[]>(() => Array.from(new Set<string>(
    requirements.flatMap(req => req.categoriasAplicables || []).map(value => value.trim()).filter(Boolean),
  )), [requirements]);
  const specificCategories = categories.filter(value => normalizeLookup(value) !== 'general');
  const serviceRequired = services.length > 0 || requirements.some(req => Boolean(req.servicioId));
  const configurationErrors: string[] = [];
  if (!projectId) configurationErrors.push('No hay un proyecto activo disponible.');
  if (projectId && requirements.length === 0) configurationErrors.push('El proyecto no tiene matriz documental de trabajadores.');
  if (requirements.some(req => Boolean(req.servicioId)) && services.length === 0) {
    configurationErrors.push('La matriz exige servicios, pero no hay servicios activos configurados.');
  }

  const validateRows = (source: ParsedWorker[], currentContractor: Contratista): ValidatedWorker[] => {
    const categoryMap = new Map<string, string>(categories.map(category => [normalizeLookup(category), category]));
    return source.map(row => {
      const errors = [...row.baseErrors];
      const warnings: string[] = [];
      const existing = (currentContractor.trabajadores || []).find(worker => normalizeRut(worker.rut) === normalizeRut(row.rut));
      const alreadyAssigned = Boolean(existing && esTrabajadorAsignado(existing, projectId, activeProjects));
      const status: ValidatedWorker['status'] = alreadyAssigned ? 'ya_asignado' : existing ? 'reingreso' : 'nuevo';

      if (alreadyAssigned) {
        warnings.push('Ya está asignado; se omitirá');
        return { ...row, errors, warnings, status, categoriasAsignacion: [], requisitosAplicables: [] };
      }

      const rawService = row.servicio || serviceId;
      const service = resolveService(rawService, services);
      if (service.error) errors.push(service.error);
      if (serviceRequired && !rawService) errors.push('Falta servicio o contrato');

      let rowCategories: string[] = [...row.categorias];
      if (specificCategories.length > 0) {
        if (rowCategories.length === 0) errors.push('Falta categoría');
        rowCategories = rowCategories.map(category => {
          const found = categoryMap.get(normalizeLookup(category));
          if (!found) errors.push('Categoría "' + category + '" no está configurada');
          return found || category;
        });
      } else if (rowCategories.length === 0) {
        rowCategories = ['General'];
      }
      rowCategories = Array.from(new Set(rowCategories));

      const tipoContrato = parseContractType(row.tipoContratoRaw);
      if (row.tipoContratoRaw && !tipoContrato) errors.push('TipoContrato inválido');
      if (tipoContrato === 'plazo_fijo' && !row.fechaTerminoContrato) errors.push('Plazo fijo requiere FechaTerminoContrato');
      if (row.fechaInicioContrato && row.fechaIngreso && validIsoDate(row.fechaInicioContrato) && validIsoDate(row.fechaIngreso) && row.fechaIngreso < row.fechaInicioContrato) {
        errors.push('FechaIngreso es anterior al inicio del contrato');
      }
      if (row.fechaInicioContrato && row.fechaTerminoContrato && validIsoDate(row.fechaInicioContrato) && validIsoDate(row.fechaTerminoContrato) && row.fechaTerminoContrato < row.fechaInicioContrato) {
        errors.push('FechaTerminoContrato es anterior al inicio del contrato');
      }
      if (tipoContrato === 'plazo_fijo' && row.fechaIngreso && row.fechaTerminoContrato && validIsoDate(row.fechaIngreso) && validIsoDate(row.fechaTerminoContrato) && row.fechaIngreso > row.fechaTerminoContrato) {
        errors.push('FechaIngreso es posterior al término del contrato');
      }
      if (tipoContrato === 'obra_faena' && !row.obraFaenaContrato.trim()) errors.push('Obra/faena requiere ObraFaenaContrato');

      const regimenEspecial = parseSpecialRegime(row.regimenEspecialRaw);
      if (row.regimenEspecialRaw && !regimenEspecial) errors.push('RegimenEspecial inválido');
      if (regimenEspecial === 'otro' && !row.detalleRegimenEspecial.trim()) errors.push('RegimenEspecial otro requiere detalle');

      const validated: ValidatedWorker = {
        ...row,
        errors,
        warnings,
        status,
        servicioId: service.id,
        servicioLabel: service.label,
        categoriasAsignacion: rowCategories,
        tipoContrato,
        regimenEspecial,
        requisitosAplicables: [],
      };

      if (existing && existing.asignaciones?.some(item => item.estado === 'activa') && !sameContract(existing, validated)) {
        errors.push('Trabajador activo en otro proyecto: el contrato del CSV no coincide con su ficha actual');
      }

      if (errors.length === 0 && tipoContrato) {
        const preview: Trabajador = {
          nombre: row.nombre,
          rut: row.rut,
          cargo: row.cargo,
          estado: 'pendiente',
          tipoContrato,
          fechaInicioContrato: row.fechaInicioContrato,
          fechaTerminoContrato: tipoContrato === 'plazo_fijo' ? row.fechaTerminoContrato : undefined,
          obraFaenaContrato: tipoContrato === 'obra_faena' ? row.obraFaenaContrato.trim() : undefined,
          regimenEspecial,
          detalleRegimenEspecial: regimenEspecial === 'otro' ? row.detalleRegimenEspecial.trim() : undefined,
          asignaciones: [{
            id: 'bulk_preview',
            proyectoId: projectId,
            servicioId: service.id,
            cargo: row.cargo,
            categorias: rowCategories,
            fechaIngreso: row.fechaIngreso,
            estado: 'activa',
            estadoAcceso: 'pendiente',
          }],
          documentos: [],
        };
        validated.requisitosAplicables = requirements.filter(req => requisitoAplicaATrabajador(req, preview, projectId));
        if (validated.requisitosAplicables.length === 0) errors.push('Servicio/categoría sin requisitos aplicables');
      }
      return validated;
    });
  };

  const validatedRows = useMemo(
    () => validateRows(rows, contratista),
    [rows, contratista, projectId, serviceId, services, requirements, categories],
  );
  const errorCount = validatedRows.filter(row => row.errors.length > 0).length;
  const skippedCount = validatedRows.filter(row => row.status === 'ya_asignado').length;
  const importableCount = validatedRows.length - errorCount - skippedCount;

  const readFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setParsingError(null);
    try {
      const parsed = parseCsv(await file.text());
      if (parsed.length === 0) throw new Error('El archivo no contiene trabajadores.');
      if (parsed.length > 500) throw new Error('La carga permite hasta 500 trabajadores por archivo.');
      setRows(parsed);
      setFilename(file.name);
    } catch (error) {
      setRows([]);
      setFilename('');
      setParsingError(error instanceof Error ? error.message : 'No fue posible leer el CSV.');
    }
  };

  const importWorkers = async () => {
    if (!projectId || rows.length === 0 || importing || configurationErrors.length > 0) return;
    const project = activeProjects.find(item => item.id === projectId);
    if (!project) {
      showToast('Solo puedes cargar trabajadores en proyectos activos.', 'error');
      return;
    }

    setImporting(true);
    try {
      const list = getContratistas();
      const contractorIndex = list.findIndex(item => item.id === contratista.id);
      if (contractorIndex < 0) throw new Error('No se encontró la empresa del contratista.');
      const current = list[contractorIndex];
      current.trabajadores ||= [];

      const freshRows = validateRows(rows, current);
      const invalid = freshRows.filter(row => row.errors.length > 0);
      if (invalid.length > 0) throw new Error('Corrige las ' + invalid.length + ' filas con errores antes de importar.');

      let created = 0;
      let assigned = 0;
      let skipped = 0;

      for (const row of freshRows) {
        const existing = current.trabajadores.find(worker => normalizeRut(worker.rut) === normalizeRut(row.rut));
        if (row.status === 'ya_asignado' || (existing && esTrabajadorAsignado(existing, projectId, activeProjects))) {
          skipped += 1;
          continue;
        }
        if (!row.tipoContrato) throw new Error('Línea ' + row.line + ': TipoContrato inválido.');

        const assignmentId = 'asignacion_' + crypto.randomUUID();
        const documents = crearDocumentosPendientesProyecto(
          row.requisitosAplicables,
          current.id,
          projectId,
          row.rut,
          assignmentId,
        );
        const assignment = {
          id: assignmentId,
          proyectoId: projectId,
          servicioId: row.servicioId,
          cargo: row.cargo,
          categorias: row.categoriasAsignacion,
          fechaIngreso: row.fechaIngreso,
          estado: 'activa' as const,
          estadoAcceso: 'pendiente' as const,
          tipoContrato: row.tipoContrato,
          fechaInicioContrato: row.fechaInicioContrato,
          fechaTerminoContrato: row.tipoContrato === 'plazo_fijo' ? row.fechaTerminoContrato : undefined,
          obraFaenaContrato: row.tipoContrato === 'obra_faena' ? row.obraFaenaContrato.trim() : undefined,
          regimenEspecial: row.regimenEspecial,
          detalleRegimenEspecial: row.regimenEspecial === 'otro' ? row.detalleRegimenEspecial.trim() : undefined,
        };

        if (existing) {
          existing.nombre = row.nombre.trim();
          existing.cargo = row.cargo;
          existing.tipoContrato = row.tipoContrato;
          existing.fechaInicioContrato = row.fechaInicioContrato;
          existing.fechaTerminoContrato = row.tipoContrato === 'plazo_fijo' ? row.fechaTerminoContrato : undefined;
          existing.obraFaenaContrato = row.tipoContrato === 'obra_faena' ? row.obraFaenaContrato.trim() : undefined;
          existing.regimenEspecial = row.regimenEspecial;
          existing.detalleRegimenEspecial = row.regimenEspecial === 'otro' ? row.detalleRegimenEspecial.trim() : undefined;
          // En un reingreso, el período nuevo debe ganar cualquier búsqueda local
          // mientras Supabase genera las obligaciones definitivas de la asignación.
          existing.documentos = [...documents, ...(existing.documentos || [])];
          existing.asignaciones = [...(existing.asignaciones || []), assignment];
          existing.estado = calcularEstadoTrabajador(existing, projectId);
          assigned += 1;
        } else {
          current.trabajadores.push({
            nombre: row.nombre.trim(),
            rut: row.rut,
            cargo: row.cargo,
            faena: project.nombre,
            estado: 'pendiente',
            tipoContrato: row.tipoContrato,
            fechaInicioContrato: row.fechaInicioContrato,
            fechaTerminoContrato: row.tipoContrato === 'plazo_fijo' ? row.fechaTerminoContrato : undefined,
            obraFaenaContrato: row.tipoContrato === 'obra_faena' ? row.obraFaenaContrato.trim() : undefined,
            regimenEspecial: row.regimenEspecial,
            detalleRegimenEspecial: row.regimenEspecial === 'otro' ? row.detalleRegimenEspecial.trim() : undefined,
            cumplimiento: 0,
            documentos: documents,
            asignaciones: [assignment],
          });
          created += 1;
        }
      }

      if (created === 0 && assigned === 0) {
        showToast('No había trabajadores nuevos para importar.', 'warning');
        return;
      }

      saveContratistas(list);
      await confirmBusinessPersistence('all');
      await refreshNow();
      setRows([]);
      setFilename('');
      const parts = [String(created) + ' creados', String(assigned) + ' reingresos/asignaciones'];
      if (skipped) parts.push(String(skipped) + ' ya estaban asignados');
      showToast('Carga completada: ' + parts.join(', ') + '.');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'No fue posible importar los trabajadores.', 'error');
    } finally {
      setImporting(false);
    }
  };

  return (
    <section className="cfg-card">
      <header>
        <h2>Carga masiva de trabajadores</h2>
        <p>Incorpora hasta 500 trabajadores con ficha laboral completa, asignación y requisitos documentales aplicables.</p>
      </header>
      <div className="cfg-card-body space-y-4">
        {activeProjects.length === 0 ? (
          <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-3 text-[12px] text-yellow-800">
            No tienes proyectos activos disponibles. Los proyectos históricos son solo de consulta.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="text-[12.5px] font-medium text-gray-700">Proyecto activo
              <select
                aria-label="Proyecto para carga masiva"
                value={projectId}
                onChange={event => {
                  setProjectId(event.target.value);
                  setServiceId('');
                  setRows([]);
                  setFilename('');
                  setParsingError(null);
                }}
                className="form-input mt-1 w-full p-2.5 border rounded-lg"
              >
                {activeProjects.map(project => <option key={project.id} value={project.id}>{project.nombre}</option>)}
              </select>
            </label>
            <label className="text-[12.5px] font-medium text-gray-700">Servicio por defecto
              <select
                aria-label="Servicio por defecto para carga masiva"
                value={serviceId}
                onChange={event => setServiceId(event.target.value)}
                className="form-input mt-1 w-full p-2.5 border rounded-lg"
                disabled={services.length === 0}
              >
                <option value="">{serviceRequired ? 'Seleccionar servicio' : 'Sin servicio específico'}</option>
                {services.map(service => <option key={service.id} value={service.id}>{service.codigo} · {service.nombre}</option>)}
              </select>
            </label>
          </div>
        )}

        {configurationErrors.length > 0 && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-[12px] text-red-700">
            <strong className="block mb-1">Configuración pendiente</strong>
            {configurationErrors.map(error => <div key={error}>• {error}</div>)}
          </div>
        )}

        <div className="rounded-lg border border-blue-100 bg-blue-50 p-3 text-[12px] leading-relaxed text-blue-800">
          <b>Obligatorias:</b> Nombre, RUT, Cargo, FechaIngreso, TipoContrato y FechaInicioContrato.
          {serviceRequired ? ' El servicio también es obligatorio.' : ''}
          {specificCategories.length > 0 ? ' Debes informar una categoría configurada.' : ' Si no informas categoría se asignará General.'}
          <br />
          TipoContrato: <b>indefinido</b>, <b>plazo_fijo</b> u <b>obra_faena</b>. Servicio acepta código o nombre. Separa categorías con <b>|</b>.
        </div>

        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn btn-secondary" onClick={downloadTemplate}><Download size={14} />Descargar plantilla CSV</button>
          <label className={'btn btn-primary cursor-pointer ' + (configurationErrors.length > 0 ? 'pointer-events-none opacity-50' : '')}>
            <Upload size={14} />Seleccionar CSV
            <input className="hidden" type="file" accept=".csv,text/csv" onChange={readFile} disabled={configurationErrors.length > 0} />
          </label>
        </div>

        {parsingError && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-[12px] text-red-700">{parsingError}</div>}

        {validatedRows.length > 0 && <>
          <div className="flex flex-col gap-2 rounded-lg border border-cream3 bg-cream2 p-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <FileSpreadsheet size={18} className="text-brown" />
              <div>
                <strong className="block text-[13px] text-navy">{filename}</strong>
                <span className="text-[11.5px] text-gray-500">
                  {validatedRows.length} filas · {importableCount} importables
                  {skippedCount ? ' · ' + skippedCount + ' se omitirán' : ''}
                  {errorCount ? ' · ' + errorCount + ' con errores' : ' · archivo validado'}
                </span>
              </div>
            </div>
            <button type="button" className="btn btn-primary" disabled={importing || errorCount > 0 || importableCount === 0 || configurationErrors.length > 0} onClick={() => void importWorkers()}>
              <Users size={14} />{importing ? 'Importando…' : 'Importar ' + importableCount}
            </button>
          </div>

          <div className="overflow-x-auto rounded-lg border border-cream3">
            <table className="w-full min-w-[1050px] text-left text-[12px]">
              <thead className="bg-cream2 text-gray-500"><tr><th className="p-2">Línea</th><th className="p-2">Trabajador</th><th className="p-2">Cargo</th><th className="p-2">Servicio</th><th className="p-2">Categorías</th><th className="p-2">Contrato</th><th className="p-2">Ingreso</th><th className="p-2">Validación</th></tr></thead>
              <tbody>{validatedRows.slice(0, 20).map(row => <tr key={row.line + ':' + row.rut} className="border-t border-cream3 align-top">
                <td className="p-2">{row.line}</td>
                <td className="p-2"><strong className="block text-navy">{row.nombre}</strong><span className="text-gray-500">{row.rut}</span></td>
                <td className="p-2">{row.cargo || '—'}</td>
                <td className="p-2">{row.servicioLabel || (row.status === 'ya_asignado' ? '—' : 'Sin servicio')}</td>
                <td className="p-2">{row.categoriasAsignacion.join(', ') || '—'}</td>
                <td className="p-2">{row.tipoContrato || row.tipoContratoRaw || '—'}</td>
                <td className="p-2">{row.fechaIngreso || '—'}</td>
                <td className="p-2">{row.errors.length ? <span className="text-red-700">{row.errors.join(' · ')}</span> : row.status === 'ya_asignado' ? <span className="text-amber-700">{row.warnings.join(' · ')}</span> : <span className="text-emerald-700">{row.status === 'reingreso' ? 'Correcta · reingreso' : 'Correcta · ' + row.requisitosAplicables.length + ' requisitos aplicables'}</span>}</td>
              </tr>)}</tbody>
            </table>
          </div>
          {validatedRows.length > 20 && <div className="text-[11px] text-gray-400">Mostrando las primeras 20 filas de {validatedRows.length}.</div>}
        </>}
      </div>
    </section>
  );
}
