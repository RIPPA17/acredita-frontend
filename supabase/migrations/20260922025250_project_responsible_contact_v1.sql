alter table public.projects
  add column if not exists responsible_name text,
  add column if not exists responsible_email text,
  add column if not exists responsible_phone text;

comment on column public.projects.responsible_name is 'Nombre del responsable principal del Mandante para el proyecto';
comment on column public.projects.responsible_email is 'Correo de contacto del responsable principal del Mandante';
comment on column public.projects.responsible_phone is 'Teléfono de contacto opcional del responsable principal del Mandante';
