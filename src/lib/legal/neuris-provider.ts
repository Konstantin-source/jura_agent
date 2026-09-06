import type {
  LegalSearchOptions,
  LegalSourceProvider,
  LegalSourceRecord,
} from "@/lib/legal/types";
import { fetchWithTimeout, makeSourceId } from "@/lib/legal/utils";

interface NeurisSearchResult {
  item?: {
    "@id"?: string;
    documentNumber?: string;
    ecli?: string;
    headline?: string;
    name?: string;
    abbreviation?: string;
    alternateName?: string;
    decisionDate?: string;
    legislationDate?: string;
    temporalCoverage?: string;
    inForce?: boolean;
    courtName?: string;
    courtType?: string;
    documentType?: string;
    workExample?: { "@id"?: string; legislationIdentifier?: string };
  };
  textMatches?: Array<{ name?: string; text?: string; location?: string }>;
}

interface NeurisCollection {
  member?: NeurisSearchResult[];
}

export interface NeurisConnectionStatus {
  reachable: boolean;
  message: string;
  checkedAt: string;
}

const PROBE_TTL_MS = 5 * 60 * 1_000;
const probeCache = new Map<string, { expiresAt: number; status: NeurisConnectionStatus }>();

function normalizeApiUrl(baseUrl: string, id: string): string {
  if (id.startsWith("http")) return id;
  const origin = new URL(baseUrl).origin;
  return new URL(id, origin).toString();
}

function toHumanUrl(apiUrl: string, kind: "legislation" | "case-law"): string {
  const url = new URL(apiUrl);
  if (kind === "legislation" && url.pathname.startsWith("/v1/legislation/")) {
    const normPath = url.pathname.replace("/v1/legislation/", "/norms/");
    return `${url.origin}${normPath}`;
  }
  if (kind === "case-law" && url.pathname.startsWith("/v1/case-law/")) {
    return `${url.origin}${url.pathname.replace("/v1/case-law/", "/case-law/")}`;
  }
  return apiUrl;
}

function compactExcerpt(result: NeurisSearchResult): string {
  return (result.textMatches ?? [])
    .map((match) => match.text?.trim())
    .filter(Boolean)
    .join(" … ")
    .slice(0, 1_200);
}

export class NeurisProvider implements LegalSourceProvider {
  readonly name = "NeuRIS" as const;

  constructor(private readonly baseUrl = "https://testphase.rechtsinformationen.bund.de/v1") {}

  async searchLegislation(query: string, options: LegalSearchOptions = {}): Promise<LegalSourceRecord[]> {
    return this.search("legislation", query, options);
  }

  async searchCaseLaw(query: string, options: LegalSearchOptions = {}): Promise<LegalSourceRecord[]> {
    return this.search("case-law", query, options);
  }

  private async search(
    kind: "legislation" | "case-law",
    query: string,
    options: LegalSearchOptions,
  ): Promise<LegalSourceRecord[]> {
    const url = new URL(`${this.baseUrl.replace(/\/$/, "")}/${kind}`);
    url.searchParams.set("searchTerm", query);
    if (kind === "legislation") url.searchParams.set("size", String(Math.min(options.limit ?? 4, 10)));
    else url.searchParams.set("limit", String(Math.min(options.limit ?? 4, 10)));
    if (options.court) url.searchParams.set("court", options.court);
    if (options.dateFrom) url.searchParams.set(kind === "case-law" ? "dateFrom" : "temporalCoverageFrom", options.dateFrom);
    if (options.dateTo) url.searchParams.set(kind === "case-law" ? "dateTo" : "temporalCoverageTo", options.dateTo);

    const response = await fetchWithTimeout(url);
    if (!response.ok) throw new Error(`NeuRIS antwortet mit HTTP ${response.status}.`);
    const payload = (await response.json()) as NeurisCollection;
    const verifiedAt = new Date().toISOString();

    return (payload.member ?? []).flatMap((result) => {
      const item = result.item ?? {};
      const expressionId = item.workExample?.["@id"] ?? item["@id"] ?? "";
      if (!expressionId) return [];
      const apiUrl = normalizeApiUrl(this.baseUrl, expressionId);
      const humanUrl = toHumanUrl(apiUrl, kind);
      const title =
        item.headline ??
        item.name ??
        item.alternateName ??
        item.abbreviation ??
        item.documentNumber ??
        "Amtliches Rechtsdokument";

      return [{
        id: makeSourceId(this.name, apiUrl),
        title,
        kind,
        provider: this.name,
        url: humanUrl,
        excerpt: compactExcerpt(result),
        official: true as const,
        verifiedAt,
        decisionDate: item.decisionDate ?? null,
        validFrom: item.temporalCoverage ?? item.legislationDate ?? null,
        metadata: {
          apiUrl,
          documentNumber: item.documentNumber ?? null,
          ecli: item.ecli ?? null,
          court: item.courtName ?? item.courtType ?? null,
          documentType: item.documentType ?? null,
          inForce: item.inForce ?? null,
        },
      }];
    });
  }

  async getDocument(documentIdOrUrl: string): Promise<LegalSourceRecord | null> {
    const candidate = documentIdOrUrl.startsWith("http")
      ? new URL(documentIdOrUrl)
      : new URL(documentIdOrUrl, new URL(this.baseUrl).origin);
    const allowedOrigin = new URL(this.baseUrl).origin;
    if (candidate.origin !== allowedOrigin || !candidate.pathname.startsWith("/v1/")) {
      throw new Error("Nicht erlaubte NeuRIS-Dokumentadresse.");
    }

    const response = await fetchWithTimeout(candidate, { headers: { Accept: "application/json" } });
    if (response.status === 404) return null;
    if (!response.ok) throw new Error(`NeuRIS antwortet mit HTTP ${response.status}.`);
    const payload = (await response.json()) as Record<string, unknown>;
    const title = String(payload.name ?? payload.headline ?? payload.documentNumber ?? "Amtliches Rechtsdokument");
    return {
      id: makeSourceId(this.name, candidate.toString()),
      title,
      kind: candidate.pathname.includes("case-law") ? "case-law" : "legislation",
      provider: this.name,
      url: toHumanUrl(candidate.toString(), candidate.pathname.includes("case-law") ? "case-law" : "legislation"),
      excerpt: JSON.stringify(payload).slice(0, 1_200),
      official: true,
      verifiedAt: new Date().toISOString(),
      decisionDate: typeof payload.decisionDate === "string" ? payload.decisionDate : null,
      validFrom: typeof payload.temporalCoverage === "string" ? payload.temporalCoverage : null,
      metadata: { apiUrl: candidate.toString() },
    };
  }

  async getLegislationVersion(law: string, section?: string): Promise<LegalSourceRecord | null> {
    const [first] = await this.searchLegislation([section ? `§ ${section}` : "", law].filter(Boolean).join(" "), {
      limit: 1,
    });
    return first ?? null;
  }
}

export async function checkNeurisConnection(
  baseUrl: string,
  options: { force?: boolean } = {},
): Promise<NeurisConnectionStatus> {
  const cached = probeCache.get(baseUrl);
  if (!options.force && cached && cached.expiresAt > Date.now()) return cached.status;

  const checkedAt = new Date().toISOString();
  let status: NeurisConnectionStatus;
  try {
    const url = new URL(`${baseUrl.replace(/\/$/, "")}/legislation`);
    url.searchParams.set("searchTerm", "BGB");
    url.searchParams.set("size", "1");
    const response = await fetchWithTimeout(url, {}, 5_000);
    if (!response.ok) {
      status = { reachable: false, message: `HTTP ${response.status}`, checkedAt };
    } else {
      const payload = (await response.json()) as NeurisCollection;
      status = Array.isArray(payload.member)
        ? { reachable: true, message: "Live-Abruf erfolgreich", checkedAt }
        : { reachable: false, message: "Unerwartetes Antwortformat", checkedAt };
    }
  } catch (error) {
    const message = error instanceof Error && error.name === "AbortError" ? "Zeitüberschreitung" : "Nicht erreichbar";
    status = { reachable: false, message, checkedAt };
  }
  probeCache.set(baseUrl, { status, expiresAt: Date.now() + PROBE_TTL_MS });
  return status;
}
