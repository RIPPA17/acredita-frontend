import React from 'react';
import { CheckCircle, XCircle, Upload, ShieldAlert, Bell, Download } from 'lucide-react';

type LogEntry = {
  id: number;
  accion: "aprobacion" | "rechazo" | "subida" | "acceso_fallido" | "alerta";
  actor: string;
  rol: "Revisor" | "Contratista" | "Sistema Automático" | "Desconocido";
  empresa: string;
  proyecto: string;
  detalle: string;
  fecha: string;
  resultado: "exitoso" | "bloqueado" | "informativo";
  ip?: string;
};

export default function AuditoriaTab({
  auditoriaLogs,
  filtroAccionLog,
  setFiltroAccionLog,
  filtroActorLog,
  setFiltroActorLog,
  filtroFechaLog,
  setFiltroFechaLog,
  busquedaLog,
  setBusquedaLog,
  expandedLogId,
  setExpandedLogId,
}: {
  auditoriaLogs: LogEntry[];
  filtroAccionLog: string;
  setFiltroAccionLog: (v: string) => void;
  filtroActorLog: string;
  setFiltroActorLog: (v: string) => void;
  filtroFechaLog: string;
  setFiltroFechaLog: (v: string) => void;
  busquedaLog: string;
  setBusquedaLog: (v: string) => void;
  expandedLogId: number | null;
  setExpandedLogId: (v: number | null) => void;
}) {
  const filteredLogs = auditoriaLogs.filter(log => {
    if (filtroAccionLog !== "Todas las Acciones") {
      const mapAccion: Record<string, string> = {
        "Aprobaciones": "aprobacion", "Rechazos": "rechazo", "Subidas de doc": "subida", "Inicios de sesión": "acceso_fallido"
      };
      if (log.accion !== mapAccion[filtroAccionLog]) return false;
    }
    if (filtroActorLog !== "Todos los Actores" && log.rol !== filtroActorLog) return false;
    if (filtroFechaLog) {
      const parts = filtroFechaLog.split("-");
      if (parts.length === 3) {
        const dayStr = parts[2];
        if (!log.fecha.startsWith(dayStr + " ") && !log.fecha.startsWith(parseInt(dayStr, 10) + " ")) return false;
      }
    }
    if (busquedaLog) {
      const lowerSrc = busquedaLog.toLowerCase();
      if (!log.empresa.toLowerCase().includes(lowerSrc) && !log.detalle.toLowerCase().includes(lowerSrc)) return false;
    }
    return true;
  });

  const renderAccion = (accion: string) => {
    switch (accion) {
      case "aprobacion": return <><CheckCircle size={15} className="inline mr-1 text-green-600" /> Aprobación Documento</>;
      case "rechazo": return <><XCircle size={15} className="inline mr-1 text-red-500" /> Rechazo Documento</>;
      case "subida": return <><Upload size={15} className="inline mr-1 text-blue-500" /> Subida de Documento</>;
      case "acceso_fallido": return <><ShieldAlert size={15} className="inline mr-1 text-red-700" /> Intento de Acceso Base</>;
      case "alerta": return <><Bell size={15} className="inline mr-1 text-amber-500" /> Alerta Automática</>;
      default: return <>{accion}</>;
    }
  };

  const renderResultado = (resultado: string) => {
    switch (resultado) {
      case "exitoso": return <span className="badge bg-green-100 text-green-800 text-[11px]">Exitoso</span>;
      case "bloqueado": return <span className="badge bg-red-100 text-red-800 text-[11px]">Bloqueado</span>;
      case "informativo": return <span className="badge bg-cream text-gray-600 text-[11px]">Informativo</span>;
      default: return null;
    }
  };

  return (
    <div className="fade-in">
      <div className="page-header">
        <div>
          <h2 className="page-title">Auditoría</h2>
          <p className="page-sub">
            Registro detallado (log) de toda la actividad en la
            plataforma.
          </p>
        </div>
        <button className="btn btn-ghost btn-sm cursor-not-allowed opacity-50 font-medium" disabled title="Exportación deshabilitada en demo">
          <Download size={14} className="mr-1" /> Exportar log [Demo]
        </button>
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        <select
          className="form-input py-1.5 min-w-[150px] text-[13.2px]"
          value={filtroAccionLog}
          onChange={e => setFiltroAccionLog(e.target.value)}
        >
          <option>Todas las Acciones</option>
          <option>Aprobaciones</option>
          <option>Rechazos</option>
          <option>Subidas de doc</option>
          <option>Inicios de sesión</option>
        </select>
        <select
          className="form-input py-1.5 min-w-[150px] text-[13.2px]"
          value={filtroActorLog}
          onChange={e => setFiltroActorLog(e.target.value)}
        >
          <option>Todos los Actores</option>
          <option value="Revisor">Revisor</option>
          <option value="Contratista">Contratista</option>
          <option value="Sistema Automático">Sistema Automático</option>
        </select>
        <input
          type="date"
          className="form-input py-1.5 min-w-[150px] text-[13.2px]"
          value={filtroFechaLog}
          onChange={e => setFiltroFechaLog(e.target.value)}
        />
        <input
          type="text"
          className="form-input py-1.5 flex-1 min-w-[200px] text-[13.2px]"
          placeholder="Buscar por RUT o nombre de empresa..."
          value={busquedaLog}
          onChange={e => setBusquedaLog(e.target.value)}
        />
      </div>

      <div className="mb-2 text-[12.5px] text-gray-500 font-medium">
        Mostrando {filteredLogs.length} de {auditoriaLogs.length} eventos
      </div>

      <div className="card p-0 overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr>
              <th className="px-4 py-3 border-b border-cream3 text-[13.2px] text-gray-600 bg-cream2 font-medium">
                Acción
              </th>
              <th className="px-4 py-3 border-b border-cream3 text-[13.2px] text-gray-600 bg-cream2 font-medium">
                Actor
              </th>
              <th className="px-4 py-3 border-b border-cream3 text-[13.2px] text-gray-600 bg-cream2 font-medium">
                Empresa / Proyecto
              </th>
              <th className="px-4 py-3 border-b border-cream3 text-[13.2px] text-gray-600 bg-cream2 font-medium">
                Detalle
              </th>
              <th className="px-4 py-3 border-b border-cream3 text-[13.2px] text-gray-600 bg-cream2 font-medium">
                Fecha y Hora
              </th>
              <th className="px-4 py-3 border-b border-cream3 text-[13.2px] text-gray-600 bg-cream2 font-medium">
                Resultado
              </th>
            </tr>
          </thead>
          <tbody>
            {filteredLogs.map(log => (
              <React.Fragment key={log.id}>
                <tr
                  className="hover:bg-gray-50 border-b border-cream cursor-pointer"
                  onClick={() => setExpandedLogId(expandedLogId === log.id ? null : log.id)}
                >
                  <td className="px-4 py-4 text-[13.2px] font-medium text-navy flex items-center">
                    {renderAccion(log.accion)}
                  </td>
                  <td className="px-4 py-4 text-[13.2px] text-gray-600">
                    <div className="font-medium text-navy">{log.actor}</div>
                    <div className="text-[11px] text-gray-400 mt-0.5">{log.rol}{log.ip ? ` · IP: ${log.ip}` : ''}</div>
                  </td>
                  <td className="px-4 py-4 text-[13.2px] text-gray-600">
                    <div className="font-bold text-[13px] text-navy">{log.empresa}</div>
                    {log.proyecto && <div className="text-[11px] text-gray-500 mt-0.5">· {log.proyecto}</div>}
                  </td>
                  <td className="px-4 py-4 text-[13.2px] text-gray-600 max-w-[200px] truncate" title={log.detalle}>
                    {log.detalle}
                  </td>
                  <td className="px-4 py-4 text-[13.2px] text-gray-500 whitespace-nowrap">
                    {log.fecha}
                  </td>
                  <td className="px-4 py-4 text-[13.2px]">
                    {renderResultado(log.resultado)}
                  </td>
                </tr>
                {expandedLogId === log.id && (
                  <tr className="bg-cream2 border-b border-cream">
                    <td colSpan={6} className="px-6 py-5">
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-6 text-[13px]">
                        <div>
                          <span className="block text-gray-400 font-semibold mb-1 text-[11px] uppercase tracking-wide">Detalle de la acción</span>
                          <p className="text-navy leading-relaxed">{log.detalle}</p>
                        </div>
                        <div>
                          <span className="block text-gray-400 font-semibold mb-1 text-[11px] uppercase tracking-wide">Contexto Operativo</span>
                          <p className="text-navy">{log.empresa} {log.proyecto ? `· ${log.proyecto}` : ''}</p>
                        </div>
                        <div>
                          <span className="block text-gray-400 font-semibold mb-1 text-[11px] uppercase tracking-wide">Metadatos</span>
                          <p className="text-navy">{log.fecha}</p>
                          {log.ip ? <p className="text-gray-500 mt-0.5">IP: {log.ip}</p> : null}
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
