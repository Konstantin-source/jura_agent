import { NextResponse } from "next/server";
import { countUsers } from "@/lib/auth/repository";
import { getServerEnvironment, isDemoMode } from "@/lib/config/env";

export const dynamic = "force-dynamic";

export function GET() {
  const demo = isDemoMode();
  const userCount = demo ? 0 : countUsers();
  return NextResponse.json(
    {
      mode: demo ? "demo" : "live",
      storage: "local",
      setupRequired: !demo && userCount !== 2,
      setupAvailable: !demo && userCount === 0 && Boolean(getServerEnvironment().SETUP_TOKEN),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
