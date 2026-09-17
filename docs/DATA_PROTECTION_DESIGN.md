# Acredita — Diseño de protección de datos

Última revisión técnica: 2026-09-16 (Chile).

> Documento de preparación técnica y operativa. No reemplaza la validación jurídica final de contratos, bases de licitud, plazos de conservación ni clasificación responsable/encargado.

## 1. Marco de referencia

La Ley N° 21.719 fue publicada el 13 de diciembre de 2024 y entra en vigencia general el 1 de diciembre de 2026. Acredita debe preparar su operación para, entre otros, los deberes de transparencia, protección desde el diseño y por defecto, seguridad, gestión de incidentes, derechos de titulares y transferencias internacionales.

Referencias oficiales:

- Ley 21.719 / texto reformado de la Ley 19.628: https://www.bcn.cl/leychile/navegar?idNorma=1209272
- Cláusulas contractuales modelo para transferencias internacionales (Res. Ex. RAEX202503748): https://www.bcn.cl/leychile/navegar?idNorma=1219636

## 2. Inventario actual de datos

### Usuarios y cuentas
- Nombre completo.
- Correo electrónico administrado en Supabase Auth.
- Teléfono cuando se registra.
- Membresías y rol: Acredita, Mandante o Contratista.
- Sesiones, identificadores y eventos técnicos de autenticación.

### Trabajadores
- RUT.
- Nombre completo.
- Cargo.
- Contratista al que pertenece.
- Asignaciones a proyectos/servicios.
- Estado de acreditación.
- Documentos y versiones asociados a requisitos del trabajador.

### Mandantes y contratistas
- Razón/nombre social.
- RUT de empresa.
- Contactos y membresías de usuarios.
- Proyectos, servicios, acreditaciones y requisitos.
- Documentación de cumplimiento empresarial.

### Operación y soporte
- Tickets y mensajes.
- Evaluaciones y planes de acción.
- Casos de pago, montos, número de factura y estados.
- Adjuntos operacionales.
- Preferencias y lecturas de notificaciones.

### Trazabilidad y seguridad
- Actor que ejecuta una acción.
- Acción realizada.
- Entidad afectada.
- Proyecto/acreditación asociada.
- Fecha/hora y metadatos mínimos necesarios para investigación y auditoría.

## 3. Datos potencialmente sensibles

Acredita no debe presumir que todos los documentos son datos ordinarios. Dependiendo del requisito configurado por el Mandante, un archivo puede revelar información sensible o especialmente protegida, por ejemplo información de salud o antecedentes cuya naturaleza exija controles reforzados.

Regla de producto: **no solicitar ni conservar datos que no sean estrictamente necesarios para el requisito de acreditación**.

Los campos de texto libre (rechazos, tickets, planes de acción, observaciones) deben evitar reproducir información sensible cuando pueda resolverse mediante categorías estructuradas.

## 4. Modelo de roles de privacidad — hipótesis de trabajo

La clasificación debe cerrarse en contratos antes del go-live comercial.

### Mandante
En muchos flujos será previsiblemente **responsable** respecto de la finalidad de acreditar contratistas/trabajadores, porque define requisitos y los efectos del cumplimiento dentro de su proyecto.

### Contratista
Será previsiblemente **responsable** respecto de datos de sus propios trabajadores que obtiene en su relación laboral y decide remitir a un Mandante/Acredita. Puede existir tratamiento conjunto o encadenado según el requisito.

### Acredita
Para la revisión documental realizada por instrucción del Mandante, el modelo objetivo es operar como **encargado/mandatario de tratamiento** con instrucciones documentadas. Acredita puede ser responsable independiente respecto de datos que trata para finalidades propias, por ejemplo seguridad de la plataforma, administración de cuentas, solicitudes comerciales y cumplimiento de sus propias obligaciones.

No se debe publicar una afirmación absoluta de rol antes de que los contratos Mandante–Acredita y Contratista–Acredita lo reflejen.

## 5. Registro de actividades de tratamiento

Se creó `public.privacy_processing_activities` para mantener un registro estructurado de:

- actividad;
- categorías de titulares;
- categorías de datos;
- posibilidad de datos sensibles;
- finalidad;
- base de licitud;
- fuente;
- destinatarios;
- transferencia internacional;
- país de destino;
- evaluación de rol;
- regla de retención.

Las actividades iniciales quedan en estado `draft` hasta validación contractual/jurídica.

## 6. Bases de licitud

No se fija una base universal para todos los datos de Acredita. Cada actividad/requisito debe asociarse a una base válida según corresponda, entre otras posibles:

- consentimiento cuando sea la base aplicable;
- necesidad para celebrar o ejecutar un contrato;
- obligación legal;
- interés legítimo, con evaluación de que no prevalezcan derechos y libertades del titular;
- ejercicio o defensa de derechos.

La base de licitud debe poder demostrarse. Para requisitos documentales configurables, la ficha del requisito debe terminar incorporando un campo interno de fundamento/base de tratamiento cuando el requisito implique datos personales.

## 7. Derechos de titulares

Se implementó `public.privacy_requests` con los tipos:

- acceso;
- rectificación;
- supresión;
- oposición;
- portabilidad;
- bloqueo.

También se implementó `public.privacy_request_events` como historial append-only de la gestión.

### Flujo operativo

1. Recepción por `/privacidad` o correo designado.
2. Acuse de recibo.
3. Verificación de identidad por un mecanismo proporcional; el formulario inicial no solicita RUT completo por defecto.
4. Identificación del responsable aplicable y del tratamiento/datos involucrados.
5. Revisión de procedencia y de posibles obligaciones legales/contractuales de conservación.
6. Ejecución de la medida o respuesta fundada.
7. Registro de la respuesta y evidencia de su envío.
8. Si corresponde, comunicación de rectificación/supresión/oposición a destinatarios a quienes los datos hayan sido comunicados.

### SLA

- Pronunciamiento general: máximo 30 días corridos desde el ingreso.
- Prórroga: una sola vez, hasta por otros 30 días corridos cuando corresponda.
- Solicitud fundada de bloqueo temporal asociada a rectificación, supresión u oposición: respuesta dentro de 2 días hábiles.

El campo `due_at` registra inicialmente el SLA general de 30 días. Los días hábiles de bloqueo se administran como SLA operacional y no mediante suma automática de 48 horas.

## 8. Retención y eliminación

Se creó `public.privacy_retention_rules`. Las reglas iniciales son deliberadamente `draft` y no tienen plazos numéricos automáticos.

Dominios iniciales:

- solicitudes de acceso/comerciales;
- identificación de trabajadores;
- documentos de trabajadores;
- documentos de empresa;
- soporte y operación;
- auditoría y seguridad.

### Regla de implementación

No activar un borrado automático hasta que cada dominio/tipo documental tenga:

1. evento que inicia el cómputo;
2. plazo aprobado;
3. fundamento;
4. excepción por obligación legal, litigio, reclamo o investigación;
5. tratamiento de copias y Storage;
6. acción final: eliminar, anonimizar o revisar.

Los documentos deben poder tener retención diferenciada por tipo/requisito. La vigencia de un documento y su plazo de conservación son conceptos distintos.

## 9. Bloqueo temporal

Una solicitud de bloqueo no equivale a borrar el dato. Debe suspender el tratamiento relevante manteniendo el almacenamiento.

La tabla de solicitudes registra el pedido y su estado. La aplicación **aún no debe prometer bloqueo técnico total automático** hasta que se modele la relación entre una solicitud y todos los registros/documentos concretos afectados. Este punto es requisito antes del go-live bajo el nuevo régimen.

## 10. Incidentes de seguridad

Se creó `public.privacy_incidents`, accesible sólo por personal Acredita, para registrar:

- fecha de detección;
- severidad y estado;
- categorías de datos;
- estimación de titulares afectados;
- presencia de datos sensibles;
- evaluación de riesgo razonable para derechos/libertades;
- necesidad y fecha de notificación a la Agencia;
- necesidad y fecha de comunicación a titulares;
- contención, causa raíz y medidas correctivas.

### Runbook mínimo

1. Contener el incidente y preservar evidencia.
2. Determinar sistemas, datos y titulares afectados.
3. Determinar el rol de Acredita en ese tratamiento.
4. Si Acredita actúa como encargado, informar al responsable conforme al contrato y sin dilaciones indebidas.
5. Si Acredita actúa como responsable, evaluar riesgo razonable para los derechos/libertades y la procedencia del reporte a la Agencia.
6. Evaluar comunicación directa a titulares cuando corresponda, especialmente en categorías expresamente señaladas por la ley.
7. Documentar decisiones, tiempos y medidas adoptadas.
8. Ejecutar análisis de causa raíz y plan de prevención de recurrencia.

No se adopta un plazo ficticio de 72 horas: la ley chilena utiliza el estándar de reporte sin dilaciones indebidas cuando exista riesgo razonable.

## 11. Transferencias internacionales

El proyecto Supabase de producción está en `sa-east-1`, región de São Paulo, Brasil. Esto debe figurar en el inventario y en la información de transparencia.

Antes de la vigencia de la Ley 21.719 deben revisarse:

- contrato/DPA con Supabase;
- mecanismo aplicable para la transferencia internacional;
- uso de las cláusulas contractuales modelo aprobadas en 2025 cuando corresponda;
- subencargados y ubicaciones de procesamiento;
- Vercel, correo transaccional y cualquier otro proveedor que llegue a tratar datos personales.

No asumir que el código de región por sí mismo acredita cumplimiento de transferencia internacional.

## 12. Controles técnicos ya existentes

- RLS en tablas públicas.
- Buckets de Storage privados.
- Autorización por proyecto/acreditación/organización.
- Auditoría de cambios y accesos documentales.
- Registro de visualización/descarga de documentos.
- Restricción reforzada de `operation-files` al contexto real del adjunto.
- Cabeceras de seguridad en Vercel.
- Validación de contraseña fuerte en flujos propios.

## 13. Controles pendientes antes de documentación sensible real

### Plataforma
- Activar Leaked Password Protection en Supabase Auth.
- Implementar backups de base de datos y copia/estrategia separada para objetos de Storage.
- Configurar SMTP transaccional propio.
- Probar restauración, no sólo existencia de backup.

### Privacidad
- Aprobar formalmente roles responsable/encargado.
- Aprobar bases de licitud por actividad/requisito.
- Aprobar plazos de retención.
- Implementar vínculo de solicitudes de bloqueo con registros concretos afectados.
- Definir responsable interno de privacidad y canal definitivo.
- Completar inventario de proveedores/subencargados y países.
- Preparar cláusulas contractuales de tratamiento y transferencias.
- Publicar política definitiva de tratamiento con razón social, representante, finalidades, bases, destinatarios, retención, transferencias, seguridad y derechos.

## 14. Criterio de aceptación del bloque

Este bloque se considera **técnicamente preparado**, no jurídicamente certificado, cuando:

- existe registro de actividades;
- existe matriz de retención;
- existe canal público y registro de derechos;
- existe historial de cada solicitud;
- existe registro de incidentes;
- RLS protege esos registros;
- las transferencias internacionales están inventariadas;
- los puntos que requieren decisión jurídica/contractual están marcados explícitamente como pendientes y no se automatizan por suposición.
