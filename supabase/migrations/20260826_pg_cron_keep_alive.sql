-- Migration: pg_cron self-healing heartbeat (layer 3)
-- Date: 2026-08-26
-- Purpose: Even with Vercel 05:00 daily + GitHub every 6h, an extended outage
--          of both providers could still hit the 7d free-tier pause. pg_cron
--          runs *inside* Postgres, so the DB wakes itself every 6h regardless
--          of external crons. Best-effort: if pg_cron is not enabled (local dev
--          or plan without it), the DO block logs a NOTICE and the external
--          crons still cover — migration never fails.

-- Extension lives in pg_catalog on Supabase; create if missing
do $do$
begin
    create extension if not exists pg_cron with schema pg_catalog;
exception when others then
    -- Supabase free tier may require enabling via Dashboard → Database → Extensions
    -- Don't fail the migration — external crons are the primary keep-alive
    raise notice 'pg_cron extension not available (enable via Supabase Dashboard → pg_cron): %', sqlerrm;
end
$do$;

-- Schedule the heartbeat. Wrap in DO so permission/duplicate errors don't abort migration.
do $do$
declare
    has_cron boolean;
begin
    select exists(select 1 from pg_extension where extname = 'pg_cron') into has_cron;
    if not has_cron then
        raise notice 'pg_cron not installed — skipping cron.schedule (external crons will handle keep-alive)';
        return;
    end if;

    -- cron schema is created by the extension; check it exists
    if not exists(select 1 from information_schema.schemata where schema_name = 'cron') then
        raise notice 'cron schema not found — skipping schedule';
        return;
    end if;

    -- Remove old schedule if present (idempotent re-run)
    begin
        perform cron.unschedule('keep-alive-heartbeat');
    exception when others then
        -- job didn't exist — ignore
        null;
    end;

    -- Every 6h at minute 0: 00:00, 06:00, 12:00, 18:00 UTC
    perform cron.schedule(
        'keep-alive-heartbeat',
        '0 */6 * * *',
        $$insert into public.keep_alive_pings (source, meta) values ('pg_cron', jsonb_build_object('schedule','0 */6 * * *', 'at', now()));$$
    );
    raise notice 'pg_cron keep-alive-heartbeat scheduled every 6h';
exception when others then
    -- e.g. must be superuser, or pg_cron disabled — don't break deploy
    raise notice 'pg_cron schedule failed (non-fatal, external crons still active): %', sqlerrm;
end
$do$;

comment on extension pg_cron is 'Self-healing keep-alive: DB inserts into keep_alive_pings every 6h';
