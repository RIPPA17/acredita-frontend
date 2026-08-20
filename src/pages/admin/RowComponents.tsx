import React, { useState } from "react";
import { FileText, Eye, ChevronDown, Download } from "lucide-react";
import { GLOBAL_CONTRATISTAS } from "./globalData";

export const DocumentoRow: React.FC<{ doc: any; onRevisar?: (doc: any) => void; showToast?: (msg: string) => void }> = ({ doc, onRevisar, showToast }) => {
  const [open, setOpen] = useState(false);
  const badgeMap: any = {
    aprobado: "b-green bg-green-100 text-green-800",
    rechazado: "b-red bg-red-100 text-red-800",
    por_vencer: "bg-yellow-100 text-yellow-800",
    pendiente: "b-gray bg-gray-100 text-gray-500",
  };
  const labelMap: any = {
    aprobado: "Aprobado",
    rechazado: "Rechazado",
    por_vencer: "Por vencer",
    pendiente: "Pendiente",
  };
  return (
    <div className="border border-cream3 rounded-xl overflow-hidden">
      <div
        onClick={() => setOpen(!open)}
        className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-cream2 transition-colors"
      >
        <div className="flex items-center gap-2.5">
          <FileText size={16} className="text-gray-400 shrink-0" />
          <span className="text-[13.5px] font-medium text-navy">
            {doc.nombre}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className={`badge text-[11px] ${badgeMap[doc.estado]}`}>
            {labelMap[doc.estado]}
          </span>
          <button
            onClick={(ev) => {
              ev.stopPropagation();
              onRevisar?.(doc);
            }}
            className="btn btn-ghost btn-sm shrink-0"
          >
            <Eye size={13} className="mr-1" /> Revisar
          </button>
          <ChevronDown
            size={14}
            className={`text-gray-400 transition-transform ${open ? "rotate-180" : ""}`}
          />
        </div>
      </div>
      {open && (
        <div className="px-4 pb-3 pt-1 bg-cream2 border-t border-cream3 text-[12.5px] text-gray-500 flex flex-col gap-1.5">
          <p>
            <span className="font-medium text-navy">Subido:</span> {doc.subido}
          </p>
          <p>
            <span className="font-medium text-navy">Vence:</span> {doc.vence}
          </p>
          {doc.obs && (
            <p className="text-red-500">
              <span className="font-medium">Observación:</span> {doc.obs}
            </p>
          )}
          <div className="flex gap-2 mt-2">
            <button className="btn btn-ghost btn-sm text-[12px]" onClick={() => showToast?.('Abriendo visor de documento...')}>
              <Eye size={12} /> Ver documento
            </button>
            <button className="btn btn-ghost btn-sm text-[12px]" onClick={() => showToast?.('Iniciando descarga del documento...')}>
              <Download size={12} /> Descargar
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export const ProyectoRow: React.FC<{ proyecto: any; contractorId?: string; showToast?: (msg: string) => void }> = ({ proyecto, contractorId, showToast }) => {
  const [open, setOpen] = useState(false);
  const [tabProy, setTabProy] = useState("trabajadores");

  const cObj = GLOBAL_CONTRATISTAS.find(c =>
    c.id === contractorId ||
    c.nombre === proyecto?.mandante ||
    c.nombre.toLowerCase().includes(proyecto?.mandante?.toLowerCase() || "")
  ) || GLOBAL_CONTRATISTAS.find(c => c.trabajadores && c.trabajadores.length > 0) || GLOBAL_CONTRATISTAS[1];

  const realProjectName = proyecto.nombre.replace("Proyecto ", "").trim();
  const trabajadores = (cObj.trabajadores || []).filter(t => t.faena === realProjectName);

  const documentosProyecto = cObj.documentos.map(d => ({
    nombre: d.nombre,
    estado: d.estado,
    vence: d.vencimiento,
    subido: d.subido || "05 May 2026",
  }));

  const badgeEstado: any = {
    aprobado: "bg-green-100 text-green-800",
    rechazado: "bg-red-100 text-red-800",
    por_vencer: "bg-yellow-100 text-yellow-800",
    pendiente: "bg-gray-100 text-gray-500",
  };
  const labelEstado: any = {
    aprobado: "Aprobado",
    rechazado: "Rechazado",
    por_vencer: "Por vencer",
    pendiente: "Pendiente",
  };

  return (
    <div className="border border-cream3 rounded-xl overflow-hidden mb-3 last:mb-0">
      {/* Header clickeable */}
      <div
        onClick={() => setOpen(!open)}
        className="flex items-center justify-between p-4 cursor-pointer hover:bg-cream2 transition-colors bg-white"
      >
        <div>
          <p className="font-semibold text-navy text-[14px]">
            {proyecto.nombre}
          </p>
          <p className="text-[12.5px] text-gray-400 mt-0.5">
            {proyecto.mandante} · {trabajadores.length} trabajadores
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`badge ${proyecto.estado}`}>{proyecto.pct}%</span>
          <ChevronDown
            size={14}
            className={`text-gray-400 transition-transform ${open ? "rotate-180" : ""}`}
          />
        </div>
      </div>

      {open && (
        <div className="border-t border-cream3 bg-cream2">
          {/* Stats rápidas */}
          <div className="grid grid-cols-3 divide-x divide-cream3 border-b border-cream3">
            {[
              { label: "Trabajadores", val: trabajadores.length },
              {
                label: "Docs aprobados",
                val: documentosProyecto.filter((d) => d.estado === "aprobado")
                  .length,
              },
              {
                label: "Estado pago",
                val: proyecto.pct >= 80 ? "✓ Habilitado" : "✗ Retenido",
              },
            ].map((s) => (
              <div key={s.label} className="text-center py-3 bg-white">
                <p className="text-[15px] font-semibold text-navy">{s.val}</p>
                <p className="text-[11.5px] text-gray-400">{s.label}</p>
              </div>
            ))}
          </div>

          {/* Tabs internos */}
          <div className="flex border-b border-cream3 px-3 bg-white pt-1">
            {["trabajadores", "documentos"].map((t) => (
              <button
                key={t}
                onClick={() => setTabProy(t)}
                className={`px-4 py-2 text-[12.5px] capitalize border-b-2 transition-colors ${tabProy === t ? "border-brown text-brown font-semibold" : "border-transparent text-gray-400 hover:text-navy"}`}
              >
                {t === "trabajadores"
                  ? `Trabajadores (${trabajadores.length})`
                  : `Documentos (${documentosProyecto.length})`}
              </button>
            ))}
          </div>

          {/* Tab trabajadores */}
          {tabProy === "trabajadores" && (
            <div className="flex flex-col divide-y divide-cream3 px-4 bg-white">
              {trabajadores.map((t, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between py-2.5"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-full bg-navy text-cream flex items-center justify-center text-[11px] font-semibold shrink-0">
                      {t.nombre
                        .split(" ")
                        .map((n) => n[0])
                        .join("")
                        .slice(0, 2)}
                    </div>
                    <div>
                      <p className="text-[13px] font-medium text-navy">
                        {t.nombre}
                      </p>
                      <p className="text-[11.5px] text-gray-400">{t.rut}</p>
                    </div>
                  </div>
                  <span
                    className={`badge text-[11px] ${badgeEstado[t.estado]}`}
                  >
                    {labelEstado[t.estado]}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Tab documentos */}
          {tabProy === "documentos" && (
            <div className="flex flex-col gap-2 p-3 bg-cream2">
              {documentosProyecto.map((doc, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between bg-white rounded-lg px-3 py-2.5 border border-cream3"
                >
                  <div className="flex items-center gap-2">
                    <FileText size={14} className="text-gray-400 shrink-0" />
                    <div>
                      <p className="text-[13px] font-medium text-navy">
                        {doc.nombre}
                      </p>
                      <p className="text-[11.5px] text-gray-400">
                        Vence: {doc.vence}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`badge text-[11px] ${badgeEstado[doc.estado]}`}
                    >
                      {labelEstado[doc.estado]}
                    </span>
                    <button className="text-gray-400 hover:text-navy" onClick={() => showToast?.('Visualizando documento del checklist...')}>
                      <Eye size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Info adicional */}
          <div className="px-4 py-3 border-t border-cream3 flex justify-between text-[12px] text-gray-400 bg-white">
            <span>Inicio: 01 Ene 2026</span>
            <span>Cierre: 31 Dic 2026</span>
            <button className="text-brown hover:underline font-medium" onClick={() => showToast?.('Cargando vista completa del proyecto...')}>
              Ver proyecto completo →
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
