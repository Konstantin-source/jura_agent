import { createHash } from "node:crypto";

export function makeSourceId(provider: string, url: string): string {
  return `src_${createHash("sha256").update(`${provider}:${url}`).digest("hex").slice(0, 12)}`;
}

export function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#160;/g, " ")
    .replace(/&sect;/g, "§")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

export async function fetchWithTimeout(url: URL | string, init: RequestInit = {}, timeoutMs = 8_000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal,
      headers: {
        "User-Agent": "Jura-Agent/0.1 (+https://github.com/Konstantin-source/jura_agent)",
        Accept: "application/json, text/html;q=0.9",
        ...init.headers,
      },
    });
  } finally {
    clearTimeout(timer);
  }
}
