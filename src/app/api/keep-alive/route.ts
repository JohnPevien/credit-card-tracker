import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

const KEEP_ALIVE_SELECT_LIMIT = 1;
const KEEP_ALIVE_OK_STATUS = 200;
const KEEP_ALIVE_ERROR_STATUS = 500;

export async function GET() {
    const { error } = await supabase
        .from("persons")
        .select("id")
        .limit(KEEP_ALIVE_SELECT_LIMIT);

    if (error) {
        return NextResponse.json(
            { ok: false, error: error.message },
            { status: KEEP_ALIVE_ERROR_STATUS },
        );
    }

    return NextResponse.json(
        { ok: true },
        { status: KEEP_ALIVE_OK_STATUS },
    );
}
