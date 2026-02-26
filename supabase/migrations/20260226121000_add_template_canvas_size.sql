alter table public.template
  add column if not exists canvas_width int not null default 1920,
  add column if not exists canvas_height int not null default 1080;

update public.template
set
  canvas_width = coalesce(canvas_width, 1920),
  canvas_height = coalesce(canvas_height, 1080)
where canvas_width is null
   or canvas_height is null;

alter table public.template
  alter column canvas_width set not null,
  alter column canvas_height set not null;
