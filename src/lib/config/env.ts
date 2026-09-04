import { z } from "zod";

const serverEnvironmentSchema = z.object({
  DEMO_MODE: z.enum(["true", "false"]).default("false"),
  OPENAI_API_KEY: z.string().min(1).optional(),
  OPENAI_PRIMARY_MODEL: z.string().min(1).default("gpt-5.6-terra"),
  SUPABASE_URL: z.string().url().optional(),
  SUPABASE_ANON_KEY: z.string().min(1).optional(),
  NEXT_PUBLIC_SUPABASE_URL: z.string().url().optional(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1).optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),
  ALLOWED_EMAILS: z.string().default(""),
  MONTHLY_AI_BUDGET_EUR: z.coerce.number().positive().default(10),
  EUR_PER_USD: z.coerce.number().positive().default(0.92),
  NEURIS_BASE_URL: z
    .string()
    .url()
    .default("https://testphase.rechtsinformationen.bund.de/v1"),
  LEGAL_SOURCE_CACHE_TTL_SECONDS: z.coerce.number().int().positive().default(86_400),
  APP_URL: z.string().url().optional(),
  NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3000"),
});

export type ServerEnvironment = z.infer<typeof serverEnvironmentSchema>;

export function getServerEnvironment(): ServerEnvironment {
  return serverEnvironmentSchema.parse({
    DEMO_MODE: process.env.DEMO_MODE,
    OPENAI_API_KEY: process.env.OPENAI_API_KEY || undefined,
    OPENAI_PRIMARY_MODEL: process.env.OPENAI_PRIMARY_MODEL,
    SUPABASE_URL: process.env.SUPABASE_URL || undefined,
    SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY || undefined,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL || undefined,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || undefined,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY || undefined,
    ALLOWED_EMAILS: process.env.ALLOWED_EMAILS,
    MONTHLY_AI_BUDGET_EUR: process.env.MONTHLY_AI_BUDGET_EUR,
    EUR_PER_USD: process.env.EUR_PER_USD,
    NEURIS_BASE_URL: process.env.NEURIS_BASE_URL,
    LEGAL_SOURCE_CACHE_TTL_SECONDS: process.env.LEGAL_SOURCE_CACHE_TTL_SECONDS,
    APP_URL: process.env.APP_URL || undefined,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  });
}

export function isDemoMode(): boolean {
  return getServerEnvironment().DEMO_MODE === "true";
}

export function getAllowedEmails(): string[] {
  return getServerEnvironment()
    .ALLOWED_EMAILS.split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

export function hasSupabaseConfiguration(): boolean {
  const config = getSupabaseRuntimeConfiguration();
  return Boolean(config.url && config.anonKey);
}

export function getSupabaseRuntimeConfiguration() {
  const env = getServerEnvironment();
  return {
    url: env.SUPABASE_URL ?? env.NEXT_PUBLIC_SUPABASE_URL,
    anonKey: env.SUPABASE_ANON_KEY ?? env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  };
}

export function getApplicationUrl(): string {
  const env = getServerEnvironment();
  return env.APP_URL ?? env.NEXT_PUBLIC_APP_URL;
}
