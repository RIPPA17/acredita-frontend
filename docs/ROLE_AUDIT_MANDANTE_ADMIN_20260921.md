# Acredita — Auditoría funcional Mandante y Acredita/Admin

Fecha técnica: 2026-09-21.

## Resultado

Los flujos funcionales principales de Mandante y Acredita/Admin se consideran cerrados para el piloto técnico. Las limitaciones pendientes son gates de cuenta, infraestructura o aprobación jurídica, no huecos funcionales del portal.

## Portal Mandante

| Proceso | Estado | Implementación / verificación |
| --- | --- | --- |
| Inicio y estado global | Cerrado | Dashboard hidratado desde Supabase; E2E de carga de proyecto. |
| Proyectos | Cerrado | Detalle, contexto, histórico y archivo conservando trazabilidad. |
| Contratistas y subcontratación | Cerrado | Vista por proyecto y jerarquía persistida. |
| Servicios/contratos | Cerrado | Panel operativo por acreditación. |
| Activos | Cerrado | Alta/estado documental/retiro histórico/matriz; E2E de retiro y matriz. |
| Requisitos | Cerrado | Alta, edición, obligatoriedad, criticidad, checklist y categorías; persistencia backend. |
| Períodos | Cerrado | Períodos documentales y controles de cierre/reapertura. |
| Operación | Cerrado | Evaluaciones, planes, pagos y soporte integrados. |
| Estados de pago | Cerrado | Decisión, liberación, pago con referencia, anulación e historial; E2E. |
| Acreditaciones/reportes | Cerrado | Vista consolidada y exportación de paquete. |
| Notificaciones | Cerrado | Campana persistente y preferencias/eventos compartidos. |
| Configuración/permisos | Cerrado | Contexto de organización; autorización efectiva vía membresías/RLS. |
| Responsive | Cerrado | E2E escritorio y 390x844. |
| Separación de roles | Cerrado | E2E impide acceso cruzado Mandante/Contratista. |

## Portal Acredita/Admin

| Proceso | Estado | Implementación / verificación |
| --- | --- | --- |
| Inicio operativo | Cerrado | Métricas y contexto compartido. |
| Cola de revisión | Cerrado | Claims atómicos, aprobación/rechazo y actividad. |
| Acreditaciones | Cerrado | Empresa + 100% trabajadores + vencimientos/bloqueos. |
| Mandantes | Cerrado | Vista consolidada e invitación de administrador Mandante. |
| Contratistas | Cerrado | Gestión/consulta e invitaciones. |
| Proyectos | Cerrado | Vista transversal y acceso al detalle. |
| Verificadores | Cerrado | Equipo real, claims y actividad desde Supabase. |
| Auditoría | Cerrado | Trazabilidad y exportación. |
| Plantillas | Cerrado | Catálogo Supabase y configuración. |
| Solicitudes/accesos | Cerrado | Solicitudes públicas y accesos Mandante. |
| Privacidad | Cerrado técnicamente | Derechos, incidentes, retención, holds, EIPD y revisión humana. Las aprobaciones jurídicas permanecen humanas. |
| Revisión humana | Cerrado técnicamente | Contratista solicita; Admin confirma u otorga excepción temporal trazable; no modifica el documento original. |
| Responsive | Cerrado | E2E escritorio y móvil. |

## Cobertura permanente

La suite CI ejecuta audit de dependencias, TypeScript, tests de dominio, build y Playwright. Incluye flujos Mandante de activos, evaluación, pagos y rol; revisión documental Acredita; invitación Mandante; responsive; y el flujo de revisión humana.

## No incluidos como “defecto funcional”

Los siguientes puntos son gates de go-live y se mantienen fuera de esta auditoría funcional: plan pagado/backups, repositorio privado y branch protection, MFA, correo externo real, protección de contraseñas filtradas y aprobaciones jurídicas de privacidad.
