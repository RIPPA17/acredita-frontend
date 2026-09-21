# Acredita — Evidencia de simulacros de privacidad

Fecha: 2026-09-21.

## Solicitud de titular ficticia

Se ejecutó un ensayo transaccional en Supabase con datos sintéticos:

1. creación de solicitud ficticia de acceso;
2. paso a verificación de identidad;
3. asignación a personal Acredita;
4. resolución con evidencia sintética;
5. aserción de estado final `resolved`;
6. rollback completo.

Resultado: **PASS**.

## Incidente ficticio

En la misma transacción se ejecutó:

1. registro de incidente S2 sintético;
2. investigación;
3. contención;
4. evaluación de riesgo sintética;
5. decisión de notificación documentada como simulacro;
6. resolución;
7. aserción de estado final `resolved`;
8. rollback completo.

Resultado: **PASS**.

## Persistencia

Filas de prueba persistentes: **0**.

## Alcance

Este ensayo verifica que el modelo de datos y el flujo técnico admiten registro y trazabilidad. No sustituye:

- una evaluación jurídica de una solicitud o incidente real;
- la prueba de comunicaciones externas;
- el cronometraje de plazos legales en un caso real;
- una restauración de backups.
