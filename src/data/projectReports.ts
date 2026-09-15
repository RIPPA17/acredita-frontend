import type { Contratista, ObligacionDocumental, Proyecto, Requisito } from '../types';
import { buildComplianceCsv } from './operationalCore';

export async function downloadProjectPackage(project: Proyecto, contractors: Contratista[], requirements: Requisito[], obligations: ObligacionDocumental[]): Promise<void> {
  const [{ default: JSZip }, { jsPDF }] = await Promise.all([import('jszip'), import('jspdf')]);
  const requirementNames = new Map(requirements.map(item => [item.id, item.nombre]));
  const contractorNames = new Map(contractors.map(item => [item.id, item.nombre]));
  const rows = obligations.map(item => ({ Proyecto: project.nombre, Contratista: contractorNames.get(item.contratistaId) || item.contratistaId, Requisito: requirementNames.get(item.requisitoId) || item.requisitoId, Periodo: item.periodoEtiqueta, 'Fecha límite': item.fechaLimite, Estado: item.estado, Trabajador: item.trabajadorRut || '', Servicio: item.servicioId || '' }));
  const xmlEscape = (value: unknown) => String(value ?? '').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
  const headers = Object.keys(rows[0] || { Proyecto:'', Contratista:'', Requisito:'', Periodo:'', Estado:'' });
  const excelRows = [headers, ...rows.map(row => headers.map(header => row[header as keyof typeof row]))];
  const excel = `<?xml version="1.0"?><Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"><Worksheet ss:Name="Cumplimiento"><Table>${excelRows.map(row=>`<Row>${row.map(cell=>`<Cell><Data ss:Type="String">${xmlEscape(cell)}</Data></Cell>`).join('')}</Row>`).join('')}</Table></Worksheet></Workbook>`;
  const pdf = new jsPDF(); pdf.setFontSize(18); pdf.text(`Acredita · ${project.nombre}`, 14, 18); pdf.setFontSize(11);
  pdf.text(`Contratistas: ${contractors.length}`, 14, 30); pdf.text(`Obligaciones: ${obligations.length}`, 14, 38);
  const approved = obligations.filter(item => item.estado === 'aprobado').length;
  pdf.text(`Cumplimiento: ${obligations.length ? Math.round(approved / obligations.length * 100) : 0}%`, 14, 46);
  let y = 60; obligations.slice(0, 42).forEach(item => { pdf.text(`${item.periodoEtiqueta} · ${requirementNames.get(item.requisitoId) || item.requisitoId} · ${item.estado}`, 14, y); y += 5; });
  const zip = new JSZip(); zip.file('cumplimiento.csv', buildComplianceCsv(obligations, requirementNames, contractorNames)); zip.file('cumplimiento.xls', excel); zip.file('resumen.pdf', pdf.output('arraybuffer')); zip.file('datos.json', JSON.stringify({ project, contractors, requirements, obligations, exportedAt: new Date().toISOString() }, null, 2));
  const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' }); const url = URL.createObjectURL(blob); const anchor = document.createElement('a'); anchor.href = url; anchor.download = `acredita-${project.id}-expediente.zip`; anchor.click(); URL.revokeObjectURL(url);
}
