import { Trash2, Plus } from 'lucide-react';
import { saveReglas } from '../../data/localStorageDb';

type Regla = {
  id: number;
  documento: string;
  diasVigencia: number;
  alertaDias: number;
  criticidad: "bloquea_pago" | "bloquea_acceso" | "advertencia";
  isNew?: boolean;
};

export default function ReglasTab({
  reglas,
  setReglas,
}: {
  reglas: Regla[];
  setReglas: (v: Regla[]) => void;
}) {
  const hasError = reglas.some(r => r.alertaDias >= r.diasVigencia);

  return (
    <div className="fade-in">
      <div className="page-header">
        <div>
          <h2 className="page-title">Reglas de vigencia</h2>
          <p className="page-sub">
            Define la caducidad global por tipo de documento y alertas
            automatizadas.
          </p>
        </div>
        <button
          onClick={() => { saveReglas(reglas); alert("Cambios guardados con éxito"); }}
          disabled={hasError}
          className={`btn btn-primary ${hasError ? 'opacity-50 pointer-events-none' : ''}`}
        >
          Guardar cambios
        </button>
      </div>

      <div className="card p-0 overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr>
              <th className="px-4 py-3 border-b border-cream3 text-[13.2px] text-gray-600 bg-cream2 font-medium">
                Tipo de documento
              </th>
              <th className="px-4 py-3 border-b border-cream3 text-[13.2px] text-gray-600 bg-cream2 font-medium">
                Días de vigencia
              </th>
              <th className="px-4 py-3 border-b border-cream3 text-[13.2px] text-gray-600 bg-cream2 font-medium">
                Alerta anticipada (días)
              </th>
              <th className="px-4 py-3 border-b border-cream3 text-[13.2px] text-gray-600 bg-cream2 font-medium">
                Criticidad
              </th>
              <th className="px-4 py-3 border-b border-cream3 text-[13.2px] text-gray-600 bg-cream2 font-medium">
                Efecto
              </th>
              <th className="px-4 py-3 border-b border-cream3 text-[13.2px] text-gray-600 bg-cream2 font-medium text-right">
                Acciones
              </th>
            </tr>
          </thead>
          <tbody>
            {reglas.map(regla => (
              <tr key={regla.id} className="border-b border-cream">
                <td className="px-4 py-4 text-[14.3px] font-medium text-navy">
                  {regla.isNew ? (
                    <input
                      type="text"
                      className="form-input w-full min-w-[150px]"
                      placeholder="Nombre de documento..."
                      value={regla.documento}
                      onChange={(e) => setReglas(reglas.map(r => r.id === regla.id ? { ...r, documento: e.target.value } : r))}
                    />
                  ) : (
                    <span>{regla.documento}</span>
                  )}
                </td>
                <td className="px-4 py-4">
                  <input
                    type="number"
                    className="form-input w-24"
                    value={regla.diasVigencia}
                    onChange={(e) => setReglas(reglas.map(r => r.id === regla.id ? { ...r, diasVigencia: Number(e.target.value) } : r))}
                  />
                </td>
                <td className="px-4 py-4">
                  <input
                    type="number"
                    className={`form-input w-24 ${regla.alertaDias >= regla.diasVigencia ? "outline outline-1 outline-red-400 border-red-400" : ""}`}
                    value={regla.alertaDias}
                    onChange={(e) => setReglas(reglas.map(r => r.id === regla.id ? { ...r, alertaDias: Number(e.target.value) } : r))}
                  />
                </td>
                <td className="px-4 py-4">
                  <select
                    className="form-input w-full min-w-[160px]"
                    value={regla.criticidad}
                    onChange={(e) => setReglas(reglas.map(r => r.id === regla.id ? { ...r, criticidad: e.target.value as any } : r))}
                  >
                    <option value="bloquea_pago">Bloquea pago</option>
                    <option value="bloquea_acceso">Bloquea acceso</option>
                    <option value="advertencia">Solo advertencia</option>
                  </select>
                </td>
                <td className="px-4 py-4">
                  {regla.criticidad === "bloquea_pago" && <span className="badge bg-yellow-100 text-yellow-800">⚠ Bloquea pago</span>}
                  {regla.criticidad === "bloquea_acceso" && <span className="badge bg-red-100 text-red-800">✕ Bloquea acceso</span>}
                  {regla.criticidad === "advertencia" && <span className="badge bg-gray-100 text-gray-600">~ Solo aviso</span>}
                </td>
                <td className="px-4 py-4 text-right">
                  <button
                    onClick={() => setReglas(reglas.filter(r => r.id !== regla.id))}
                    className="text-gray-400 hover:text-red-500"
                  >
                    <Trash2 size={16} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="p-4 border-t border-cream">
          <button
            onClick={() => setReglas([...reglas, { id: Date.now(), documento: "", diasVigencia: 30, alertaDias: 7, criticidad: "advertencia", isNew: true }])}
            className="btn btn-ghost btn-sm mt-2"
          >
            <Plus size={14} className="mr-1" /> Añadir nueva regla
          </button>
        </div>
      </div>
    </div>
  );
}
