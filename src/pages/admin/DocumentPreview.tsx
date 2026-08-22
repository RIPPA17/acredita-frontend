import { Receipt, ShieldCheck, Landmark, FileCheck2, FileText } from 'lucide-react';

/**
 * Renders a realistic-looking mockup of the document being reviewed, built
 * entirely from the real queue item's own fields (empresa, trabajador,
 * título, fecha, folio) — no separate mock dataset. There is no real file
 * storage/backend behind "Cola de revisión", so this stands in for an actual
 * PDF/scan preview: a payslip, certificate, tax form or contract layout
 * chosen from the document's título/categoría, falling back to a generic
 * document card when nothing matches.
 */

type Variant = 'liquidacion' | 'certificado' | 'tributario' | 'contrato' | 'generico';

function matchVariant(s: string): Variant | null {
  if (s.includes('contrato') || s.includes('anexo')) return 'contrato';
  if (s.includes('liquidaci')) return 'liquidacion';
  if (s.includes('sii') || s.includes('f29') || s.includes('f30') || s.includes('declaraci') || s.includes('tributari')) return 'tributario';
  if (s.includes('certificad') || s.includes('odi') || s.includes('mutual') || s.includes('antecedentes') || s.includes('examen') || s.includes('prevenci')) return 'certificado';
  return null;
}

// The document's own título carries the specific intent (e.g. "Anexo Horas
// Extras"); `type` is only a coarse category label ("Liquidación mensual"
// for any Laboral doc) so it's checked second, purely as a fallback.
function detectVariant(title: string, type: string): Variant {
  return matchVariant(title.toLowerCase()) ?? matchVariant(type.toLowerCase()) ?? 'generico';
}

export default function DocumentPreview({ item }: { item: any }) {
  const variant = detectVariant(item.title || '', item.type || '');
  const persona = item.origen === 'Trabajador' ? item.trabajadorNombre : item.emp;
  const personaRut = item.origen === 'Trabajador' ? item.trabajadorRut : item.rut;
  const folio = `${new Date().getFullYear()}-${String(item.docId ?? item.id).padStart(4, '0')}`;

  if (variant === 'liquidacion') {
    const sueldoBase = 650000;
    const gratificacion = Math.round(sueldoBase * 0.25);
    const totalHaberes = sueldoBase + gratificacion;
    const afp = Math.round(totalHaberes * 0.1);
    const salud = Math.round(totalHaberes * 0.07);
    const liquido = totalHaberes - afp - salud;
    const fmt = (n: number) => `$${n.toLocaleString('es-CL')}`;
    return (
      <div className="bg-white border border-gray-300 rounded-[2px] shadow-sm w-full max-w-[420px] p-5 font-mono text-[11px] text-gray-800">
        <div className="text-center border-b border-gray-300 pb-2.5 mb-2.5">
          <Receipt size={20} className="text-brown mx-auto mb-1" />
          <div className="font-bold text-[13px] text-navy">{item.emp}</div>
          <div className="text-[10px] text-gray-500">RUT: {item.rut}</div>
          <div className="text-[11.5px] font-semibold text-navy mt-1.5">LIQUIDACIÓN DE SUELDO</div>
          <div className="text-[10px] text-gray-500">{item.title}</div>
        </div>
        <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 mb-2.5">
          {item.origen === 'Trabajador' ? (
            <>
              <div className="text-gray-500">Trabajador</div>
              <div className="text-right text-navy">{persona}</div>
              <div className="text-gray-500">RUT</div>
              <div className="text-right text-navy">{personaRut}</div>
              <div className="text-gray-500">Cargo</div>
              <div className="text-right text-navy">{item.trabajadorCargo || 'Operario'}</div>
            </>
          ) : (
            <>
              <div className="text-gray-500">Proyecto / Faena</div>
              <div className="text-right text-navy">{item.proyecto}</div>
              <div className="text-gray-500">Tipo</div>
              <div className="text-right text-navy">Planilla mensual</div>
            </>
          )}
        </div>
        <table className="w-full border-t border-gray-200 pt-1.5">
          <tbody>
            <tr><td className="py-0.5 text-gray-600">Sueldo base</td><td className="py-0.5 text-right text-navy">{fmt(sueldoBase)}</td></tr>
            <tr><td className="py-0.5 text-gray-600">Gratificación legal</td><td className="py-0.5 text-right text-navy">{fmt(gratificacion)}</td></tr>
            <tr className="border-t border-gray-200"><td className="py-0.5 text-gray-500">AFP (10%)</td><td className="py-0.5 text-right text-[#9a2020]">-{fmt(afp)}</td></tr>
            <tr><td className="py-0.5 text-gray-500">Salud (7%)</td><td className="py-0.5 text-right text-[#9a2020]">-{fmt(salud)}</td></tr>
            <tr className="border-t border-gray-300 font-bold"><td className="pt-1.5 text-navy">Líquido a pagar</td><td className="pt-1.5 text-right text-navy">{fmt(liquido)}</td></tr>
          </tbody>
        </table>
        <div className="text-center text-[9.5px] text-gray-400 mt-3 pt-2 border-t border-gray-200">Folio {folio} · Emitido {item.time}</div>
      </div>
    );
  }

  if (variant === 'certificado') {
    return (
      <div className="bg-white border-2 border-[#e2d5b3] rounded-[6px] p-6 text-center w-full max-w-[420px] shadow-sm">
        <ShieldCheck size={30} className="text-brown mx-auto" />
        <div className="uppercase tracking-[0.12em] text-[10px] text-gray-500 mt-2.5">Certificado</div>
        <div className="text-[14.5px] font-bold text-navy mt-1 leading-snug">{item.title}</div>
        <div className="text-[11px] text-gray-600 mt-3">Se certifica que</div>
        <div className="text-[13px] font-semibold text-navy">{persona || item.emp}</div>
        {personaRut && <div className="text-[10.5px] text-gray-500 font-mono">RUT {personaRut}</div>}
        <div className="text-[11px] text-gray-600 mt-2 leading-relaxed">
          ha dado cumplimiento a los requisitos correspondientes a<br /><span className="font-medium text-navy">{item.proyecto}</span>.
        </div>
        <div className="mt-4 pt-3 border-t border-dashed border-gray-300 flex justify-center gap-8 text-[10px] text-gray-400">
          <div>Fecha emisión<br /><span className="text-navy font-medium">{item.time}</span></div>
          <div>N° Folio<br /><span className="text-navy font-medium font-mono">{folio}</span></div>
        </div>
      </div>
    );
  }

  if (variant === 'tributario') {
    return (
      <div className="bg-white border border-gray-300 w-full max-w-[420px] p-5 text-[11px] shadow-sm">
        <div className="flex justify-between items-start border-b border-gray-300 pb-2.5 mb-2.5">
          <div className="flex items-center gap-2">
            <Landmark size={18} className="text-brown shrink-0" />
            <div>
              <div className="font-bold text-navy text-[11.5px]">Servicio de Impuestos Internos</div>
              <div className="text-gray-500 text-[10px]">{item.title}</div>
            </div>
          </div>
          <div className="text-right text-gray-500 text-[10px]">
            Folio<br /><span className="font-mono text-navy">{folio}</span>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-x-2 gap-y-1">
          <div className="text-gray-500">Contribuyente</div>
          <div className="text-right text-navy font-medium">{item.emp}</div>
          <div className="text-gray-500">RUT</div>
          <div className="text-right text-navy font-mono">{item.rut}</div>
          <div className="text-gray-500">Proyecto / Faena</div>
          <div className="text-right text-navy">{item.proyecto}</div>
          <div className="text-gray-500">Período tributario</div>
          <div className="text-right text-navy">{item.time}</div>
        </div>
        <div className="mt-3 pt-2.5 border-t border-gray-200 text-[10px] text-gray-500 leading-relaxed">
          Declaración presentada conforme a la normativa vigente del Servicio de Impuestos Internos de Chile.
        </div>
      </div>
    );
  }

  if (variant === 'contrato') {
    return (
      <div className="bg-white border border-gray-300 w-full max-w-[420px] p-5 text-[11px] shadow-sm">
        <div className="flex items-center gap-2 border-b border-gray-300 pb-2.5 mb-2.5">
          <FileCheck2 size={18} className="text-brown shrink-0" />
          <div>
            <div className="font-bold text-navy text-[11.5px]">{item.title}</div>
            <div className="text-gray-500 text-[10px]">{item.proyecto}</div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-x-2 gap-y-1 mb-2.5">
          <div className="text-gray-500">Empleador</div>
          <div className="text-right text-navy">{item.emp}</div>
          {item.origen === 'Trabajador' ? (
            <>
              <div className="text-gray-500">Trabajador</div>
              <div className="text-right text-navy">{persona}</div>
              <div className="text-gray-500">Cargo</div>
              <div className="text-right text-navy">{item.trabajadorCargo || '—'}</div>
            </>
          ) : (
            <>
              <div className="text-gray-500">Faena</div>
              <div className="text-right text-navy">{item.proyecto}</div>
            </>
          )}
        </div>
        <div className="space-y-1.5 text-gray-600 text-[10.5px] leading-relaxed border-t border-gray-200 pt-2.5">
          <p><span className="font-semibold text-navy">Primero:</span> El trabajador se compromete a prestar servicios personales en la faena indicada.</p>
          <p><span className="font-semibold text-navy">Segundo:</span> El empleador se compromete a cumplir con las condiciones legales vigentes de remuneración y previsión.</p>
        </div>
        <div className="text-center text-[9.5px] text-gray-400 mt-3 pt-2 border-t border-gray-200">Folio {folio} · Suscrito {item.time}</div>
      </div>
    );
  }

  return (
    <div className="bg-[#eeeade] border border-dashed border-[#dedad1] rounded-xl flex flex-col items-center justify-center h-[230px] w-full max-w-[400px] p-6 gap-3 shadow-sm">
      <FileText size={44} className="text-brown opacity-85" />
      <div className="text-[13px] font-bold text-navy text-center font-mono">{item.title}.pdf</div>
      <div className="text-[11.5px] text-gray-500 text-center font-sans">Vista previa del documento cargado por el contratista</div>
      <div className="text-[10.5px] text-[#639922] bg-[#f0fbf0] border border-[#d4f0de] font-semibold rounded-full px-3 py-0.5 mt-1">
        ✓ Archivo Digitalizado Correctamente
      </div>
    </div>
  );
}
