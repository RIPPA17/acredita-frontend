import { useMemo, useState, type ChangeEvent } from 'react';
import { Download, FileSpreadsheet, Upload, Users } from 'lucide-react';
import {
  calcularEstadoTrabajador,
  esTrabajadorAsignado,
  getContratistas,
  getRequisitos,
  saveContratistas,
} from '../../data/localStorageDb';
import { confirmBusinessPersistence } from '../../data/supabasePersistence';
import { getServiciosProyecto } from '../../data/operationalCore';
import { useDataSync } from '../../components/DataSyncContext';
import { isValidRut } from '../../utils/rut';
import type { Contratista, Proyecto, Trabajador } from '../../types';
import { crearDocumentosPendientesProyecto } from './documentosUtils';

type ParsedWorker = {
  line: number;
  nombre: string;
  rut: string;
  cargo: string;
  categorias: string[];
  fechaIngreso: string;
  errors: string[];
};

function normalizeHeader(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase().replace(/[\s_-]+/g, '');
}

function parseCsvRow(line: string, delimiter: string): string[] {
  const result: string[] = [];
  let current = '';
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"') {
      if (quoted && line[index + 1] === '"') { current += '"'; index += 1; }
      else quoted = !quoted;
    } else if (char === delimiter && !quoted) {
      result.push(current.trim()); current = '';
    } else current += char;
  }
  result.push(current.trim());
  return result;
}

function parseCsv(text: string): ParsedWorker[] {
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/).filter(line => line.trim());
  if (lines.length < 2) return [];
  const delimiter = (lines[0].match(/;/g)?.length || 0) > (lines[0].match(/,/g)?.length || 0) ? ';' : ',';
  const headers = parseCsvRow(lines[0], delimiter).map(normalizeHeader);
  const index = (names: string[]) => headers.findIndex(header => names.includes(header));
  const nombreIndex = index(['nombre', 'nombrecompleto', 'trabajador']);
  const rutIndex = index(['rut']);
  const cargoIndex = index(['cargo', 'puesto']);
  const categoriasIndex = index(['categorias', 'categoria']);
  const fechaIndex = index(['fechaingreso', 'ingreso', 'fecha']);
  if (nombreIndex < 0 || rutIndex < 0) throw new Error('El CSV debe incluir las columnas Nombre y RUT.');

  const seen = new Set<string>();
  return lines.slice(1).map((line, offset) => {
    const cells = parseCsvRow(line, delimiter);
    const nombre = (cells[nombreIndex] || '').trim();
    const rut = (cells[rutIndex] || '').trim();
    const cargo = cargoIndex >= 0 ? (cells[cargoIndex] || '').trim() : '';
    const categoriasRaw = categoriasIndex >= 0 ? (cells[categoriasIndex] || '').trim() : '';
    const fechaIngreso = fechaIndex >= 0 ? (cells[fechaIndex] || '').trim() : '';
    const errors: string[] = [];
    if (!nombre) errors.push('Falta nombre');
    if (!rut) errors.push('Falta RUT');
    else if (!isValidRut(rut)) errors.push('RUT inválido');
    const rutKey = rut.replace(/[^0-9kK]/g, '').toLowerCase();
    if (rutKey && seen.has(rutKey)) errors.push('RUT duplicado en el archivo');
    if (rutKey) seen.add(rutKey);
    if (fechaIngreso && !/^\d{4}-\d{2}-\d{2}$/.test(fechaIngreso)) errors.push('Fecha debe usar AAAA-MM-DD');
    return {
      line: offset + 2,
      nombre,
      rut,
      cargo,
      categorias: categoriasRaw.split('|').map(value => value.trim()).filter(Boolean),
      fechaIngreso,
      errors,
    };
  });
}

function downloadTemplate() {
  const content = 'Nombre;RUT;Cargo;Categorias;FechaIngreso\nJuan Pérez;12.345.678-5;Operador;general|altura;2026-09-15\n';
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8' });
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
  const [projectId, setProjectId] = useState(proyectos[0]?.id || '');
  const [serviceId, setServiceId] = useState('');
  const [rows, setRows] = useState<ParsedWorker[]>([]);
  const [filename, setFilename] = useState('');
  const [parsingError, setParsingError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const services = useMemo(() => projectId ? getServiciosProyecto(projectId, contratista.id) : [], [projectId, contratista.id]);
  const errorCount = rows.filter(row => row.errors.length > 0).length;

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
      setRows([]); setFilename('');
      setParsingError(error instanceof Error ? error.message : 'No fue posible leer el CSV.');
    }
  };

  const importWorkers = async () => {
    if (!projectId || rows.length === 0 || errorCount > 0 || importing) return;
    const project = proyectos.find(item => item.id === projectId);
    if (!project) return;
    setImporting(true);
    try {
      const list = getContratistas();
      const index = list.findIndex(item => item.id === contratista.id);
      if (index < 0) throw new Error('No se encontró la empresa del contratista.');
      const current = list[index];
      current.trabajadores ||= [];
      const requirements = getRequisitos().filter(req => req.proyectoId === projectId && req.destino === 'trabajador' && req.activo !== false);
      let created = 0;
      let assigned = 0;
      let skipped = 0;

      for (const row of rows) {
        const existing = current.trabajadores.find(worker => worker.rut.replace(/[^0-9kK]/g, '').toLowerCase() === row.rut.replace(/[^0-9kK]/g, '').toLowerCase());
        if (existing && esTrabajadorAsignado(existing, projectId, proyectos)) { skipped += 1; continue; }
        const documents = crearDocumentosPendientesProyecto(requirements, current.id, projectId, row.rut);
        const assignment = {
          id: `asignacion_${crypto.randomUUID()}`,
          proyectoId: projectId,
          servicioId: serviceId || undefined,
          cargo: row.cargo || undefined,
          categorias: row.categorias,
          fechaIngreso: row.fechaIngreso || new Date().toISOString().slice(0, 10),
          estado: 'activa' as const,
          estadoAcceso: 'pendiente' as const,
        };
        if (existing) {
          existing.documentos = [...(existing.documentos || []), ...documents];
          existing.asignaciones = [...(existing.asignaciones || []), assignment];
          existing.estado = calcularEstadoTrabajador(existing, projectId);
          assigned += 1;
        } else {
          const worker: Trabajador = {
            nombre: row.nombre,
            rut: row.rut,
            cargo: row.cargo || undefined,
            faena: project.nombre,
            estado: 'pendiente',
            cumplimiento: 0,
            documentos: documents,
            asignaciones: [assignment],
          };
          current.trabajadores.push(worker);
          created += 1;
        }
      }

      saveContratistas(list);
      await confirmBusinessPersistence('all');
      await refreshNow();
      setRows([]); setFilename('');
      const parts = [`${created} creados`, `${assigned} existentes asignados`];
      if (skipped) parts.push(`${skipped} ya estaban asignados`);
      showToast(`Carga completada: ${parts.join(', ')}.`);
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'No fue posible importar los trabajadores.', 'error');
    } finally {
      setImporting(false);
    }
  };

  return (
    <section className="cfg-card">
      <header><h2>Carga masiva de trabajadores</h2><p>Incorpora personal a un proyecto mediante CSV y genera automáticamente su asignación y requisitos documentales.</p></header>
      <div className="cfg-card-body space-y-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="text-[12.5px] font-medium text-gray-700">Proyecto
            <select value={projectId} onChange={event => { setProjectId(event.target.value); setServiceId(''); }} className="form-input mt-1 w-full p-2.5 border rounded-lg">
              {proyectos.map(project => <option key={project.id} value={project.id}>{project.nombre}</option>)}
            </select>
          </label>
          <label className="text-[12.5px] font-medium text-gray-700">Servicio para esta carga
            <select value={serviceId} onChange={event => setServiceId(event.target.value)} className="form-input mt-1 w-full p-2.5 border rounded-lg">
              <option value="">Sin servicio específico</option>
              {services.map(service => <option key={service.id} value={service.id}>{service.codigo} · {service.nombre}</option>)}
            </select>
          </label>
        </div>

        <div className="rounded-lg border border-blue-100 bg-blue-50 p-3 text-[12px] leading-relaxed text-blue-800">
          Columnas obligatorias: <b>Nombre</b> y <b>RUT</b>. Opcionales: Cargo, Categorias y FechaIngreso. Separa múltiples categorías con <b>|</b>. La fecha usa formato AAAA-MM-DD.
        </div>

        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn btn-secondary" onClick={downloadTemplate}><Download size={14} />Descargar plantilla CSV</button>
          <label className="btn btn-primary cursor-pointer"><Upload size={14} />Seleccionar CSV<input className="hidden" type="file" accept=".csv,text/csv" onChange={readFile} /></label>
        </div>

        {parsingError && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-[12px] text-red-700">{parsingError}</div>}
        {rows.length > 0 && <>
          <div className="flex flex-col gap-2 rounded-lg border border-cream3 bg-cream2 p-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2"><FileSpreadsheet size={18} className="text-brown" /><div><strong className="block text-[13px] text-navy">{filename}</strong><span className="text-[11.5px] text-gray-500">{rows.length} trabajadores · {errorCount ? `${errorCount} filas con errores` : 'archivo validado'}</span></div></div>
            <button type="button" className="btn btn-primary" disabled={importing || errorCount > 0} onClick={() => void importWorkers()}><Users size={14} />{importing ? 'Importando…' : `Importar ${rows.length}`}</button>
          </div>
          <div className="overflow-x-auto rounded-lg border border-cream3"><table className="w-full text-left text-[12px]"><thead className="bg-cream2 text-gray-500"><tr><th className="p-2">Línea</th><th className="p-2">Nombre</th><th className="p-2">RUT</th><th className="p-2">Cargo</th><th className="p-2">Validación</th></tr></thead><tbody>{rows.slice(0, 15).map(row => <tr key={`${row.line}:${row.rut}`} className="border-t border-cream3"><td className="p-2">{row.line}</td><td className="p-2 font-medium text-navy">{row.nombre}</td><td className="p-2">{row.rut}</td><td className="p-2">{row.cargo || '—'}</td><td className={`p-2 ${row.errors.length ? 'text-red-700' : 'text-emerald-700'}`}>{row.errors.length ? row.errors.join(' · ') : 'Correcta'}</td></tr>)}</tbody></table></div>
          {rows.length > 15 && <div className="text-[11px] text-gray-400">Mostrando las primeras 15 filas de {rows.length}.</div>}
        </>}
      </div>
    </section>
  );
}
