import { z } from "zod";

const serverEnvironmentSchema = z.object({
  DEMO_MODE: z.enum(["true", "false"]).default("false"),
  OPENAI_API_KEY: z.string().min(1).optional(),
  DATA_DIR: z.string().min(1).default(".data"),
  SETUP_TOKEN: z.string().min(32).max(512).optional(),
  MONTHLY_AI_BUDGET_EUR: z.coerce.number().positive().default(5),
  EUR_PER_USD: z.coerce.number().positive().default(0.92),
  NEURIS_BASE_URL: z
    .string()
    .url()
    .default("https://testphase.rechtsinformationen.bund.de/v1"),
  LEGAL_SOURCE_CACHE_TTL_SECONDS: z.coerce.number().int().positive().default(86_400),
  APP_URL: z.string().url().default("http://localhost:3000"),
});

export type ServerEnvironment = z.infer<typeof serverEnvironmentSchema>;

export function getServerEnvironment(): ServerEnvironment {
  return serverEnvironmentSchema.parse({
    DEMO_MODE: process.env.DEMO_MODE,
    OPENAI_API_KEY: process.env.OPENAI_API_KEY || undefined,
    DATA_DIR: process.env.DATA_DIR,
    SETUP_TOKEN: process.env.SETUP_TOKEN || undefined,
    MONTHLY_AI_BUDGET_EUR: process.env.MONTHLY_AI_BUDGET_EUR,
    EUR_PER_USD: process.env.EUR_PER_USD,
    NEURIS_BASE_URL: process.env.NEURIS_BASE_URL,
    LEGAL_SOURCE_CACHE_TTL_SECONDS: process.env.LEGAL_SOURCE_CACHE_TTL_SECONDS,
    APP_URL: process.env.APP_URL,
  });
}

export function isDemoMode(): boolean {
  return getServerEnvironment().DEMO_MODE === "true";
}

export function getApplicationUrl(): string {
  return getServerEnvironment().APP_URL;
}
