import { X, Upload, FileText } from 'lucide-react';
import { Documento } from '../../types';

interface DocumentDetailPanelProps {
  doc: Documento;
  onClose: () => void;
  onUpload: (docId: string, actionMsg: string) => void;
  showToast: (msg: string, type?: 'success'|'error'|'warning') => void;
}

export default function DocumentDetailPanel({ doc, onClose, onUpload, showToast }: DocumentDetailPanelProps) {
  if (!doc) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 fade-in" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-[460px] max-h-[calc(100vh-24px)] overflow-y-auto font-sans" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex justify-between items-center p-4 border-b border-cream">
          <h3 className="font-medium text-navy text-[17px] flex items-center gap-2">
            {doc.nombre}
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors p-1.5 hover:bg-gray-100 rounded-lg"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 flex flex-col gap-5">
          {/* Badge de estado */}
          <div className="flex items-center gap-2">
            <span className="text-[13px] text-gray-500 font-medium">Estado actual:</span>
            <span className={`badge ${
              doc.estado === 'aprobado' ? 'b-green' :
              doc.estado === 'rechazado' ? 'b-red' :
              doc.estado === 'por_vencer' ? 'b-yellow' :
              doc.estado === 'revision' ? 'b-blue' : 'b-gray'
            }`}>
              {doc.estado === 'aprobado' ? 'Aprobado' :
               doc.estado === 'rechazado' ? 'Rechazado' :
               doc.estado === 'por_vencer' ? 'Por vencer' :
               doc.estado === 'revision' ? 'En revisión' : 'Pendiente'}
            </span>
          </div>

          {/* Details based on status */}
          {doc.estado === 'rechazado' && (
            <>
              <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 flex flex-col gap-3">
                <div className="flex items-center gap-2 font-bold text-[14.5px]">
                  <span>❌ Documento rechazado</span>
                </div>
                <div className="text-[13px] font-medium text-red-800">
                  {doc.nombre}
                </div>
              </div>

              {/* Motivo */}
              {(doc.motivoRechazo || doc.motivo) && (
                <div className="flex flex-col gap-1">
                  <span className="text-[12.5px] font-semibold text-gray-500 uppercase tracking-wider">Motivo</span>
                  <div className="bg-gray-50 border border-gray-200 text-gray-800 rounded-lg p-3 text-[13.5px] leading-relaxed">
                    {doc.motivoRechazo || doc.motivo}
                  </div>
                </div>
              )}

              {/* ¿Qué ocurrió? */}
              <div className="flex flex-col gap-1">
                <span className="text-[12.5px] font-semibold text-gray-500 uppercase tracking-wider">¿Qué ocurrió?</span>
                <div className="bg-gray-50 border border-gray-200 text-gray-800 rounded-lg p-3 text-[13.5px] leading-relaxed">
                  {doc.explicacionRechazo || doc.observacion || doc.motivo || 'El documento no cumple con los requisitos del mandante.'}
                </div>
              </div>

              {/* ¿Cómo solucionarlo? */}
              {doc.solucionRechazo && (
                <div className="flex flex-col gap-1">
                  <span className="text-[12.5px] font-semibold text-gray-500 uppercase tracking-wider">¿Cómo solucionarlo?</span>
                  <div className="bg-gray-50 border border-gray-200 text-gray-800 rounded-lg p-3 text-[13.5px] leading-relaxed">
                    {doc.solucionRechazo}
                  </div>
                </div>
              )}

              <button
                className="btn btn-primary w-full mt-2 flex items-center justify-center gap-2 py-2.5 font-medium shadow-sm"
                onClick={() => {
                  onUpload(doc.id, 'Documento reemplazado con éxito. Queda en estado de revisión.');
                  onClose();
                }}
              >
                <Upload size={16} /> Reemplazar documento
              </button>
            </>
          )}

          {doc.estado === 'pendiente' && (
            <>
              <div className="flex flex-col gap-2">
                <span className="text-[13px] font-semibold text-gray-700">Qué se necesita</span>
                <div className="bg-gray-50 border border-gray-200 text-gray-700 rounded-lg p-3.5 text-[13.5px] leading-relaxed flex flex-col gap-1">
                  <div><span className="font-semibold">Categoría:</span> {doc.categoria || 'Laboral'}</div>
                  {doc.vencimiento && doc.vencimiento !== '—' && (
                    <div><span className="font-semibold">Fecha límite:</span> {doc.vencimiento}</div>
                  )}
                </div>
              </div>

              <div className="flex flex-col gap-3">
                <span className="text-[13px] font-semibold text-navy">Pasos a seguir</span>
                <div className="flex flex-col gap-3">
                  <div className="flex items-start gap-3">
                    <span className="w-5 h-5 shrink-0 rounded-full bg-gray-100 text-gray-700 text-xs font-bold flex items-center justify-center mt-0.5">1</span>
                    <span className="text-[13px] text-gray-600">Prepara el documento vigente y legible.</span>
                  </div>
                  <div className="flex items-start gap-3">
                    <span className="w-5 h-5 shrink-0 rounded-full bg-gray-100 text-gray-700 text-xs font-bold flex items-center justify-center mt-0.5">2</span>
                    <span className="text-[13px] text-gray-600">Verifica que tenga todas las firmas requeridas.</span>
                  </div>
                  <div className="flex items-start gap-3">
                    <span className="w-5 h-5 shrink-0 rounded-full bg-gray-100 text-gray-700 text-xs font-bold flex items-center justify-center mt-0.5">3</span>
                    <span className="text-[13px] text-gray-600">Súbelo en formato PDF.</span>
                  </div>
                </div>
              </div>

              <button
                className="btn btn-primary w-full mt-2 flex items-center justify-center gap-2 py-2.5 font-medium"
                onClick={() => { onUpload(doc.id, 'Documento subido correctamente'); onClose(); }}
              >
                <Upload size={16} /> Subir documento
              </button>
            </>
          )}

          {doc.estado === 'revision' && (
            <>
              <div className="bg-blue-50 border border-blue-200 text-blue-800 rounded-lg p-4 text-[13.8px] leading-relaxed flex flex-col gap-1.5 font-sans mb-3">
                <div>El documento ha sido enviado y se encuentra en cola de revisión por el equipo auditor de Acredita.</div>
                {doc.subido && (
                  <div><span className="font-semibold text-blue-950">Fecha de envío:</span> {doc.subido}</div>
                )}
              </div>

              {/* Mock Viewer Section */}
              <div className="border border-cream3 rounded-xl p-4 bg-gray-50 flex flex-col items-center justify-center text-center py-6 font-sans mb-3">
                <FileText size={32} className="text-gray-400 mb-2" />
                <div className="font-semibold text-navy text-[13.5px] truncate max-w-[280px]">{doc.archivoReferencia || `mock_file_${doc.id}.pdf`}</div>
                <div className="text-[11px] text-gray-500 mt-1">Vista previa no disponible en entorno demo</div>
              </div>

              <div className="flex flex-col gap-2">
                <span className="text-[13px] font-semibold text-gray-500 uppercase tracking-wider">Detalles del Requisito</span>
                <div className="bg-gray-50 border border-gray-200 text-gray-700 rounded-lg p-3 text-[13.5px]">
                  <div><span className="font-semibold">Categoría:</span> {doc.categoria || 'Laboral'}</div>
                  {doc.vencimiento && doc.vencimiento !== '—' && (
                    <div><span className="font-semibold">Fecha de vencimiento declarada:</span> {doc.vencimiento}</div>
                  )}
                </div>
              </div>
            </>
          )}

          {doc.estado === 'por_vencer' && (
            <>
              <div className="flex flex-col gap-2">
                <span className="text-[13px] font-semibold text-yellow-700">Por qué importa</span>
                <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 rounded-lg p-3.5 text-[13.5px] leading-relaxed">
                  Vence el <span className="font-semibold">{doc.vencimiento}</span>. Si no se renueva a tiempo, el proyecto puede quedar bloqueado para pago o acceso a faena.
                </div>
              </div>

              <div className="flex flex-col gap-3">
                <span className="text-[13px] font-semibold text-navy">Pasos a seguir</span>
                <div className="flex flex-col gap-3">
                  <div className="flex items-start gap-3">
                    <span className="w-5 h-5 shrink-0 rounded-full bg-yellow-100 text-yellow-800 text-xs font-bold flex items-center justify-center mt-0.5">1</span>
                    <span className="text-[13px] text-gray-600">Solicita el documento actualizado con anticipación.</span>
                  </div>
                  <div className="flex items-start gap-3">
                    <span className="w-5 h-5 shrink-0 rounded-full bg-yellow-100 text-yellow-800 text-xs font-bold flex items-center justify-center mt-0.5">2</span>
                    <span className="text-[13px] text-gray-600">Verifica que la nueva fecha de vigencia sea posterior a hoy.</span>
                  </div>
                  <div className="flex items-start gap-3">
                    <span className="w-5 h-5 shrink-0 rounded-full bg-yellow-100 text-yellow-800 text-xs font-bold flex items-center justify-center mt-0.5">3</span>
                    <span className="text-[13px] text-gray-600">Sube la renovación antes de la fecha de vencimiento.</span>
                  </div>
                </div>
              </div>

              <button
                className="btn bg-[#c08000] hover:bg-[#a06a00] text-white w-full mt-2 flex items-center justify-center gap-2 py-2.5 font-medium border-none"
                onClick={() => { onUpload(doc.id, 'Subiendo renovación'); onClose(); }}
              >
                <Upload size={16} /> Subir renovación
              </button>
            </>
          )}

          {doc.estado === 'aprobado' && (
            <>
              <div className="bg-green-50 border border-green-200 text-green-800 rounded-lg p-4 text-[13.8px] leading-relaxed flex flex-col gap-1.5 mb-3 font-sans">
                <div><span className="font-semibold text-green-950">Vigencia:</span> Vigente hasta {doc.vencimiento || 'Indefinido'}</div>
                {doc.revisor && (
                  <div><span className="font-semibold text-green-950">Revisado por:</span> {doc.revisor}</div>
                )}
              </div>

              {/* Mock Viewer Section */}
              <div className="border border-cream3 rounded-xl p-4 bg-gray-50 flex flex-col items-center justify-center text-center py-6 font-sans">
                <FileText size={32} className="text-gray-400 mb-2" />
                <div className="font-semibold text-navy text-[13.5px] truncate max-w-[280px]">{doc.archivoReferencia || `${doc.nombre}.pdf`}</div>
                <div className="text-[11px] text-gray-500 mt-1">Vista previa no disponible en entorno demo</div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
