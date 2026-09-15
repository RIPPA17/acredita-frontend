create index if not exists asset_documents_reviewed_by_idx
on public.asset_documents(reviewed_by)
where reviewed_by is not null;
