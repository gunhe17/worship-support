do $$
declare
  rec record;
  version_id uuid;
begin
  for rec in
    select id, type
    from public.block
    where deleted_at is null
      and current_version_id is null
  loop
    version_id := null;

    if rec.type = 'txt' then
      insert into public.block_txt (block_id, content)
      values (rec.id, '')
      returning id into version_id;
    elsif rec.type = 'image' then
      insert into public.block_image (block_id, image_path)
      values (rec.id, '')
      returning id into version_id;
    elsif rec.type = 'datetime' then
      insert into public.block_datetime (block_id, start_at)
      values (rec.id, now())
      returning id into version_id;
    elsif rec.type = 'song' then
      insert into public.block_song (block_id, title)
      values (rec.id, '')
      returning id into version_id;
    elsif rec.type = 'song_list' then
      insert into public.block_song_list (block_id)
      values (rec.id)
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
