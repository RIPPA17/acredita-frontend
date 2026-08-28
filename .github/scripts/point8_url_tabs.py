from pathlib import Path


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{label}: se esperaba 1 coincidencia y se encontraron {count}')
    return text.replace(old, new, 1)

changes = [
    (
        'src/pages/Admin.tsx',
        "import { useDataSync } from '../components/DataSyncContext';\n",
        "import { useDataSync } from '../components/DataSyncContext';\nimport { usePortalTab } from '../hooks/usePortalTab';\n",
        'Admin import',
        '  const [activeTab, setActiveTab] = useState("dashboard");',
        "  const [activeTab, setActiveTab] = usePortalTab('admin');",
        'Admin tab',
    ),
    (
        'src/pages/Mandante.tsx',
        "import { useDataSync } from '../components/DataSyncContext';\n",
        "import { useDataSync } from '../components/DataSyncContext';\nimport { usePortalTab } from '../hooks/usePortalTab';\n",
        'Mandante import',
        "  const [activeTab, setActiveTab] = useState('dashboard');",
        "  const [activeTab, setActiveTab] = usePortalTab('mandante');",
        'Mandante tab',
    ),
    (
        'src/pages/Contratista.tsx',
        "import { useDataSync } from '../components/DataSyncContext';\n",
        "import { useDataSync } from '../components/DataSyncContext';\nimport { usePortalTab } from '../hooks/usePortalTab';\n",
        'Contratista import',
        "  const [activeTab, setActiveTab] = useState('dashboard');",
        "  const [activeTab, setActiveTab] = usePortalTab('contratista');",
        'Contratista tab',
    ),
]

for path, import_old, import_new, import_label, state_old, state_new, state_label in changes:
    p = Path(path)
    text = p.read_text()
    text = replace_once(text, import_old, import_new, import_label)
    text = replace_once(text, state_old, state_new, state_label)
    p.write_text(text)
