# Inventario de proveedores, subencargados y transferencias — Acredita

Estado: **borrador operativo previo al go-live**. Debe cerrarse con revisión contractual/jurídica antes de usar documentación sensible real.

| Proveedor | Uso en Acredita | Datos potenciales | Región observada | Rol a validar | Acción pendiente |
|---|---|---|---|---|---|
| Supabase | Auth, Postgres, Storage, Edge Functions | cuentas, metadatos de trabajadores, documentos, auditoría | sa-east-1 | subencargado / proveedor tecnológico | revisar DPA, subprocesadores, retención, transferencias y respaldo |
| Vercel | frontend y entrega web | IP, user-agent, logs técnicos; la app consulta Supabase desde el cliente | despliegue observado iad1 | proveedor tecnológico | revisar DPA, logging, transferencias y plan comercial |
| Resend | correo transaccional de notificaciones, si se habilita | correo, asunto y contenido de alertas | por definir según contrato/cuenta | subencargado | verificar dominio, DPA, región, retención y lista de subprocesadores antes de activar |

## Reglas de cierre

1. No asumir que la región del servicio equivale por sí sola al país jurídico de tratamiento.
2. Guardar copia del DPA/condiciones vigentes aceptadas y fecha de revisión.
3. Documentar subprocesadores relevantes y mecanismos de transferencia internacional aplicables.
4. Evitar incluir documentos o datos sensibles completos en correos; los mensajes deben dirigir al portal autenticado.
5. Reevaluar el inventario cada vez que se agregue un proveedor que reciba datos personales.

## Gate

Este inventario está preparado para ser completado, pero **no constituye aprobación jurídica** de transferencias internacionales ni del contrato Mandante–Acredita.
