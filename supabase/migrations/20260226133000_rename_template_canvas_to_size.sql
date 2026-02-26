do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'template'
      and column_name = 'canvas_width'
  ) and not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'template'
      and column_name = 'width'
  ) then
    alter table public.template rename column canvas_width to width;
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'template'
      and column_name = 'canvas_height'
  ) and not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'template'
      and column_name = 'height'
  ) then
    alter table public.template rename column canvas_height to height;
  end if;
end
$$;

alter table public.template
  add column if not exists width int,
  add column if not exists height int;

update public.template
set
  width = coalesce(width, 1920),
  height = coalesce(height, 1080)
where width is null
   or height is null;

alter table public.template
  alter column width set default 1920,
  alter column width set not null,
  alter column height set default 1080,
  alter column height set not null;
