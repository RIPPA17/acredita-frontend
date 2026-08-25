import type { Verificador } from '../../../types';

const BADGE_CLASS: Record<string, string> = {
  green: 'bg-green-100 text-green-800',
  blue: 'bg-blue-100 text-blue-800',
  gray: 'bg-gray-100 text-gray-600',
};

export default function GeneralConfig({
  verificadores,
  verificadorActualId,
}: {
  verificadores: Verificador[];
  verificadorActualId: string | null;
}) {
  const actual = verificadores.find(item => item.id === verificadorActualId);
  const supervisores = verificadores.filter(item => item.rol === 'supervisor' && item.activo);

  const entorno = [
    { label: 'Backend', help: 'Autenticación, datos de negocio, revisiones y archivos.', value: 'Supabase conectado', color: 'green' },
    { label: 'Persistencia', help: 'Fuente central compartida entre usuarios y dispositivos.', value: 'Postgres + Storage', color: 'blue' },
    { label: 'Revisión', help: 'Las tomas y decisiones se bloquean de forma atómica.', value: 'Multiusuario', color: 'green' },
    { label: 'Despliegue', help: 'Aplicación productiva servida desde Vercel.', value: 'Producción', color: 'blue' },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div>
        <div className="text-[15px] font-bold text-navy">General</div>
        <div className="text-[11.5px] text-gray-400 mt-0.5">Estado operativo de Acredita y de la sesión actual.</div>
      </div>

      <div className="border border-cream3 rounded-xl bg-white overflow-hidden">
        <div className="px-4 py-3 border-b border-cream3">
          <div className="text-[13px] font-bold text-navy">Operación del equipo</div>
          <div className="text-[11px] text-gray-400 mt-0.5">La identidad del revisor proviene de la cuenta autenticada; ya no se selecciona manualmente.</div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-[1.2fr_1fr] gap-3 items-center px-4 py-3.5 border-b border-cream2">
          <div>
            <div className="text-[12.5px] font-semibold text-navy">Revisor de esta sesión</div>
            <div className="text-[11px] text-gray-400 mt-0.5">Firma las decisiones realizadas desde esta sesión.</div>
          </div>
          <div className="text-[13px] font-semibold text-navy">{actual?.nombre || 'Cuenta Acredita autenticada'}</div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-[1.2fr_1fr] gap-3 items-center px-4 py-3.5">
          <div>
            <div className="text-[12.5px] font-semibold text-navy">Supervisores activos</div>
            <div className="text-[11px] text-gray-400 mt-0.5">Cuentas con rol de supervisor en Supabase.</div>
          </div>
          <div><span className={`badge ${supervisores.length > 0 ? BADGE_CLASS.green : BADGE_CLASS.gray}`}>{supervisores.length}</span></div>
        </div>
      </div>

      <div className="border border-cream3 rounded-xl bg-white overflow-hidden">
        <div className="px-4 py-3 border-b border-cream3">
          <div className="text-[13px] font-bold text-navy">Entorno del producto</div>
          <div className="text-[11px] text-gray-400 mt-0.5">Información técnica real de esta versión.</div>
        </div>
        {entorno.map((row, index) => (
          <div key={row.label} className={`grid grid-cols-1 sm:grid-cols-[1.2fr_1fr] gap-3 items-center px-4 py-3.5 ${index < entorno.length - 1 ? 'border-b border-cream2' : ''}`}>
            <div>
              <div className="text-[12.5px] font-semibold text-navy">{row.label}</div>
              <div className="text-[11px] text-gray-400 mt-0.5">{row.help}</div>
            </div>
            <div><span className={`badge ${BADGE_CLASS[row.color]}`}>{row.value}</span></div>
          </div>
        ))}
      </div>

      <div className="bg-gold-soft/40 border border-[#ecdcc4] rounded-lg px-3 py-2.5 text-[12px] text-[#7b5b32] leading-relaxed">
        Vigencia, alertas, obligatoriedad y criticidad siguen perteneciendo al requisito específico de cada proyecto.
      </div>
    </div>
  );
}
