import type { LearningMode, SourceStatus } from "@/lib/ai/schemas";
import { getServerEnvironment } from "@/lib/config/env";
import { decideLegalRetrieval } from "@/lib/legal/query-parser";
import { FederalLawProvider } from "@/lib/legal/federal-provider";
import { NeurisProvider } from "@/lib/legal/neuris-provider";
import { NrwLawProvider } from "@/lib/legal/nrw-provider";
import type { LegalResearchResult, LegalSourceRecord } from "@/lib/legal/types";

interface CacheEntry {
  expiresAt: number;
  value: LegalResearchResult;
}

const memoryCache = new Map<string, CacheEntry>();

export async function researchOfficialSources(
  query: string,
  mode: LearningMode,
): Promise<LegalResearchResult> {
  const env = getServerEnvironment();
  const decision = decideLegalRetrieval(query, mode);
  if (!decision.required) {
    return { query, sources: [], attemptedProviders: [], warnings: [], live: false };
  }

  const cacheKey = `${mode}:${query.toLowerCase().trim()}`;
  const cached = memoryCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.value;

  const neuris = new NeurisProvider(env.NEURIS_BASE_URL);
  const federal = new FederalLawProvider();
  const nrw = new NrwLawProvider();
  const attemptedProviders: LegalResearchResult["attemptedProviders"] = [];
  const warnings: string[] = [];
  const sources: LegalSourceRecord[] = [];

  try {
    attemptedProviders.push(neuris.name);
    const legislation = await neuris.searchLegislation(query, { limit: decision.wantsCaseLaw ? 2 : 4 });
    sources.push(...legislation);
  } catch (error) {
    warnings.push(error instanceof Error ? error.message : "NeuRIS war nicht erreichbar.");
  }

  if (decision.wantsCaseLaw && sources.length < 4) {
    try {
      if (!attemptedProviders.includes(neuris.name)) attemptedProviders.push(neuris.name);
      sources.push(...(await neuris.searchCaseLaw(query, { limit: 3 })));
    } catch (error) {
      warnings.push(error instanceof Error ? error.message : "NeuRIS-Rechtsprechung war nicht erreichbar.");
    }
  }

  if (sources.length < 2) {
    try {
      attemptedProviders.push(federal.name);
      sources.push(...(await federal.searchLegislation(query)));
    } catch (error) {
      warnings.push(error instanceof Error ? error.message : "Bundesrecht-Fallback war nicht erreichbar.");
    }
  }

  if (/\b(nrw|nordrhein-westfalen|landesrecht)\b/i.test(query) && sources.length < 4) {
    try {
      attemptedProviders.push(nrw.name);
      sources.push(...(await nrw.searchLegislation(query)));
    } catch (error) {
      warnings.push(error instanceof Error ? error.message : "RECHT.NRW war nicht erreichbar.");
    }
  }

  const deduplicated = sources.filter(
    (source, index, all) => index === all.findIndex((candidate) => candidate.url === source.url),
  ).slice(0, 6);
  const result: LegalResearchResult = {
    query,
    sources: deduplicated,
    attemptedProviders,
    warnings,
    live: deduplicated.some((source) => Boolean(source.verifiedAt)),
  };
  memoryCache.set(cacheKey, {
    value: result,
    expiresAt: Date.now() + env.LEGAL_SOURCE_CACHE_TTL_SECONDS * 1_000,
  });
  return result;
}

export function deriveSourceStatus(
  sources: LegalSourceRecord[],
  hasCourseDocument: boolean,
): SourceStatus {
  if (sources.length > 0 && sources.every((source) => source.official && source.verifiedAt)) {
    return "Amtlich verifiziert";
  }
  if (sources.length === 0 && hasCourseDocument) return "Mit Kursunterlage belegt";
  if (sources.length > 0 || hasCourseDocument) return "Teilweise verifiziert";
  return "Nicht aktuell verifiziert";
}
