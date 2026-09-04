import { NextResponse } from "next/server";
import {
  getSupabaseRuntimeConfiguration,
  hasSupabaseConfiguration,
  isDemoMode,
} from "@/lib/config/env";

export const dynamic = "force-dynamic";

export function GET() {
  const supabase = getSupabaseRuntimeConfiguration();
  return NextResponse.json(
    {
      mode: isDemoMode() ? "demo" : "live",
      supabase: hasSupabaseConfiguration()
        ? { url: supabase.url, anonKey: supabase.anonKey }
        : null,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
