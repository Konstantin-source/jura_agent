import { NextResponse } from "next/server";
import { countUsers } from "@/lib/auth/repository";
import { getServerEnvironment, isDemoMode } from "@/lib/config/env";
import { checkLocalStorage } from "@/lib/db/database";

export const dynamic = "force-dynamic";

export function GET() {
  const env = getServerEnvironment();
  const demo = isDemoMode();
  let localDatabase = false;
  let accountsConfigured = demo;
  try {
    if (!demo) {
      localDatabase = checkLocalStorage();
      accountsConfigured = countUsers() === 2;
    }
  } catch {
    localDatabase = false;
  }
  return NextResponse.json({
    status: demo || localDatabase ? "ok" : "error",
    mode: demo ? "demo" : "live",
    accountsConfigured,
    integrations: {
      openai: Boolean(env.OPENAI_API_KEY),
      localDatabase,
      neuris: Boolean(env.NEURIS_BASE_URL),
    },
  }, { status: demo || localDatabase ? 200 : 503 });
}
