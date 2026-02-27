-- background mode: choose exactly one source (color or image)
alter table public.block_background
  add column if not exists mode text;

update public.block_background
set image_path = null
where image_path is not null
  and btrim(image_path) = '';

update public.block_background
set color = null
where color is not null
  and btrim(color) = '';

update public.block_background
set mode = case
  when nullif(btrim(coalesce(image_path, '')), '') is not null then 'image'
  when nullif(btrim(coalesce(color, '')), '') is not null then 'color'
  else 'color'
end
where mode is null;

update public.block_background
set color = '#000000'
where mode = 'color'
  and nullif(btrim(coalesce(color, '')), '') is null;

update public.block_background
set image_path = null
where mode = 'color';

update public.block_background
set color = null
where mode = 'image';

alter table public.block_background
  alter column mode set not null;

alter table public.block_background
  drop constraint if exists block_background_image_or_color_check;

alter table public.block_background
  drop constraint if exists block_background_mode_check;

alter table public.block_background
  add constraint block_background_mode_check
  check (
    (
      mode = 'color'
      and nullif(btrim(coalesce(color, '')), '') is not null
      and nullif(btrim(coalesce(image_path, '')), '') is null
    )
    or
    (
      mode = 'image'
      and nullif(btrim(coalesce(image_path, '')), '') is not null
      and nullif(btrim(coalesce(color, '')), '') is null
    )
  );
