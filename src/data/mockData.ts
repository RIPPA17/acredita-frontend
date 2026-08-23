import { Mandante, Proyecto, Contratista, Documento, Trabajador, Verificador } from '../types';

// Equipo de verificación inicial — única fuente de verdad de nombres de
// revisor/supervisor para todo el frontend (reemplaza los nombres antes
// hardcodeados por separado en Admin.tsx y ColaRevisionTab.tsx).
export const VERIFICADORES: Verificador[] = [
  { id: 'ver_maria', nombre: 'María González', email: 'maria.gonzalez@acredita.cl', rol: 'verificador', estado: 'online', activo: true },
  { id: 'ver_carlos', nombre: 'Carlos Reyes', email: 'carlos.reyes@acredita.cl', rol: 'verificador', estado: 'online', activo: true },
  { id: 'sup_ana', nombre: 'Ana Ruiz', email: 'ana.ruiz@acredita.cl', rol: 'supervisor', estado: 'online', activo: true },
  { id: 'ver_sofia', nombre: 'Sofía Pérez', email: 'sofia.perez@acredita.cl', rol: 'verificador', estado: 'offline', activo: true },
];

export const PLANTILLA_DOCUMENTOS = [
  { id: 'liquidacion', nombre: 'Liquidación de sueldo (mes vigente)', categoria: 'Laboral', frecuencia: 'Mensual', destino: 'trabajador' },
  { id: 'f30', nombre: 'F30 SII (mes vigente)', categoria: 'Tributario', frecuencia: 'Mensual', destino: 'empresa' },
  { id: 'contrato', nombre: 'Contrato de Trabajo', categoria: 'Laboral', frecuencia: 'Indefinido', destino: 'trabajador' },
  { id: 'mutual', nombre: 'Registro Mutual ACHS', categoria: 'Prevención', frecuencia: 'Mensual', destino: 'empresa' },
  { id: 'antecedentes', nombre: 'Certificado de Antecedentes', categoria: 'Laboral', frecuencia: 'Mensual', destino: 'trabajador' },
  { id: 'odi', nombre: 'ODI 2026', categoria: 'Prevención', frecuencia: 'Por Proyecto', destino: 'trabajador' },
];

export const MANDANTES: Mandante[] = [
  {
    id: 'andina',
    nombre: 'Constructora Andina SA',
    rut: '76.890.123-4',
    plan: 'Pro',
    proyectos: ['costanera', 'mackenna', 'hospital'],
  },
  {
    id: 'minera-los-andes',
    nombre: 'Minera Los Andes SpA',
    rut: '77.654.321-K',
    plan: 'Pro',
    proyectos: ['bodega'],
  },
  {
    id: 'inmobiliaria-sur',
    nombre: 'Inmobiliaria del Sur Ltda.',
    rut: '76.234.567-8',
    plan: 'Básico',
    proyectos: ['solar'],
  },
];

export const PROYECTOS: Proyecto[] = [
  {
    id: 'costanera',
    nombre: 'Costanera Norte',
    mandanteId: 'andina',
    estado: 'Activo',
    urgenciaBadge: 'b-red',
    urgenciaLabel: '3 urgentes',
    contratistas: ['servicios-norte', 'lagos-cia', 'constructora-velez'],
  },
  {
    id: 'mackenna',
    nombre: 'Torre Mackenna',
    mandanteId: 'andina',
    estado: 'Activo',
    urgenciaBadge: 'b-yellow',
    urgenciaLabel: '1 normal',
    contratistas: ['electrica-sur', 'tecnicosur'],
  },
  {
    id: 'hospital',
    nombre: 'Hospital Regional Centro',
    mandanteId: 'andina',
    estado: 'Activo',
    urgenciaBadge: 'b-green',
    urgenciaLabel: 'Al día',
    contratistas: ['servicios-norte'],
  },
  {
    id: 'bodega',
    nombre: 'Bodega Logística Sur',
    mandanteId: 'minera-los-andes',
    estado: 'Activo',
    urgenciaBadge: 'b-green',
    urgenciaLabel: 'Al día',
    contratistas: ['tecnicosur', 'servicios-norte'],
  },
  {
    id: 'solar',
    nombre: 'Ampliación Planta Solar',
    mandanteId: 'inmobiliaria-sur',
    estado: 'Activo',
    urgenciaBadge: 'b-red',
    urgenciaLabel: '1 urgente',
    contratistas: ['tecnicosur'],
  },
];

export const CONTRATISTAS: Contratista[] = [
  {
    id: 'tecnicosur',
    nombre: 'TécnicoSur SpA',
    rut: '77.321.654-1',
    proyectos: ['mackenna', 'bodega', 'solar'],
    trabajadores: [
      { 
        nombre: 'Juan Pérez González', 
        rut: '18.453.211-0', 
        estado: 'aprobado', 
        cargo: 'Operador de Maquinaria', 
        faena: 'Torre Mackenna', 
        cumplimiento: 100,
        documentos: [
          { id: 'wt1_d1', nombre: 'Liquidación de sueldo (mes vigente)', categoria: 'Laboral', estado: 'aprobado', vencimiento: '30 Jun 2026', subido: '05 May 2026' },
          { id: 'wt1_d2', nombre: 'Contrato de Trabajo', categoria: 'Laboral', estado: 'aprobado', vencimiento: '31 Dic 2026', subido: '10 Ene 2026' },
          { id: 'wt1_d3', nombre: 'Certificado de Antecedentes', categoria: 'Laboral', estado: 'aprobado', vencimiento: '31 Dic 2026', subido: '10 Ene 2026' },
          { id: 'wt1_d4', nombre: 'ODI 2026', categoria: 'Prevención', estado: 'aprobado', vencimiento: '31 Dic 2026', subido: '10 Ene 2026' }
        ]
      },
      { 
        nombre: 'Carlos Rojas Méndez', 
        rut: '19.223.445-8', 
        estado: 'rechazado', 
        cargo: 'Jornalero', 
        faena: 'Torre Mackenna', 
        cumplimiento: 50, 
        detalle: 'Examen de Altura Rechazado',
        documentos: [
          { id: 'wt2_d1', nombre: 'Liquidación de sueldo (mes vigente)', categoria: 'Laboral', estado: 'aprobado', vencimiento: '30 Jun 2026', subido: '05 May 2026' },
          { id: 'wt2_d2', nombre: 'Contrato de Trabajo', categoria: 'Laboral', estado: 'aprobado', vencimiento: '31 Dic 2026', subido: '10 Ene 2026' },
          { id: 'wt2_d3', nombre: 'Certificado de Antecedentes', categoria: 'Laboral', estado: 'aprobado', vencimiento: '31 Dic 2026', subido: '10 Ene 2026' },
          { id: 'wt2_d4', nombre: 'ODI 2026', categoria: 'Prevención', estado: 'rechazado', vencimiento: '—', subido: '12 May 2026', motivo: 'Examen de Altura Rechazado', observacion: 'Examen de Altura Rechazado' }
        ]
      },
      { 
        nombre: 'Alejandro Muñoz Silva', 
        rut: '16.784.322-K', 
        estado: 'por_vencer', 
        cargo: 'Eléctrico', 
        faena: 'Torre Mackenna', 
        cumplimiento: 85, 
        detalle: 'Curso Faltante',
        documentos: [
          { id: 'wt3_d1', nombre: 'Liquidación de sueldo (mes vigente)', categoria: 'Laboral', estado: 'aprobado', vencimiento: '30 Jun 2026', subido: '05 May 2026' },
          { id: 'wt3_d2', nombre: 'Contrato de Trabajo', categoria: 'Laboral', estado: 'aprobado', vencimiento: '31 Dic 2026', subido: '10 Ene 2026' },
          { id: 'wt3_d3', nombre: 'Certificado de Antecedentes', categoria: 'Laboral', estado: 'aprobado', vencimiento: '31 Dic 2026', subido: '10 Ene 2026' },
          { id: 'wt3_d4', nombre: 'ODI 2026', categoria: 'Prevención', estado: 'por_vencer', vencimiento: '24 May 2026', subido: '24 May 2025', observacion: 'Curso Faltante' }
        ]
      }
    ],
    documentos: [
      {
        id: 'd1',
        nombre: 'Contrato de Trabajo',
        categoria: 'Laboral',
        estado: 'aprobado',
        vencimiento: '31 Dic 2026',
        subido: '15 Ene 2026',
      },
      {
        id: 'd2',
        nombre: 'Certificado ODI',
        categoria: 'Prevención',
        estado: 'por_vencer',
        vencimiento: '24 May 2026',
        subido: '24 May 2025',
        motivo: 'Vence en 6 días — renueva ahora para no bloquear el pago',
        observacion: 'Vence en 6 días — renueva ahora para no bloquear el pago',
      },
      {
        id: 'd3',
        nombre: 'Registro Mutual ACHS',
        categoria: 'Prevención',
        estado: 'rechazado',
        vencimiento: '—',
        subido: '10 May 2026',
        motivo: 'la firma del representante legal es ilegible en página 2',
        observacion: 'Rechazado: la firma del representante legal es ilegible en página 2',
      },
      {
        id: 'd4',
        nombre: 'Declaración jurada F30 — Mayo 2026',
        categoria: 'Tributario',
        estado: 'pendiente',
        vencimiento: '31 May 2026',
        subido: '—',
        motivo: 'Sin subir',
        observacion: 'Sin subir',
      },
      {
        id: 'd5',
        nombre: 'Liquidación de sueldo (mes vigente)',
        categoria: 'Laboral',
        estado: 'aprobado',
        vencimiento: '31 May 2026',
        subido: '05 May 2026',
      },
      {
        id: 'd6',
        nombre: 'Certificado de Antecedentes',
        categoria: 'Laboral',
        estado: 'aprobado',
        vencimiento: '31 Dic 2026',
        subido: '10 Ene 2026',
      },
    ],
  },
  {
    id: 'servicios-norte',
    nombre: 'Servicios Norte',
    rut: '76.111.222-3',
    proyectos: ['costanera', 'hospital', 'bodega'],
    trabajadores: [
      { 
        nombre: 'Jorge Morales', 
        rut: '12.345.678-9', 
        estado: 'aprobado',
        documentos: [
          { id: 'ws1_d1', nombre: 'Liquidación de sueldo (mes vigente)', categoria: 'Laboral', estado: 'aprobado', vencimiento: '30 Jun 2026', subido: '05 May 2026' },
          { id: 'ws1_d2', nombre: 'Contrato de Trabajo', categoria: 'Laboral', estado: 'aprobado', vencimiento: '31 Dic 2026', subido: '10 Ene 2026' },
          { id: 'ws1_d3', nombre: 'Certificado de Antecedentes', categoria: 'Laboral', estado: 'aprobado', vencimiento: '31 Dic 2026', subido: '10 Ene 2026' },
          { id: 'ws1_d4', nombre: 'ODI 2026', categoria: 'Prevención', estado: 'aprobado', vencimiento: '31 Dic 2026', subido: '10 Ene 2026' }
        ]
      },
      { 
        nombre: 'Pedro Soto', 
        rut: '13.456.789-0', 
        estado: 'por_vencer',
        documentos: [
          { id: 'ws2_d1', nombre: 'Liquidación de sueldo (mes vigente)', categoria: 'Laboral', estado: 'aprobado', vencimiento: '30 Jun 2026', subido: '05 May 2026' },
          { id: 'ws2_d2', nombre: 'Contrato de Trabajo', categoria: 'Laboral', estado: 'aprobado', vencimiento: '31 Dic 2026', subido: '10 Ene 2026' },
          { id: 'ws2_d3', nombre: 'Certificado de Antecedentes', categoria: 'Laboral', estado: 'aprobado', vencimiento: '31 Dic 2026', subido: '10 Ene 2026' },
          { id: 'ws2_d4', nombre: 'ODI 2026', categoria: 'Prevención', estado: 'por_vencer', vencimiento: '24 May 2026', subido: '24 May 2025' }
        ]
      },
      { 
        nombre: 'Luis Vera', 
        rut: '14.567.890-1', 
        estado: 'rechazado',
        documentos: [
          { id: 'ws3_d1', nombre: 'Liquidación de sueldo (mes vigente)', categoria: 'Laboral', estado: 'aprobado', vencimiento: '30 Jun 2026', subido: '05 May 2026' },
          { id: 'ws3_d2', nombre: 'Contrato de Trabajo', categoria: 'Laboral', estado: 'aprobado', vencimiento: '31 Dic 2026', subido: '10 Ene 2026' },
          { id: 'ws3_d3', nombre: 'Certificado de Antecedentes', categoria: 'Laboral', estado: 'aprobado', vencimiento: '31 Dic 2026', subido: '10 Ene 2026' },
          { id: 'ws3_d4', nombre: 'ODI 2026', categoria: 'Prevención', estado: 'rechazado', vencimiento: '—', subido: '11 May 2026', motivo: 'Examen de altura vencido', observacion: 'Examen de altura vencido' }
        ]
      },
      { 
        nombre: 'Carlos Muñoz', 
        rut: '15.678.901-2', 
        estado: 'pendiente',
        documentos: [
          { id: 'ws4_d1', nombre: 'Liquidación de sueldo (mes vigente)', categoria: 'Laboral', estado: 'aprobado', vencimiento: '30 Jun 2026', subido: '05 May 2026' },
          { id: 'ws4_d2', nombre: 'Contrato de Trabajo', categoria: 'Laboral', estado: 'aprobado', vencimiento: '31 Dic 2026', subido: '10 Ene 2026' },
          { id: 'ws4_d3', nombre: 'Certificado de Antecedentes', categoria: 'Laboral', estado: 'aprobado', vencimiento: '31 Dic 2026', subido: '10 Ene 2026' },
          { id: 'ws4_d4', nombre: 'ODI 2026', categoria: 'Prevención', estado: 'pendiente', vencimiento: '—' }
        ]
      },
    ],
    documentos: [
      {
        id: 'd1',
        nombre: 'Liquidación Mayo 2026',
        categoria: 'Laboral',
        estado: 'revision',
        vencimiento: '31 May 2026',
        subido: '05 May 2026',
        motivo: 'Verificar descuentos legales y base imponible del trabajador indicado.',
        observacion: 'Verificar descuentos legales y base imponible del trabajador indicado.',
      },
      {
        id: 'd2',
        nombre: 'F30 SII (mes vigente)',
        categoria: 'Tributario',
        estado: 'aprobado',
        vencimiento: '30 Jun 2026',
        subido: '02 May 2026',
      },
      {
        id: 'd3',
        nombre: 'Contrato de Trabajo',
        categoria: 'Laboral',
        estado: 'aprobado',
        vencimiento: '31 Dic 2026',
        subido: '10 Ene 2026',
      },
      {
        id: 'd4',
        nombre: 'Registro Mutual ACHS',
        categoria: 'Prevención',
        estado: 'aprobado',
        vencimiento: '30 Jun 2026',
        subido: '15 Jun 2025',
      },
      {
        id: 'd5',
        nombre: 'Certificado de Antecedentes',
        categoria: 'Laboral',
        estado: 'aprobado',
        vencimiento: '31 Dic 2026',
        subido: '10 Ene 2026',
      },
      {
        id: 'd6',
        nombre: 'ODI 2026',
        categoria: 'Prevención',
        estado: 'aprobado',
        vencimiento: '31 Dic 2026',
        subido: '10 Ene 2026',
      },
    ],
  },
  {
    id: 'electrica-sur',
    nombre: 'Eléctrica Sur',
    rut: '79.555.444-2',
    proyectos: ['mackenna'],
    documentos: [
      {
        id: 'd1',
        nombre: 'Contrato trabajo',
        categoria: 'Laboral',
        estado: 'aprobado',
        vencimiento: 'Indefinido',
        subido: '04 Jun 2026',
        revisor: 'Ana Díaz',
        fechaRevisado: '04 Jun 2026',
      },
      {
        id: 'd2',
        nombre: 'Anexo Horas Extras',
        categoria: 'Laboral',
        estado: 'revision',
        vencimiento: '30 Jun 2026',
        subido: '04 Jun 2026',
        motivo: 'Revisar tope legal de horas pactadas.',
        observacion: 'Revisar tope legal de horas pactadas.',
      },
      {
        id: 'd3',
        nombre: 'Liquidación de sueldo (mes vigente)',
        categoria: 'Laboral',
        estado: 'aprobado',
        vencimiento: '31 May 2026',
        subido: '05 May 2026',
      },
      {
        id: 'd4',
        nombre: 'F30 SII (mes vigente)',
        categoria: 'Tributario',
        estado: 'aprobado',
        vencimiento: '30 Jun 2026',
        subido: '05 May 2026',
      },
      {
        id: 'd5',
        nombre: 'Registro Mutual ACHS',
        categoria: 'Prevención',
        estado: 'aprobado',
        vencimiento: '30 Jun 2026',
        subido: '15 May 2026',
      },
      {
        id: 'd6',
        nombre: 'Certificado de Antecedentes',
        categoria: 'Laboral',
        estado: 'aprobado',
        vencimiento: '31 Dic 2026',
        subido: '10 Ene 2026',
      },
      {
        id: 'd7',
        nombre: 'ODI 2026',
        categoria: 'Prevención',
        estado: 'aprobado',
        vencimiento: '15 Dic 2026',
        subido: '10 Ene 2026',
      },
    ],
  },
  {
    id: 'lagos-cia',
    nombre: 'Lagos y Cía',
    rut: '76.543.210-K',
    proyectos: ['costanera'],
    documentos: [
      {
        id: 'd1',
        nombre: 'F30 SII',
        categoria: 'Tributario',
        estado: 'rechazado',
        vencimiento: '30 Abr 2026',
        subido: '04 Jun 2026',
        motivo: 'Periodo incorrecto',
        observacion: 'Periodo incorrecto',
        revisor: 'Carlos Reyes',
        fechaRevisado: '04 Jun 2026',
      },
      {
        id: 'd2',
        nombre: 'Contrato Obra',
        categoria: 'Laboral',
        estado: 'aprobado',
        vencimiento: 'Indefinido',
        subido: '04 Jun 2026',
        revisor: 'Ana Díaz',
        fechaRevisado: '04 Jun 2026',
      },
      {
        id: 'd3',
        nombre: 'Liquidación de sueldo (mes vigente)',
        categoria: 'Laboral',
        estado: 'aprobado',
        vencimiento: '31 May 2026',
        subido: '05 May 2026',
      },
      {
        id: 'd4',
        nombre: 'Registro Mutual ACHS',
        categoria: 'Prevención',
        estado: 'aprobado',
        vencimiento: '30 Jun 2026',
        subido: '15 May 2026',
      },
      {
        id: 'd5',
        nombre: 'Certificado de Antecedentes',
        categoria: 'Laboral',
        estado: 'aprobado',
        vencimiento: '31 Dic 2026',
        subido: '10 Ene 2026',
      },
      {
        id: 'd6',
        nombre: 'ODI 2026',
        categoria: 'Prevención',
        estado: 'aprobado',
        vencimiento: '31 Dic 2026',
        subido: '10 Ene 2026',
      },
    ],
  },
  {
    id: 'constructora-velez',
    nombre: 'Constructora Vélez',
    rut: '77.234.890-1',
    proyectos: ['costanera'],
    isNew: true,
    documentos: [
      {
        id: 'd1',
        nombre: 'ODI 2026',
        categoria: 'Prevención',
        estado: 'revision',
        vencimiento: '15 Jun 2026',
        subido: '04 Jun 2026',
        motivo: 'Revisar vigencia y firmas del listero.',
        observacion: 'Revisar vigencia y firmas del listero.',
      },
      {
        id: 'd2',
        nombre: 'Liquidación de sueldo (mes vigente)',
        categoria: 'Laboral',
        estado: 'pendiente',
        vencimiento: '—',
        subido: '—',
      },
      {
        id: 'd3',
        nombre: 'F30 SII (mes vigente)',
        categoria: 'Tributario',
        estado: 'pendiente',
        vencimiento: '—',
        subido: '—',
      },
      {
        id: 'd4',
        nombre: 'Contrato de Trabajo',
        categoria: 'Laboral',
        estado: 'aprobado',
        vencimiento: '31 Dic 2026',
        subido: '10 Ene 2026',
      },
      {
        id: 'd5',
        nombre: 'Registro Mutual ACHS',
        categoria: 'Prevención',
        estado: 'pendiente',
        vencimiento: '—',
        subido: '—',
      },
      {
        id: 'd6',
        nombre: 'Certificado de Antecedentes',
        categoria: 'Laboral',
        estado: 'pendiente',
        vencimiento: '—',
        subido: '—',
      },
    ],
  },
];
