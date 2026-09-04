import type { AssistantResponse } from "@/lib/ai/schemas";
import type { LegalSourceRecord } from "@/lib/legal/types";

export class UnknownCitationError extends Error {
  constructor(public readonly unknownIds: string[]) {
    super(`Die Antwort enthält unbekannte Quellen-IDs: ${unknownIds.join(", ")}`);
    this.name = "UnknownCitationError";
  }
}

export function validateResponseCitations<T extends AssistantResponse>(
  response: T,
  sources: LegalSourceRecord[],
): T {
  const allowed = new Set(sources.map((source) => source.id));
  const unknown = response.citations
    .map((citation) => citation.sourceId)
    .filter((sourceId) => !allowed.has(sourceId));

  if (unknown.length > 0) throw new UnknownCitationError([...new Set(unknown)]);
  return response;
}

export function sourcesReferencedByResponse(
  response: AssistantResponse,
  sources: LegalSourceRecord[],
): LegalSourceRecord[] {
  const cited = new Set(response.citations.map((citation) => citation.sourceId));
  return sources.filter((source) => cited.has(source.id));
}
