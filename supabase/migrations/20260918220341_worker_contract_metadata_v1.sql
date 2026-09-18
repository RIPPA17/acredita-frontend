alter table public.workers
  add column if not exists contract_type text,
  add column if not exists contract_start_date date,
  add column if not exists contract_end_date date,
  add column if not exists contract_work_or_task text,
  add column if not exists special_labor_regime text,
  add column if not exists special_labor_regime_detail text;

alter table public.workers
  drop constraint if exists workers_contract_type_check,
  add constraint workers_contract_type_check
    check (contract_type is null or contract_type in ('indefinido','plazo_fijo','obra_faena')),
  drop constraint if exists workers_contract_start_required_check,
  add constraint workers_contract_start_required_check
    check (contract_type is null or contract_start_date is not null),
  drop constraint if exists workers_fixed_term_end_check,
  add constraint workers_fixed_term_end_check
    check (contract_type is distinct from 'plazo_fijo' or contract_end_date is not null),
  drop constraint if exists workers_work_or_task_detail_check,
  add constraint workers_work_or_task_detail_check
    check (
      contract_type is distinct from 'obra_faena'
      or nullif(btrim(contract_work_or_task), '') is not null
    ),
  drop constraint if exists workers_contract_dates_check,
  add constraint workers_contract_dates_check
    check (
      contract_end_date is null
      or contract_start_date is null
      or contract_end_date >= contract_start_date
    ),
  drop constraint if exists workers_special_labor_regime_check,
  add constraint workers_special_labor_regime_check
    check (
      special_labor_regime is null
      or special_labor_regime in (
        'servicios_transitorios',
        'aprendizaje',
        'agricola_temporada',
        'casa_particular',
        'gente_mar_portuario_buceo',
        'artes_espectaculos',
        'deportista_profesional',
        'tripulacion_aerea',
        'plataforma_digital_dependiente',
        'otro'
      )
    ),
  drop constraint if exists workers_special_regime_detail_check,
  add constraint workers_special_regime_detail_check
    check (
      special_labor_regime is distinct from 'otro'
      or nullif(btrim(special_labor_regime_detail), '') is not null
    );
