from pathlib import Path

path = Path('src/pages/Landing.tsx')
text = path.read_text()

replacements = {
    'Vista general de cumplimiento, 18 de mayo 2026': 'Vista de ejemplo · datos ilustrativos',
    'Servicios Integrales Lagos': 'Contratista A',
    'Proyecto Costanera Norte': 'Proyecto 1',
    'Constructora Andrade Ltda': 'Contratista B',
    'Bodega Logística Sur': 'Proyecto 2',
    'Servicios Norte Ltda.': 'Contratista C',
    'Torre Mackenna': 'Proyecto 3',
    'Eléctrica Sur SpA': 'Contratista D',
    'placeholder="Jorge Morales"': 'placeholder="Tu nombre"',
    'placeholder="jorge@empresa.cl"': 'placeholder="nombre@empresa.cl"',
}
for old, new in replacements.items():
    if old not in text:
        raise SystemExit(f'No se encontró texto esperado: {old}')
    text = text.replace(old, new)

start_marker = '      {/* TESTIMONIOS */}'
end_marker = '      {/* CONTACTO */}'
start = text.find(start_marker)
end = text.find(end_marker, start)
if start < 0 or end < 0:
    raise SystemExit('No se encontró la sección de testimonios.')

replacement = '''      {/* CAPACIDADES DEL PRODUCTO */}
      <div className="bg-white py-20 px-12">
        <div className="text-center max-w-[700px] mx-auto">
          <div className="inline-block bg-cream text-brown text-[12.7px] font-semibold tracking-[1.5px] uppercase py-1 px-3 rounded-md mb-4">Qué permite Acredita</div>
          <div className="text-[33px] font-medium leading-[1.2]">Capacidades reales del producto</div>
          <p className="text-[16px] text-[#7a7a6a] leading-relaxed mt-4">
            Sin testimonios ni resultados atribuidos a clientes ficticios. Estas son funciones disponibles en la plataforma para gestionar acreditaciones.
          </p>
        </div>
        <div className="grid md:grid-cols-3 gap-6 max-w-[1000px] mx-auto mt-12">
          <div className="bg-cream2 rounded-xl p-8 border border-cream3">
            <ShieldCheck size={24} className="text-brown mb-4" />
            <div className="text-[17px] font-medium text-navy mb-2">Trazabilidad por proyecto</div>
            <div className="text-[15px] text-[#5a5a4a] leading-relaxed">Consulta el estado de acreditación de empresas y trabajadores dentro de cada proyecto, con sus requisitos y bloqueos asociados.</div>
          </div>
          <div className="bg-cream2 rounded-xl p-8 border border-cream3">
            <Bell size={24} className="text-brown mb-4" />
            <div className="text-[17px] font-medium text-navy mb-2">Vigencias y alertas</div>
            <div className="text-[15px] text-[#5a5a4a] leading-relaxed">Controla documentos mensuales, por proyecto o con vigencias definidas y detecta requisitos próximos a vencer o bloqueados.</div>
          </div>
          <div className="bg-cream2 rounded-xl p-8 border border-cream3">
            <FileText size={24} className="text-brown mb-4" />
            <div className="text-[17px] font-medium text-navy mb-2">Revisión con historial</div>
            <div className="text-[15px] text-[#5a5a4a] leading-relaxed">Registra aprobaciones, rechazos, correcciones y nuevas versiones para que el proceso documental quede visible y auditable.</div>
          </div>
        </div>
      </div>

'''
text = text[:start] + replacement + text[end:]

for forbidden in [
    'Jorge Morales',
    'Patricia Rojas',
    'Cristóbal Araya',
    'Constructora Andina SA',
    'Minera Los Andes',
    'Lo que dicen nuestros clientes',
    '★★★★★',
]:
    if forbidden in text:
        raise SystemExit(f'Quedó referencia ficticia: {forbidden}')

path.write_text(text)
