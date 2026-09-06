import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { hashPassword } from "@/lib/auth/password";
import {
  clearRateLimit,
  countUsers,
  createInitialUsers,
  getRateLimit,
  recordRateLimitFailure,
} from "@/lib/auth/repository";
import { getSetupRateLimitKey } from "@/lib/auth/request";
import { setupSchema } from "@/lib/auth/schemas";
import { getServerEnvironment, isDemoMode } from "@/lib/config/env";
import { isSameOriginRequest } from "@/lib/security/origin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function tokenMatches(actual: string, expected: string): boolean {
  const actualHash = createHash("sha256").update(actual).digest();
  const expectedHash = createHash("sha256").update(expected).digest();
  return timingSafeEqual(actualHash, expectedHash);
}

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: "Anfrage von einer fremden Herkunft abgelehnt." }, { status: 403 });
  }
  if (isDemoMode()) {
    return NextResponse.json({ error: "Der Demo-Modus benötigt keine Einrichtung." }, { status: 409 });
  }
  if (countUsers() !== 0) {
    return NextResponse.json({ error: "Die Ersteinrichtung wurde bereits abgeschlossen." }, { status: 409 });
  }

  const configuredToken = getServerEnvironment().SETUP_TOKEN;
  if (!configuredToken) {
    return NextResponse.json(
      { error: "SETUP_TOKEN fehlt in den Portainer-Variablen." },
      { status: 503 },
    );
  }
  const rateKey = getSetupRateLimitKey(request);
  const limit = getRateLimit(rateKey);
  if (limit.blocked) {
    return NextResponse.json(
      { error: "Zu viele Einrichtungsversuche. Bitte später erneut versuchen." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Ungültige Einrichtungsdaten." }, { status: 400 });
  }
  const parsed = setupSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Bitte alle Felder korrekt ausfüllen. Passwörter brauchen mindestens 12 Zeichen." },
      { status: 400 },
    );
  }
  if (!tokenMatches(parsed.data.setupToken, configuredToken)) {
    recordRateLimitFailure(rateKey, { limit: 5, blockMs: 30 * 60 * 1000 });
    return NextResponse.json({ error: "Der Einrichtungsschlüssel ist falsch." }, { status: 401 });
  }

  const passwordHashes = await Promise.all(parsed.data.users.map((user) => hashPassword(user.password)));
  try {
    createInitialUsers(
      parsed.data.users.map((user, index) => ({
        email: user.email,
        displayName: user.displayName,
        passwordHash: passwordHashes[index],
      })),
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Konten konnten nicht angelegt werden.";
    return NextResponse.json({ error: message }, { status: 409 });
  }
  clearRateLimit(rateKey);
  return NextResponse.json({ success: true }, { status: 201 });
}
