-- ============================================================
-- Worship Support – Initial Schema
-- ============================================================

-- 0) Extensions
create extension if not exists "uuid-ossp" with schema extensions;

-- ============================================================
-- 1) audit_log
-- ============================================================
create table public.audit_log (
  id          uuid primary key default uuid_generate_v4(),
  created_at  timestamptz not null default now(),
  actor_id    uuid references auth.users(id),
  action      text not null,
  entity_type text,
  entity_id   uuid,
  meta        jsonb default '{}'
);

-- ============================================================
-- 2) project
-- ============================================================
create table public.project (
  id          uuid primary key default uuid_generate_v4(),
  name        text not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz,
  deleted_by  uuid references auth.users(id)
);

-- ============================================================
-- 3) template
-- ============================================================
create table public.template (
  id          uuid primary key default uuid_generate_v4(),
  project_id  uuid not null references public.project(id),
  name        text not null,
  type        text not null check (type in ('card-news', 'presentation')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz,
  deleted_by  uuid references auth.users(id)
);

-- ============================================================
-- 4) block (메타 – current_version_id는 뒤에서 ALTER로 추가)
-- ============================================================
create table public.block (
  id                  uuid primary key default uuid_generate_v4(),
  project_id          uuid not null references public.project(id),
  type                text not null,
  name                text not null default '',
  current_version_id  uuid,  -- FK는 타입별 테이블 생성 후 앱 레벨에서 관리
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  deleted_at          timestamptz,
  deleted_by          uuid references auth.users(id)
);

-- ============================================================
-- 5) render (template ↔ block 배치)
-- ============================================================
create table public.render (
  id          uuid primary key default uuid_generate_v4(),
  template_id uuid not null references public.template(id),
  block_id    uuid not null references public.block(id),
  location    jsonb not null default '{"x":0,"y":0,"z":0}',
  size        jsonb not null default '{"width":100,"height":100}',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz,
  deleted_by  uuid references auth.users(id),
  unique (template_id, block_id)
);

-- ============================================================
-- 6) block version tables (타입별)
-- ============================================================

-- 6-a) block_txt
create table public.block_txt (
  id          uuid primary key default uuid_generate_v4(),
  block_id    uuid not null references public.block(id),
  title       text,
  description text,
  content     text not null default '',
  created_at  timestamptz not null default now()
);

-- 6-b) block_image
create table public.block_image (
  id          uuid primary key default uuid_generate_v4(),
  block_id    uuid not null references public.block(id),
  title       text,
  description text,
  image_path  text not null,
  crop        jsonb,
  created_at  timestamptz not null default now()
);

-- 6-c) block_datetime
create table public.block_datetime (
  id          uuid primary key default uuid_generate_v4(),
  block_id    uuid not null references public.block(id),
  title       text,
  description text,
  start_at    timestamptz not null,
  end_at      timestamptz,
  created_at  timestamptz not null default now()
);

-- 6-d) block_song
create table public.block_song (
  id            uuid primary key default uuid_generate_v4(),
  block_id      uuid not null references public.block(id),
  title         text not null,
  description   text,
  reference_url text,
  musical_key   text,
  created_at    timestamptz not null default now()
);

-- 6-e) block_song_list
create table public.block_song_list (
  id            uuid primary key default uuid_generate_v4(),
  block_id      uuid not null references public.block(id),
  title         text,
  description   text,
  reference_url text,
  created_at    timestamptz not null default now()
);

-- 6-f) block_advertisement
create table public.block_advertisement (
  id          uuid primary key default uuid_generate_v4(),
  block_id    uuid not null references public.block(id),
  title       text not null,
  description text not null,
  created_at  timestamptz not null default now()
);

-- 6-g) block_background
create table public.block_background (
  id          uuid primary key default uuid_generate_v4(),
  block_id    uuid not null references public.block(id),
  title       text,
  description text,
  image_path  text not null,
  crop        jsonb,
  created_at  timestamptz not null default now()
);

-- ============================================================
-- 7) composition tables
-- ============================================================

-- 7-a) block_song_list_item
create table public.block_song_list_item (
  id                    uuid primary key default uuid_generate_v4(),
  parent_block_id       uuid not null references public.block(id),
  child_block_id        uuid not null references public.block(id),
  sequence              int not null default 0,
  created_at            timestamptz not null default now()
);

-- 7-b) block_advertisement_item
create table public.block_advertisement_item (
  id                    uuid primary key default uuid_generate_v4(),
  parent_block_id       uuid not null references public.block(id),
  child_block_id        uuid not null references public.block(id),
  sequence              int not null default 0,
  created_at            timestamptz not null default now()
);

-- ============================================================
-- 8) Indexes
-- ============================================================
create index idx_template_project on public.template(project_id) where deleted_at is null;
create index idx_block_project    on public.block(project_id) where deleted_at is null;
create index idx_render_template  on public.render(template_id) where deleted_at is null;
create index idx_render_block     on public.render(block_id);
create index idx_audit_log_entity on public.audit_log(entity_type, entity_id);
create index idx_audit_log_actor  on public.audit_log(actor_id);

create index idx_block_txt_block       on public.block_txt(block_id);
create index idx_block_image_block     on public.block_image(block_id);
create index idx_block_datetime_block  on public.block_datetime(block_id);
create index idx_block_song_block      on public.block_song(block_id);
create index idx_block_song_list_block on public.block_song_list(block_id);
create index idx_block_adv_block       on public.block_advertisement(block_id);
create index idx_block_bg_block        on public.block_background(block_id);

create index idx_song_list_item_parent on public.block_song_list_item(parent_block_id);
create index idx_adv_item_parent       on public.block_advertisement_item(parent_block_id);

-- ============================================================
-- 9) updated_at trigger
-- ============================================================
create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger set_updated_at before update on public.project
  for each row execute function public.handle_updated_at();

create trigger set_updated_at before update on public.template
  for each row execute function public.handle_updated_at();

create trigger set_updated_at before update on public.block
  for each row execute function public.handle_updated_at();

create trigger set_updated_at before update on public.render
  for each row execute function public.handle_updated_at();

-- ============================================================
-- 10) RLS – authenticated only
-- ============================================================
alter table public.audit_log enable row level security;
alter table public.project enable row level security;
alter table public.template enable row level security;
alter table public.block enable row level security;
alter table public.render enable row level security;
alter table public.block_txt enable row level security;
alter table public.block_image enable row level security;
alter table public.block_datetime enable row level security;
alter table public.block_song enable row level security;
alter table public.block_song_list enable row level security;
alter table public.block_advertisement enable row level security;
alter table public.block_background enable row level security;
alter table public.block_song_list_item enable row level security;
alter table public.block_advertisement_item enable row level security;

-- Helper: allow all operations for authenticated users
do $$
declare
  tbl text;
begin
  for tbl in
    select unnest(array[
      'audit_log','project','template','block','render',
      'block_txt','block_image','block_datetime','block_song',
      'block_song_list','block_advertisement','block_background',
      'block_song_list_item','block_advertisement_item'
    ])
  loop
    execute format(
      'create policy "authenticated_select_%1$s" on public.%1$I for select to authenticated using (true)',
      tbl
    );
    execute format(
      'create policy "authenticated_insert_%1$s" on public.%1$I for insert to authenticated with check (true)',
      tbl
    );
    execute format(
      'create policy "authenticated_update_%1$s" on public.%1$I for update to authenticated using (true) with check (true)',
      tbl
    );
  end loop;
end;
$$;
