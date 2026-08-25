-- Migration: keep-alive pings to prevent free-tier pausing
-- Date: 2026-08-25
-- Purpose: Old cron was every 48h single-table anon SELECT and could be cached / RLS-blocked,
--          so Supabase still paused after 7d. This table gives the keep-alive endpoint a
--          guaranteed *write* (service_role insert) which always counts as DB activity,
--          plus a cheap index for monitoring. Reads still work even before migration is applied.

create extension if not exists "pgcrypto";

create table if not exists public.keep_alive_pings (
    id uuid primary key default gen_random_uuid(),
    pinged_at timestamptz not null default now(),
    source text not null default 'cron',
    duration_ms integer,
    meta jsonb
);

-- No RLS for this table: service_role inserts must never be blocked and anon count checks
-- should work for the keep-alive probe. Other tables keep their own RLS policies.
alter table public.keep_alive_pings disable row level security;

create index if not exists keep_alive_pings_pinged_at_idx
    on public.keep_alive_pings (pinged_at desc);

-- Keep table small: retain last 1000 pings, drop older (runs on insert)
create or replace function public.trim_keep_alive_pings()
returns trigger as $$
begin
    delete from public.keep_alive_pings
    where id in (
        select id from public.keep_alive_pings
        order by pinged_at desc
        offset 1000
    );
    return new;
end;
$$ language plpgsql;

drop trigger if exists trg_trim_keep_alive_pings on public.keep_alive_pings;
create trigger trg_trim_keep_alive_pings
    after insert on public.keep_alive_pings
    for each row execute function public.trim_keep_alive_pings();

comment on table public.keep_alive_pings is 'Heartbeat writes from /api/keep-alive and GitHub Actions to prevent free-tier pausing';
