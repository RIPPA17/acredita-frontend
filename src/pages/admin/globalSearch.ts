import type { Contratista, Mandante, Proyecto, Verificador } from '../../types';

export type AdminSearchItem =
  | { tipo: 'empresa'; label: string; sub: string; data: Mandante | Contratista; esMandante: boolean }
  | { tipo: 'documento'; label: string; sub: string; data: any }
  | { tipo: 'proyecto'; label: string; sub: string; data: { nombre: string; mandante: string; proyecto: Proyecto } }
  | { tipo: 'revisor'; label: string; sub: string; data: Verificador };

export function buildAdminSearchResults(params: {
  query: string;
  mandantes: Mandante[];
  contratistas: Contratista[];
  proyectos: Proyecto[];
  verificadores: Verificador[];
}) {
  const { query, mandantes, contratistas, proyectos, verificadores } = params;

  const projects = proyectos.map(project => {
    const mandante = mandantes.find(item => item.id === project.mandanteId);
    return {
      nombre: project.nombre,
      mandante: mandante ? mandante.nombre : 'Mandante no disponible',
      proyecto: project,
    };
  });

  const documents = contratistas.flatMap(contractor => [
    ...contractor.documentos.map(document => ({
      documento: document.nombre,
      estado: document.estado,
      contratista: contractor,
      proyectoId: document.proyectoId,
      proyectoNombre: proyectos.find(project => project.id === document.proyectoId)?.nombre || 'Proyecto no disponible',
      trabajador: null,
    })),
    ...(contractor.trabajadores || []).flatMap(worker =>
      (worker.documentos || []).map(document => ({
        documento: document.nombre,
        estado: document.estado,
        contratista: contractor,
        proyectoId: document.proyectoId,
        proyectoNombre: proyectos.find(project => project.id === document.proyectoId)?.nombre || 'Proyecto no disponible',
        trabajador: worker,
      })),
    ),
  ]).filter(item => Boolean(item.proyectoId));

  const index: AdminSearchItem[] = [
    ...mandantes.map(item => ({ tipo: 'empresa' as const, label: item.nombre, sub: 'Mandante', data: item, esMandante: true })),
    ...contratistas.map(item => ({ tipo: 'empresa' as const, label: item.nombre, sub: item.isNew ? 'Contratista (Nuevo)' : 'Contratista', data: item, esMandante: false })),
    ...documents.map(item => ({ tipo: 'documento' as const, label: item.documento, sub: `${item.contratista.nombre} · ${item.proyectoNombre} · ${item.estado}`, data: item })),
    ...projects.map(item => ({ tipo: 'proyecto' as const, label: item.nombre, sub: item.mandante, data: item })),
    ...verificadores.map(item => ({
      tipo: 'revisor' as const,
      label: item.nombre,
      sub: `${item.rol === 'supervisor' ? 'Supervisor' : 'Verificador'} · ${item.estado === 'online' ? 'Online' : 'Offline'}`,
      data: item,
    })),
  ];

  const normalizedQuery = query.trim().toLowerCase();
  const results = normalizedQuery
    ? index.filter(item => item.label.toLowerCase().includes(normalizedQuery) || item.sub.toLowerCase().includes(normalizedQuery))
    : [];

  return {
    total: results.length,
    empresa: results.filter(item => item.tipo === 'empresa'),
    documento: results.filter(item => item.tipo === 'documento'),
    proyecto: results.filter(item => item.tipo === 'proyecto'),
    revisor: results.filter(item => item.tipo === 'revisor'),
  };
}
