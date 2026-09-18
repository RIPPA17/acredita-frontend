# Acredita — Matriz de privacidad por requisito

Estado: control pre-go-live para Ley 21.719.

Cada requisito documental configurado por un Mandante debe tener una evaluación propia antes de utilizarse con datos reales. El sistema no presume que un documento completo sea necesario ni que una base de licitud sea aplicable solo porque el requisito exista.

## Campos de evaluación
- finalidad específica;
- base de licitud;
- necesidad y proporcionalidad;
- estrategia de minimización;
- posible presencia de datos sensibles o especialmente protegidos;
- destinatarios;
- efectos del incumplimiento (acceso, pago, trabajo, asignación);
- revisión humana;
- mecanismo de override/corrección;
- regla de retención;
- referencia de instrucción del Mandante;
- notas y aprobación.

## Estrategias de minimización
1. `full_document_justified`: el documento completo es necesario y la justificación queda registrada.
2. `extract_fields`: solo deben conservarse los campos estrictamente necesarios.
3. `verification_only`: verificar la condición sin conservar el documento.
4. `no_collection`: eliminar el requisito de recopilación.
5. `pending`: no está listo para producción.

## Gate técnico de aprobación
La base de datos bloquea `status='approved'` mientras falte cualquiera de estos elementos:
- minimización definida;
- evaluación de datos sensibles;
- al menos un destinatario;
- regla de retención;
- revisión humana;
- override documentado cuando el requisito tiene efecto sobre acceso/pago/trabajo/asignación;
- base de licitud cerrada;
- necesidad/proporcionalidad cerrada.

## Estado inicial al 18-09-2026
Los requisitos existentes fueron cargados como **borrador**. Las bases jurídicas no fueron inventadas automáticamente. Los requisitos cuyo nombre sugiere una revisión reforzada (por ejemplo, certificados de antecedentes o documentos de salud) quedan marcados para análisis específico antes de producción.

Este control complementa el ROPA general y la EIPD de acreditación de trabajadores.
