-- Los roles cliente no necesitan privilegios de mantenimiento/DDL sobre tablas de aplicación.
-- Se conservan únicamente los privilegios DML que luego son acotados por RLS.
revoke truncate, references, trigger, maintain on all tables in schema public from anon, authenticated;
