import React, { useMemo, useState } from 'react';
import { XCircle, Plus, Edit } from 'lucide-react';
import { Contratista, Proyecto, Mandante, Requisito, PlantillaBase } from '../../types';
import { saveRequisitos, getPlantillas } from '../../data/localStorageDb';
import { buildAcreditacionRows, AcredRow, estadoUILabel, badgeClass } from './acreditacionUtils';

type Tab = 'resumen' | 'contratistas' | 'requisitos' | 'acreditaciones';

const BADGE_CLASS: Record<string, string> = {
  green: 'b-green bg-green-100 text-green-800',
  amber: 'bg-yellow-100 text-yellow-800',
  red: 'b-red bg-red-100 text-red-800',
  gray: 'b-gray bg-gray-100 text-gray-500',
};

const EstadoBadge = ({ estado }: { estado: string }) => (
  <span className={`badge text-[11px] shrink-0 ${BADGE_CLASS[badgeClass(estado)]}`}>{estado}</span>
);

const DESTINO_LABEL: Record<Requisito['destino'], string> = {
  empresa: 'Empresa',
  trabajador: 'Trabajador',
};

const CRITICIDAD_LABEL: Record<Requisito['criticidad'], string> = {
  bloquea_pago: 'Bloquea pago',
  bloquea_acceso: 'Bloquea acceso',
  bloquea_ambas: 'Bloquea acceso y pago',
  advertencia: 'Advertencia',
};

const FRECUENCIA_OPCIONES = ['Mensual', 'Por Proyecto', '6 meses', '1 año', 'Indefinido'];

function rankEstado(estado: AcredRow['estado']): number {
  return estado === 'Vencido/Bloqueado' ? 0 : estado === 'En proceso' ? 1 : 2;
}

function ResumenTab({
  rows,
  acreditadas,
  enProceso,
  bloqueadas,
  trabajadoresCount,
  contratistasCount,
}: {
  rows: AcredRow[];
  acreditadas: number;
  enProceso: number;
  bloqueadas: number;
  trabajadoresCount: number;
  contratistasCount: number;
}) {
  const estadoGeneral = rows.length === 0 ? 'Sin contratistas' : bloqueadas > 0 ? 'Bloqueado' : enProceso > 0 ? 'En proceso' : 'Acreditado';
  const ordenadas = [...rows].sort((a, b) => rankEstado(a.estado) - rankEstado(b.estado) || a.entity.localeCompare(b.entity));

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-3 gap-3">
        <div className="card p-4 text-center">
          <div className="text-[20px] font-bold text-navy">{contratistasCount}</div>
          <div className="text-[11px] text-gray-400 uppercase tracking-wide mt-1">Contratista{contratistasCount === 1 ? '' : 's'}</div>
        </div>
        <div className="card p-4 text-center">
          <div className="text-[20px] font-bold text-navy">{trabajadoresCount}</div>
          <div className="text-[11px] text-gray-400 uppercase tracking-wide mt-1">Trabajador{trabajadoresCount === 1 ? '' : 'es'}</div>
        </div>
        <div className="card p-4 text-center">
          <div className="text-[20px] font-bold text-navy">{acreditadas}</div>
          <div className="text-[11px] text-gray-400 uppercase tracking-wide mt-1">Acreditaciones aprobadas</div>
        </div>
      </div>

      <div className="card p-4">
        <p className="text-[12px] uppercase tracking-wider text-gray-400 mb-2 font-medium">Estado del proyecto</p>
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[13.5px] font-semibold text-navy">Acreditación general</p>
            <p className="text-[12px] text-gray-400 mt-0.5">Se deriva del estado real de las acreditaciones del proyecto.</p>
          </div>
          <EstadoBadge estado={estadoGeneral} />
        </div>
      </div>

      <div className="card p-4">
        <p className="text-[12px] uppercase tracking-wider text-gray-400 mb-3 font-medium">Resumen de acreditaciones</p>
        {rows.length === 0 ? (
          <p className="text-[13px] text-gray-400">Este proyecto todavía no tiene contratistas asignados.</p>
        ) : (
          <div className="flex flex-col divide-y divide-cream3">
            {ordenadas.map(r => (
              <div key={r.key} className="flex justify-between items-center py-2.5 gap-3">
                <div className="min-w-0">
                  <div className="text-[13px] font-semibold text-navy truncate">{r.entity}</div>
                  <div className="text-[11.5px] text-gray-400">Empresa {r.company.ok}/{r.company.total} · Trabajadores {r.workers.ok}/{r.workers.total}</div>
                </div>
                <EstadoBadge estado={estadoUILabel(r.estado)} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ContratistasProyectoTab({ rows }: { rows: AcredRow[] }) {
  if (rows.length === 0) {
    return <p className="text-[13px] text-gray-400 text-center py-10">Este proyecto todavía no tiene contratistas asignados.</p>;
  }
  const ordenadas = [...rows].sort((a, b) => rankEstado(a.estado) - rankEstado(b.estado) || a.entity.localeCompare(b.entity));
  return (
    <div className="flex flex-col divide-y divide-cream3">
      {ordenadas.map(r => (
        <div key={r.key} className="flex items-center justify-between gap-3 py-3">
          <div className="min-w-0">
            <div className="text-[13.5px] font-semibold text-navy truncate">{r.entity}</div>
            <div className="text-[11.5px] text-gray-400 truncate">{r.rut}</div>
            <div className="text-[11.5px] text-gray-500 mt-0.5">Empresa {r.company.ok}/{r.company.total} · Trabajadores {r.workers.ok}/{r.workers.total}</div>
          </div>
          <EstadoBadge estado={estadoUILabel(r.estado)} />
        </div>
      ))}
    </div>
  );
}

function AcreditacionesProyectoTab({
  rows,
  onVerAcreditacion,
}: {
  rows: AcredRow[];
  onVerAcreditacion: (contratista: Contratista, proyectoId: string) => void;
}) {
  if (rows.length === 0) {
    return <p className="text-[13px] text-gray-400 text-center py-10">Este proyecto todavía no tiene contratistas asignados.</p>;
  }
  const ordenadas = [...rows].sort((a, b) => rankEstado(a.estado) - rankEstado(b.estado) || a.entity.localeCompare(b.entity));
  return (
    <div className="flex flex-col gap-3">
      {ordenadas.map(r => (
        <div key={r.key} className="card p-4 flex flex-col gap-2">
          <div className="flex justify-between items-start gap-3">
            <div className="min-w-0 text-[14px] font-semibold text-navy truncate">{r.entity}</div>
            <EstadoBadge estado={estadoUILabel(r.estado)} />
          </div>
          <div className="flex gap-4 text-[12.5px] text-gray-600 font-medium">
            <span>Empresa {r.company.ok}/{r.company.total}</span>
            <span>Trabajadores {r.workers.ok}/{r.workers.total}</span>
          </div>
          <button
            onClick={() => onVerAcreditacion(r.contratista, r.proyectoId)}
            className="self-start text-brown text-[12.5px] font-semibold hover:underline cursor-pointer border-none bg-transparent"
          >
            Ver acreditación
          </button>
        </div>
      ))}
    </div>
  );
}

function RequisitosTab({
  requisitosProyecto,
  onNuevo,
  onEditar,
  onToggleActivo,
}: {
  requisitosProyecto: Requisito[];
  onNuevo: () => void;
  onEditar: (r: Requisito) => void;
  onToggleActivo: (r: Requisito) => void;
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <button
          onClick={onNuevo}
          className="px-3.5 py-2 rounded-lg bg-brown text-white text-[12.5px] font-semibold flex items-center gap-1.5 cursor-pointer hover:brightness-105 transition-all border-none"
        >
          <Plus size={14} />
          Agregar requisito
        </button>
      </div>

      {requisitosProyecto.length === 0 ? (
        <p className="text-[13px] text-gray-400 text-center py-10">Este proyecto todavía no tiene requisitos configurados.</p>
      ) : (
        <div className="flex flex-col divide-y divide-cream3">
          {requisitosProyecto.map(r => (
            <div key={r.id} className="flex items-center justify-between gap-3 py-3">
              <div className="min-w-0">
                <div className="text-[13.5px] font-semibold text-navy truncate">{r.nombre}</div>
                <div className="text-[11.5px] text-gray-500 mt-0.5">
                  {DESTINO_LABEL[r.destino]} · {r.frecuencia} · {r.obligatorio ? 'Obligatorio' : 'Opcional'} · {CRITICIDAD_LABEL[r.criticidad]}
                </div>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <button
                  onClick={() => onEditar(r)}
                  title="Editar requisito"
                  className="w-8 h-8 rounded-lg bg-gold-soft border border-gold-soft text-gold flex items-center justify-center cursor-pointer hover:bg-gold hover:text-white transition-all"
                >
                  <Edit size={13} />
                </button>
                <button
                  onClick={() => onToggleActivo(r)}
                  title={r.activo === false ? 'Activar requisito' : 'Desactivar requisito'}
                  className={`relative w-11 h-6 rounded-full transition-colors cursor-pointer border-none ${r.activo === false ? 'bg-gray-300' : 'bg-emerald-600'}`}
                >
                  <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${r.activo === false ? 'translate-x-0.5' : 'translate-x-[22px]'}`} />
                </button>
                <span className={`badge text-[10.5px] shrink-0 ${r.activo === false ? BADGE_CLASS.gray : BADGE_CLASS.green}`}>
                  {r.activo === false ? 'INACTIVO' : 'ACTIVO'}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const FORM_VACIO = {
  nombre: '',
  categoria: 'Laboral' as Requisito['categoria'],
  destino: 'empresa' as Requisito['destino'],
  frecuencia: 'Mensual',
  obligatorio: true,
  criticidad: 'bloquea_pago' as Requisito['criticidad'],
  alertaDias: 15,
};

export default function ProyectoDetailDrawer({
  proyectoSeleccionado,
  setProyectoSeleccionado,
  tabProyecto,
  setTabProyecto,
  GLOBAL_CONTRATISTAS,
  GLOBAL_PROYECTOS,
  GLOBAL_MANDANTES,
  requisitos,
  setRequisitos,
  onVerAcreditacion,
}: {
  proyectoSeleccionado: any;
  setProyectoSeleccionado: (v: any) => void;
  tabProyecto: string;
  setTabProyecto: (v: string) => void;
  GLOBAL_CONTRATISTAS: Contratista[];
  GLOBAL_PROYECTOS: Proyecto[];
  GLOBAL_MANDANTES: Mandante[];
  requisitos: Requisito[];
  setRequisitos: (v: Requisito[]) => void;
  onVerAcreditacion: (contratista: Contratista, proyectoId: string) => void;
}) {
  const [showRequisitoModal, setShowRequisitoModal] = useState(false);
  const [editingRequisito, setEditingRequisito] = useState<Requisito | null>(null);
  const [form, setForm] = useState(FORM_VACIO);
  const [plantillaSeleccionadaId, setPlantillaSeleccionadaId] = useState('');

  // Catálogo reutilizable de Configuración → Plantillas base: se lee
  // directamente cada vez que el modal está abierto (sin levantar estado
  // global) para reflejar siempre las plantillas activas actuales. Solo
  // aplica a crear un requisito nuevo — nunca al editar uno existente.
  const plantillasDisponibles: PlantillaBase[] = showRequisitoModal
    ? getPlantillas()
        .filter((p: any) => p.activo !== false)
        .map((p: any): PlantillaBase => ({ id: p.id, nombre: p.nombre, categoria: p.categoria, destino: p.destino === 'trabajador' ? 'trabajador' : 'empresa', activo: true }))
        .sort((a, b) => a.nombre.localeCompare(b.nombre))
    : [];

  // Siempre se re-resuelve el proyecto real desde el arreglo vivo (nunca se
  // confía en la instantánea con la que se abrió el drawer), y nunca cae de
  // vuelta al primer proyecto del sistema si no se encuentra.
  const proyecto = GLOBAL_PROYECTOS.find(p => p.id === proyectoSeleccionado?.id);

  // buildAcreditacionRows() lee los requisitos internamente vía
  // getRequisitos(). Si solo cambia el estado local `requisitos` (activar,
  // agregar, editar) sin que cambien contratistas/proyectos/mandantes, este
  // useMemo debe igual recalcular — por eso `requisitos` está en las deps
  // aunque la función no lo reciba como parámetro.
  const acreditacionRows = useMemo(
    () => buildAcreditacionRows(GLOBAL_CONTRATISTAS, GLOBAL_PROYECTOS, GLOBAL_MANDANTES),
    [GLOBAL_CONTRATISTAS, GLOBAL_PROYECTOS, GLOBAL_MANDANTES, requisitos]
  );

  if (!proyecto) {
    return (
      <>
        <div className="fixed inset-0 z-[399] bg-black/20" onClick={() => setProyectoSeleccionado(null)} />
        <div className="fixed left-1/2 top-1/2 z-[400] -translate-x-1/2 -translate-y-1/2 w-[calc(100vw-32px)] max-w-[420px] bg-white rounded-2xl border border-cream3 shadow-2xl p-6 text-center">
          <p className="text-[13.5px] text-gray-500 mb-4">No se pudo cargar la información del proyecto.</p>
          <button onClick={() => setProyectoSeleccionado(null)} className="btn btn-primary">Cerrar</button>
        </div>
      </>
    );
  }

  const mandante = GLOBAL_MANDANTES.find(m => m.id === proyecto.mandanteId);
  const rows = acreditacionRows.filter(r => r.proyectoId === proyecto.id);
  const contratistasCount = new Set(rows.map(r => r.contratista.id)).size;
  const trabajadoresCount = rows.reduce((acc, r) => acc + r.workers.total, 0);
  const bloqueadas = rows.filter(r => r.estado === 'Vencido/Bloqueado').length;
  const enProceso = rows.filter(r => r.estado === 'En proceso').length;
  const acreditadas = rows.filter(r => r.estado === 'Aprobado').length;

  const requisitosProyecto = requisitos.filter(r => r.proyectoId === proyecto.id);

  const abrirNuevoRequisito = () => {
    setEditingRequisito(null);
    setForm(FORM_VACIO);
    setPlantillaSeleccionadaId('');
    setShowRequisitoModal(true);
  };

  const abrirEditarRequisito = (r: Requisito) => {
    setEditingRequisito(r);
    setForm({
      nombre: r.nombre,
      categoria: r.categoria,
      destino: r.destino,
      frecuencia: r.frecuencia,
      obligatorio: r.obligatorio,
      criticidad: r.criticidad,
      alertaDias: r.alertaDias,
    });
    setPlantillaSeleccionadaId('');
    setShowRequisitoModal(true);
  };

  const cerrarModalRequisito = () => {
    setShowRequisitoModal(false);
    setEditingRequisito(null);
    setForm(FORM_VACIO);
    setPlantillaSeleccionadaId('');
  };

  // Selector "Usar plantilla base": solo precarga nombre/categoría/destino.
  // Nunca toca frecuencia/obligatorio/criticidad/alertaDias — esas reglas
  // son del requisito en este proyecto, no de la plantilla. Volver a la
  // opción vacía no borra lo que el usuario ya haya escrito.
  const seleccionarPlantilla = (id: string) => {
    setPlantillaSeleccionadaId(id);
    if (!id) return;
    const plantilla = plantillasDisponibles.find(p => p.id === id);
    if (!plantilla) return;
    setForm(f => ({ ...f, nombre: plantilla.nombre, categoria: plantilla.categoria, destino: plantilla.destino }));
  };

  const guardarRequisito = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.nombre.trim() || !form.frecuencia.trim()) return;

    if (editingRequisito) {
      const nuevaLista = requisitos.map(r =>
        r.id === editingRequisito.id
          ? { ...r, ...form, nombre: form.nombre.trim(), frecuencia: form.frecuencia.trim() }
          : r
      );
      saveRequisitos(nuevaLista);
      setRequisitos(nuevaLista);
    } else {
      const nuevo: Requisito = {
        id: `req_${proyecto.id}_${Date.now()}`,
        nombre: form.nombre.trim(),
        categoria: form.categoria,
        destino: form.destino,
        obligatorio: form.obligatorio,
        frecuencia: form.frecuencia.trim(),
        alertaDias: form.alertaDias,
        criticidad: form.criticidad,
        proyectoId: proyecto.id,
        activo: true,
      };
      const nuevaLista = [...requisitos, nuevo];
      saveRequisitos(nuevaLista);
      setRequisitos(nuevaLista);
    }
    cerrarModalRequisito();
  };

  const toggleActivoRequisito = (r: Requisito) => {
    const nuevaLista = requisitos.map(x => x.id === r.id ? { ...x, activo: x.activo === false ? true : false } : x);
    saveRequisitos(nuevaLista);
    setRequisitos(nuevaLista);
  };

  const tabs: Array<{ id: Tab; label: string }> = [
    { id: 'resumen', label: 'Resumen' },
    { id: 'contratistas', label: 'Contratistas' },
    { id: 'requisitos', label: 'Requisitos' },
    { id: 'acreditaciones', label: 'Acreditaciones' },
  ];

  return (
    <>
      <div className="fixed inset-0 z-[399] bg-black/20" onClick={() => setProyectoSeleccionado(null)} />
      <div className="fixed left-1/2 top-1/2 z-[400] flex h-[calc(100vh-16px)] sm:h-[90vh] w-[calc(100vw-16px)] sm:w-3/4 max-w-[1000px] -translate-x-1/2 -translate-y-1/2 flex-col overflow-y-auto sm:overflow-hidden rounded-2xl border border-cream3 bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center gap-3 py-3.5 px-5 border-b border-cream3 flex-shrink-0">
          <div className="min-w-0 shrink-0">
            <p className="font-semibold text-navy text-[15px] leading-tight truncate max-w-[320px]">
              {proyecto.nombre}
            </p>
            <p className="text-[11.5px] text-gray-400 leading-tight">{mandante ? mandante.nombre : 'Mandante no disponible'}</p>
          </div>
          <div className="flex-1" />
          <button
            onClick={() => setProyectoSeleccionado(null)}
            className="text-gray-400 hover:text-navy shrink-0"
          >
            <XCircle size={20} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-cream3 px-4 flex-shrink-0">
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => setTabProyecto(t.id)}
              className={`px-4 py-2.5 text-[13px] border-b-2 transition-colors ${tabProyecto === t.id ? "border-brown text-brown font-semibold" : "border-transparent text-gray-400 hover:text-navy"}`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5">
          {tabProyecto === 'resumen' && (
            <ResumenTab rows={rows} acreditadas={acreditadas} enProceso={enProceso} bloqueadas={bloqueadas} trabajadoresCount={trabajadoresCount} contratistasCount={contratistasCount} />
          )}
          {tabProyecto === 'contratistas' && (
            <ContratistasProyectoTab rows={rows} />
          )}
          {tabProyecto === 'requisitos' && (
            <RequisitosTab
              requisitosProyecto={requisitosProyecto}
              onNuevo={abrirNuevoRequisito}
              onEditar={abrirEditarRequisito}
              onToggleActivo={toggleActivoRequisito}
            />
          )}
          {tabProyecto === 'acreditaciones' && (
            <AcreditacionesProyectoTab rows={rows} onVerAcreditacion={onVerAcreditacion} />
          )}
        </div>
      </div>

      {/* Modal Agregar/Editar Requisito */}
      {showRequisitoModal && (
        <div className="fixed inset-0 bg-black/50 z-[500] flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-[440px] max-h-[calc(100vh-24px)] overflow-y-auto">
            <div className="flex justify-between items-center p-4 border-b border-cream">
              <h3 className="font-medium text-navy text-[17.6px]">
                {editingRequisito ? 'Editar requisito' : 'Agregar requisito'}
              </h3>
              <button onClick={cerrarModalRequisito} className="text-gray-400 hover:text-gray-600">
                <XCircle size={20} />
              </button>
            </div>

            <form onSubmit={guardarRequisito} className="p-6 flex flex-col gap-4">
              {!editingRequisito && (
                <div>
                  <label className="block text-[13.2px] font-medium text-gray-700 mb-1.5">Usar plantilla base</label>
                  <select
                    value={plantillaSeleccionadaId}
                    onChange={e => seleccionarPlantilla(e.target.value)}
                    className="form-input w-full p-2.5 border border-cream3 rounded-lg focus:border-brown focus:ring-1 focus:ring-brown outline-none transition-all"
                  >
                    <option value="">Crear requisito manualmente</option>
                    {plantillasDisponibles.map(p => (
                      <option key={p.id} value={p.id}>{p.nombre}</option>
                    ))}
                  </select>
                  <p className="text-[11px] text-gray-400 mt-1.5 leading-relaxed">
                    Opcional. Precarga nombre, categoría y destino; las reglas del requisito se configuran para este proyecto.
                  </p>
                </div>
              )}
              <div>
                <label className="block text-[13.2px] font-medium text-gray-700 mb-1.5">Nombre</label>
                <input
                  type="text"
                  value={form.nombre}
                  onChange={e => setForm({ ...form, nombre: e.target.value })}
                  className="form-input w-full p-2.5 border border-cream3 rounded-lg focus:border-brown focus:ring-1 focus:ring-brown outline-none transition-all"
                  placeholder="F30 SII (mes vigente)"
                  required
                />
              </div>
              <div>
                <label className="block text-[13.2px] font-medium text-gray-700 mb-1.5">Categoría</label>
                <select
                  value={form.categoria}
                  onChange={e => setForm({ ...form, categoria: e.target.value as Requisito['categoria'] })}
                  className="form-input w-full p-2.5 border border-cream3 rounded-lg focus:border-brown focus:ring-1 focus:ring-brown outline-none transition-all"
                >
                  <option value="Laboral">Laboral</option>
                  <option value="Tributario">Tributario</option>
                  <option value="Prevención">Prevención</option>
                </select>
              </div>
              <div>
                <label className="block text-[13.2px] font-medium text-gray-700 mb-1.5">Destino</label>
                <select
                  value={form.destino}
                  onChange={e => setForm({ ...form, destino: e.target.value as Requisito['destino'] })}
                  className="form-input w-full p-2.5 border border-cream3 rounded-lg focus:border-brown focus:ring-1 focus:ring-brown outline-none transition-all"
                >
                  <option value="empresa">Empresa</option>
                  <option value="trabajador">Trabajador</option>
                </select>
              </div>
              <div>
                <label className="block text-[13.2px] font-medium text-gray-700 mb-1.5">Frecuencia / Vigencia</label>
                <input
                  type="text"
                  list="frecuencia-opciones"
                  value={form.frecuencia}
                  onChange={e => setForm({ ...form, frecuencia: e.target.value })}
                  className="form-input w-full p-2.5 border border-cream3 rounded-lg focus:border-brown focus:ring-1 focus:ring-brown outline-none transition-all"
                  placeholder="Mensual"
                  required
                />
                <datalist id="frecuencia-opciones">
                  {FRECUENCIA_OPCIONES.map(f => <option key={f} value={f} />)}
                </datalist>
              </div>
              <div>
                <label className="block text-[13.2px] font-medium text-gray-700 mb-1.5">Condición</label>
                <select
                  value={form.obligatorio ? 'obligatorio' : 'opcional'}
                  onChange={e => setForm({ ...form, obligatorio: e.target.value === 'obligatorio' })}
                  className="form-input w-full p-2.5 border border-cream3 rounded-lg focus:border-brown focus:ring-1 focus:ring-brown outline-none transition-all"
                >
                  <option value="obligatorio">Obligatorio</option>
                  <option value="opcional">Opcional</option>
                </select>
              </div>
              <div>
                <label className="block text-[13.2px] font-medium text-gray-700 mb-1.5">Criticidad</label>
                <select
                  value={form.criticidad}
                  onChange={e => setForm({ ...form, criticidad: e.target.value as Requisito['criticidad'] })}
                  className="form-input w-full p-2.5 border border-cream3 rounded-lg focus:border-brown focus:ring-1 focus:ring-brown outline-none transition-all"
                >
                  <option value="bloquea_pago">Bloquea pago</option>
                  <option value="bloquea_acceso">Bloquea acceso</option>
                  <option value="bloquea_ambas">Bloquea acceso y pago</option>
                  <option value="advertencia">Advertencia</option>
                </select>
              </div>
              <div>
                <label className="block text-[13.2px] font-medium text-gray-700 mb-1.5">Días de alerta</label>
                <input
                  type="number"
                  min={0}
                  value={form.alertaDias}
                  onChange={e => setForm({ ...form, alertaDias: Number(e.target.value) })}
                  className="form-input w-full p-2.5 border border-cream3 rounded-lg focus:border-brown focus:ring-1 focus:ring-brown outline-none transition-all"
                  required
                />
              </div>

              <div className="flex justify-end gap-3 mt-2 pt-4 border-t border-cream">
                <button type="button" onClick={cerrarModalRequisito} className="btn btn-ghost font-medium">
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary">
                  {editingRequisito ? 'Guardar cambios' : 'Agregar requisito'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
