alter table public.render
  alter column size drop not null,
  alter column size drop default;

update public.render r
set size = null
from public.block b
where r.block_id = b.id
  and b.type = 'background';
