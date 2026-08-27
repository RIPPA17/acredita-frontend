from pathlib import Path


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if text.count(old) != 1:
        raise SystemExit(f'{label}: se esperaba 1 coincidencia y se encontraron {text.count(old)}')
    return text.replace(old, new, 1)

# Admin
p = Path('src/pages/Admin.tsx')
t = p.read_text()
t = replace_once(
    t,
    "import ContractorInvitationModal from '../components/ContractorInvitationModal';\n",
    "import ContractorInvitationModal from '../components/ContractorInvitationModal';\nimport DataSyncButton from '../components/DataSyncButton';\nimport { useDataSync } from '../components/DataSyncContext';\n",
    'Admin imports',
)
t = replace_once(
    t,
    "export default function AdminPortal() {\n  const navigate = useNavigate();\n  const session = getCurrentSession();",
    "export default function AdminPortal() {\n  const navigate = useNavigate();\n  const session = getCurrentSession();\n  const { revision: dataSyncRevision } = useDataSync();",
    'Admin hook',
)
t = replace_once(t, "  }, [activeTab]);", "  }, [activeTab, dataSyncRevision]);", 'Admin refresh dependency')
t = replace_once(
    t,
    '        <div className="flex min-w-0 items-center gap-2 sm:gap-4">\n          <div className="relative">',
    '        <div className="flex min-w-0 items-center gap-2 sm:gap-4">\n          <DataSyncButton />\n          <div className="relative">',
    'Admin sync button',
)
p.write_text(t)

# Mandante
p = Path('src/pages/Mandante.tsx')
t = p.read_text()
t = replace_once(
    t,
    "import ContractorInvitationModal from '../components/ContractorInvitationModal';\n",
    "import ContractorInvitationModal from '../components/ContractorInvitationModal';\nimport DataSyncButton from '../components/DataSyncButton';\nimport { useDataSync } from '../components/DataSyncContext';\n",
    'Mandante imports',
)
t = replace_once(
    t,
    "export default function MandantePortal() {\n  const session = getCurrentSession();",
    "export default function MandantePortal() {\n  const { revision: dataSyncRevision } = useDataSync();\n  const session = getCurrentSession();",
    'Mandante hook',
)
t = replace_once(
    t,
    "    ? <MandantePortalContent mandanteLogueado={mandanteLogueado} />",
    "    ? <MandantePortalContent mandanteLogueado={mandanteLogueado} dataSyncRevision={dataSyncRevision} />",
    'Mandante prop',
)
t = replace_once(
    t,
    "function MandantePortalContent({ mandanteLogueado }: { mandanteLogueado: Mandante }) {",
    "function MandantePortalContent({ mandanteLogueado, dataSyncRevision }: { mandanteLogueado: Mandante; dataSyncRevision: number }) {",
    'Mandante content signature',
)
t = replace_once(t, "  }, [activeProjectId]);", "  }, [activeProjectId, dataSyncRevision]);", 'Mandante refresh dependency')
t = replace_once(
    t,
    '        <div className="flex items-center gap-4">\n          <div className="relative">',
    '        <div className="flex items-center gap-4">\n          <DataSyncButton />\n          <div className="relative">',
    'Mandante sync button',
)
p.write_text(t)

# Contratista
p = Path('src/pages/Contratista.tsx')
t = p.read_text()
t = replace_once(
    t,
    "import ContratistaNotificaciones from '../components/ContratistaNotificaciones';\n",
    "import ContratistaNotificaciones from '../components/ContratistaNotificaciones';\nimport DataSyncButton from '../components/DataSyncButton';\nimport { useDataSync } from '../components/DataSyncContext';\n",
    'Contratista imports',
)
t = replace_once(
    t,
    "export default function ContratistaPortal() {\n  const navigate = useNavigate();",
    "export default function ContratistaPortal() {\n  const navigate = useNavigate();\n  const { revision: dataSyncRevision } = useDataSync();",
    'Contratista hook',
)
t = replace_once(
    t,
    "  }, [selectedProyectoId, dataRevision, contratistaLogueado.id]);",
    "  }, [selectedProyectoId, dataRevision, contratistaLogueado.id, dataSyncRevision]);",
    'Contratista refresh dependency',
)
t = replace_once(
    t,
    '        <div className="flex items-center gap-4">\n          <div className="relative">',
    '        <div className="flex items-center gap-4">\n          <DataSyncButton />\n          <div className="relative">',
    'Contratista sync button',
)
p.write_text(t)
