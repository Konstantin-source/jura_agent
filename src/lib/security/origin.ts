export function isSameOriginRequest(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  try {
    const originHost = new URL(origin).host.toLowerCase();
    const forwardedHost = request.headers.get("x-forwarded-host")?.split(",")[0].trim();
    const requestHost = forwardedHost ?? request.headers.get("host") ?? new URL(request.url).host;
    return originHost === requestHost.toLowerCase();
  } catch {
    return false;
  }
}
