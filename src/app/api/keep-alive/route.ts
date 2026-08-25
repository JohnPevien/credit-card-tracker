import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

const KEEP_ALIVE_TABLES = [
    "persons",
    "credit_cards",
    "purchases",
    "transactions",
] as const;
const KEEP_ALIVE_OK_STATUS = 200;
const KEEP_ALIVE_ERROR_STATUS = 500;
const KEEP_ALIVE_UNAUTHORIZED_STATUS = 401;

type PingResult = {
    table: string;
    ok: boolean;
    count?: number;
    error?: string;
};

function getSupabaseCredentials() {
    const url =
        process.env.NEXT_PUBLIC_SUPABASE_URL ||
        process.env.SUPABASE_URL ||
        "";
    // Prefer service_role for keep-alive to bypass RLS and guarantee DB hit
    const serviceKey =
        process.env.SUPABASE_SERVICE_ROLE_KEY ||
        process.env.SUPABASE_SERVICE_ROLE ||
        process.env.SUPABASE_SERVICE_KEY ||
        "";
    const anonKey =
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
        process.env.SUPABASE_ANON_KEY ||
        "";

    const key = serviceKey || anonKey;
    const keyType = serviceKey ? "service_role" : "anon";

    return { url, key, keyType };
}

function verifyCronSecret(request: NextRequest): NextResponse | null {
    const cronSecret = process.env.CRON_SECRET;
    if (!cronSecret) return null;

    const authHeader = request.headers.get("authorization");
    // Vercel Cron sends `Authorization: Bearer <CRON_SECRET>` when CRON_SECRET is set
    if (authHeader) {
        if (authHeader !== `Bearer ${cronSecret}`) {
            return NextResponse.json(
                { ok: false, error: "Unauthorized: invalid cron secret" },
                {
                    status: KEEP_ALIVE_UNAUTHORIZED_STATUS,
                    headers: {
                        "Cache-Control":
                            "no-store, no-cache, must-revalidate, proxy-revalidate",
                    },
                },
            );
        }
        return null;
    }

    // No auth header — allow for GitHub Actions / UptimeRobot / manual pings,
    // but log so misconfigured Vercel cron is visible
    console.warn(
        "[keep-alive] CRON_SECRET is set but request had no Authorization header — allowing (external ping)",
    );
    return null;
}

async function pingSupabase(): Promise<{
    results: PingResult[];
    anyOk: boolean;
}> {
    const { url, key } = getSupabaseCredentials();

    if (!url || !key) {
        const missing = [
            !url ? "NEXT_PUBLIC_SUPABASE_URL/SUPABASE_URL" : null,
            !key
                ? "NEXT_PUBLIC_SUPABASE_ANON_KEY or SUPABASE_SERVICE_ROLE_KEY"
                : null,
        ]
            .filter(Boolean)
            .join(", ");

        // Return synthetic failure for every table so caller can report clearly
        return {
            results: KEEP_ALIVE_TABLES.map((table) => ({
                table,
                ok: false,
                error: `Missing env: ${missing}`,
            })),
            anyOk: false,
        };
    }

    // Cache-busting fetch: disable Next fetch cache and CDN cache; forces DB hit
    const noStoreFetch: typeof fetch = (input, init) =>
        fetch(input as URL | RequestInfo, {
            ...init,
            cache: "no-store",
        } as RequestInit);

    const supabase = createClient(url, key, {
        auth: { persistSession: false, autoRefreshToken: false },
        global: { fetch: noStoreFetch },
    });

    const settled = await Promise.allSettled(
        KEEP_ALIVE_TABLES.map(async (table): Promise<PingResult> => {
            // select count + limit 1 hits Postgres even on empty tables and avoids
            // PostgREST cache; `head: false` + `count: exact` forces a real query
            const { count, error } = await supabase
                .from(table)
                .select("id", { count: "exact", head: true });

            if (error) {
                return { table, ok: false, error: error.message };
            }
            return { table, ok: true, count: count ?? 0 };
        }),
    );

    const results: PingResult[] = settled.map((s, i) => {
        if (s.status === "fulfilled") return s.value;
        return {
            table: KEEP_ALIVE_TABLES[i],
            ok: false,
            error: s.reason?.message ?? String(s.reason),
        };
    });

    return { results, anyOk: results.some((r) => r.ok) };
}

async function handleKeepAlive(request: NextRequest) {
    const start = Date.now();

    const unauthorized = verifyCronSecret(request);
    if (unauthorized) return unauthorized;

    const { url, keyType } = getSupabaseCredentials();
    const { results, anyOk } = await pingSupabase();
    const durationMs = Date.now() - start;

    const timestamp = new Date().toISOString();

    if (anyOk) {
        console.log(
            `[keep-alive] ok keyType=${keyType} duration=${durationMs}ms results=${JSON.stringify(results)}`,
        );
        return NextResponse.json(
            {
                ok: true,
                timestamp,
                durationMs,
                keyType,
                results,
            },
            {
                status: KEEP_ALIVE_OK_STATUS,
                headers: {
                    "Cache-Control":
                        "no-store, no-cache, must-revalidate, proxy-revalidate",
                    "CDN-Cache-Control": "no-store",
                    "Vercel-CDN-Cache-Control": "no-store",
                },
            },
        );
    }

    console.error(
        `[keep-alive] failed url=${url ? "set" : "missing"} keyType=${keyType} duration=${durationMs}ms results=${JSON.stringify(results)}`,
    );
    return NextResponse.json(
        {
            ok: false,
            timestamp,
            durationMs,
            keyType,
            results,
            error: "All keep-alive pings failed — database may be paused or unreachable",
        },
        {
            status: KEEP_ALIVE_ERROR_STATUS,
            headers: {
                "Cache-Control":
                    "no-store, no-cache, must-revalidate, proxy-revalidate",
            },
        },
    );
}

export async function GET(request: NextRequest) {
    return handleKeepAlive(request);
}

export async function POST(request: NextRequest) {
    return handleKeepAlive(request);
}

// Allow HEAD for uptime monitors that prefer it
export async function HEAD(request: NextRequest) {
    const res = await handleKeepAlive(request);
    // HEAD must not have body — return headers only with status
    return new NextResponse(null, {
        status: res.status,
        headers: res.headers,
    });
}
