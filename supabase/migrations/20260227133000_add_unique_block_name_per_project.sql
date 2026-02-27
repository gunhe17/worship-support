-- Enforce unique block names within a project (excluding soft-deleted rows).
-- Case-insensitive and trim-aware comparison.
-- Existing duplicates are normalized by appending a stable id suffix.

with ranked as (
  select
    id,
    btrim(name) as trimmed_name,
    row_number() over (
      partition by project_id, lower(btrim(name))
      order by created_at, id
    ) as rn
  from public.block
  where deleted_at is null
)
update public.block b
set name = ranked.trimmed_name || ' (' || substr(b.id::text, 1, 8) || ')'
from ranked
where b.id = ranked.id
  and ranked.rn > 1;

create unique index if not exists uq_block_project_name_active
  on public.block (project_id, lower(btrim(name)))
  where deleted_at is null;
