import { XCircle, FileText, Search, ArrowUpDown } from 'lucide-react';
import { Contratista, Proyecto } from '../../types';
import { DocumentoRow, ProyectoRow } from './RowComponents';
import { GLOBAL_CONTRATISTAS as MODULE_GLOBAL_CONTRATISTAS } from './globalData';
import SeverityBadge from '../../components/SeverityBadge';

const getDocumentosEmpresa = (cliente: any) => {
  const cObj = MODULE_GLOBAL_CONTRATISTAS.find(c =>
    c.nombre === cliente?.empresa ||
    c.nombre === cliente?.nombre ||
    c.id === cliente?.id
  ) || MODULE_GLOBAL_CONTRATISTAS[0];

  return cObj.documentos.map(d => ({
    nombre: d.nombre,
    estado: d.estado,
    vence: d.vencimiento,
    subido: d.subido || "05 May 2026",
    obs: d.motivo
  }));
};

// Fixed display order + singular/plural wording for the status-strip summary.
const ESTADOS_RESUMEN: Array<{ estado: string; dot: string; singular: string; plural: string }> = [
  { estado: 'aprobado', dot: 'bg-[#1e7a3c]', singular: 'aprobado', plural: 'aprobados' },
  { estado: 'rechazado', dot: 'bg-[#a32d2d]', singular: 'rechazado', plural: 'rechazados' },
  { estado: 'por_vencer', dot: 'bg-[#b58600]', singular: 'por vencer', plural: 'por vencer' },
  { estado: 'pendiente', dot: 'bg-[#9a9484]', singular: 'pendiente', plural: 'pendientes' },
];

export default function ClienteDetailDrawer({
  clienteSeleccionado,
  setClienteSeleccionado,
  tabCliente,
  setTabCliente,
  busquedaDoc,
  setBusquedaDoc,
  filtroEstado,
  setFiltroEstado,
  ordenDoc,
  setOrdenDoc,
  showToast,
  setActividadSeleccionada,
  GLOBAL_CONTRATISTAS,
  GLOBAL_PROYECTOS,
  GLOBAL_MANDANTES,
}: {
  clienteSeleccionado: any;
  setClienteSeleccionado: (v: any) => void;
  tabCliente: string;
  setTabCliente: (v: string) => void;
  busquedaDoc: string;
  setBusquedaDoc: (v: string) => void;
  filtroEstado: string;
  setFiltroEstado: (v: string) => void;
  ordenDoc: string;
  setOrdenDoc: (v: string) => void;
  showToast: (msg: string, type?: 'success' | 'error' | 'warning') => void;
  setActividadSeleccionada: (v: any) => void;
  GLOBAL_CONTRATISTAS: Contratista[];
  GLOBAL_PROYECTOS: Proyecto[];
  GLOBAL_MANDANTES: any[];
}) {
  const documentos = getDocumentosEmpresa(clienteSeleccionado);

  const docsFiltrados = documentos
    .filter((d) => filtroEstado === "todos" || d.estado === filtroEstado)
    .filter((d) => d.nombre.toLowerCase().includes(busquedaDoc.toLowerCase()))
    .sort((a, b) => (ordenDoc === "nombre" ? a.nombre.localeCompare(b.nombre) : 0));

  // Overview counts stay pinned to the full document set (not the current
  // search/filter) so the strip keeps reading as "the state of this company",
  // not "the state of what's currently visible".
  const resumenEstados = ESTADOS_RESUMEN
    .map(meta => ({ ...meta, n: documentos.filter(d => d.estado === meta.estado).length }))
    .filter(meta => meta.n > 0);

  return (
    <>
      <div
        className="fixed inset-0 z-[399] bg-black/20"
        onClick={() => setClienteSeleccionado(null)}
      />
      <div className="fixed left-1/2 top-1/2 z-[400] flex h-[calc(100vh-16px)] sm:h-[90vh] w-[calc(100vw-16px)] sm:w-3/4 max-w-[1000px] -translate-x-1/2 -translate-y-1/2 flex-col overflow-y-auto sm:overflow-hidden rounded-2xl border border-cream3 bg-white shadow-2xl">
        {/* Header — single row: avatar, name/RUT, badges, close */}
        <div className="flex items-center gap-3 py-3.5 px-5 border-b border-cream3 flex-shrink-0">
          <div className="w-[38px] h-[38px] rounded-full bg-brown text-white flex items-center justify-center font-semibold text-[13px] shrink-0">
            {clienteSeleccionado.iniciales}
          </div>
          <div className="min-w-0 shrink-0">
            <p className="font-semibold text-navy text-[15px] leading-tight truncate max-w-[220px]">
              {clienteSeleccionado.empresa}
            </p>
            <p className="text-[11.5px] text-gray-400 leading-tight">
              {clienteSeleccionado.rut}
            </p>
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="badge border border-cream3 bg-white text-gray-700 text-[11px]">
              {clienteSeleccionado.rol}
            </span>
            <SeverityBadge cumplimiento={clienteSeleccionado.cumplimiento} />
          </div>
          <div className="flex-1" />
          <button
            onClick={() => setClienteSeleccionado(null)}
            className="text-gray-400 hover:text-navy shrink-0"
          >
            <XCircle size={20} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-cream3 px-4 flex-shrink-0">
          {["documentos", "proyectos", "actividad", "info"].map((t) => (
            <button
              key={t}
              onClick={() => setTabCliente(t)}
              className={`px-4 py-2.5 text-[13px] capitalize border-b-2 transition-colors ${tabCliente === t ? "border-brown text-brown font-semibold" : "border-transparent text-gray-400 hover:text-navy"}`}
            >
              {t === "documentos"
                ? "Documentos"
                : t === "proyectos"
                  ? "Proyectos"
                  : t === "actividad"
                    ? "Actividad"
                    : "Info empresa"}
            </button>
          ))}
        </div>

        {/* Status strip — replaces the old 2-row filter block. Fixed above
            the scroll area so it stays visible while the list scrolls. */}
        {tabCliente === "documentos" && (
          <div className="flex items-center gap-3.5 px-5 py-2.5 border-b border-cream3 flex-wrap flex-shrink-0">
            {resumenEstados.map(({ estado, dot, singular, plural, n }) => (
              <span key={estado} className="flex items-center gap-1.5 text-[12px] text-gray-500 font-medium">
                <span className={`w-[7px] h-[7px] rounded-full shrink-0 ${dot}`} />
                {n} {n === 1 ? singular : plural}
              </span>
            ))}
            <div className="flex-1" />
            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              <input
                type="text"
                placeholder="Buscar documento..."
                value={busquedaDoc}
                onChange={(e) => setBusquedaDoc(e.target.value)}
                className="form-input w-[170px] pl-7 py-1.5 text-[12.5px]"
              />
            </div>
            <select
              value={filtroEstado}
              onChange={(e) => setFiltroEstado(e.target.value)}
              className="form-input py-1.5 text-[12.5px]"
            >
              <option value="todos">Todos los estados</option>
              <option value="aprobado">Aprobado</option>
              <option value="rechazado">Rechazado</option>
              <option value="por_vencer">Por vencer</option>
              <option value="pendiente">Pendiente</option>
            </select>
            <div className="relative">
              <ArrowUpDown size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              <select
                value={ordenDoc}
                onChange={(e) => setOrdenDoc(e.target.value)}
                title="Ordenar documentos"
                className="form-input pl-7 py-1.5 text-[12.5px]"
              >
                <option value="vencimiento">Vencimiento</option>
                <option value="subido">Fecha subida</option>
                <option value="nombre">Nombre A-Z</option>
              </select>
            </div>
          </div>
        )}

        {/* Content */}
        <div className={`flex-1 overflow-y-auto ${tabCliente === "documentos" ? "px-5 pt-1 pb-3" : "p-4"}`}>
          {tabCliente === "documentos" && (
            <div className="flex flex-col">
              {docsFiltrados.length === 0 ? (
                <div className="text-center py-10 text-gray-400">
                  <FileText size={36} className="mx-auto mb-2 opacity-30" />
                  <p className="text-[13px]">
                    No hay documentos que coincidan con los filtros
                  </p>
                  <button
                    onClick={() => {
                      setBusquedaDoc("");
                      setFiltroEstado("todos");
                    }}
                    className="text-brown text-[12.5px] mt-1 hover:underline"
                  >
                    Limpiar filtros
                  </button>
                </div>
              ) : (
                docsFiltrados.map((doc, i) => (
                  <DocumentoRow
                    key={i}
                    doc={doc}
                    showToast={showToast}
                    onRevisar={(d) => setActividadSeleccionada({
                      id: d.id || Math.random(),
                      documento: d.nombre || "—",
                      categoria: d.categoria || "Laboral",
                      proyecto: d.proyecto || "—",
                      empresa: clienteSeleccionado.empresa,
                      rut: clienteSeleccionado.rut,
                      fecha: d.subido || "—",
                      hora: "—",
                      estado: d.estado || "revision",
                      revisor: d.revisor || "—",
                      evento: d.estado === "aprobado" ? "Aprobación" : d.estado === "rechazado" ? "Rechazo" : "Subida",
                      motivo: d.obs || ""
                    })}
                  />
                ))
              )}

              <p className="text-[12px] text-gray-400 pt-2.5">
                Mostrando {docsFiltrados.length} de {documentos.length} documentos
              </p>
            </div>
          )}

          {tabCliente === "proyectos" && (() => {
            const contractorObj = GLOBAL_CONTRATISTAS.find(c =>
              c.nombre === clienteSeleccionado?.empresa ||
              c.nombre === clienteSeleccionado?.nombre ||
              c.id === clienteSeleccionado?.id
            ) || GLOBAL_CONTRATISTAS[0];
            const contractorProjects = GLOBAL_PROYECTOS.filter(p => contractorObj.proyectos.includes(p.id)).map(p => {
              const mandante = GLOBAL_MANDANTES.find(m => m.id === p.mandanteId);

              // Calculate project compliance percentage dynamically from real documents of the contractor
              const total = contractorObj.documentos.length;
              const aprobados = contractorObj.documentos.filter(d => d.estado === 'aprobado').length;
              const pct = total > 0 ? Math.round((aprobados / total) * 100) : 100;
              const estado = pct >= 90 ? "b-green" : pct >= 70 ? "b-yellow" : "b-red";

              return {
                nombre: `Proyecto ${p.nombre}`,
                mandante: mandante ? mandante.nombre : "Mandante",
                pct,
                estado
              };
            });

            return (
              <div className="flex flex-col gap-2">
                {contractorProjects.map((p, i) => (
                  <ProyectoRow key={i} proyecto={p} contractorId={contractorObj.id} showToast={showToast} />
                ))}
              </div>
            );
          })()}

          {tabCliente === "actividad" && (() => {
            const contractorObj = GLOBAL_CONTRATISTAS.find(c =>
              c.nombre === clienteSeleccionado?.empresa ||
              c.nombre === clienteSeleccionado?.nombre ||
              c.id === clienteSeleccionado?.id
            ) || GLOBAL_CONTRATISTAS[0];

            const dynamicAct: any[] = [];
            contractorObj.documentos.forEach(d => {
              if (d.estado === 'aprobado') {
                dynamicAct.push({
                  accion: "Documento aprobado",
                  detalle: `${d.nombre} · Revisado por ${d.revisor || 'Ana Díaz'}`,
                  hora: d.subido || "Hoy 09:35",
                  icon: "green"
                });
              } else if (d.estado === 'rechazado') {
                dynamicAct.push({
                  accion: "Documento rechazado",
                  detalle: `${d.nombre} · Motivo: ${d.motivo || 'Firma ilegible'}`,
                  hora: "Hoy 09:18",
                  icon: "red"
                });
              } else if (d.estado === 'revision') {
                dynamicAct.push({
                  accion: "Documento subido",
                  detalle: `${d.nombre} · Esperando revisión`,
                  hora: "Hace 2 hr",
                  icon: "blue"
                });
              }
            });

            if (dynamicAct.length === 0) {
              dynamicAct.push({
                accion: "Sin actividad reciente",
                detalle: "No hay eventos registrados en este período",
                hora: "—",
                icon: "gray"
              });
            }

            return (
              <div className="flex flex-col gap-2">
                {dynamicAct.map((ev, i) => (
                  <div
                    key={i}
                    className="flex items-start gap-3 py-2.5 border-b border-cream3 last:border-0"
                  >
                    <div
                      className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${ev.icon === "green" ? "bg-green-500" : ev.icon === "red" ? "bg-red-500" : ev.icon === "blue" ? "bg-blue-400" : "bg-gray-300"}`}
                    />
                    <div className="flex-1">
                      <p className="text-[13.5px] font-medium text-navy">
                        {ev.accion}
                      </p>
                      <p className="text-[12.5px] text-gray-400">
                        {ev.detalle}
                      </p>
                    </div>
                    <span className="text-[11.5px] text-gray-400 shrink-0">
                      {ev.hora}
                    </span>
                  </div>
                ))}
              </div>
            );
          })()}

          {tabCliente === "info" && (
            <div className="flex flex-col gap-4">
              <div className="card p-4">
                <p className="text-[12px] uppercase tracking-wider text-gray-400 mb-3 font-medium">
                  Datos de la empresa
                </p>
                {[
                  ["Razón social", clienteSeleccionado.empresa],
                  ["RUT", clienteSeleccionado.rut],
                  ["Rol en plataforma", clienteSeleccionado.rol],
                  ["Industria", "Construcción"],
                  ["Fecha de registro", "12 Ene 2026"],
                  ["Contacto principal", "contacto@empresa.cl"],
                  ["Teléfono", "+56 9 8765 4321"],
                ].map(([label, val]) => (
                  <div
                    key={label}
                    className="flex justify-between py-2 border-b border-cream3 last:border-0 text-[13.5px]"
                  >
                    <span className="text-gray-400">{label}</span>
                    <span className="font-medium text-navy text-right">
                      {val}
                    </span>
                  </div>
                ))}
              </div>
              <div className="card p-4">
                <p className="text-[12px] uppercase tracking-wider text-gray-400 mb-3 font-medium">
                  Plan y facturación
                </p>
                {[
                  ["Plan actual", clienteSeleccionado.rol === "Mandante" ? `${clienteSeleccionado.plan || "Pro"} · $${clienteSeleccionado.plan === "Enterprise" ? "149.990" : clienteSeleccionado.plan === "Pro" ? "49.990" : "19.990"}/mes` : "N/A (Acceso Contratista)"],
                  ["Próxima factura", "01 Jul 2026"],
                  ["Estado de pago", "Al día"],
                ].map(([label, val]) => (
                  <div
                    key={label}
                    className="flex justify-between py-2 border-b border-cream3 last:border-0 text-[13.5px]"
                  >
                    <span className="text-gray-400">{label}</span>
                    <span className="font-medium text-navy">{val}</span>
                  </div>
                ))}
              </div>
              <p className="text-[12px] text-gray-400 text-center py-1">
                Edición de datos y suspensión de cuenta: próximamente
              </p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
