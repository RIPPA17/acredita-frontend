from pathlib import Path

p = Path('src/data/supabaseCoreData.ts')
text = p.read_text()
replacements = {
    "readArray<Mandante>('acredita_mandantes', MANDANTES)": "readArray<Mandante>('acredita_mandantes', [])",
    "readArray<Proyecto>('acredita_proyectos', PROYECTOS)": "readArray<Proyecto>('acredita_proyectos', [])",
    "readArray<Contratista>('acredita_contratistas', CONTRATISTAS)": "readArray<Contratista>('acredita_contratistas', [])",
}
for old, new in replacements.items():
    if text.count(old) != 1:
        raise SystemExit(f'Se esperaba una coincidencia para: {old}')
    text = text.replace(old, new, 1)
p.write_text(text)
