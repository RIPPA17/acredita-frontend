/**
 * @deprecated Importa desde "./businessStore".
 *
 * Este archivo se conserva temporalmente para compatibilidad con pruebas y
 * módulos legados. Acredita ya no usa localStorage como base de datos de negocio:
 * el estado se hidrata desde Supabase y la persistencia se realiza contra el backend.
 */
export * from './businessStore';
