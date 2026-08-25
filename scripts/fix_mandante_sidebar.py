from pathlib import Path

p = Path('src/pages/Mandante.tsx')
text = p.read_text()
text = text.replace(
    '<div className="sb-org-sub truncate">Plan Pro · 3 proyectos</div>',
    '<div className="sb-org-sub truncate">{misProyectos.length} proyecto{misProyectos.length === 1 ? \'\' : \'s\'} visible{misProyectos.length === 1 ? \'\' : \'s\'}</div>',
)
text = text.replace(
    '<div className="sb-org-sub">Plan Pro · 3 proyectos activos</div>',
    '<div className="sb-org-sub">{misProyectos.length} proyecto{misProyectos.length === 1 ? \'\' : \'s\'} visible{misProyectos.length === 1 ? \'\' : \'s\'}</div>',
)
p.write_text(text)
