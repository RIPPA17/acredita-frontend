-- Un requisito que bloquea una consecuencia operacional no puede ser opcional.
-- Mantiene coherencia entre la configuración del Mandante y las compuertas operativas.
alter table public.requirements
  add constraint requirements_blocking_must_be_required
  check (
    is_required
    or (
      criticality = 'advertencia'
      and not coalesce(blocks_work, false)
      and not coalesce(blocks_assignment, false)
    )
  );
