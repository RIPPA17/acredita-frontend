create index if not exists assets_retired_by_idx
  on public.assets(retired_by) where retired_by is not null;
create index if not exists asset_requirement_templates_retired_by_idx
  on public.asset_requirement_templates(retired_by) where retired_by is not null;
