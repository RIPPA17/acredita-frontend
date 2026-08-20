export default function ContratistasTab({
  EMPRESAS_CONTRATISTAS,
  setClienteSeleccionado,
}: {
  EMPRESAS_CONTRATISTAS: any[];
  setClienteSeleccionado: (v: any) => void;
}) {
  return (
    <div className="fade-in">
      <div className="page-header">
        <div>
          <h2 className="page-title">Contratistas</h2>
          <p className="page-sub">Empresas contratistas y subcontratistas asignadas a proyectos</p>
        </div>
        <select className="form-input py-1.5 min-w-[200px]">
          <option>Todos los proyectos</option>
          <option>Proyecto Costanera Norte</option>
          <option>Proyecto Minera Los Andes</option>
          <option>Ampliación Planta Solar</option>
        </select>
      </div>

      <div className="card max-w-full overflow-x-auto p-0">
        <table className="w-full text-left">
          <thead>
            <tr>
              <th className="px-4 py-3 border-b border-cream3 text-[13.2px] text-gray-600 bg-cream2 font-medium">Empresa</th>
              <th className="px-4 py-3 border-b border-cream3 text-[13.2px] text-gray-600 bg-cream2 font-medium">RUT</th>
              <th className="px-4 py-3 border-b border-cream3 text-[13.2px] text-gray-600 bg-cream2 font-medium">Rol</th>
              <th className="px-4 py-3 border-b border-cream3 text-[13.2px] text-gray-600 bg-cream2 font-medium">Proyectos Asignados</th>
              <th className="px-4 py-3 border-b border-cream3 text-[13.2px] text-gray-600 bg-cream2 font-medium">Estado</th>
              <th className="px-4 py-3 border-b border-cream3 text-[13.2px] text-gray-600 bg-cream2 font-medium">Cumplimiento</th>
            </tr>
          </thead>
          <tbody>
            {EMPRESAS_CONTRATISTAS.map((c, i) => (
              <tr
                key={i}
                onClick={() => setClienteSeleccionado(c)}
                className="hover:bg-gray-50 border-b border-cream cursor-pointer"
              >
                <td className="px-4 py-3 text-[14.3px]"><div className="font-medium text-navy">{c.empresa}</div></td>
                <td className="px-4 py-3 text-[14.3px] text-gray-600">{c.rut}</td>
                <td className="px-4 py-3 text-[14.3px]">
                  <span className={`badge ${c.rol === "Subcontratista" ? "border border-cream3 bg-cream2 text-gray-600" : "border border-cream3 bg-white text-gray-700"}`}>
                    {c.rol}
                  </span>
                </td>
                <td className="px-4 py-3 text-[14.3px]">
                  <div className="flex flex-wrap gap-1">
                    {c.proyectos.map((p: string, j: number) => (
                      <span key={j} className="badge b-gray bg-cream">{p}</span>
                    ))}
                  </div>
                </td>
                <td className="px-4 py-3 text-[14.3px]">
                  <span className="badge b-green bg-green-100 text-green-800">{c.estado}</span>
                </td>
                <td className="px-4 py-3 text-[14.3px]">
                  <span className={`badge ${c.cumplimiento === "100% Aprobado" ? "b-green bg-green-100 text-green-800" : c.cumplimiento?.includes("Vencido") ? "b-red bg-red-100 text-red-800" : "bg-yellow-100 text-yellow-800 border-none"}`}>
                    {c.cumplimiento}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
