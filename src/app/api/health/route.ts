import { NextResponse } from "next/server";
import { getServerEnvironment, hasSupabaseConfiguration, isDemoMode } from "@/lib/config/env";

export function GET() {
  const env = getServerEnvironment();
  return NextResponse.json({
    status: "ok",
    mode: isDemoMode() ? "demo" : "live",
    integrations: {
      openai: Boolean(env.OPENAI_API_KEY),
      supabase: hasSupabaseConfiguration(),
      neuris: Boolean(env.NEURIS_BASE_URL),
    },
  });
}
