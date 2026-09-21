# Acredita — Política operativa de revisión humana de decisiones

Estado: control pre-go-live para Ley 21.719. No reemplaza la revisión jurídica final.

Fuente oficial: Ley 19.628 reformada por Ley 21.719, especialmente art. 8 bis y principios de privacidad por diseño/default: https://www.bcn.cl/leychile/navegar?i=1209272

## Principio

Los estados calculados por Acredita consolidan requisitos y revisiones documentales. No deben transformarse en una decisión humana irreversible cuando puedan producir efectos significativos sobre acceso, pago, trabajo o asignación.

La persona afectada o el usuario contratista autorizado debe poder:
1. conocer qué estado automático se está aplicando;
2. pedir intervención humana;
3. aportar su punto de vista y antecedentes adicionales;
4. obtener una revisión fundada;
5. mantener trazabilidad de la decisión posterior.

## Flujo

1. El sistema muestra el bloqueo y su explicación disponible.
2. El Contratista solicita revisión e indica el motivo.
3. La solicitud queda registrada en `privacy_decision_reviews`.
4. Admin Acredita o un gestor autorizado del Mandante revisa evidencia.
5. La persona revisora puede:
   - **confirmar** el resultado automático; o
   - **autorizar una excepción temporal** cuando exista fundamento suficiente.
6. Se registra revisor, fecha, fundamento, alcance y vencimiento.

## Reglas de override

- El override nunca modifica ni borra el documento original.
- El override no convierte un documento rechazado en aprobado.
- El override es temporal: el producto limita actualmente la vigencia a un máximo de 7 días.
- Una excepción de pago sólo afecta pago.
- Una excepción de acceso de empresa no habilita automáticamente a trabajadores bloqueados individualmente.
- El revisor debe registrar fundamento suficiente.
- La base de datos rechaza un override sin valor, fundamento, vencimiento, revisor y fecha de revisión.
- Sólo puede existir una solicitud abierta por acreditación/tipo de decisión en cada momento.

## Uso esperado

El override existe para supuestos como:
- error material o de parametrización;
- antecedente relevante recibido fuera del flujo normal;
- contingencia operacional justificada;
- discrepancia que necesita revisión antes de mantener una medida de alto impacto.

No debe utilizarse para:
- saltarse requisitos por conveniencia;
- sustituir la corrección documental ordinaria;
- habilitar de forma indefinida una empresa o trabajador;
- ocultar una deficiencia de cumplimiento.

## Evidencia

La auditoría debe poder reconstruir:
- estado automático original;
- explicación disponible;
- solicitante;
- motivo y punto de vista aportado;
- revisor;
- decisión humana;
- fundamento;
- vigencia de la excepción;
- estado documental original.

## Gate de aprobación EIPD

La EIPD de acreditación de trabajadores sólo debe aprobarse cuando este flujo esté probado extremo a extremo y se hayan cerrado además minimización/retención, DPA responsable-encargado y transferencias/subencargados.
