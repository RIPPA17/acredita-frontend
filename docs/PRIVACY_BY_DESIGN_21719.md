# Acredita — Privacidad por Diseño y Ley 21.719

Última revisión técnica: 2026-09-16 (Chile).

> Documento técnico-operacional. No reemplaza revisión jurídica especializada ni determina por sí solo la calidad legal de responsable o encargado en cada contrato.

## 1. Objetivo

Diseñar Acredita para que el tratamiento de datos personales sea limitado, trazable, seguro y compatible con la Ley 21.719. La ley refuerza los derechos de acceso, rectificación, supresión, oposición, portabilidad y bloqueo; exige transparencia, minimización, seguridad, protección desde el diseño y reporte de incidentes cuando corresponda.

Fuentes oficiales de referencia:
- https://www.bcn.cl/leychile/navegar?idNorma=1209272
- https://www.bcn.cl/leychile/navegar?idNorma=141599&idVersion=2026-12-01

## 2. Inventario de datos actualmente tratados

### 2.1 Usuarios y perfiles
Tablas principales: `profiles`, `auth.users`, memberships.

Datos observados:
- nombre completo;
- correo electrónico (Auth);
- teléfono;
- identificadores internos UUID;
- rol, membresía, estado de cuenta;
- timestamps de creación/actualización.

Finalidad técnica: autenticación, autorización, contacto operacional y trazabilidad.

### 2.2 Trabajadores
Tabla principal: `workers`.

Datos observados:
- RUT;
- nombre completo;
- cargo;
- contratista asociado;
- estado activo/inactivo;
- historial temporal.

Riesgo: alto, porque el trabajador es una persona natural identificable y sus documentos pueden contener datos adicionales no estructurados.

### 2.3 Solicitudes e invitaciones
Tablas principales: `access_requests`, `invitations`.

Datos observados:
- nombre;
- empresa;
- RUT;
- email;
- teléfono;
- mensaje libre;
- estado de la solicitud/invitación;
- token hash;
- fechas de envío, expiración y respuesta.

Riesgo: medio/alto por datos identificatorios y texto libre.

### 2.4 Documentos de acreditación
Tablas principales: `documents`, `document_versions`, `document_library`, Storage.

Datos observados/metadatos:
- vínculo con trabajador/empresa/proyecto;
- requisito asociado;
- fechas de emisión y vencimiento;
- nombre original de archivo;
- tipo MIME y tamaño;
- usuario que cargó/revisó;
- motivo, explicación y solución de rechazo;
- metadatos JSON;
- archivo almacenado en bucket privado.

Riesgo: alto. El contenido real del archivo puede incorporar domicilio, firma, datos laborales, previsionales, de salud u otros datos sensibles según el documento exigido.

### 2.5 Operación, soporte y auditoría
Tablas principales: `support_tickets`, `support_ticket_messages`, `operation_attachments`, `audit_logs`, evaluaciones/pagos.

Datos observados:
- autor/usuario relacionado;
- asunto, descripción, resolución y mensajes libres;
- adjuntos;
- decisiones, estados y timestamps;
- actor y acción auditada.

Riesgo: medio/alto, especialmente en campos de texto libre y archivos adjuntos.

## 3. Principios técnicos obligatorios para Acredita

### Minimización
- No agregar campos de datos personales sin una finalidad documentada.
- Evitar almacenar en columnas estructuradas información que ya está contenida en un documento salvo necesidad operacional clara.
- No usar RUT, email o nombre como claves técnicas; usar UUID.
- No copiar contenido de documentos a logs.
- Limitar textos libres cuando exista alternativa con categorías predefinidas.

### Limitación de finalidad
Cada tratamiento debe mapearse a una finalidad explícita. No reutilizar documentos o datos para marketing, scoring u otros fines ajenos a la acreditación sin una base jurídica separada.

### Acceso mínimo
- Mandante: sólo proyectos, contratistas, trabajadores y documentos bajo su ámbito autorizado.
- Contratista: sólo su organización, trabajadores, proyectos y documentación propia.
- Acredita: sólo personal autorizado para revisión/soporte/administración.
- Ningún rol debe acceder por mera condición de `authenticated` sin validación de pertenencia al recurso.

### Trazabilidad
Registrar al menos:
- carga de documento;
- nueva versión;
- visualización/descarga de documentos sensibles;
- aprobación/rechazo;
- modificación de requisitos;
- cambios de permisos/membresías;
- acciones sobre pagos/evaluaciones/planes de acción;
- exportaciones o descargas masivas;
- atención de solicitudes de derechos del titular.

Los logs no deben copiar texto libre innecesario ni contenido documental.

## 4. Modelo de roles legales — decisión contractual pendiente

La ley distingue entre responsable y tercero mandatario/encargado. Técnicamente Acredita debe soportar ambos escenarios.

### Hipótesis operativa recomendada para contratos
- El Mandante podría actuar como responsable respecto de los tratamientos cuyos fines y requisitos documentales define.
- Acredita podría actuar como encargado cuando trate datos estrictamente según instrucciones del Mandante.
- Acredita podría ser responsable respecto de tratamientos propios necesarios para seguridad, autenticación, facturación, soporte, prevención de fraude y administración de su servicio, sujeto a revisión jurídica.

Este reparto debe quedar definido por contrato. No debe codificarse en la aplicación como una conclusión legal universal.

## 5. Matriz técnica de finalidades

| Datos | Finalidad técnica | Acceso esperado | Retención propuesta inicial |
|---|---|---|---|
| Perfil de usuario | acceso, autorización, soporte | usuario + admins autorizados | mientras cuenta activa + período de cierre definido |
| Trabajador/RUT/cargo | acreditación y asignación | contratista, mandante autorizado, Acredita | mientras exista relación/proyecto + período contractual/legal |
| Documento vigente | demostrar cumplimiento | partes autorizadas del proyecto | mientras sea necesario para acreditación y defensa de cumplimiento |
| Versión rechazada/sustituida | trazabilidad | Acredita + partes autorizadas según necesidad | período acotado definido por política |
| Solicitud de acceso | onboarding comercial | Acredita | eliminar/anonimizar solicitudes rechazadas o abandonadas tras período definido |
| Invitación expirada | seguridad/auditoría | Acredita | retención corta salvo necesidad probatoria |
| Ticket/mensaje soporte | resolución y evidencia operativa | participantes autorizados + Acredita | período de soporte definido |
| Audit log | seguridad, responsabilidad y prueba | personal autorizado/partes con derecho | plazo superior al dato operativo sólo si existe justificación documentada |

**Importante:** los plazos anteriores son categorías de política, no plazos legales definitivos. La Ley 21.719 exige conservar datos sólo durante el tiempo necesario para la finalidad, salvo excepción legal o consentimiento aplicable. El plazo concreto debe fijarse por tipo documental y finalidad.

## 6. Retención y eliminación — requerimiento de producto

Acredita debe incorporar una `retention_policy` por clase de información.

Campos mínimos conceptuales:
- categoría de dato/documento;
- finalidad;
- evento que inicia el plazo (`project_closed`, `worker_removed`, `document_expired`, `account_closed`, etc.);
- duración;
- acción final (`delete`, `anonymize`, `review_hold`);
- fundamento/justificación;
- estado de aprobación jurídica;
- fecha de última revisión.

### Reglas técnicas
- No borrar automáticamente información sometida a `legal_hold` o investigación de incidente.
- El borrado debe incluir base de datos y objeto de Storage.
- La anonimización debe ser irreversible a efectos prácticos y eliminar identificadores directos e indirectos razonables.
- Toda ejecución automática debe generar un evento de auditoría.
- Debe existir modo `dry-run` antes de ejecutar una política nueva.

## 7. Derechos del titular — módulo requerido

Crear un módulo interno de solicitudes de privacidad con, al menos:
- acceso;
- rectificación;
- supresión;
- oposición;
- portabilidad;
- bloqueo temporal.

Flujo mínimo:
1. recepción de solicitud;
2. verificación de identidad;
3. identificación de responsable/contrato/proyecto;
4. bloqueo preventivo cuando corresponda;
5. búsqueda de datos asociados al titular;
6. revisión de excepciones/obligaciones de conservación;
7. respuesta;
8. ejecución técnica;
9. auditoría y cierre.

Requerimientos:
- SLA configurable;
- registro de fechas y responsable interno;
- adjuntos de respaldo privados;
- exportación estructurada para acceso/portabilidad;
- evidencias de rectificación/supresión;
- impedir que una solicitud cerrada sea modificada sin dejar trazabilidad.

## 8. Bloqueo temporal

La plataforma debe poder marcar un titular o conjunto de datos como `processing_blocked` mientras una solicitud esté pendiente cuando corresponda.

Efecto técnico esperado:
- impedir usos secundarios o modificaciones no necesarias;
- permitir conservación segura del dato;
- permitir acciones estrictamente necesarias para resolver la solicitud, seguridad o cumplimiento aplicable;
- mostrar advertencia visible a operadores autorizados.

No debe implementarse como borrado.

## 9. Portabilidad

Acredita debe ser capaz de exportar, por titular:
- perfil básico;
- asignaciones;
- proyectos relacionados;
- metadatos documentales;
- historial de estados y decisiones que correspondan al titular;
- referencias a archivos cuando jurídicamente proceda.

Formato técnico recomendado: JSON + CSV para datos tabulares, ZIP para archivos autorizados.

La exportación debe quedar auditada y tener enlace temporal/expirable.

## 10. Transparencia y política pública

Antes del go-live comercial debe existir una página pública/versionada que informe, según corresponda:
- identidad del responsable y/o encargado aplicable;
- canales de contacto;
- categorías de datos tratados;
- finalidades;
- bases de legitimidad definidas jurídicamente;
- destinatarios/categorías de destinatarios;
- transferencias internacionales;
- períodos de conservación;
- derechos del titular y canal para ejercerlos;
- versión y fecha de la política;
- medidas de seguridad descritas a nivel general sin revelar secretos técnicos.

Nunca publicar arquitectura interna, nombres de políticas RLS, claves, rutas sensibles o detalles aprovechables para atacar el sistema.

## 11. Incidentes de seguridad — módulo/procedimiento requerido

La Ley 21.719 contempla reporte cuando una vulneración genere riesgo razonable para derechos y libertades y exige mantener registro del incidente.

Acredita debe registrar:
- fecha/hora de detección;
- fecha/hora estimada de inicio;
- sistemas afectados;
- categorías de datos;
- cantidad aproximada de titulares;
- posible impacto;
- contención aplicada;
- estado de investigación;
- evaluación de riesgo;
- decisión de notificación;
- fecha/canal de comunicación;
- medidas correctivas;
- responsable interno;
- evidencia asociada.

### Severidad técnica inicial
- S1 crítica: acceso o filtración confirmada de documentos personales/sensibles a terceros no autorizados.
- S2 alta: exposición potencial relevante o compromiso de cuenta privilegiada.
- S3 media: incidente contenido sin evidencia de acceso significativo.
- S4 baja: evento sin exposición de datos pero útil para mejora preventiva.

La clasificación técnica no sustituye la evaluación jurídica de obligación de notificar.

## 12. Seguridad por diseño — controles ya presentes

Estado técnico verificado:
- RLS habilitado en tablas `public` de aplicación;
- buckets documentales privados;
- acceso documental ligado a recurso/proyecto/contratista;
- auditoría de acciones sensibles;
- auditoría de visualización/descarga documental;
- restricción reforzada en `operation-files`;
- frontend utiliza publishable key, no `service_role`;
- headers de seguridad en Vercel;
- CI con TypeScript, build, tests de dominio y E2E.

## 13. Seguridad por diseño — controles pendientes prioritarios

P0 antes de documentos sensibles reales:
- activar Leaked Password Protection;
- backups automáticos y estrategia separada para Storage;
- configurar SMTP transaccional propio;
- definir y probar recuperación ante incidente;
- retirar/separar datos demo del entorno comercial.

P1 antes de escala comercial:
- módulo de solicitudes de derechos del titular;
- motor de retención/eliminación con `dry-run`;
- registro formal de incidentes;
- exportación segura para acceso/portabilidad;
- legal hold;
- proceso de revocación de sesiones ante baja o incidente;
- revisión periódica de miembros/roles privilegiados.

P2 madurez:
- alertas de comportamiento anómalo;
- pruebas periódicas de restauración;
- revisión automática de objetos huérfanos en Storage;
- dashboard interno de privacidad/seguridad;
- evaluación periódica de proveedores y transferencias internacionales.

## 14. Proveedores y transferencias

Inventariar como mínimo:
- Supabase;
- Vercel;
- proveedor SMTP;
- herramientas de analítica/monitorización futuras;
- cualquier servicio OCR/IA que llegue a procesar documentos.

Para cada proveedor registrar:
- servicio;
- datos tratados;
- finalidad;
- región/ubicación conocida;
- subencargados relevantes;
- contrato/DPA;
- mecanismo de transferencia internacional aplicable;
- responsable de revisión;
- fecha de revisión.

No enviar documentos reales a servicios de IA/OCR externos sin incorporar previamente ese tratamiento al inventario y revisar contrato, finalidad, retención y transferencia.

## 15. Campos especialmente riesgosos

Revisar primero:
- `workers.rut`;
- nombres y teléfonos de perfiles;
- `access_requests.message`;
- `invitations.message`;
- `document_versions.metadata`;
- nombres originales de archivos;
- motivos/explicaciones de rechazo;
- `support_tickets.description`;
- `support_ticket_messages.body`;
- todos los archivos de Storage.

Regla: no registrar estos textos completos en `audit_logs`, errores de frontend, analytics o logs de observabilidad.

## 16. Criterios de aceptación para implementación

### Derechos del titular
- un admin autorizado puede abrir una solicitud;
- el sistema registra identidad, tipo, fechas y estado;
- el solicitante queda asociado sin exponer información a otros tenants;
- puede generarse un paquete de acceso/portabilidad;
- una supresión ejecutada elimina/anomiza según política y queda auditada;
- el bloqueo temporal impide tratamientos definidos sin destruir el dato.

### Retención
- cada política tiene versión y responsable;
- existe simulación previa;
- no se elimina un registro con `legal_hold`;
- archivos Storage y metadatos se eliminan coordinadamente;
- cada ejecución queda auditada.

### Incidentes
- sólo personal Acredita autorizado puede crear/gestionar incidentes;
- los registros no son visibles a Mandante/Contratista salvo comunicación deliberada;
- existe historial inmutable de estado y decisiones;
- la evidencia está en bucket privado separado o con política específica.

## 17. Decisiones que requieren revisión jurídica antes de producción definitiva

1. Definir, por flujo, quién es responsable y quién encargado.
2. Determinar base de legitimidad de cada tratamiento.
3. Determinar plazos de conservación por tipo documental.
4. Determinar qué documentos pueden contener datos sensibles y si realmente deben solicitarse completos.
5. Redactar contrato de encargo/DPA entre Mandante–Acredita y, si corresponde, Contratista–Acredita.
6. Revisar transferencias internacionales a proveedores tecnológicos.
7. Validar política pública de tratamiento.
8. Definir procedimiento formal de incidentes y comunicaciones.

## 18. Orden de implementación recomendado

1. P0 de seguridad y continuidad.
2. Tabla/módulo de solicitudes de privacidad.
3. Registro de incidentes.
4. Motor de retención en modo simulación.
5. Exportación de acceso/portabilidad.
6. Bloqueo temporal y legal hold.
7. Ejecución de supresión/anominización.
8. Política pública y contratos revisados jurídicamente.
9. Prueba integral con datos ficticios.
10. Piloto real controlado.
