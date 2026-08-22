import { useState } from 'react';
import { Download, Plus, X } from 'lucide-react';
import { Mandante, Contratista, Proyecto } from '../../types';

type EstadoFactura = 'Vencida' | 'Pago parcial' | 'Por vencer' | 'En plazo' | 'Pagada';
interface Factura {
  id: string;
  mandante: string;
  proyecto: string;
  original: number;
  balance: number;
  due: string;
  status: EstadoFactura;
  issued: string;
}

type EstadoObligacion = 'Listo' | 'Retenido' | 'Revisión' | 'Liberado';
interface Obligacion {
  id: string;
  contratista: string;
  proyecto: string;
  amount: number;
  payDate: string;
  docs: string;
  status: EstadoObligacion;
  condition: string;
}

interface PagoLog {
  quien: string;
  monto: number;
  ref: string;
  fecha: string;
  estado: string;
}

interface ActividadLog {
  fecha: string;
  titulo: string;
  detalle: string;
  badge: string;
  color: 'green' | 'blue' | 'red' | 'amber' | 'gray';
}

// Facturas y obligaciones son ilustrativas (no hay backend de cobranza aún),
// pero usan mandantes, contratistas y proyectos reales de la plataforma.
const FACTURAS_SEED: Factura[] = [
  { id: 'F-1032', mandante: 'Constructora Andina SA', proyecto: 'Costanera Norte', original: 8500000, balance: 8500000, due: '25 ago', status: 'Vencida', issued: '20 jul' },
  { id: 'F-998', mandante: 'Minera Los Andes SpA', proyecto: 'Bodega Logística Sur', original: 5000000, balance: 4200000, due: '10 ago', status: 'Pago parcial', issued: '12 jul' },
  { id: 'F-1051', mandante: 'Inmobiliaria del Sur Ltda.', proyecto: 'Ampliación Planta Solar', original: 12800000, balance: 12800000, due: '30 ago', status: 'Por vencer', issued: '30 jul' },
  { id: 'F-1040', mandante: 'Constructora Andina SA', proyecto: 'Torre Mackenna', original: 6100000, balance: 6100000, due: '05 sep', status: 'En plazo', issued: '05 ago' },
  { id: 'F-1064', mandante: 'Constructora Andina SA', proyecto: 'Hospital Regional Centro', original: 9700000, balance: 9700000, due: '12 sep', status: 'En plazo', issued: '12 ago' },
];

const OBLIGACIONES_SEED: Obligacion[] = [
  { id: 'OP-1083', contratista: 'Servicios Norte', proyecto: 'Costanera Norte', amount: 4800000, payDate: '27 ago 2026', docs: '12 / 12', status: 'Listo', condition: 'Sin observaciones' },
  { id: 'OP-1085', contratista: 'Eléctrica Sur', proyecto: 'Torre Mackenna', amount: 3250000, payDate: '30 ago 2026', docs: '10 / 12', status: 'Retenido', condition: '2 documentos próximos a vencer' },
  { id: 'OP-1086', contratista: 'Lagos y Cía', proyecto: 'Costanera Norte', amount: 5700000, payDate: '28 ago 2026', docs: '12 / 12', status: 'Listo', condition: 'Sin observaciones' },
  { id: 'OP-1089', contratista: 'Constructora Vélez', proyecto: 'Costanera Norte', amount: 2900000, payDate: '30 ago 2026', docs: '9 / 12', status: 'Retenido', condition: '3 documentos vencidos' },
  { id: 'OP-1092', contratista: 'TécnicoSur SpA', proyecto: 'Bodega Logística Sur', amount: 5000000, payDate: '02 sep 2026', docs: '12 / 12', status: 'Revisión', condition: 'Aprobación administrativa pendiente' },
];

const PAGOS_SEED: PagoLog[] = [
  { quien: 'Constructora Andina SA', monto: 8500000, ref: 'F-1018', fecha: '20 ago', estado: 'Conciliado' },
  { quien: 'Inmobiliaria del Sur Ltda.', monto: 6200000, ref: 'F-1041', fecha: '19 ago', estado: 'Conciliado' },
  { quien: 'Minera Los Andes SpA', monto: 4900000, ref: 'F-1011', fecha: '18 ago', estado: 'Pago parcial' },
];

const ACTIVIDAD_SEED: ActividadLog[] = [
  { fecha: '22 ago', titulo: 'Pago de $8.500.000 conciliado', detalle: 'F-1018 · Constructora Andina SA', badge: 'Conciliado', color: 'green' },
  { fecha: '21 ago', titulo: 'Factura F-1051 registrada', detalle: '$12.800.000 · Ampliación Planta Solar', badge: 'Factura', color: 'blue' },
  { fecha: '20 ago', titulo: 'Factura F-1032 pasó a vencida', detalle: '$8.500.000 · requiere cobranza', badge: 'Alerta', color: 'red' },
];

const money = (v: number) =>
  new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(v);

const BADGE: Record<string, string> = {
  red: 'border-red-200 bg-red-50 text-red-700',
  amber: 'border-amber-200 bg-amber-50 text-amber-700',
  green: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  blue: 'border-blue-200 bg-blue-50 text-blue-700',
  gray: 'border-cream3 bg-cream2 text-gray-600',
};

const FACTURA_BADGE: Record<EstadoFactura, string> = {
  Vencida: BADGE.red,
  'Pago parcial': BADGE.red,
  'Por vencer': BADGE.amber,
  'En plazo': BADGE.green,
  Pagada: BADGE.green,
};

const OBLIGACION_BADGE: Record<EstadoObligacion, string> = {
  Listo: BADGE.green,
  Retenido: BADGE.red,
  Revisión: BADGE.amber,
  Liberado: BADGE.green,
};

type ModalState =
  | { type: 'nuevaFactura' | 'nuevaObligacion' }
  | { type: 'detalleFactura' | 'registrarPago'; id: string }
  | { type: 'detalleObligacion'; id: string }
  | null;

export default function FacturacionTab({
  GLOBAL_MANDANTES,
  GLOBAL_CONTRATISTAS,
  GLOBAL_PROYECTOS,
  showToast,
}: {
  GLOBAL_MANDANTES: Mandante[];
  GLOBAL_CONTRATISTAS: Contratista[];
  GLOBAL_PROYECTOS: Proyecto[];
  showToast: (msg: string, type?: 'success' | 'error' | 'warning') => void;
}) {
  const [view, setView] = useState<'receivable' | 'release'>('receivable');
  const [facturas, setFacturas] = useState<Factura[]>(FACTURAS_SEED);
  const [obligaciones, setObligaciones] = useState<Obligacion[]>(OBLIGACIONES_SEED);
  const [pagos, setPagos] = useState<PagoLog[]>(PAGOS_SEED);
  const [actividad, setActividad] = useState<ActividadLog[]>(ACTIVIDAD_SEED);
  const [modal, setModal] = useState<ModalState>(null);

  const closeModal = () => setModal(null);

  // ---- Receivable KPIs ----
  const totalPorCobrar = facturas.reduce((s, f) => s + f.balance, 0);
  const vencido = facturas.filter(f => f.status === 'Vencida').reduce((s, f) => s + f.balance, 0);
  const porVencer = totalPorCobrar - vencido;
  const cobradoEsteMes = pagos.reduce((s, p) => s + p.monto, 0);

  // ---- Obligation KPIs ----
  const pendienteLiberar = obligaciones.filter(o => o.status !== 'Liberado').reduce((s, o) => s + o.amount, 0);
  const listoParaLiberar = obligaciones.filter(o => o.status === 'Listo').reduce((s, o) => s + o.amount, 0);
  const retenidoAhora = obligaciones.filter(o => o.status === 'Retenido').reduce((s, o) => s + o.amount, 0);
  const enRevision = obligaciones.filter(o => o.status === 'Revisión').reduce((s, o) => s + o.amount, 0);
  const dineroEnRiesgo = retenidoAhora + enRevision;

  const documentosVencidos = obligaciones.filter(o => o.condition.includes('vencido')).reduce((s, o) => s + o.amount, 0);
  const documentosProximos = obligaciones.filter(o => o.condition.includes('próximo')).reduce((s, o) => s + o.amount, 0);
  const contratistasAfectadosVencidos = obligaciones.filter(o => o.condition.includes('vencido')).length;
  const contratistasAfectadosProximos = obligaciones.filter(o => o.condition.includes('próximo')).length;

  const pagadoUltimos30 = obligaciones
    .filter(o => o.status === 'Liberado')
    .reduce((s, o) => s + o.amount, 0);
  const flujoPct = pendienteLiberar + pagadoUltimos30 > 0
    ? Math.round((pagadoUltimos30 / (pendienteLiberar + pagadoUltimos30)) * 100)
    : 0;

  const registrarActividad = (entry: ActividadLog) => setActividad(prev => [entry, ...prev].slice(0, 8));

  // ---- Actions ----
  const registrarPago = (facturaId: string, monto: number, referencia: string) => {
    setFacturas(prev => prev.map(f => {
      if (f.id !== facturaId) return f;
      const nuevoSaldo = Math.max(0, f.balance - monto);
      return { ...f, balance: nuevoSaldo, status: nuevoSaldo === 0 ? 'Pagada' : 'Pago parcial' };
    }));
    const factura = facturas.find(f => f.id === facturaId);
    if (factura) {
      setPagos(prev => [{ quien: factura.mandante, monto, ref: referencia || facturaId, fecha: 'Hoy', estado: 'Conciliado' }, ...prev]);
      registrarActividad({ fecha: 'Hoy', titulo: `Pago de ${money(monto)} conciliado`, detalle: `${facturaId} · ${factura.mandante}`, badge: 'Conciliado', color: 'green' });
    }
    showToast('Pago registrado y saldo actualizado');
    closeModal();
  };

  const resolverCondicion = (id: string) => {
    setObligaciones(prev => prev.map(o => o.id === id ? { ...o, status: 'Listo', condition: 'Sin observaciones' } : o));
    showToast('Obligación marcada como lista para liberar');
  };

  const autorizarPago = (id: string) => {
    const op = obligaciones.find(o => o.id === id);
    if (!op || op.status !== 'Listo') {
      showToast('La obligación debe estar lista para liberar', 'warning');
      return;
    }
    setObligaciones(prev => prev.map(o => o.id === id ? { ...o, status: 'Liberado' } : o));
    registrarActividad({ fecha: 'Hoy', titulo: `Pago de ${money(op.amount)} liberado`, detalle: `${id} · ${op.contratista}`, badge: 'Liberado', color: 'green' });
    showToast('Pago liberado y registrado en auditoría');
  };

  const liberarSeleccionados = () => {
    const listos = obligaciones.filter(o => o.status === 'Listo');
    if (listos.length === 0) {
      showToast('No hay pagos listos para liberar', 'warning');
      return;
    }
    setObligaciones(prev => prev.map(o => o.status === 'Listo' ? { ...o, status: 'Liberado' } : o));
    registrarActividad({ fecha: 'Hoy', titulo: `${listos.length} pagos liberados`, detalle: `${money(listos.reduce((s, o) => s + o.amount, 0))} en total`, badge: 'Liberado', color: 'green' });
    showToast(`${listos.length} pagos liberados y registrados`);
  };

  const crearFactura = (data: { entidad: string; proyecto: string; numero: string; monto: number; fecha: string; vencimiento: string }) => {
    setFacturas(prev => [{
      id: data.numero, mandante: data.entidad, proyecto: data.proyecto,
      original: data.monto, balance: data.monto, due: data.vencimiento, status: 'En plazo', issued: data.fecha,
    }, ...prev]);
    registrarActividad({ fecha: 'Hoy', titulo: `Factura ${data.numero} registrada`, detalle: `${money(data.monto)} · ${data.proyecto}`, badge: 'Factura', color: 'blue' });
    showToast('Factura registrada correctamente');
    closeModal();
  };

  const crearObligacion = (data: { entidad: string; proyecto: string; numero: string; monto: number; fecha: string; estado: EstadoObligacion }) => {
    setObligaciones(prev => [{
      id: data.numero, contratista: data.entidad, proyecto: data.proyecto,
      amount: data.monto, payDate: data.fecha, docs: '12 / 12', status: data.estado, condition: 'Sin observaciones',
    }, ...prev]);
    showToast('Obligación registrada correctamente');
    closeModal();
  };

  const factura = modal && (modal.type === 'detalleFactura' || modal.type === 'registrarPago') ? facturas.find(f => f.id === modal.id) : undefined;
  const obligacion = modal && modal.type === 'detalleObligacion' ? obligaciones.find(o => o.id === modal.id) : undefined;

  return (
    <div className="fade-in relative">
      {/* Header */}
      <div className="flex justify-between items-start gap-5 mb-4.5 flex-wrap">
        <div>
          <div className="text-[11px] uppercase tracking-[0.12em] text-brown font-extrabold">Gestión financiera · Acredita</div>
          <div className="text-[27px] font-extrabold text-navy my-1">Facturación y pagos</div>
          <p className="text-[13px] text-gray-500 max-w-[850px] leading-relaxed">
            Control financiero operativo: cuentas por cobrar, pagos a contratistas, retenciones y trazabilidad de cada movimiento.
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          <button
            onClick={() => showToast('Exportación disponible como siguiente etapa', 'warning')}
            className="btn btn-ghost border border-cream3"
          >
            <Download size={14} /> Exportar
          </button>
          <button
            onClick={() => setModal({ type: view === 'receivable' ? 'nuevaFactura' : 'nuevaObligacion' })}
            className="btn btn-primary"
          >
            <Plus size={14} /> Registrar
          </button>
        </div>
      </div>

      {/* Switcher */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 bg-cream border border-cream3 p-1.5 rounded-xl mb-4">
        <button
          onClick={() => setView('receivable')}
          className={`rounded-lg py-3 px-4 text-[12px] font-extrabold flex justify-center items-center gap-2 cursor-pointer border-none transition-all ${view === 'receivable' ? 'bg-white text-navy shadow-[0_2px_8px_rgba(18,32,56,.08)]' : 'bg-transparent text-gray-500'}`}
        >
          Nos deben
          <span className={`text-[9px] px-1.5 py-1 rounded-full ${view === 'receivable' ? 'bg-gold-soft text-brown' : 'bg-cream2 text-gray-500'}`}>
            {facturas.length} abiertas
          </span>
        </button>
        <button
          onClick={() => setView('release')}
          className={`rounded-lg py-3 px-4 text-[12px] font-extrabold flex justify-center items-center gap-2 cursor-pointer border-none transition-all ${view === 'release' ? 'bg-white text-navy shadow-[0_2px_8px_rgba(18,32,56,.08)]' : 'bg-transparent text-gray-500'}`}
        >
          Pagos por liberar
          <span className={`text-[9px] px-1.5 py-1 rounded-full ${view === 'release' ? 'bg-gold-soft text-brown' : 'bg-cream2 text-gray-500'}`}>
            {obligaciones.filter(o => o.status !== 'Liberado').length} pendientes
          </span>
        </button>
      </div>

      {view === 'receivable' ? (
        <>
          {/* Toolbar */}
          <div className="flex justify-between gap-2.5 items-center mb-3 flex-wrap">
            <div>
              <div className="text-[15px] font-extrabold text-navy">Cobros a empresas mandantes</div>
              <div className="text-[10.5px] text-gray-500 mt-0.5">Desde la factura emitida hasta el pago conciliado, incluyendo saldos y pagos parciales.</div>
            </div>
            <div className="flex gap-1.5 flex-wrap">
              {['Todos los mandantes', 'Todos los proyectos', '0–90+ días', 'Este mes'].map(f => (
                <button key={f} className="border border-cream3 bg-white rounded-lg px-2.5 py-2 text-[10px] text-gray-600 cursor-default">
                  {f} ▾
                </button>
              ))}
            </div>
          </div>

          {/* KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 mb-4">
            <div className="bg-white border border-cream3 rounded-xl p-3.5">
              <div className="text-[9.5px] uppercase text-gray-400 font-extrabold tracking-wide">Total por cobrar</div>
              <div className="text-[22px] font-extrabold text-navy mt-1.5">{money(totalPorCobrar)}</div>
              <div className="text-[9.5px] text-gray-400 mt-1">{facturas.length} facturas abiertas</div>
            </div>
            <div className="bg-white border border-cream3 rounded-xl p-3.5">
              <div className="text-[9.5px] uppercase text-gray-400 font-extrabold tracking-wide">Vencido</div>
              <div className="text-[22px] font-extrabold text-red-700 mt-1.5">{money(vencido)}</div>
              <div className="text-[9.5px] text-gray-400 mt-1">{facturas.filter(f => f.status === 'Vencida').length} facturas requieren gestión</div>
            </div>
            <div className="bg-white border border-cream3 rounded-xl p-3.5">
              <div className="text-[9.5px] uppercase text-gray-400 font-extrabold tracking-wide">Por vencer</div>
              <div className="text-[22px] font-extrabold text-amber-700 mt-1.5">{money(porVencer)}</div>
              <div className="text-[9.5px] text-gray-400 mt-1">{facturas.filter(f => f.status !== 'Vencida').length} facturas dentro de plazo</div>
            </div>
            <div className="bg-white border border-cream3 rounded-xl p-3.5">
              <div className="text-[9.5px] uppercase text-gray-400 font-extrabold tracking-wide">Cobrado este mes</div>
              <div className="text-[22px] font-extrabold text-emerald-700 mt-1.5">{money(cobradoEsteMes)}</div>
              <div className="text-[9.5px] text-gray-400 mt-1">Incluye pagos parciales conciliados</div>
            </div>
          </div>

          {/* Layout: table + aside */}
          <div className="grid grid-cols-1 md:grid-cols-[1.42fr_.76fr] gap-3.5 mb-4">
            <section className="bg-white rounded-2xl border border-cream3 shadow-sm overflow-hidden flex flex-col">
              <div className="p-3.5 border-b border-cream3 flex justify-between items-center gap-3">
                <div>
                  <div className="text-[14px] font-extrabold text-navy">Facturas y cuentas por cobrar</div>
                  <div className="text-[10px] text-gray-500 mt-0.5">Saldo actual, vencimiento, estado de cobranza y conciliación.</div>
                </div>
                <span className={`badge border font-semibold whitespace-nowrap ${BADGE.blue}`}>{facturas.length} abiertas</span>
              </div>

              {vencido > 0 && (
                <div className="px-3.5 py-2.5 border-b border-cream3 bg-red-50 text-red-800 text-[10.5px] flex justify-between gap-3 items-center">
                  <span><b>{money(vencido)} están vencidos.</b> Prioriza las cuentas con más días de atraso.</span>
                  <button
                    onClick={() => showToast('Detalle de antigüedad disponible como siguiente etapa', 'warning')}
                    className="text-[10px] font-bold text-gray-600 bg-white border-none rounded-md px-2 py-1.5 hover:bg-red-100 transition-all whitespace-nowrap cursor-pointer shrink-0"
                  >
                    Ver antigüedad
                  </button>
                </div>
              )}

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse table-auto">
                  <thead>
                    <tr className="border-b border-cream3">
                      <th className="px-1 py-2 text-[8px] uppercase font-bold tracking-wider text-gray-500 bg-cream2 whitespace-nowrap">Mandante</th>
                      <th className="px-1 py-2 text-[8px] uppercase font-bold tracking-wider text-gray-500 bg-cream2 whitespace-nowrap">Factura</th>
                      <th className="px-1 py-2 text-[8px] uppercase font-bold tracking-wider text-gray-500 bg-cream2 whitespace-nowrap">Proyecto</th>
                      <th className="px-1 py-2 text-[8px] uppercase font-bold tracking-wider text-gray-500 bg-cream2 whitespace-nowrap">Original</th>
                      <th className="px-1 py-2 text-[8px] uppercase font-bold tracking-wider text-gray-500 bg-cream2 whitespace-nowrap">Saldo</th>
                      <th className="px-1 py-2 text-[8px] uppercase font-bold tracking-wider text-gray-500 bg-cream2 whitespace-nowrap">Vence</th>
                      <th className="px-1 py-2 text-[8px] uppercase font-bold tracking-wider text-gray-500 bg-cream2 whitespace-nowrap">Estado</th>
                      <th className="px-1 py-2 text-[8px] uppercase font-bold tracking-wider text-gray-500 bg-cream2 text-right whitespace-nowrap">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {facturas.map(f => (
                      <tr key={f.id} className="hover:bg-[#fbfaf6] transition-colors">
                        <td className="px-1 py-1.5 text-[10px] font-semibold text-navy truncate max-w-[85px]" title={f.mandante}>{f.mandante}</td>
                        <td className="px-1 py-1.5">
                          <div className="text-[10px] font-semibold text-navy whitespace-nowrap">{f.id}</div>
                          <div className="text-[8.5px] text-gray-400 whitespace-nowrap">Emitida {f.issued}</div>
                        </td>
                        <td className="px-1 py-1.5 text-[9.5px] text-gray-600 truncate max-w-[70px]" title={f.proyecto}>{f.proyecto}</td>
                        <td className="px-1 py-1.5 text-[9.5px] text-gray-600 whitespace-nowrap">{money(f.original)}</td>
                        <td className="px-1 py-1.5 text-[9.5px] font-extrabold text-navy whitespace-nowrap">{money(f.balance)}</td>
                        <td className="px-1 py-1.5 text-[9.5px] text-gray-600 whitespace-nowrap">{f.due}</td>
                        <td className="px-1 py-1.5">
                          <span className={`badge border text-[8.5px] px-1 whitespace-nowrap ${FACTURA_BADGE[f.status]}`}>{f.status}</span>
                        </td>
                        <td className="px-1 py-1.5 text-right">
                          <button
                            onClick={() => setModal({ type: 'detalleFactura', id: f.id })}
                            className="text-[9px] font-bold text-gray-500 bg-cream2 border-none rounded-md px-1.5 py-1 hover:bg-navy hover:text-white transition-all whitespace-nowrap cursor-pointer"
                          >
                            Detalle
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="px-3.5 py-3 border-t border-cream3 flex items-center justify-between gap-3 flex-wrap">
                <span className="text-[10.5px] text-gray-500">Mostrando {facturas.length} de {facturas.length} facturas abiertas.</span>
                <button
                  onClick={() => showToast(`Vista completa: ${facturas.length} facturas abiertas`)}
                  className="text-[10px] font-bold text-gray-500 bg-cream2 border-none rounded-md px-2.5 py-1.5 hover:bg-navy hover:text-white transition-all cursor-pointer"
                >
                  Ver todas
                </button>
              </div>
            </section>

            <aside className="bg-white rounded-2xl border border-cream3 shadow-sm overflow-hidden flex flex-col">
              <div className="p-3.5 border-b border-cream3">
                <div className="text-[14px] font-extrabold text-navy">Control de cobranza</div>
                <div className="text-[10px] text-gray-500 mt-0.5">Antigüedad, pagos recibidos y conciliación.</div>
              </div>
              <div className="p-3.5">
                <div className="text-[9.5px] uppercase tracking-wide text-gray-400 font-extrabold mb-2">Antigüedad de saldos</div>
                {[
                  ['Vencido > 30 días', 6100000],
                  ['Vencido 1–30 días', 12100000],
                  ['Vence 0–7 días', 18600000],
                  ['Vence 8–30 días', 23900000],
                  ['Vence +30 días', 23900000],
                ].map(([label, val]) => (
                  <div key={label as string} className="flex justify-between py-2 border-b border-cream2 last:border-b-0">
                    <b className="text-[10.5px] text-navy font-semibold">{label}</b>
                    <span className="text-[10.5px] font-extrabold text-navy">{money(val as number)}</span>
                  </div>
                ))}

                <div className="text-[9.5px] uppercase tracking-wide text-gray-400 font-extrabold mb-2 mt-4">Conciliación</div>
                <div className="flex justify-between py-2 border-b border-cream2">
                  <b className="text-[10.5px] text-navy font-semibold">Pagos pendientes de asociar</b>
                  <span className="text-[10.5px] font-extrabold text-navy">2 · {money(3200000)}</span>
                </div>
                <div className="flex justify-between py-2">
                  <b className="text-[10.5px] text-navy font-semibold">Pagos conciliados este mes</b>
                  <span className="text-[10.5px] font-extrabold text-navy">{pagos.length} · {money(cobradoEsteMes)}</span>
                </div>

                <div className="text-[9.5px] uppercase tracking-wide text-gray-400 font-extrabold mb-2 mt-4">Últimos pagos</div>
                {pagos.slice(0, 3).map((p, i) => (
                  <div key={i} className="py-2 border-b border-cream2 last:border-b-0">
                    <div className="flex justify-between gap-2">
                      <b className="text-[11px] text-navy">{p.quien}</b>
                      <span className="text-[9.5px] text-gray-400">{money(p.monto)}</span>
                    </div>
                    <div className="text-[9.5px] text-gray-400 mt-0.5">{p.ref} · {p.fecha} · {p.estado}</div>
                  </div>
                ))}
              </div>
            </aside>
          </div>

          {/* Bottom grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 mb-4">
            <section className="bg-white rounded-2xl border border-cream3 shadow-sm overflow-hidden">
              <div className="p-3.5 border-b border-cream3 flex justify-between items-center gap-3">
                <div>
                  <div className="text-[14px] font-extrabold text-navy">Flujo proyectado</div>
                  <div className="text-[10px] text-gray-500 mt-0.5">Entradas esperadas menos salidas comprometidas.</div>
                </div>
                <span className={`badge border font-semibold whitespace-nowrap ${BADGE.green}`}>+ {money(34950000)}</span>
              </div>
              <div className="p-3.5">
                {[
                  ['Próximos 7 días · entradas', 18600000],
                  ['Próximos 7 días · salidas', 8200000],
                  ['Próximos 30 días · entradas', 66400000],
                  ['Próximos 30 días · salidas', 31450000],
                ].map(([label, val]) => (
                  <div key={label as string} className="flex justify-between py-2 border-b border-cream2 last:border-b-0">
                    <b className="text-[10.5px] text-navy font-semibold">{label}</b>
                    <span className="text-[10.5px] font-extrabold text-navy">{money(val as number)}</span>
                  </div>
                ))}
                <div className="h-2 rounded-full bg-cream overflow-hidden mt-2.5">
                  <div className="h-full bg-brown rounded-full" style={{ width: '68%' }} />
                </div>
                <div className="text-[10px] text-gray-400 mt-1.5">La proyección considera facturas abiertas y obligaciones aprobadas.</div>
              </div>
            </section>

            <section className="bg-white rounded-2xl border border-cream3 shadow-sm overflow-hidden">
              <div className="p-3.5 border-b border-cream3 flex justify-between items-center gap-3">
                <div>
                  <div className="text-[14px] font-extrabold text-navy">Actividad financiera</div>
                  <div className="text-[10px] text-gray-500 mt-0.5">Últimos cambios relevantes.</div>
                </div>
                <span className={`badge border font-semibold whitespace-nowrap ${BADGE.gray}`}>Auditable</span>
              </div>
              <div className="p-3.5">
                {actividad.slice(0, 3).map((a, i) => (
                  <div key={i} className="grid grid-cols-[56px_1fr_auto] gap-2.5 items-center py-2 border-b border-cream2 last:border-b-0">
                    <div className="text-[9.5px] font-extrabold text-gray-500">{a.fecha}</div>
                    <div className="min-w-0">
                      <b className="block text-[10.5px] text-navy truncate">{a.titulo}</b>
                      <span className="text-[9px] text-gray-400 truncate">{a.detalle}</span>
                    </div>
                    <span className={`badge border font-semibold whitespace-nowrap ${BADGE[a.color]}`}>{a.badge}</span>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </>
      ) : (
        <>
          {/* Toolbar */}
          <div className="flex justify-between gap-2.5 items-center mb-3 flex-wrap">
            <div>
              <div className="text-[15px] font-extrabold text-navy">Pagos por liberar a contratistas</div>
              <div className="text-[10.5px] text-gray-500 mt-0.5">Obligaciones, retenciones, fechas programadas y pagos realizados.</div>
            </div>
            <div className="flex gap-1.5 flex-wrap">
              {['Todos los contratistas', 'Todos los proyectos', 'Estado', 'Este mes'].map(f => (
                <button key={f} className="border border-cream3 bg-white rounded-lg px-2.5 py-2 text-[10px] text-gray-600 cursor-default">
                  {f} ▾
                </button>
              ))}
            </div>
          </div>

          {/* KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 mb-4">
            <div className="bg-white border border-cream3 rounded-xl p-3.5">
              <div className="text-[9.5px] uppercase text-gray-400 font-extrabold tracking-wide">Pendiente de liberar</div>
              <div className="text-[22px] font-extrabold text-navy mt-1.5">{money(pendienteLiberar)}</div>
              <div className="text-[9.5px] text-gray-400 mt-1">{obligaciones.filter(o => o.status !== 'Liberado').length} obligaciones activas</div>
            </div>
            <div className="bg-white border border-cream3 rounded-xl p-3.5">
              <div className="text-[9.5px] uppercase text-gray-400 font-extrabold tracking-wide">Listo para liberar</div>
              <div className="text-[22px] font-extrabold text-emerald-700 mt-1.5">{money(listoParaLiberar)}</div>
              <div className="text-[9.5px] text-gray-400 mt-1">{obligaciones.filter(o => o.status === 'Listo').length} cumplen condiciones</div>
            </div>
            <div className="bg-white border border-cream3 rounded-xl p-3.5">
              <div className="text-[9.5px] uppercase text-gray-400 font-extrabold tracking-wide">Retenido ahora</div>
              <div className="text-[22px] font-extrabold text-red-700 mt-1.5">{money(retenidoAhora)}</div>
              <div className="text-[9.5px] text-gray-400 mt-1">{obligaciones.filter(o => o.status === 'Retenido').length} obligaciones bloqueadas</div>
            </div>
            <div className="bg-white border border-cream3 rounded-xl p-3.5">
              <div className="text-[9.5px] uppercase text-gray-400 font-extrabold tracking-wide">Dinero en riesgo</div>
              <div className="text-[22px] font-extrabold text-amber-700 mt-1.5">{money(dineroEnRiesgo)}</div>
              <div className="text-[9.5px] text-gray-400 mt-1">Podría quedar retenido por vencimientos</div>
            </div>
          </div>

          {/* Layout: table + aside */}
          <div className="grid grid-cols-1 md:grid-cols-[1.42fr_.76fr] gap-3.5 mb-4">
            <section className="bg-white rounded-2xl border border-cream3 shadow-sm overflow-hidden flex flex-col">
              <div className="p-3.5 border-b border-cream3 flex justify-between items-center gap-3 flex-wrap">
                <div>
                  <div className="text-[14px] font-extrabold text-navy">Cola de liberación</div>
                  <div className="text-[10px] text-gray-500 mt-0.5">Ciclo completo: obligación → revisión → liberación → pago.</div>
                </div>
                <button onClick={liberarSeleccionados} className="btn btn-primary btn-sm whitespace-nowrap">
                  Autorizar seleccionados
                </button>
              </div>

              {retenidoAhora > 0 && (
                <div className="px-3.5 py-2.5 border-b border-cream3 bg-red-50 text-red-800 text-[10.5px] flex justify-between gap-3 items-center">
                  <span><b>{money(retenidoAhora)} están retenidos.</b> Revisa los documentos que causan la retención antes de liberar.</span>
                  <button
                    onClick={() => showToast('Detalle de retenciones disponible como siguiente etapa', 'warning')}
                    className="text-[10px] font-bold text-gray-600 bg-white border-none rounded-md px-2 py-1.5 hover:bg-red-100 transition-all whitespace-nowrap cursor-pointer shrink-0"
                  >
                    Ver retenidos
                  </button>
                </div>
              )}

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse table-auto">
                  <thead>
                    <tr className="border-b border-cream3">
                      <th className="px-1 py-2 text-[8px] uppercase font-bold tracking-wider text-gray-500 bg-cream2 whitespace-nowrap">Contratista</th>
                      <th className="px-1 py-2 text-[8px] uppercase font-bold tracking-wider text-gray-500 bg-cream2 whitespace-nowrap">Proyecto</th>
                      <th className="px-1 py-2 text-[8px] uppercase font-bold tracking-wider text-gray-500 bg-cream2 whitespace-nowrap">Obligación</th>
                      <th className="px-1 py-2 text-[8px] uppercase font-bold tracking-wider text-gray-500 bg-cream2 whitespace-nowrap">Monto</th>
                      <th className="px-1 py-2 text-[8px] uppercase font-bold tracking-wider text-gray-500 bg-cream2 whitespace-nowrap">Docs.</th>
                      <th className="px-1 py-2 text-[8px] uppercase font-bold tracking-wider text-gray-500 bg-cream2 whitespace-nowrap">Fecha pago</th>
                      <th className="px-1 py-2 text-[8px] uppercase font-bold tracking-wider text-gray-500 bg-cream2 whitespace-nowrap">Estado</th>
                      <th className="px-1 py-2 text-[8px] uppercase font-bold tracking-wider text-gray-500 bg-cream2 text-right whitespace-nowrap">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {obligaciones.map(o => (
                      <tr key={o.id} className="hover:bg-[#fbfaf6] transition-colors">
                        <td className="px-1 py-1.5 text-[10px] font-semibold text-navy truncate max-w-[80px]" title={o.contratista}>{o.contratista}</td>
                        <td className="px-1 py-1.5 text-[9.5px] text-gray-600 truncate max-w-[65px]" title={o.proyecto}>{o.proyecto}</td>
                        <td className="px-1 py-1.5 text-[9.5px] text-gray-600 whitespace-nowrap">{o.id}</td>
                        <td className="px-1 py-1.5 text-[9.5px] font-extrabold text-navy whitespace-nowrap">{money(o.amount)}</td>
                        <td className="px-1 py-1.5 text-[9.5px] text-gray-600 whitespace-nowrap">{o.docs}</td>
                        <td className="px-1 py-1.5 text-[9.5px] text-gray-600 whitespace-nowrap">{o.payDate.replace(' 2026', '')}</td>
                        <td className="px-1 py-1.5">
                          <span className={`badge border text-[8.5px] px-1 whitespace-nowrap ${OBLIGACION_BADGE[o.status]}`}>{o.status}</span>
                        </td>
                        <td className="px-1 py-1.5 text-right">
                          <button
                            onClick={() => setModal({ type: 'detalleObligacion', id: o.id })}
                            className="text-[9px] font-bold text-gray-500 bg-cream2 border-none rounded-md px-1.5 py-1 hover:bg-navy hover:text-white transition-all whitespace-nowrap cursor-pointer"
                          >
                            {o.status === 'Retenido' ? 'Resolver' : o.status === 'Revisión' ? 'Revisar' : 'Detalle'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="px-3.5 py-3 border-t border-cream3 flex items-center justify-between gap-3 flex-wrap">
                <span className="text-[10.5px] text-gray-500">Mostrando {obligaciones.length} de {obligaciones.length} obligaciones activas.</span>
                <button
                  onClick={() => showToast('Historial completo disponible en la siguiente vista', 'warning')}
                  className="text-[10px] font-bold text-gray-500 bg-cream2 border-none rounded-md px-2.5 py-1.5 hover:bg-navy hover:text-white transition-all cursor-pointer"
                >
                  Ver pagos realizados
                </button>
              </div>
            </section>

            <aside className="bg-white rounded-2xl border border-cream3 shadow-sm overflow-hidden flex flex-col">
              <div className="p-3.5 border-b border-cream3">
                <div className="text-[14px] font-extrabold text-navy">Retenciones y riesgo</div>
                <div className="text-[10px] text-gray-500 mt-0.5">Qué impide pagar y qué puede bloquearse después.</div>
              </div>
              <div className="p-3.5">
                <div className="text-[9.5px] uppercase tracking-wide text-gray-400 font-extrabold mb-2">Retenciones actuales</div>
                <div className="flex justify-between py-2 border-b border-cream2">
                  <b className="text-[10.5px] text-navy font-semibold">Documentos vencidos</b>
                  <span className="text-[10.5px] font-extrabold text-navy">{money(documentosVencidos)}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-cream2">
                  <b className="text-[10.5px] text-navy font-semibold">Documentos próximos a vencer</b>
                  <span className="text-[10.5px] font-extrabold text-navy">{money(documentosProximos)}</span>
                </div>
                <div className="flex justify-between py-2">
                  <b className="text-[10.5px] text-navy font-semibold">Revisión administrativa</b>
                  <span className="text-[10.5px] font-extrabold text-navy">{money(enRevision)}</span>
                </div>

                <div className="text-[9.5px] uppercase tracking-wide text-gray-400 font-extrabold mb-2 mt-4">Fechas programadas</div>
                {obligaciones.filter(o => o.status !== 'Liberado').slice(0, 3).map(o => (
                  <div key={o.id} className="py-2 border-b border-cream2 last:border-b-0">
                    <div className="flex justify-between gap-2 items-center">
                      <b className="text-[10.5px] text-navy">{o.payDate.replace(' 2026', '')} · {money(o.amount)}</b>
                      <span className={`badge border font-semibold whitespace-nowrap ${o.status === 'Listo' ? BADGE.green : o.status === 'Retenido' ? BADGE.red : BADGE.amber}`}>
                        {o.status === 'Retenido' ? 'Bloqueado' : o.status}
                      </span>
                    </div>
                    <div className="text-[9.5px] text-gray-400 mt-0.5">{o.contratista} · {o.proyecto}</div>
                  </div>
                ))}

                <div className="text-[9.5px] uppercase tracking-wide text-gray-400 font-extrabold mb-2 mt-4">Próximos pagos realizados</div>
                <div className="flex justify-between py-2 border-b border-cream2">
                  <b className="text-[10.5px] text-navy font-semibold">Pagado este mes</b>
                  <span className="text-[10.5px] font-extrabold text-navy whitespace-nowrap">{money(pagadoUltimos30)}</span>
                </div>
                <div className="flex justify-between py-2">
                  <b className="text-[10.5px] text-navy font-semibold">Pagos atrasados</b>
                  <span className="text-[10.5px] font-extrabold text-navy whitespace-nowrap">{money(2100000)}</span>
                </div>
              </div>
            </aside>
          </div>

          {/* Bottom grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 mb-4">
            <section className="bg-white rounded-2xl border border-cream3 shadow-sm overflow-hidden">
              <div className="p-3.5 border-b border-cream3 flex justify-between items-center gap-3">
                <div>
                  <div className="text-[14px] font-extrabold text-navy">Impacto de acreditación</div>
                  <div className="text-[10px] text-gray-500 mt-0.5">Relaciona cada problema documental con el dinero afectado.</div>
                </div>
                <span className={`badge border font-semibold whitespace-nowrap ${BADGE.amber}`}>{money(dineroEnRiesgo)} expuestos</span>
              </div>
              <div className="p-3.5">
                <div className="py-2 border-b border-cream2">
                  <div className="flex justify-between gap-2">
                    <b className="text-[11px] text-navy">{obligaciones.filter(o => o.condition.includes('vencido')).length} documentos vencidos</b>
                    <span className="text-[10.5px] font-extrabold text-navy">{money(documentosVencidos)}</span>
                  </div>
                  <div className="text-[9.5px] text-gray-400 mt-0.5">{contratistasAfectadosVencidos} contratista{contratistasAfectadosVencidos === 1 ? '' : 's'} afectado{contratistasAfectadosVencidos === 1 ? '' : 's'} · requieren gestión inmediata</div>
                </div>
                <div className="py-2 border-b border-cream2">
                  <div className="flex justify-between gap-2">
                    <b className="text-[11px] text-navy">{obligaciones.filter(o => o.condition.includes('próximo')).length} documentos próximos a vencer</b>
                    <span className="text-[10.5px] font-extrabold text-navy">{money(documentosProximos)}</span>
                  </div>
                  <div className="text-[9.5px] text-gray-400 mt-0.5">{contratistasAfectadosProximos} contratista{contratistasAfectadosProximos === 1 ? '' : 's'} · riesgo de retención en próximos días</div>
                </div>
                <div className="py-2">
                  <div className="flex justify-between gap-2">
                    <b className="text-[11px] text-navy">Revisión administrativa</b>
                    <span className="text-[10.5px] font-extrabold text-navy">{money(enRevision)}</span>
                  </div>
                  <div className="text-[9.5px] text-gray-400 mt-0.5">{obligaciones.filter(o => o.status === 'Revisión').length} obligación{obligaciones.filter(o => o.status === 'Revisión').length === 1 ? '' : 'es'} pendiente{obligaciones.filter(o => o.status === 'Revisión').length === 1 ? '' : 's'} de aprobación</div>
                </div>
              </div>
            </section>

            <section className="bg-white rounded-2xl border border-cream3 shadow-sm overflow-hidden">
              <div className="p-3.5 border-b border-cream3 flex justify-between items-center gap-3">
                <div>
                  <div className="text-[14px] font-extrabold text-navy">Flujo de pagos</div>
                  <div className="text-[10px] text-gray-500 mt-0.5">Comprometido, liberable y realizado.</div>
                </div>
                <span className={`badge border font-semibold whitespace-nowrap ${BADGE.blue}`}>30 días</span>
              </div>
              <div className="p-3.5">
                <div className="flex justify-between py-2 border-b border-cream2">
                  <b className="text-[10.5px] text-navy font-semibold">Por pagar próximos 7 días</b>
                  <span className="text-[10.5px] font-extrabold text-navy">{money(Math.round(pendienteLiberar * 0.26))}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-cream2">
                  <b className="text-[10.5px] text-navy font-semibold">Por pagar próximos 30 días</b>
                  <span className="text-[10.5px] font-extrabold text-navy">{money(pendienteLiberar)}</span>
                </div>
                <div className="flex justify-between py-2">
                  <b className="text-[10.5px] text-navy font-semibold">Pagado últimos 30 días</b>
                  <span className="text-[10.5px] font-extrabold text-navy">{money(pagadoUltimos30)}</span>
                </div>
                <div className="h-2 rounded-full bg-cream overflow-hidden mt-2.5">
                  <div className="h-full bg-brown rounded-full" style={{ width: `${flujoPct}%` }} />
                </div>
                <div className="text-[10px] text-gray-400 mt-1.5">{flujoPct}% de las obligaciones del período están liberadas o pagadas.</div>
              </div>
            </section>
          </div>
        </>
      )}

      {/* ---- Modals ---- */}
      {modal && (
        <>
          <div className="fixed inset-0 z-[399] bg-black/20" onClick={closeModal} />
          <div className="fixed left-1/2 top-1/2 z-[400] w-full max-w-2xl -translate-x-1/2 -translate-y-1/2 max-h-[90vh] overflow-y-auto rounded-2xl bg-white shadow-2xl border border-cream3">
            <div className="flex justify-between items-center p-4 border-b border-cream3">
              <div className="text-[16px] font-extrabold text-navy">
                {modal.type === 'nuevaFactura' && 'Registrar factura por cobrar'}
                {modal.type === 'nuevaObligacion' && 'Registrar obligación de pago'}
                {modal.type === 'detalleFactura' && `Factura ${modal.id}`}
                {modal.type === 'registrarPago' && `Registrar pago · ${modal.id}`}
                {modal.type === 'detalleObligacion' && `Obligación ${modal.id}`}
              </div>
              <button onClick={closeModal} className="text-gray-400 hover:text-navy bg-cream2 rounded-lg p-1.5">
                <X size={16} />
              </button>
            </div>

            {(modal.type === 'nuevaFactura' || modal.type === 'nuevaObligacion') && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const f = new FormData(e.currentTarget);
                  const monto = Number(f.get('amount') || 0);
                  if (!monto) return;
                  if (modal.type === 'nuevaFactura') {
                    crearFactura({
                      entidad: String(f.get('entity')), proyecto: String(f.get('project')), numero: String(f.get('number')),
                      monto, fecha: String(f.get('date')), vencimiento: String(f.get('due')),
                    });
                  } else {
                    crearObligacion({
                      entidad: String(f.get('entity')), proyecto: String(f.get('project')), numero: String(f.get('number')),
                      monto, fecha: String(f.get('date')), estado: String(f.get('status')) as EstadoObligacion,
                    });
                  }
                }}
              >
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-4">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[9px] uppercase text-gray-400 font-extrabold tracking-wide">{modal.type === 'nuevaFactura' ? 'Mandante' : 'Contratista'}</label>
                    <select name="entity" required defaultValue="" className="form-input !rounded-lg">
                      <option value="" disabled>{modal.type === 'nuevaFactura' ? 'Selecciona un mandante' : 'Selecciona un contratista'}</option>
                      {(modal.type === 'nuevaFactura' ? GLOBAL_MANDANTES.map(m => m.nombre) : GLOBAL_CONTRATISTAS.map(c => c.nombre)).map(n => (
                        <option key={n} value={n}>{n}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[9px] uppercase text-gray-400 font-extrabold tracking-wide">Proyecto</label>
                    <select name="project" required defaultValue="" className="form-input !rounded-lg">
                      <option value="" disabled>Selecciona un proyecto</option>
                      {GLOBAL_PROYECTOS.map(p => (
                        <option key={p.id} value={p.nombre}>{p.nombre}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[9px] uppercase text-gray-400 font-extrabold tracking-wide">{modal.type === 'nuevaFactura' ? 'Nº de factura' : 'Nº de obligación'}</label>
                    <input name="number" required placeholder={modal.type === 'nuevaFactura' ? 'F-1070' : 'OP-1100'} className="form-input !rounded-lg" />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[9px] uppercase text-gray-400 font-extrabold tracking-wide">Monto</label>
                    <input name="amount" type="number" min="1" required placeholder="0" className="form-input !rounded-lg" />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[9px] uppercase text-gray-400 font-extrabold tracking-wide">{modal.type === 'nuevaFactura' ? 'Fecha de emisión' : 'Fecha programada'}</label>
                    <input name="date" type="date" required className="form-input !rounded-lg" />
                  </div>
                  {modal.type === 'nuevaFactura' ? (
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[9px] uppercase text-gray-400 font-extrabold tracking-wide">Fecha de vencimiento</label>
                      <input name="due" type="date" required className="form-input !rounded-lg" />
                    </div>
                  ) : (
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[9px] uppercase text-gray-400 font-extrabold tracking-wide">Estado inicial</label>
                      <select name="status" defaultValue="Listo" className="form-input !rounded-lg">
                        <option>Listo</option>
                        <option>Revisión</option>
                        <option>Retenido</option>
                      </select>
                    </div>
                  )}
                  <div className="sm:col-span-2 flex flex-col gap-1.5">
                    <label className="text-[9px] uppercase text-gray-400 font-extrabold tracking-wide">Observación</label>
                    <textarea name="note" placeholder="Información adicional o referencia" className="form-input !rounded-lg min-h-[70px]" />
                  </div>
                  <div className="sm:col-span-2 flex flex-col gap-1.5">
                    <label className="text-[9px] uppercase text-gray-400 font-extrabold tracking-wide">Documento</label>
                    <input name="file" type="file" accept=".pdf,.jpg,.jpeg,.png" className="form-input !rounded-lg" />
                  </div>
                </div>
                <div className="p-4 pt-0 flex justify-end gap-2">
                  <button type="button" onClick={closeModal} className="btn btn-ghost border border-cream3">Cancelar</button>
                  <button type="submit" className="btn btn-primary">Guardar registro</button>
                </div>
              </form>
            )}

            {modal.type === 'detalleFactura' && factura && (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 p-4">
                  {[
                    ['Mandante', factura.mandante],
                    ['Proyecto', factura.proyecto],
                    ['Monto original', money(factura.original)],
                    ['Saldo actual', money(factura.balance)],
                    ['Estado', factura.status],
                    ['Vencimiento', factura.due],
                  ].map(([label, value]) => (
                    <div key={label} className="border border-cream3 rounded-lg p-2.5">
                      <label className="block text-[9px] uppercase text-gray-400 font-extrabold tracking-wide">{label}</label>
                      <strong className="block text-[13px] text-navy mt-1">{value}</strong>
                    </div>
                  ))}
                </div>
                <div className="px-4 pb-4">
                  <h4 className="text-[11px] font-extrabold text-navy mb-2">Acciones</h4>
                  <div className="flex gap-1.5 flex-wrap">
                    {factura.balance > 0 && (
                      <button onClick={() => setModal({ type: 'registrarPago', id: factura.id })} className="btn btn-primary btn-sm">Registrar pago</button>
                    )}
                    <button onClick={() => showToast('Gestión de cobranza registrada')} className="btn btn-ghost btn-sm border border-cream3">Registrar gestión</button>
                  </div>
                </div>
                <div className="px-4 pb-4">
                  <h4 className="text-[11px] font-extrabold text-navy mb-2">Historial</h4>
                  <div className="border-t border-cream3">
                    <div className="flex gap-2.5 py-2 border-b border-cream2 text-[10.5px]">
                      <b className="text-navy shrink-0">{factura.id}</b>
                      <span className="text-gray-400">Factura registrada · {factura.issued}</span>
                    </div>
                    <div className="flex gap-2.5 py-2 text-[10.5px]">
                      <b className="text-navy shrink-0">Saldo</b>
                      <span className="text-gray-400">{money(factura.balance)} pendiente</span>
                    </div>
                  </div>
                </div>
              </>
            )}

            {modal.type === 'registrarPago' && factura && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const f = new FormData(e.currentTarget);
                  const amount = Number(f.get('amount') || 0);
                  if (amount <= 0 || amount > factura.balance) return;
                  registrarPago(factura.id, amount, String(f.get('reference') || ''));
                }}
              >
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-4">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[9px] uppercase text-gray-400 font-extrabold tracking-wide">Factura</label>
                    <input value={factura.id} disabled className="form-input !rounded-lg bg-cream2" />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[9px] uppercase text-gray-400 font-extrabold tracking-wide">Saldo actual</label>
                    <input value={money(factura.balance)} disabled className="form-input !rounded-lg bg-cream2" />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[9px] uppercase text-gray-400 font-extrabold tracking-wide">Monto pagado</label>
                    <input name="amount" type="number" min="1" max={factura.balance} required className="form-input !rounded-lg" />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[9px] uppercase text-gray-400 font-extrabold tracking-wide">Fecha de pago</label>
                    <input name="date" type="date" required className="form-input !rounded-lg" />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[9px] uppercase text-gray-400 font-extrabold tracking-wide">Medio de pago</label>
                    <select name="method" defaultValue="Transferencia" className="form-input !rounded-lg">
                      <option>Transferencia</option>
                      <option>Cheque</option>
                      <option>Otro</option>
                    </select>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[9px] uppercase text-gray-400 font-extrabold tracking-wide">Referencia</label>
                    <input name="reference" placeholder="Nº operación / comprobante" className="form-input !rounded-lg" />
                  </div>
                  <div className="sm:col-span-2 flex flex-col gap-1.5">
                    <label className="text-[9px] uppercase text-gray-400 font-extrabold tracking-wide">Observación</label>
                    <textarea name="note" placeholder="Comentario opcional" className="form-input !rounded-lg min-h-[70px]" />
                  </div>
                </div>
                <div className="p-4 pt-0 flex justify-end gap-2">
                  <button type="button" onClick={() => setModal({ type: 'detalleFactura', id: factura.id })} className="btn btn-ghost border border-cream3">Cancelar</button>
                  <button type="submit" className="btn btn-primary">Registrar pago</button>
                </div>
              </form>
            )}

            {modal.type === 'detalleObligacion' && obligacion && (() => {
              const blocked = obligacion.status === 'Retenido' || obligacion.status === 'Revisión';
              return (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 p-4">
                    {[
                      ['Contratista', obligacion.contratista],
                      ['Proyecto', obligacion.proyecto],
                      ['Monto', money(obligacion.amount)],
                      ['Fecha programada', obligacion.payDate],
                      ['Documentación', obligacion.docs],
                      ['Condición', obligacion.condition],
                      ['Estado', obligacion.status],
                    ].map(([label, value]) => (
                      <div key={label} className="border border-cream3 rounded-lg p-2.5">
                        <label className="block text-[9px] uppercase text-gray-400 font-extrabold tracking-wide">{label}</label>
                        <strong className="block text-[13px] text-navy mt-1">{value}</strong>
                      </div>
                    ))}
                  </div>
                  <div className="px-4 pb-4">
                    <h4 className="text-[11px] font-extrabold text-navy mb-2">Acciones</h4>
                    <div className="flex gap-1.5 flex-wrap">
                      {blocked ? (
                        <button onClick={() => { resolverCondicion(obligacion.id); setModal({ type: 'detalleObligacion', id: obligacion.id }); }} className="btn btn-primary btn-sm">Resolver observación</button>
                      ) : obligacion.status === 'Listo' ? (
                        <button onClick={() => { autorizarPago(obligacion.id); setModal({ type: 'detalleObligacion', id: obligacion.id }); }} className="btn btn-primary btn-sm">Autorizar liberación</button>
                      ) : null}
                      <button onClick={() => showToast('Observación guardada en auditoría')} className="btn btn-ghost btn-sm border border-cream3">Agregar observación</button>
                    </div>
                  </div>
                  <div className="px-4 pb-4">
                    <h4 className="text-[11px] font-extrabold text-navy mb-2">Secuencia del pago</h4>
                    <div className="border-t border-cream3">
                      <div className="flex gap-2.5 py-2 border-b border-cream2 text-[10.5px]">
                        <b className="text-navy shrink-0">Obligación</b>
                        <span className="text-gray-400">Registrada y asociada al proyecto</span>
                      </div>
                      <div className="flex gap-2.5 py-2 border-b border-cream2 text-[10.5px]">
                        <b className="text-navy shrink-0">Acreditación</b>
                        <span className="text-gray-400">Validación documental antes de liberar</span>
                      </div>
                      <div className="flex gap-2.5 py-2 text-[10.5px]">
                        <b className="text-navy shrink-0">Próximo paso</b>
                        <span className="text-gray-400">{blocked ? 'Resolver condición pendiente' : obligacion.status === 'Listo' ? 'Autorizar liberación' : 'Pago liberado'}</span>
                      </div>
                    </div>
                  </div>
                </>
              );
            })()}
          </div>
        </>
      )}
    </div>
  );
}
