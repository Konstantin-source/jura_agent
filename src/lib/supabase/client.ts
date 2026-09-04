"use client";

import { createBrowserClient } from "@supabase/ssr";

export function createSupabaseBrowserClient(config?: { url?: string; anonKey?: string }) {
  const url = config?.url ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = config?.anonKey ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) throw new Error("Supabase ist nicht konfiguriert.");
  return createBrowserClient(url, anonKey);
}
