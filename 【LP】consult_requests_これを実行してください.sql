create table if not exists public.consult_requests (id uuid primary key default gen_random_uuid(), created_at timestamptz not null default now(), name text not null, email text not null, phone text, category text not null, summary text not null, agree boolean not null default true, entrance smallint, source text, user_agent text, ip text);
create index if not exists consult_requests_created_at_idx on public.consult_requests (created_at desc);
alter table public.consult_requests enable row level security;
