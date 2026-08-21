-- 찬양팀 콘티 공유 · 데이터베이스 스키마
-- Supabase 대시보드 > SQL Editor 에 붙여넣고 실행하세요.

create extension if not exists "pgcrypto";

-- ─────────────────────────────────────────────
-- 교회 설정 (교회마다 한 줄). 이름은 화면 상단에 표시된다.
-- ─────────────────────────────────────────────
create table if not exists church_setting (
  church     text primary key,              -- main, c2, c3 … (로그인 비밀번호로 정해짐)
  name       text not null default '',      -- 교회/찬양팀 이름
  updated_at timestamptz not null default now()
);

alter table church_setting enable row level security;

-- ─────────────────────────────────────────────
-- 폴더 (콘티를 담는 한 단계 폴더)
-- ─────────────────────────────────────────────
create table if not exists folder (
  id          uuid primary key default gen_random_uuid(),
  church      text not null default 'main',   -- 교회 구분 (로그인 비밀번호로 정해진다)
  name        text not null,
  -- 상위 폴더 (비어있으면 최상위). 폴더 삭제 시 하위 폴더는 액션에서 한 단계 위로 올린다.
  parent_id   uuid references folder(id) on delete set null,
  order_index int  not null default 0,             -- 직접 정렬 순서
  is_favorite boolean not null default false,      -- 즐겨찾기 (홈에 다음 콘티를 띄운다)
  created_by  text not null default '',
  created_at  timestamptz not null default now()
);

create index if not exists folder_parent_idx on folder (parent_id);

-- ─────────────────────────────────────────────
-- 콘티 (한 번의 예배에서 부를 곡 묶음)
-- ─────────────────────────────────────────────
create table if not exists conti (
  id           uuid primary key default gen_random_uuid(),
  church       text not null default 'main',  -- 교회 구분
  title        text not null,
  service_date date not null default current_date,
  note         text not null default '',        -- 콘티 전체 안내사항
  created_by   text not null default '',
  -- 폴더 없으면 null (= 폴더 밖). 폴더 삭제 시 콘티는 폴더 밖으로 나온다.
  folder_id    uuid references folder(id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists conti_service_date_idx on conti (service_date desc);
create index if not exists conti_folder_idx on conti (folder_id);
create index if not exists conti_church_idx on conti (church, service_date desc);
create index if not exists folder_church_idx on folder (church);

-- ─────────────────────────────────────────────
-- 곡
-- ─────────────────────────────────────────────
create table if not exists song (
  id          uuid primary key default gen_random_uuid(),
  conti_id    uuid not null references conti(id) on delete cascade,
  order_index int  not null default 0,
  title       text not null,
  song_key    text not null default '',         -- 곡 키 (G, Am ...)
  bpm         text not null default '',
  memo        text not null default '',         -- 곡별 전체 메모
  lyrics      text not null default '',          -- 가사 (PPT 생성용). 한 줄 = 한 슬라이드
  sheet_layout text not null default 'single'   -- 악보 배치: single | vertical | horizontal | grid
    check (sheet_layout in ('single', 'vertical', 'horizontal', 'grid')),
  created_at  timestamptz not null default now()
);

create index if not exists song_conti_idx on song (conti_id, order_index);

-- ─────────────────────────────────────────────
-- 레퍼런스 (유튜브 링크). 곡당 여러 개 가능
-- ─────────────────────────────────────────────
create table if not exists reference (
  id          uuid primary key default gen_random_uuid(),
  song_id     uuid not null references song(id) on delete cascade,
  order_index int  not null default 0,
  url         text not null,
  label       text not null default '',         -- "원곡", "우리 편곡" 등
  created_at  timestamptz not null default now()
);

create index if not exists reference_song_idx on reference (song_id, order_index);

-- ─────────────────────────────────────────────
-- 악보 파일 (곡당 여러 장 가능). PDF 는 여러 페이지를 가진다.
-- ─────────────────────────────────────────────
create table if not exists sheet (
  id          uuid primary key default gen_random_uuid(),
  song_id     uuid not null references song(id) on delete cascade,
  order_index int  not null default 0,
  storage_path text not null,                   -- supabase storage 안의 경로
  file_name   text not null default '',
  kind        text not null check (kind in ('pdf', 'image')),
  page_count  int  not null default 1,
  created_at  timestamptz not null default now()
);

create index if not exists sheet_song_idx on sheet (song_id, order_index);

-- ─────────────────────────────────────────────
-- 손글씨 메모. (악보 1장 · 페이지 1개 · 작성자 1명) 당 한 줄.
-- strokes 는 0~1 로 정규화된 좌표라 화면 크기가 달라도 그대로 얹힌다.
-- ─────────────────────────────────────────────
create table if not exists annotation (
  id         uuid primary key default gen_random_uuid(),
  sheet_id   uuid not null references sheet(id) on delete cascade,
  page       int  not null default 1,
  author     text not null,
  strokes    jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now(),
  unique (sheet_id, page, author)
);

create index if not exists annotation_sheet_idx on annotation (sheet_id);

-- ─────────────────────────────────────────────
-- RLS: 서버(service role)를 통해서만 접근한다.
-- 정책을 만들지 않으면 anon/authenticated 키로는 아무것도 읽고 쓸 수 없다.
-- ─────────────────────────────────────────────
alter table folder     enable row level security;
alter table conti      enable row level security;
alter table song       enable row level security;
alter table reference  enable row level security;
alter table sheet      enable row level security;
alter table annotation enable row level security;
