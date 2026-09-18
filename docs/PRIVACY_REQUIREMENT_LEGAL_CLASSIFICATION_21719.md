# Acredita — Clasificación jurídico-operativa de requisitos iniciales

Fecha: 18-09-2026  
Estado: evaluación pre-go-live; las bases definitivas deben quedar validadas por el responsable de cada tratamiento y sus asesores.

## F30-1 DT

**Decisión:** mantener como requisito estándar de empresa cuando exista subcontratación.

- Nombre correcto: Certificado de Cumplimiento de Obligaciones Laborales y Previsionales F30-1, Dirección del Trabajo.
- Finalidad: ejercer el derecho de información y gestionar exposición/estados de pago bajo los arts. 183-C y 183-D del Código del Trabajo.
- Minimización: preferir F30-1 frente a recopilar antecedentes salariales individuales.
- Estado de privacidad: `review`.
- Retención preliminar: 5 años, sujeta a validación jurídica y legal hold.

Fuente DT: https://www.dt.gob.cl/portal/1626/w3-article-100359.html

## ODI

**Decisión:** mantener.

- Finalidad: acreditar que el trabajador recibió información de riesgos, medidas preventivas y procedimientos antes de iniciar labores.
- Sustento principal: DS 44, art. 15, vigente desde 01-02-2025.
- Minimización objetivo: trabajador + faena + fecha/hora + versión/contenido + aceptación, evitando conservar un documento más amplio de lo necesario.
- Estado de privacidad: `review`, estrategia `extract_fields`.

Fuente oficial DS 44: https://www.bcn.cl/leychile/navegar?idNorma=1205298

## Organismo administrador Ley 16.744

**Decisión:** mantener, generalizando la antigua referencia exclusiva a ACHS.

- Puede corresponder a mutualidad o ISL según el caso.
- El DS 76 exige que el registro de faena de la empresa principal incluya el organismo administrador de contratistas/subcontratistas.
- No requiere información clínica de trabajadores.
- Estado: `review`.

Fuente oficial DS 76: https://www.bcn.cl/leychile/navegar?idNorma=246677

## Contrato de trabajo

**Decisión:** no aprobar conservación permanente del contrato completo.

- Finalidad admisible: verificar relación laboral/asignación cuando sea realmente necesaria.
- Riesgo: puede contener remuneración y otros datos no necesarios para el Mandante.
- Estrategia: `verification_only`; mantener resultado/campos mínimos y tratar el binario sólo de forma temporal.
- Estado: `review`.
- El gate de producción impide recopilarlo hasta que esta estrategia esté cerrada.

## Liquidación de sueldo

**Decisión:** retirar del requisito estándar.

- La remuneración permite conocer situación socioeconómica, categoría sensible bajo la Ley 21.719.
- Para acreditar cumplimiento general en subcontratación existe un mecanismo menos intrusivo: F30-1.
- Sólo una excepción contractual/jurídica específica puede justificar su tratamiento.
- Plantilla estándar: inactiva.
- Requisitos demo: opcionales/advertencia.
- Privacidad: `rejected` + `no_collection`.

## Certificado de antecedentes penales

**Decisión:** retirar del requisito estándar.

La Dirección del Trabajo ha sostenido que, como regla general, no corresponde exigirlo y que sólo puede justificarse cuando la ausencia de antecedentes sea absolutamente indispensable para la capacidad o idoneidad de una función concreta.

- Plantilla estándar: inactiva.
- Requisitos demo: opcionales/advertencia.
- Privacidad: `rejected` + `no_collection`.
- Una excepción debe crearse como requisito específico y tener evaluación jurídica propia.

Fuentes DT:
- https://www.dt.gob.cl/legislacion/1624/w3-article-126912.html
- https://www.dt.gob.cl/legislacion/1624/w3-article-127810.html

## Protección técnica asociada

Todo requisito nuevo genera automáticamente una ficha de privacidad en borrador. En proyectos marcados `production`, Supabase bloquea la creación de documentos/versiones si el requisito no está previamente aprobado o si su estrategia es `pending` / `no_collection`.
