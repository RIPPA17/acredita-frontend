import React, { useState } from 'react';
import { 
  X, CheckCircle, AlertTriangle, XCircle, Key, Banknote, Briefcase, FileText, 
  Eye, Download, Upload, Check, AlertCircle, ArrowLeft, Users 
} from 'lucide-react';
import { 
  calcularEstadoTrabajador, 
  calcularEstadoAcreditacion, 
  calcularAccesoPago, 
  getRequisitos,
  esVencidoPorFecha,
  esPorVencerPorFecha
} from '../data/localStorageDb';
import { Contratista, Trabajador, Requisito, Documento } from '../types';
import { Mandante, Proyecto } from '../types';
import ContratistaFichaAcreditacion from './ContratistaFichaAcreditacion';

interface FichaAcreditacionProps {
  tipo: 'empresa' | 'trabajador';
  contratista: Contratista;
  trabajador?: Trabajador;
  proyectoId: string;
  onClose: () => void;
  rol: 'admin' | 'mandante' | 'contratista';
  onCorregirDocumento?: (doc: Documento) => void;
  onRevisarDocumento?: (doc: Documento) => void;
  proyectos?: Proyecto[];
  mandantes?: Mandante[];
  onProyectoChange?: (id: string) => void;
  onIrADocumentos?: (proyectoId: string) => void;
  onIrATrabajador?: (proyectoId: string, trabajador: Trabajador) => void;
}

function LegacyFichaAcreditacion({
  tipo,
  contratista,
  trabajador: initialTrabajador,
  proyectoId,
  onClose,
  rol,
  onCorregirDocumento,
  onRevisarDocumento
}: FichaAcreditacionProps) {
  
  // Soporte para navegacion interna auto-contenida
  const [currentTipo, setCurrentTipo] = useState<'empresa' | 'trabajador'>(tipo);
  const [currentTrabajador, setCurrentTrabajador] = useState<Trabajador | undefined>(initialTrabajador);
  const [expandedReqId, setExpandedReqId] = useState<string | null>(null);

  // 1. Obtener estados de acreditación usando las funciones existentes
  let statusText: 'Acreditado' | 'En proceso' | 'Vencido/Bloqueado' = 'En proceso';
  let badgeClass = 'b-yellow';
  let motivosBloqueo: string[] = [];
  let pendientes: string[] = [];

  // Requisitos y Documentos listados
  let reqsCount = { total: 0, aprobados: 0, pendientes: 0, rechazados: 0, vencidos: 0, porVencer: 0 };
  let docListToDisplay: Array<{ requirement: Requisito; document?: Documento }> = [];

  // Habilitaciones
  let accesoBloqueado = false;
  let pagoBloqueado = false;
  let motivoAccesoStr = '';
  let motivoPagoStr = '';

  if (currentTipo === 'trabajador' && currentTrabajador) {
    // Estado del trabajador
    const wState = calcularEstadoTrabajador(currentTrabajador, proyectoId);
    if (wState === 'aprobado') {
      statusText = 'Acreditado';
      badgeClass = 'b-green';
    } else if (wState === 'rechazado') {
      statusText = 'Vencido/Bloqueado';
      badgeClass = 'b-red';
    } else {
      statusText = 'En proceso';
      badgeClass = 'b-yellow';
    }

    // Requisitos específicos del trabajador en este proyecto
    const wkReqs = getRequisitos().filter(r => r.proyectoId === proyectoId && r.destino === 'trabajador' && r.activo !== false);
    reqsCount.total = wkReqs.length;

    wkReqs.forEach(req => {
      const doc = currentTrabajador.documentos?.find(d => 
        d.proyectoId === proyectoId &&
        (d.nombre.toLowerCase().includes(req.nombre.toLowerCase()) || 
         req.nombre.toLowerCase().includes(d.nombre.toLowerCase()))
      );

      docListToDisplay.push({ requirement: req, document: doc });

      if (!doc) {
        if (req.obligatorio) {
          pendientes.push(`${req.nombre} pendiente`);
          reqsCount.pendientes++;
        }
      } else {
        const isVencido = esVencidoPorFecha(doc.vencimiento);
        const isPorVencer = esPorVencerPorFecha(doc.vencimiento, req.alertaDias);

        let docEstado: string = doc.estado;
        if (doc.estado === 'aprobado') {
          if (isVencido) {
            docEstado = 'vencido';
          } else if (isPorVencer) {
            docEstado = 'por_vencer';
          }
        }

        if (docEstado === 'aprobado') {
          reqsCount.aprobados++;
        } else if (docEstado === 'rechazado' || isVencido || docEstado === 'vencido') {
          reqsCount.rechazados++;
          if (isVencido || docEstado === 'vencido') reqsCount.vencidos++;
          if (req.obligatorio) {
            const feedbackDetail = doc.explicacionRechazo || doc.observacion || doc.motivo || 'Documento incorrecto o vencido';
            motivosBloqueo.push(`${req.nombre} ${isVencido || docEstado === 'vencido' ? 'vencido' : 'rechazado'} (${feedbackDetail})`);
          }
        } else if (docEstado === 'por_vencer') {
          reqsCount.porVencer++;
          reqsCount.aprobados++; // counts as approved/valid for now
        } else {
          // Pendiente o en revisión
          reqsCount.pendientes++;
          if (req.obligatorio) {
            pendientes.push(`${req.nombre} en revisión`);
          }
        }

      }
    });

  } else {
    // Estado de la empresa contratista
    const cState = calcularEstadoAcreditacion(contratista, proyectoId);
    if (cState === 'Aprobado') {
      statusText = 'Acreditado';
      badgeClass = 'b-green';
    } else if (cState === 'Vencido/Bloqueado') {
      statusText = 'Vencido/Bloqueado';
      badgeClass = 'b-red';
    } else {
      statusText = 'En proceso';
      badgeClass = 'b-yellow';
    }



    // Requisitos de la empresa en este proyecto
    const empReqs = getRequisitos().filter(r => r.proyectoId === proyectoId && r.destino === 'empresa' && r.activo !== false);
    reqsCount.total = empReqs.length;

    empReqs.forEach(req => {
      const doc = contratista.documentos?.find(d => 
        d.proyectoId === proyectoId &&
        (d.nombre.toLowerCase().includes(req.nombre.toLowerCase()) || 
         req.nombre.toLowerCase().includes(d.nombre.toLowerCase()))
      );

      docListToDisplay.push({ requirement: req, document: doc });

      if (!doc) {
        if (req.obligatorio) {
          pendientes.push(`${req.nombre} de empresa pendiente`);
          reqsCount.pendientes++;
        }
      } else {
        const isVencido = esVencidoPorFecha(doc.vencimiento);
        const isPorVencer = esPorVencerPorFecha(doc.vencimiento, req.alertaDias);

        let docEstado: string = doc.estado;
        if (doc.estado === 'aprobado') {
          if (isVencido) {
            docEstado = 'vencido';
          } else if (isPorVencer) {
            docEstado = 'por_vencer';
          }
        }

        if (docEstado === 'aprobado') {
          reqsCount.aprobados++;
        } else if (docEstado === 'rechazado' || isVencido || docEstado === 'vencido') {
          reqsCount.rechazados++;
          if (isVencido || docEstado === 'vencido') reqsCount.vencidos++;
          if (req.obligatorio) {
            const feedbackDetail = doc.explicacionRechazo || doc.observacion || doc.motivo || 'Documento incorrecto o vencido';
            motivosBloqueo.push(`${req.nombre} de empresa ${isVencido || docEstado === 'vencido' ? 'vencido' : 'rechazado'} (${feedbackDetail})`);
          }
        } else if (docEstado === 'por_vencer') {
          reqsCount.porVencer++;
          reqsCount.aprobados++;
        } else {
          reqsCount.pendientes++;
          if (req.obligatorio) {
            pendientes.push(`${req.nombre} de empresa en revisión`);
          }
        }
      }
    });

    // Validar también los motivos de bloqueo de los trabajadores asignados al proyecto
    const projectWorkers = (contratista.trabajadores || []).filter(w => 
      w.documentos?.some(d => d.proyectoId === proyectoId)
    );

    projectWorkers.forEach(w => {
      const wState = calcularEstadoTrabajador(w, proyectoId);
      if (wState === 'rechazado') {
        const wkReqs = getRequisitos().filter(r => r.proyectoId === proyectoId && r.destino === 'trabajador' && r.activo !== false);
        wkReqs.forEach(req => {
          const doc = w.documentos?.find(d => 
            d.proyectoId === proyectoId &&
            (d.nombre.toLowerCase().includes(req.nombre.toLowerCase()) || 
             req.nombre.toLowerCase().includes(d.nombre.toLowerCase()))
          );
          if (doc) {
            const isVencido = esVencidoPorFecha(doc.vencimiento);
            if (req.obligatorio && (doc.estado === 'rechazado' || isVencido)) {
              motivosBloqueo.push(`${w.nombre}: ${req.nombre} ${isVencido ? 'vencido' : 'rechazado'}`);
            }
          } else if (req.obligatorio) {
            motivosBloqueo.push(`${w.nombre}: falta ${req.nombre}`);
          }
        });
      } else if (wState === 'pendiente') {
        pendientes.push(`${w.nombre} en proceso de acreditación`);
      }
    });
  }

  // Habilitaciones se derivan de forma independiente para la empresa, y del estado del trabajador para este
  const motivoTexto = statusText === 'Vencido/Bloqueado'
    ? (motivosBloqueo[0] || 'Documento vencido o rechazado')
    : statusText === 'En proceso'
      ? (pendientes[0] || 'Acreditación en proceso')
      : '';

  if (currentTipo === 'trabajador') {
    const isAprobado = statusText === 'Acreditado';
    accesoBloqueado = !isAprobado;
    pagoBloqueado = false;
    motivoAccesoStr = !isAprobado ? motivoTexto : '';
    motivoPagoStr = '';
  } else {
    const accPago = calcularAccesoPago(contratista, proyectoId);
    accesoBloqueado = accPago.accesoBloqueado;
    pagoBloqueado = accPago.pagoBloqueado;
    motivoAccesoStr = accPago.accesoBloqueado ? (accPago.motivoAcceso || motivoTexto) : '';
    motivoPagoStr = accPago.pagoBloqueado ? (accPago.motivoPago || motivoTexto) : '';
  }

  // Filtrar trabajadores asignados al proyecto para mostrarlos si es Empresa
  const projectWorkersList = (contratista.trabajadores || []).filter(w => 
    w.documentos?.some(d => d.proyectoId === proyectoId)
  );

  return (
    <div className="fixed inset-0 bg-black/60 z-[999] flex items-center justify-center p-4 fade-in font-sans" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-[580px] max-h-[calc(100vh-24px)] sm:max-h-[90vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
        
        {/* Header */}
        <div className="p-5 border-b border-cream flex justify-between items-center bg-[#faf8f5] shrink-0">
          <div>
            <div className="flex items-center gap-2 mb-1">
              {currentTipo === 'trabajador' && tipo === 'empresa' && (
                <button 
                  onClick={() => { setCurrentTipo('empresa'); setCurrentTrabajador(undefined); }}
                  className="text-brown hover:underline text-[11px] font-bold flex items-center gap-1 mr-2"
                >
                  <ArrowLeft size={12} /> Volver a Empresa
                </button>
              )}
              <div className="text-[11px] font-bold text-brown uppercase tracking-wider">
                Ficha de Acreditación ({currentTipo === 'trabajador' ? 'Trabajador' : 'Empresa'})
              </div>
            </div>
            <h3 className="text-[18px] font-extrabold text-navy flex items-center gap-2">
              {currentTipo === 'trabajador' && currentTrabajador ? currentTrabajador.nombre : contratista.nombre}
              <span className={`badge ${badgeClass} text-[11px] py-0.5 px-2.5 font-bold`}>{statusText}</span>
            </h3>
          </div>
          <button 
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors p-2 hover:bg-gray-100 rounded-xl"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-6">
          
          {/* 1. Información General */}
          <div className="card p-4 border border-cream3 bg-[#fffcf9] rounded-xl flex flex-col gap-2 text-[13.5px]">
            <div><span className="font-semibold text-gray-500">Empresa:</span> <span className="font-medium text-navy">{contratista.nombre}</span></div>
            {currentTipo === 'trabajador' && currentTrabajador && (
              <>
                <div><span className="font-semibold text-gray-500">Trabajador:</span> <span className="font-medium text-navy">{currentTrabajador.nombre}</span></div>
                <div><span className="font-semibold text-gray-500">RUT:</span> <span className="font-medium text-navy font-mono">{currentTrabajador.rut}</span></div>
                <div><span className="font-semibold text-gray-500">Cargo:</span> <span className="font-medium text-navy">{currentTrabajador.cargo || 'Operario'}</span></div>
              </>
            )}
            <div><span className="font-semibold text-gray-500">Proyecto:</span> <span className="font-medium text-navy">ID: {proyectoId.toUpperCase()}</span></div>
          </div>

          {/* 2. Diagnóstico del Estado */}
          <div className="flex flex-col gap-3">
            <h4 className="text-[12px] font-bold uppercase tracking-wider text-gray-400">Diagnóstico del Estado</h4>
            
            {statusText === 'Acreditado' && (
              <div className="p-4 rounded-xl border border-green-200 bg-green-50 text-green-800 text-[13.5px] leading-relaxed flex items-start gap-2.5">
                <CheckCircle size={18} className="text-green-600 shrink-0 mt-0.5" />
                <div>
                  <div className="font-bold">Acreditación aprobada</div>
                  <p className="text-green-700 mt-0.5">Todos los requisitos contractuales y documentales se encuentran vigentes y aprobados.</p>
                </div>
              </div>
            )}

            {statusText === 'Vencido/Bloqueado' && (
              <div className="p-4 rounded-xl border border-red-200 bg-red-50 text-red-800 text-[13.5px] leading-relaxed flex flex-col gap-2">
                <div className="flex items-start gap-2.5">
                  <XCircle size={18} className="text-red-600 shrink-0 mt-0.5" />
                  <div>
                    <div className="font-bold">Acreditación Bloqueada / Vencida</div>
                    <p className="text-red-700 mt-0.5">La entidad no puede operar debido a los siguientes motivos de bloqueo documental:</p>
                  </div>
                </div>
                <div className="mt-2 pl-7 flex flex-col gap-1.5 text-[12.5px] border-l-2 border-red-200">
                  {motivosBloqueo.map((m, idx) => (
                    <div key={idx} className="font-medium text-red-900">• {m}</div>
                  ))}
                </div>
              </div>
            )}

            {statusText === 'En proceso' && (
              <div className="p-4 rounded-xl border border-yellow-200 bg-yellow-50 text-yellow-800 text-[13.5px] leading-relaxed flex flex-col gap-2">
                <div className="flex items-start gap-2.5">
                  <AlertCircle size={18} className="text-yellow-600 shrink-0 mt-0.5" />
                  <div>
                    <div className="font-bold">Acreditación En Proceso</div>
                    <p className="text-yellow-700 mt-0.5">Falta documentación obligatoria por subir o validar:</p>
                  </div>
                </div>
                <div className="mt-2 pl-7 flex flex-col gap-1.5 text-[12.5px] border-l-2 border-yellow-200">
                  {pendientes.map((p, idx) => (
                    <div key={idx} className="font-medium text-yellow-900">• {p}</div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* 3. Resumen de Requisitos */}
          <div className="flex flex-col gap-3">
            <h4 className="text-[12px] font-bold uppercase tracking-wider text-gray-400">Resumen de Requisitos</h4>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 text-center text-sans">
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-2">
                <div className="text-[15px] font-bold text-navy">{reqsCount.total}</div>
                <div className="text-[10.5px] text-gray-400">Total</div>
              </div>
              <div className="bg-green-50 border border-green-100 rounded-lg p-2">
                <div className="text-[15px] font-bold text-green-700">{reqsCount.aprobados}</div>
                <div className="text-[10.5px] text-green-600">Aprobados</div>
              </div>
              <div className="bg-blue-50 border border-blue-100 rounded-lg p-2">
                <div className="text-[15px] font-bold text-blue-700">{reqsCount.pendientes}</div>
                <div className="text-[10.5px] text-blue-600">Pendientes</div>
              </div>
              <div className="bg-red-50 border border-red-100 rounded-lg p-2">
                <div className="text-[15px] font-bold text-red-700">{reqsCount.rechazados}</div>
                <div className="text-[10.5px] text-red-600">Rechazados</div>
              </div>
              <div className="bg-red-100 border border-red-200 rounded-lg p-2">
                <div className="text-[15px] font-bold text-red-800">{reqsCount.vencidos}</div>
                <div className="text-[10.5px] text-red-700">Vencidos</div>
              </div>
              <div className="bg-yellow-50 border border-yellow-100 rounded-lg p-2">
                <div className="text-[15px] font-bold text-[#b45309]">{reqsCount.porVencer}</div>
                <div className="text-[10.5px] text-[#b45309]">Por Vencer</div>
              </div>
            </div>
          </div>

          {/* 4. Habilitaciones */}
          <div className="flex flex-col gap-3">
            <h4 className="text-[12px] font-bold uppercase tracking-wider text-gray-400">Habilitaciones Operativas</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[13px]">
              
              <div className={`p-3 border rounded-xl flex items-center justify-between ${accesoBloqueado ? 'bg-red-50/40 border-red-200 text-red-900' : 'bg-green-50/40 border-green-200 text-green-900'}`}>
                <div className="flex items-center gap-2">
                  <Key size={16} className={accesoBloqueado ? 'text-red-500' : 'text-green-600'} />
                  <div>
                    <span className="font-semibold">Ingresar a faena</span>
                    {accesoBloqueado && motivoAccesoStr && <div className="text-[10.5px] text-red-600 font-sans mt-0.5">Bloqueo por: {motivoAccesoStr}</div>}
                  </div>
                </div>
                <span className="font-bold">{accesoBloqueado ? '✗ Bloqueado' : '✓ Habilitado'}</span>
              </div>

              <div className={`p-3 border rounded-xl flex items-center justify-between ${accesoBloqueado ? 'bg-red-50/40 border-red-200 text-red-900' : 'bg-green-50/40 border-green-200 text-green-900'}`}>
                <div className="flex items-center gap-2">
                  <Briefcase size={16} className={accesoBloqueado ? 'text-red-500' : 'text-green-600'} />
                  <div>
                    <span className="font-semibold">Trabajar en faena</span>
                  </div>
                </div>
                <span className="font-bold">{accesoBloqueado ? '✗ Bloqueado' : '✓ Habilitado'}</span>
              </div>

              <div className={`p-3 border rounded-xl flex items-center justify-between ${accesoBloqueado ? 'bg-red-50/40 border-red-200 text-red-900' : 'bg-green-50/40 border-green-200 text-green-900'}`}>
                <div className="flex items-center gap-2">
                  <CheckCircle size={16} className={accesoBloqueado ? 'text-red-500' : 'text-green-600'} />
                  <div>
                    <span className="font-semibold">Asignación a obra</span>
                  </div>
                </div>
                <span className="font-bold">{accesoBloqueado ? '✗ Bloqueado' : '✓ Habilitado'}</span>
              </div>

              <div className={`p-3 border rounded-xl flex items-center justify-between ${pagoBloqueado ? 'bg-red-50/40 border-red-200 text-red-900' : 'bg-green-50/40 border-green-200 text-green-900'}`}>
                <div className="flex items-center gap-2">
                  <Banknote size={16} className={pagoBloqueado ? 'text-red-500' : 'text-green-600'} />
                  <div>
                    <span className="font-semibold">Recibir pago</span>
                    {pagoBloqueado && motivoPagoStr && <div className="text-[10.5px] text-red-600 font-sans mt-0.5">Retenido por: {motivoPagoStr}</div>}
                  </div>
                </div>
                <span className="font-bold">{pagoBloqueado ? '✗ Retenido' : '✓ Habilitado'}</span>
              </div>

            </div>
          </div>

          {/* Estado operativo */}
          <div className="flex flex-col gap-3">
            <h4 className="text-[12px] font-bold uppercase tracking-wider text-gray-400">Estado operativo</h4>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-[13px] font-medium">
              <div className={`p-2.5 rounded-lg flex items-center justify-between border ${!accesoBloqueado ? 'bg-green-50 border-green-200 text-green-800' : 'bg-red-50 border-red-200 text-red-800'}`}>
                <span>Asignación</span>
                <span className="font-bold text-[14px]">{!accesoBloqueado ? '✓' : '✕'}</span>
              </div>
              <div className={`p-2.5 rounded-lg flex items-center justify-between border ${!accesoBloqueado ? 'bg-green-50 border-green-200 text-green-800' : 'bg-red-800/10 border-red-200 text-red-800'}`}>
                <span>Ingreso</span>
                <span className="font-bold text-[14px]">{!accesoBloqueado ? '✓' : '✕'}</span>
              </div>
              <div className={`p-2.5 rounded-lg flex items-center justify-between border ${!accesoBloqueado ? 'bg-green-50 border-green-200 text-green-800' : 'bg-red-800/10 border-red-200 text-red-800'}`}>
                <span>Trabajo</span>
                <span className="font-bold text-[14px]">{!accesoBloqueado ? '✓' : '✕'}</span>
              </div>
              <div className={`p-2.5 rounded-lg flex items-center justify-between border ${!pagoBloqueado ? 'bg-green-50 border-green-200 text-green-800' : 'bg-red-800/10 border-red-200 text-red-800'}`}>
                <span>Pago</span>
                <span className="font-bold text-[14px]">{!pagoBloqueado ? '✓' : '✕'}</span>
              </div>
            </div>
          </div>

          {/* 5. Listado de Documentos del Proyecto */}
          <div className="flex flex-col gap-3">
            <h4 className="text-[12px] font-bold uppercase tracking-wider text-gray-400">Detalle de Requisitos y Documentos</h4>
            <div className="flex flex-col gap-2">
              {docListToDisplay.map((item, idx) => {
                const doc = item.document;
                const req = item.requirement;
                const isVencido = doc ? esVencidoPorFecha(doc.vencimiento) : false;
                const isPorVencer = doc ? esPorVencerPorFecha(doc.vencimiento, req.alertaDias) : false;
                let docEstado = doc ? doc.estado : '';
                if (doc && doc.estado === 'aprobado') {
                  if (isVencido) {
                    docEstado = 'vencido';
                  } else if (isPorVencer) {
                    docEstado = 'por_vencer';
                  }
                }

                const isExpanded = expandedReqId === req.id;
                
                return (
                  <div key={idx} className="border border-cream3 rounded-xl overflow-hidden font-sans">
                    <div 
                      className={`p-3 hover:bg-gray-50/50 flex justify-between items-center gap-3 text-[13.5px] cursor-pointer ${isExpanded ? 'bg-cream/10 border-b border-cream3' : ''}`}
                      onClick={() => setExpandedReqId(isExpanded ? null : req.id)}
                    >
                      <div className="flex items-center gap-2.5">
                        <FileText size={18} className="text-gray-400 shrink-0" />
                        <div>
                          <div className="font-semibold text-navy">{req.nombre}</div>
                          <div className="text-[11.5px] text-gray-400">
                            {doc ? (
                              <>Vencimiento: {doc.vencimiento} · <span className="font-medium">{docEstado === 'por_vencer' ? 'Por vencer' : docEstado === 'revision' ? 'En revisión' : docEstado === 'vencido' ? 'Vencido' : docEstado}</span></>
                            ) : (
                              <span className="text-red-500 font-medium">Falta cargar documento</span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
                        {doc && (
                          <span className={`badge text-[10.5px] ${
                            docEstado === 'aprobado' ? 'b-green' :
                            docEstado === 'rechazado' || docEstado === 'vencido' ? 'b-red' : 
                            docEstado === 'por_vencer' ? 'b-yellow' : 'b-gray'
                          }`}>
                            {docEstado === 'vencido' ? 'Vencido' : docEstado === 'revision' ? 'En revisión' : docEstado === 'rechazado' ? 'Rechazado' : docEstado}
                          </span>
                        )}

                        {/* Botones contextuales por ROL */}
                        {rol === 'admin' && doc && (
                          <button 
                            className="btn btn-ghost btn-sm px-2 py-1 text-[11.5px] text-brown hover:underline"
                            onClick={() => onRevisarDocumento?.(doc)}
                          >
                            Revisar
                          </button>
                        )}

                        {rol === 'contratista' && doc && (docEstado === 'rechazado' || docEstado === 'vencido') && (
                          <button 
                            className="btn btn-primary btn-sm text-[11px] px-2.5 py-1"
                            onClick={() => onCorregirDocumento?.(doc)}
                          >
                            Corregir
                          </button>
                        )}
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="bg-[#fafafa] p-4 text-[13px] border-t border-cream2 font-sans space-y-3">
                        <div className="font-bold text-navy text-[13px] border-b border-cream3 pb-1 flex items-center justify-between">
                          <span>Última revisión</span>
                          <span className="text-[11px] font-normal text-gray-400 italic">Historial de control</span>
                        </div>

                        {(() => {
                          if (!doc) {
                            return <div className="text-gray-500 italic">⏳ Pendiente de revisión</div>;
                          }

                          if (docEstado === 'revision') {
                            return <div className="text-gray-500 italic">⏳ Pendiente de revisión</div>;
                          }

                          const showRevisor = rol === 'admin';
                          const showImpact = rol === 'admin' || rol === 'mandante';
                          const hasImpact = req.obligatorio && (docEstado === 'rechazado' || docEstado === 'vencido');

                          return (
                            <div className="space-y-3">
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                                <div>
                                  <span className="font-semibold text-navy">Estado:</span>{' '}
                                  <span className={docEstado === 'aprobado' ? 'text-green-700 font-bold' : docEstado === 'por_vencer' ? 'text-yellow-700 font-bold' : 'text-red-700 font-bold'}>
                                    {docEstado === 'aprobado' ? '✓ Aprobado' : docEstado === 'por_vencer' ? '⚠ Por vencer' : docEstado === 'vencido' ? '❌ Vencido' : '❌ Rechazado'}
                                  </span>
                                </div>
                                {doc.fechaRevisado && (
                                  <div>
                                    <span className="font-semibold text-navy">Fecha:</span> {doc.fechaRevisado}
                                  </div>
                                )}
                              </div>

                              {showRevisor && doc.revisor && (
                                <div>
                                  <span className="font-semibold text-navy">Revisado por:</span> {doc.revisor}
                                </div>
                              )}

                              {(docEstado === 'rechazado' || docEstado === 'vencido') && (
                                <div className="bg-white border border-red-100 rounded-lg p-3 space-y-2">
                                  {doc.motivoRechazo && (
                                    <div>
                                      <div className="font-bold text-red-800 text-[11px] uppercase tracking-wider">Motivo:</div>
                                      <div className="text-gray-700 font-medium mt-0.5">{doc.motivoRechazo}</div>
                                    </div>
                                  )}
                                  {doc.explicacionRechazo && (
                                    <div>
                                      <div className="font-bold text-gray-500 text-[11px] uppercase tracking-wider">Qué ocurrió:</div>
                                      <div className="text-gray-600 mt-0.5 leading-relaxed">{doc.explicacionRechazo}</div>
                                    </div>
                                  )}
                                  {doc.solucionRechazo && (
                                    <div>
                                      <div className="font-bold text-gray-500 text-[11px] uppercase tracking-wider">Cómo solucionarlo:</div>
                                      <div className="text-gray-600 mt-0.5 leading-relaxed">{doc.solucionRechazo}</div>
                                    </div>
                                  )}
                                </div>
                              )}

                              {showImpact && (
                                <div className="border-t border-cream pt-2.5">
                                  <div className="font-semibold text-navy mb-1.5">Impacto:</div>
                                  {hasImpact ? (
                                    <div className="grid grid-cols-2 gap-1.5 text-[12px] font-medium">
                                      <span className="text-red-600 flex items-center gap-1">🔴 Bloquea ingreso</span>
                                      <span className="text-red-600 flex items-center gap-1">🔴 Bloquea trabajo</span>
                                      <span className="text-red-600 flex items-center gap-1">🔴 Bloquea asignación</span>
                                      <span className="text-red-600 flex items-center gap-1">🔴 Bloquea pago</span>
                                    </div>
                                  ) : (
                                    <div className="grid grid-cols-2 gap-1.5 text-[12px] font-medium">
                                      <span className="text-green-600 flex items-center gap-1">🟢 Habilitado ingreso</span>
                                      <span className="text-green-600 flex items-center gap-1">🟢 Habilitado trabajo</span>
                                      <span className="text-green-600 flex items-center gap-1">🟢 Habilitado asignación</span>
                                      <span className="text-green-600 flex items-center gap-1">🟢 Habilitado pago</span>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })()}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* 6. Listado de Trabajadores (Solo si es vista empresa) */}
          {currentTipo === 'empresa' && projectWorkersList.length > 0 && (
            <div className="flex flex-col gap-3 border-t border-cream pt-5">
              <h4 className="text-[12px] font-bold uppercase tracking-wider text-gray-400 flex items-center gap-1.5">
                <Users size={14} /> Personal Asignado al Proyecto ({projectWorkersList.length})
              </h4>
              <div className="flex flex-col gap-2">
                {projectWorkersList.map(w => {
                  const wEstado = calcularEstadoTrabajador(w, proyectoId);
                  const wBadgeClass = wEstado === 'aprobado' ? 'b-green' : wEstado === 'rechazado' ? 'b-red' : 'b-yellow';
                  const wStatusLabel = wEstado === 'aprobado' ? 'Habilitado' : wEstado === 'rechazado' ? 'Bloqueado' : 'Pendiente';
                  
                  return (
                    <div 
                      key={w.rut} 
                      onClick={() => { setCurrentTipo('trabajador'); setCurrentTrabajador(w); }}
                      className="p-3 border border-cream3 rounded-xl hover:bg-gray-50/50 transition-colors flex justify-between items-center cursor-pointer text-[13.5px]"
                    >
                      <div>
                        <div className="font-semibold text-navy">{w.nombre}</div>
                        <div className="text-[11.5px] text-gray-400">{w.cargo || 'Operario'} · RUT: {w.rut}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`badge text-[10.5px] ${wBadgeClass}`}>{wStatusLabel}</span>
                        <span className="text-brown text-[11.5px] font-medium hover:underline">Ver Ficha</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

        </div>

      </div>
    </div>
  );
}

export default function FichaAcreditacion(props: FichaAcreditacionProps) {
  if (props.rol === 'contratista' && props.proyectos && props.mandantes && props.onProyectoChange && props.onIrADocumentos && props.onIrATrabajador) {
    return <ContratistaFichaAcreditacion contratista={props.contratista} proyectoId={props.proyectoId} proyectos={props.proyectos} mandantes={props.mandantes} onProyectoChange={props.onProyectoChange} onClose={props.onClose} onIrADocumentos={props.onIrADocumentos} onIrATrabajador={props.onIrATrabajador} />;
  }
  return <LegacyFichaAcreditacion {...props} />;
}
