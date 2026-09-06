import { NextResponse } from "next/server";
import { loginSchema } from "@/lib/auth/schemas";
import {
  clearRateLimit,
  findUserByEmail,
  getRateLimit,
  hasExactlyTwoUsers,
  recordRateLimitFailure,
} from "@/lib/auth/repository";
import { consumeDummyPasswordCheck, verifyPassword } from "@/lib/auth/password";
import { getLoginRateLimitKey } from "@/lib/auth/request";
import { createAppSession } from "@/lib/auth/server";
import { isDemoMode } from "@/lib/config/env";
import { isSameOriginRequest } from "@/lib/security/origin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: "Anfrage von einer fremden Herkunft abgelehnt." }, { status: 403 });
  }
  if (isDemoMode()) {
    return NextResponse.json({ error: "Im Demo-Modus ist keine Anmeldung erforderlich." }, { status: 409 });
  }
  if (!hasExactlyTwoUsers()) {
    return NextResponse.json({ error: "Die Ersteinrichtung ist noch nicht abgeschlossen." }, { status: 503 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Ungültige Anmeldedaten." }, { status: 400 });
  }
  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Ungültige Anmeldedaten." }, { status: 400 });

  const email = parsed.data.email.trim().toLowerCase();
  const rateKey = getLoginRateLimitKey(request, email);
  const limit = getRateLimit(rateKey);
  if (limit.blocked) {
    return NextResponse.json(
      { error: "Zu viele Anmeldeversuche. Bitte später erneut versuchen." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } },
    );
  }

  const user = findUserByEmail(email);
  const validPassword = user
    ? await verifyPassword(parsed.data.password, user.passwordHash)
    : (await consumeDummyPasswordCheck(parsed.data.password), false);
  if (!user || !validPassword) {
    recordRateLimitFailure(rateKey);
    return NextResponse.json({ error: "E-Mail-Adresse oder Passwort ist falsch." }, { status: 401 });
  }

  clearRateLimit(rateKey);
  await createAppSession(user.id, request);
  return NextResponse.json({
    user: { id: user.id, email: user.email, displayName: user.displayName },
  });
}
