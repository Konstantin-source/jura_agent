import { rateLimitKey } from "@/lib/auth/repository";

export function getClientAddress(request: Request): string {
  return (
    request.headers.get("cf-connecting-ip") ??
    request.headers.get("x-real-ip") ??
    request.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
    "unknown"
  );
}

export function getLoginRateLimitKey(request: Request, email: string): string {
  return rateLimitKey("login", `${getClientAddress(request)}:${email.trim().toLowerCase()}`);
}

export function getSetupRateLimitKey(request: Request): string {
  return rateLimitKey("setup", getClientAddress(request));
}
