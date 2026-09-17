alter table public.mandantes
  add column if not exists data_environment text not null default 'production'
  check (data_environment in ('demo','pilot','production'));

alter table public.contratistas
  add column if not exists data_environment text not null default 'production'
  check (data_environment in ('demo','pilot','production'));

alter table public.projects
  add column if not exists data_environment text not null default 'production'
  check (data_environment in ('demo','pilot','production'));

alter table public.workers
  add column if not exists data_environment text not null default 'production'
  check (data_environment in ('demo','pilot','production'));

-- El dataset existente al momento de esta migración corresponde a fixtures/demo.
-- Nuevos registros quedan como production por defecto.
update public.mandantes set data_environment = 'demo';
update public.contratistas set data_environment = 'demo';
update public.projects set data_environment = 'demo';
update public.workers set data_environment = 'demo';

comment on column public.mandantes.data_environment is
  'Separates demo/pilot/production records. New records default to production.';
comment on column public.contratistas.data_environment is
  'Separates demo/pilot/production records. New records default to production.';
comment on column public.projects.data_environment is
  'Separates demo/pilot/production records. New records default to production.';
comment on column public.workers.data_environment is
  'Separates demo/pilot/production records. New records default to production.';
