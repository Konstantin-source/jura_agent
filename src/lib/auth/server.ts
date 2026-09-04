import "server-only";

import { getAllowedEmails, hasSupabaseConfiguration, isDemoMode } from "@/lib/config/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export interface AppUser {
  id: string;
  email: string;
  demo: boolean;
}

export class AuthenticationError extends Error {
  constructor(message = "Bitte melde dich an.") {
    super(message);
    this.name = "AuthenticationError";
  }
}

export async function requireAppUser(): Promise<AppUser> {
  if (isDemoMode()) {
    return { id: "00000000-0000-4000-8000-000000000001", email: "demo@jura-agent.local", demo: true };
  }
  if (!hasSupabaseConfiguration()) throw new AuthenticationError("Supabase ist nicht konfiguriert.");
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user?.email) throw new AuthenticationError();

  const email = data.user.email.toLowerCase();
  const allowed = getAllowedEmails();
  if (allowed.length !== 2 || !allowed.includes(email)) {
    throw new AuthenticationError("Dieses Konto ist nicht für Jura Agent freigeschaltet.");
  }
  return { id: data.user.id, email, demo: false };
}
