from pathlib import Path

p = Path('src/pages/Landing.tsx')
t = p.read_text()
start_marker = '      {/* FOOTER */}'
end_marker = '      {/* LOGIN MODAL */}'
start = t.find(start_marker)
end = t.find(end_marker, start)
if start < 0 or end < 0:
    raise SystemExit('No se encontró el footer esperado')

replacement = '''      {/* FOOTER */}
      <footer className="bg-brown py-10 px-12 text-cream">
        <div className="grid md:grid-cols-3 gap-8 max-w-[1200px] mx-auto mb-8">
          <div>
            <div className="text-[22px] tracking-[2px] mb-4 text-cream">Acre<b className="text-navy font-normal">dita</b></div>
            <p className="text-[14.3px] text-white/70 leading-[1.6] max-w-[300px]">Gestión de acreditaciones para mandantes, contratistas y trabajadores por proyecto.</p>
          </div>
          <div>
            <h5 className="text-[13.2px] tracking-[1.5px] uppercase text-white/50 mb-4 font-semibold">Producto</h5>
            <div className="flex flex-col gap-2.5 text-[14.3px] text-white/80">
              <a href="#como-funciona" className="hover:text-cream transition-colors">Cómo funciona</a>
              <a href="#beneficios" className="hover:text-cream transition-colors">Beneficios</a>
              <a href="#contacto" className="hover:text-cream transition-colors">Solicitar demo</a>
            </div>
          </div>
          <div>
            <h5 className="text-[13.2px] tracking-[1.5px] uppercase text-white/50 mb-4 font-semibold">Acceso</h5>
            <div className="flex flex-col gap-2.5 text-[14.3px] text-white/80">
              <Link to="/login" className="hover:text-cream transition-colors">Iniciar sesión</Link>
              <Link to="/registro?rol=mandante" className="hover:text-cream transition-colors">Solicitar acceso</Link>
              <a href="#contacto" className="hover:text-cream transition-colors">Contacto</a>
            </div>
          </div>
        </div>
        <div className="border-t border-white/20 pt-6 text-[13.2px] text-white/60 max-w-[1200px] mx-auto">
          <p>© 2026 Acredita · Santiago, Chile</p>
        </div>
      </footer>
'''

t = t[:start] + replacement + t[end:]
for item in [
    'No disponible en demo',
    'Nosotros</span>',
    'Blog</span>',
    'Trabaja con nosotros',
    'Términos de uso',
    'Privacidad</span>',
    'Seguridad</span>',
    'Cookies</span>',
]:
    if item in t:
        raise SystemExit(f'Quedó elemento muerto en Landing: {item}')

p.write_text(t)
