import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getSupabaseRuntimeConfiguration } from "@/lib/config/env";

export async function createSupabaseServerClient() {
  const config = getSupabaseRuntimeConfiguration();
  if (!config.url || !config.anonKey) {
    throw new Error("Supabase ist nicht konfiguriert.");
  }
  const cookieStore = await cookies();
  return createServerClient(config.url, config.anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Server Components cannot write cookies. Route handlers and actions can.
        }
      },
    },
  });
}
