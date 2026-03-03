-- ============================================================
-- Project ownership-based RLS
-- ============================================================

alter table public.project
  add column if not exists owner_id uuid references auth.users(id);

update public.project p
set owner_id = coalesce(
  (
    select al.actor_id
    from public.audit_log al
    where al.entity_type = 'project'
      and al.entity_id = p.id
      and al.action = 'project.create'
      and al.actor_id is not null
    order by al.created_at asc
    limit 1
  ),
  p.deleted_by
)
where p.owner_id is null;

alter table public.project
  alter column owner_id set default auth.uid();

create index if not exists idx_project_owner
  on public.project(owner_id)
  where deleted_at is null;

do $$
declare
  tbl text;
begin
  foreach tbl in array array[
    'audit_log','project','template','block','render',
    'block_txt','block_image','block_datetime','block_song',
    'block_song_list','block_advertisement','block_background',
    'block_song_list_item','block_advertisement_item'
  ]
  loop
    execute format('drop policy if exists "authenticated_select_%1$s" on public.%1$I', tbl);
    execute format('drop policy if exists "authenticated_insert_%1$s" on public.%1$I', tbl);
    execute format('drop policy if exists "authenticated_update_%1$s" on public.%1$I', tbl);
  end loop;
end $$;

create policy "owner_select_project"
  on public.project
  for select to authenticated
  using (owner_id = auth.uid());

create policy "owner_insert_project"
  on public.project
  for insert to authenticated
  with check (owner_id = auth.uid());

create policy "owner_update_project"
  on public.project
  for update to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

create policy "owner_select_template"
  on public.template
  for select to authenticated
  using (
    exists (
      select 1
      from public.project p
      where p.id = template.project_id
        and p.owner_id = auth.uid()
    )
  );

create policy "owner_insert_template"
  on public.template
  for insert to authenticated
  with check (
    exists (
      select 1
      from public.project p
      where p.id = template.project_id
        and p.owner_id = auth.uid()
    )
  );

create policy "owner_update_template"
  on public.template
  for update to authenticated
  using (
    exists (
      select 1
      from public.project p
      where p.id = template.project_id
        and p.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.project p
      where p.id = template.project_id
        and p.owner_id = auth.uid()
    )
  );

create policy "owner_select_block"
  on public.block
  for select to authenticated
  using (
    exists (
      select 1
      from public.project p
      where p.id = block.project_id
        and p.owner_id = auth.uid()
    )
  );

create policy "owner_insert_block"
  on public.block
  for insert to authenticated
  with check (
    exists (
      select 1
      from public.project p
      where p.id = block.project_id
        and p.owner_id = auth.uid()
    )
  );

create policy "owner_update_block"
  on public.block
  for update to authenticated
  using (
    exists (
      select 1
      from public.project p
      where p.id = block.project_id
        and p.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.project p
      where p.id = block.project_id
        and p.owner_id = auth.uid()
    )
  );

create policy "owner_select_render"
  on public.render
  for select to authenticated
  using (
    exists (
      select 1
      from public.template t
      join public.project p on p.id = t.project_id
      where t.id = render.template_id
        and p.owner_id = auth.uid()
    )
  );

create policy "owner_insert_render"
  on public.render
  for insert to authenticated
  with check (
    exists (
      select 1
      from public.template t
      join public.project p on p.id = t.project_id
      where t.id = render.template_id
        and p.owner_id = auth.uid()
    )
  );

create policy "owner_update_render"
  on public.render
  for update to authenticated
  using (
    exists (
      select 1
      from public.template t
      join public.project p on p.id = t.project_id
      where t.id = render.template_id
        and p.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.template t
      join public.project p on p.id = t.project_id
      where t.id = render.template_id
        and p.owner_id = auth.uid()
    )
  );

create policy "owner_select_block_txt"
  on public.block_txt
  for select to authenticated
  using (
    exists (
      select 1
      from public.block b
      join public.project p on p.id = b.project_id
      where b.id = block_txt.block_id
        and p.owner_id = auth.uid()
    )
  );

create policy "owner_insert_block_txt"
  on public.block_txt
  for insert to authenticated
  with check (
    exists (
      select 1
      from public.block b
      join public.project p on p.id = b.project_id
      where b.id = block_txt.block_id
        and p.owner_id = auth.uid()
    )
  );

create policy "owner_update_block_txt"
  on public.block_txt
  for update to authenticated
  using (
    exists (
      select 1
      from public.block b
      join public.project p on p.id = b.project_id
      where b.id = block_txt.block_id
        and p.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.block b
      join public.project p on p.id = b.project_id
      where b.id = block_txt.block_id
        and p.owner_id = auth.uid()
    )
  );

create policy "owner_select_block_image"
  on public.block_image
  for select to authenticated
  using (
    exists (
      select 1
      from public.block b
      join public.project p on p.id = b.project_id
      where b.id = block_image.block_id
        and p.owner_id = auth.uid()
    )
  );

create policy "owner_insert_block_image"
  on public.block_image
  for insert to authenticated
  with check (
    exists (
      select 1
      from public.block b
      join public.project p on p.id = b.project_id
      where b.id = block_image.block_id
        and p.owner_id = auth.uid()
    )
  );

create policy "owner_update_block_image"
  on public.block_image
  for update to authenticated
  using (
    exists (
      select 1
      from public.block b
      join public.project p on p.id = b.project_id
      where b.id = block_image.block_id
        and p.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.block b
      join public.project p on p.id = b.project_id
      where b.id = block_image.block_id
        and p.owner_id = auth.uid()
    )
  );

create policy "owner_select_block_datetime"
  on public.block_datetime
  for select to authenticated
  using (
    exists (
      select 1
      from public.block b
      join public.project p on p.id = b.project_id
      where b.id = block_datetime.block_id
        and p.owner_id = auth.uid()
    )
  );

create policy "owner_insert_block_datetime"
  on public.block_datetime
  for insert to authenticated
  with check (
    exists (
      select 1
      from public.block b
      join public.project p on p.id = b.project_id
      where b.id = block_datetime.block_id
        and p.owner_id = auth.uid()
    )
  );

create policy "owner_update_block_datetime"
  on public.block_datetime
  for update to authenticated
  using (
    exists (
      select 1
      from public.block b
      join public.project p on p.id = b.project_id
      where b.id = block_datetime.block_id
        and p.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.block b
      join public.project p on p.id = b.project_id
      where b.id = block_datetime.block_id
        and p.owner_id = auth.uid()
    )
  );

create policy "owner_select_block_song"
  on public.block_song
  for select to authenticated
  using (
    exists (
      select 1
      from public.block b
      join public.project p on p.id = b.project_id
      where b.id = block_song.block_id
        and p.owner_id = auth.uid()
    )
  );

create policy "owner_insert_block_song"
  on public.block_song
  for insert to authenticated
  with check (
    exists (
      select 1
      from public.block b
      join public.project p on p.id = b.project_id
      where b.id = block_song.block_id
        and p.owner_id = auth.uid()
    )
  );

create policy "owner_update_block_song"
  on public.block_song
  for update to authenticated
  using (
    exists (
      select 1
      from public.block b
      join public.project p on p.id = b.project_id
      where b.id = block_song.block_id
        and p.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.block b
      join public.project p on p.id = b.project_id
      where b.id = block_song.block_id
        and p.owner_id = auth.uid()
    )
  );

create policy "owner_select_block_song_list"
  on public.block_song_list
  for select to authenticated
  using (
    exists (
      select 1
      from public.block b
      join public.project p on p.id = b.project_id
      where b.id = block_song_list.block_id
        and p.owner_id = auth.uid()
    )
  );

create policy "owner_insert_block_song_list"
  on public.block_song_list
  for insert to authenticated
  with check (
    exists (
      select 1
      from public.block b
      join public.project p on p.id = b.project_id
      where b.id = block_song_list.block_id
        and p.owner_id = auth.uid()
    )
  );

create policy "owner_update_block_song_list"
  on public.block_song_list
  for update to authenticated
  using (
    exists (
      select 1
      from public.block b
      join public.project p on p.id = b.project_id
      where b.id = block_song_list.block_id
        and p.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.block b
      join public.project p on p.id = b.project_id
      where b.id = block_song_list.block_id
        and p.owner_id = auth.uid()
    )
  );

create policy "owner_select_block_advertisement"
  on public.block_advertisement
  for select to authenticated
  using (
    exists (
      select 1
      from public.block b
      join public.project p on p.id = b.project_id
      where b.id = block_advertisement.block_id
        and p.owner_id = auth.uid()
    )
  );

create policy "owner_insert_block_advertisement"
  on public.block_advertisement
  for insert to authenticated
  with check (
    exists (
      select 1
      from public.block b
      join public.project p on p.id = b.project_id
      where b.id = block_advertisement.block_id
        and p.owner_id = auth.uid()
    )
  );

create policy "owner_update_block_advertisement"
  on public.block_advertisement
  for update to authenticated
  using (
    exists (
      select 1
      from public.block b
      join public.project p on p.id = b.project_id
      where b.id = block_advertisement.block_id
        and p.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.block b
      join public.project p on p.id = b.project_id
      where b.id = block_advertisement.block_id
        and p.owner_id = auth.uid()
    )
  );

create policy "owner_select_block_background"
  on public.block_background
  for select to authenticated
  using (
    exists (
      select 1
      from public.block b
      join public.project p on p.id = b.project_id
      where b.id = block_background.block_id
        and p.owner_id = auth.uid()
    )
  );

create policy "owner_insert_block_background"
  on public.block_background
  for insert to authenticated
  with check (
    exists (
      select 1
      from public.block b
      join public.project p on p.id = b.project_id
      where b.id = block_background.block_id
        and p.owner_id = auth.uid()
    )
  );

create policy "owner_update_block_background"
  on public.block_background
  for update to authenticated
  using (
    exists (
      select 1
      from public.block b
      join public.project p on p.id = b.project_id
      where b.id = block_background.block_id
        and p.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.block b
      join public.project p on p.id = b.project_id
      where b.id = block_background.block_id
        and p.owner_id = auth.uid()
    )
  );

create policy "owner_select_block_song_list_item"
  on public.block_song_list_item
  for select to authenticated
  using (
    exists (
      select 1
      from public.block b
      join public.project p on p.id = b.project_id
      where b.id = block_song_list_item.parent_block_id
        and p.owner_id = auth.uid()
    )
  );

create policy "owner_insert_block_song_list_item"
  on public.block_song_list_item
  for insert to authenticated
  with check (
    exists (
      select 1
      from public.block b
      join public.project p on p.id = b.project_id
      where b.id = block_song_list_item.parent_block_id
        and p.owner_id = auth.uid()
    )
  );

create policy "owner_update_block_song_list_item"
  on public.block_song_list_item
  for update to authenticated
  using (
    exists (
      select 1
      from public.block b
      join public.project p on p.id = b.project_id
      where b.id = block_song_list_item.parent_block_id
        and p.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.block b
      join public.project p on p.id = b.project_id
      where b.id = block_song_list_item.parent_block_id
        and p.owner_id = auth.uid()
    )
  );

create policy "owner_select_block_advertisement_item"
  on public.block_advertisement_item
  for select to authenticated
  using (
    exists (
      select 1
      from public.block b
      join public.project p on p.id = b.project_id
      where b.id = block_advertisement_item.parent_block_id
        and p.owner_id = auth.uid()
    )
  );

create policy "owner_insert_block_advertisement_item"
  on public.block_advertisement_item
  for insert to authenticated
  with check (
    exists (
      select 1
      from public.block b
      join public.project p on p.id = b.project_id
      where b.id = block_advertisement_item.parent_block_id
        and p.owner_id = auth.uid()
    )
  );

create policy "owner_update_block_advertisement_item"
  on public.block_advertisement_item
  for update to authenticated
  using (
    exists (
      select 1
      from public.block b
      join public.project p on p.id = b.project_id
      where b.id = block_advertisement_item.parent_block_id
        and p.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.block b
      join public.project p on p.id = b.project_id
      where b.id = block_advertisement_item.parent_block_id
        and p.owner_id = auth.uid()
    )
  );

create policy "owner_select_audit_log"
  on public.audit_log
  for select to authenticated
  using (actor_id = auth.uid());

create policy "owner_insert_audit_log"
  on public.audit_log
  for insert to authenticated
  with check (actor_id = auth.uid());

create policy "owner_update_audit_log"
  on public.audit_log
  for update to authenticated
  using (actor_id = auth.uid())
  with check (actor_id = auth.uid());
