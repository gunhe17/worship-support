-- block: remove name default, enforce current_version_id not null
alter table public.block
  alter column name drop default;

do $$
declare
  rec record;
  version_id uuid;
begin
  for rec in
    select id, type
    from public.block
    where current_version_id is null
      and deleted_at is null
  loop
    version_id := null;

    if rec.type = 'txt' then
      insert into public.block_txt (block_id, title, content)
      values (rec.id, '', '')
      returning id into version_id;
    elsif rec.type = 'image' then
      insert into public.block_image (block_id, title, image_path)
      values (rec.id, '', '')
      returning id into version_id;
    elsif rec.type = 'datetime' then
      insert into public.block_datetime (block_id, title, start_at)
      values (rec.id, '', now())
      returning id into version_id;
    elsif rec.type = 'song' then
      insert into public.block_song (block_id, title)
      values (rec.id, '')
      returning id into version_id;
    elsif rec.type = 'song_list' then
      insert into public.block_song_list (block_id, title)
      values (rec.id, '')
      returning id into version_id;
    elsif rec.type = 'advertisement' then
      insert into public.block_advertisement (block_id, title, description)
      values (rec.id, '', '')
      returning id into version_id;
    elsif rec.type = 'background' then
      insert into public.block_background (block_id, image_path)
      values (rec.id, '')
      returning id into version_id;
    end if;

    if version_id is not null then
      update public.block
      set current_version_id = version_id
      where id = rec.id;
    end if;
  end loop;
end
$$;

alter table public.block
  alter column current_version_id set not null;

-- block_txt
update public.block_txt set title = '' where title is null;
alter table public.block_txt
  alter column title set not null,
  alter column content drop default;

-- block_image
update public.block_image set title = '' where title is null;
alter table public.block_image
  alter column title set not null;

-- block_datetime
update public.block_datetime set title = '' where title is null;
alter table public.block_datetime
  alter column title set not null;

-- block_song_list
update public.block_song_list set title = '' where title is null;
alter table public.block_song_list
  alter column title set not null;

-- block_background
alter table public.block_background
  add column if not exists color text;

alter table public.block_background
  alter column image_path drop not null;

update public.block_background
set image_path = null
where image_path is not null
  and btrim(image_path) = '';

update public.block_background
set color = '#000000'
where nullif(btrim(coalesce(image_path, '')), '') is null
  and nullif(btrim(coalesce(color, '')), '') is null;

alter table public.block_background
  drop column if exists title,
  drop column if exists description;

alter table public.block_background
  drop constraint if exists block_background_image_or_color_check;

alter table public.block_background
  add constraint block_background_image_or_color_check
  check (
    nullif(btrim(coalesce(image_path, '')), '') is not null
    or nullif(btrim(coalesce(color, '')), '') is not null
  );
