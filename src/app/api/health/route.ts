import { NextResponse } from "next/server";
import { countUsers } from "@/lib/auth/repository";
import { getServerEnvironment, isDemoMode } from "@/lib/config/env";
import { checkLocalStorage } from "@/lib/db/database";
import { checkNeurisConnection } from "@/lib/legal/neuris-provider";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const env = getServerEnvironment();
  const demo = isDemoMode();
  const shouldProbeNeuris = new URL(request.url).searchParams.get("probe") === "1";
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
  const neurisStatus = demo
    ? { reachable: false, message: "Im Demo-Modus nicht geprüft", checkedAt: null }
    : shouldProbeNeuris
      ? await checkNeurisConnection(env.NEURIS_BASE_URL)
      : {
          reachable: Boolean(env.NEURIS_BASE_URL),
          message: env.NEURIS_BASE_URL ? "Konfiguriert; kein Live-Test angefordert" : "Keine Basis-URL konfiguriert",
          checkedAt: null,
        };
  return NextResponse.json({
    status: demo || localDatabase ? "ok" : "error",
    mode: demo ? "demo" : "live",
    accountsConfigured,
    integrations: {
      openai: Boolean(env.OPENAI_API_KEY),
      localDatabase,
      neuris: neurisStatus.reachable,
      neurisStatus,
    },
  }, { status: demo || localDatabase ? 200 : 503 });
}
