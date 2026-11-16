-- ORTHOHIN '27 Portal — Supabase PostgreSQL Schema
-- Project: orthohin-27-2.0- (ypoetsrjbdgzobrxbkfl)
-- Run this script once in your Supabase Dashboard -> SQL Editor -> New Query

create table if not exists public.batchmates (
  id text primary key,
  name text not null,
  roll text not null,
  "group" text not null default 'Batchmate',
  social text,
  quote text,
  photo text,
  registered_at text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_batchmates_created_at on public.batchmates (created_at desc);

create table if not exists public.notices (
  id text primary key,
  title text not null,
  message text not null,
  category text not null default 'General',
  pinned boolean not null default false,
  active boolean not null default true,
  created_at text not null,
  updated_at timestamptz not null default now()
);

create index if not exists idx_notices_updated_at on public.notices (updated_at desc);

create table if not exists public.gallery_items (
  id text primary key,
  src text not null default '',
  title text not null,
  caption text not null default '',
  date text,
  is_video boolean not null default false,
  video_url text,
  sort_order integer not null default 0,
  updated_at timestamptz not null default now()
);

create index if not exists idx_gallery_sort_order on public.gallery_items (sort_order asc);

create table if not exists public.hoodie_orders (
  id text primary key,
  customer_name text not null,
  roll text not null,
  size text not null default 'L',
  quantity integer not null default 1,
  contact text not null,
  notes text,
  status text not null default 'Pending',
  created_at timestamptz not null default now()
);

create index if not exists idx_hoodie_orders_created_at on public.hoodie_orders (created_at desc);

create table if not exists public.portal_settings (
  id text primary key,
  profile text not null default '',
  hoodie_config jsonb not null,
  site_config jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.activity_logs (
  id text primary key,
  user_uid text,
  action text not null,
  detail text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_activity_logs_created_at on public.activity_logs (created_at desc);

-- Optional Production Hardening:
-- Once you add SUPABASE_SERVICE_ROLE_KEY to your server environment secrets,
-- uncomment the statements below to lock direct client PostgREST access with RLS:
-- alter table public.batchmates enable row level security;
-- alter table public.notices enable row level security;
-- alter table public.gallery_items enable row level security;
-- alter table public.hoodie_orders enable row level security;
-- alter table public.portal_settings enable row level security;
-- alter table public.activity_logs enable row level security;
