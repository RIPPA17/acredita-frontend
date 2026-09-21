# Acredita — Acciones manuales finales de go-live

Fecha: 2026-09-21.

Estas acciones no pueden completarse mediante las integraciones actuales de desarrollo o requieren una decisión/compra del titular de las cuentas.

## Cuenta y repositorio

- [ ] Cambiar `RIPPA17/acredita-frontend` de público a privado.
- [ ] Revisar colaboradores/accesos del repositorio.
- [ ] Proteger `main` para exigir Pull Request y CI verde.
- [ ] Confirmar MFA en GitHub.
- [ ] Confirmar MFA en Supabase.
- [ ] Confirmar MFA en Vercel.

Estado verificado hoy: repositorio público y `main` sin protección.

## Supabase

- [ ] Elegir plan de producción con backups recuperables.
- [ ] Habilitar Leaked Password Protection.
- [ ] Revisar SSL Enforcement.
- [ ] Definir Network Restrictions solo después de tener IP/CIDR administrativas estables.
- [ ] Ejecutar una restauración aislada y registrar RPO/RTO observados.
- [ ] Crear estrategia separada de backup para objetos de Storage.

Security Advisor al 2026-09-21: una advertencia, Leaked Password Protection Disabled.

## Vercel

- [ ] Confirmar plan apto para uso comercial.
- [ ] Confirmar miembros y MFA de la cuenta/equipo.
- [ ] Revisar dominios definitivos antes del primer cliente.

## Correo

La función `dispatch-notification-emails` está activa, con cola, reintentos y autenticación por secreto interno.

- [ ] Confirmar `RESEND_API_KEY` en secretos de Supabase.
- [ ] Confirmar `NOTIFICATION_FROM_EMAIL`.
- [ ] Verificar dominio/remitente en el proveedor.
- [ ] Configurar Custom SMTP de Supabase Auth para invitación/recuperación.
- [ ] Probar con cuentas controladas externas: invitación Mandante, invitación Contratista, recuperación, rechazo, vencimiento, soporte y pago.
- [ ] Revisar entrega/spam.

## Privacidad / contractual

No marcar como aprobado por conveniencia técnica:

- [ ] Aprobar EIPD de trabajadores.
- [ ] Aprobar reglas de retención por categoría.
- [ ] Cerrar DPA/contrato Mandante–Acredita.
- [ ] Validar inventario de proveedores/subencargados y transferencias.
- [ ] Completar identidad societaria y contacto de privacidad.
- [ ] Revisión jurídica final de política pública.

Hasta cerrar estos gates no cargar documentación sensible real ni declarar go-live comercial.
