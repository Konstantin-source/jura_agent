import "server-only";

import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getApplicationUrl, isDemoMode } from "@/lib/config/env";
import {
  createSessionRecord,
  deleteSessionRecord,
  findUserForSession,
  hashSessionToken,
  hasExactlyTwoUsers,
} from "@/lib/auth/repository";

export const SESSION_COOKIE_NAME = "jura_session";
const SESSION_TTL_SECONDS = 30 * 24 * 60 * 60;

export interface AppUser {
  id: string;
  email: string;
  displayName: string;
  demo: boolean;
}

export class AuthenticationError extends Error {
  constructor(message = "Bitte melde dich an.") {
    super(message);
    this.name = "AuthenticationError";
  }
}

export async function getOptionalAppUser(): Promise<AppUser | null> {
  if (isDemoMode()) {
    return {
      id: "00000000-0000-4000-8000-000000000001",
      email: "demo@jura-agent.local",
      displayName: "Demo-Nutzer",
      demo: true,
    };
  }
  if (!hasExactlyTwoUsers()) return null;
  const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  if (!token || token.length > 256) return null;
  const user = findUserForSession(hashSessionToken(token));
  if (!user) return null;
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    demo: false,
  };
}

export async function requireAppUser(): Promise<AppUser> {
  const user = await getOptionalAppUser();
  if (!user) throw new AuthenticationError();
  return user;
}

export async function requirePageUser(): Promise<AppUser> {
  const user = await getOptionalAppUser();
  if (!user) redirect("/login");
  return user;
}

function requestUsesHttps(request: Request): boolean {
  const forwardedProtocol = request.headers.get("x-forwarded-proto")?.split(",")[0].trim();
  if (forwardedProtocol === "https") return true;
  if (new URL(request.url).protocol === "https:") return true;
  return new URL(getApplicationUrl()).protocol === "https:";
}

export async function createAppSession(userId: string, request: Request): Promise<void> {
  const token = randomBytes(32).toString("base64url");
  createSessionRecord(hashSessionToken(token), userId, Date.now() + SESSION_TTL_SECONDS * 1000);
  (await cookies()).set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: requestUsesHttps(request),
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
    priority: "high",
  });
}

export async function deleteAppSession(): Promise<void> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (token && token.length <= 256) deleteSessionRecord(hashSessionToken(token));
  cookieStore.delete(SESSION_COOKIE_NAME);
}
