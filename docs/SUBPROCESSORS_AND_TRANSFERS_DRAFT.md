# Acredita — Inventario de proveedores/subencargados y transferencias (BORRADOR)

Estado: borrador operativo. Requiere verificación contractual y jurídica antes del go-live.

| Proveedor | Uso técnico | Datos potenciales | Evidencia técnica actual | Contrato/DPA | Transferencia / garantía |
| --- | --- | --- | --- | --- | --- |
| Supabase | Base de datos, Auth, Storage, Edge Functions | cuentas, metadatos, documentos, auditoría | proyecto productivo Acredita; región configurada en infraestructura | Pendiente revisar/archivar términos aplicables | Pendiente evaluación jurídica por flujo/destino |
| Vercel | Hosting frontend | tráfico web y metadatos técnicos | producción activa de Acredita | Pendiente revisar/archivar términos aplicables | Pendiente evaluación jurídica |
| Resend (si se habilita) | correo de notificaciones operativas | correo, asunto y contenido de notificación | Edge Function preparada; configuración secreta no verificable desde esta integración | Pendiente | Pendiente |
| Proveedor SMTP de Supabase Auth | invitación/recuperación | correo y contenido de autenticación | Custom SMTP pendiente de configuración definitiva | Pendiente | Pendiente |

## Regla de alta de nuevos proveedores

Antes de incorporar un proveedor que trate datos personales:

1. identificar finalidad y datos;
2. definir rol (proveedor/subencargado u otro);
3. revisar términos/DPA y medidas de seguridad;
4. identificar ubicaciones/destinos relevantes;
5. documentar el mecanismo jurídico aplicable cuando corresponda;
6. registrar autorización/instrucción del responsable si aplica;
7. actualizar ROPA, EIPD y política cuando corresponda;
8. definir baja, devolución/supresión y respuesta a incidentes.

Este documento no afirma por sí solo que una transferencia internacional sea lícita ni selecciona automáticamente un mecanismo jurídico.
