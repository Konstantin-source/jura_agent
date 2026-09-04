import type { LegalSourceProvider, LegalSourceRecord } from "@/lib/legal/types";
import { fetchWithTimeout, makeSourceId, stripHtml } from "@/lib/legal/utils";

const NRW_LAWS = [
  {
    match: ["vwvfg nrw", "verwaltungsverfahrensgesetz nrw", "verwaltungsverfahrensgesetz für das land nordrhein-westfalen"],
    title: "Verwaltungsverfahrensgesetz für das Land Nordrhein-Westfalen",
    url: "https://recht.nrw.de/taxonomy/term/27995",
  },
];

export class NrwLawProvider implements LegalSourceProvider {
  readonly name = "RECHT.NRW" as const;

  async searchLegislation(query: string): Promise<LegalSourceRecord[]> {
    const normalized = query.toLowerCase();
    const entry = NRW_LAWS.find((law) => law.match.some((term) => normalized.includes(term)));
    if (!entry) return [];
    const record = await this.getDocument(entry.url);
    return record ? [{ ...record, title: entry.title }] : [];
  }

  async searchCaseLaw(): Promise<LegalSourceRecord[]> {
    return [];
  }

  async getDocument(documentIdOrUrl: string): Promise<LegalSourceRecord | null> {
    const url = new URL(documentIdOrUrl);
    if (url.hostname !== "recht.nrw.de") throw new Error("Nicht erlaubte NRW-Rechtsadresse.");
    const response = await fetchWithTimeout(url, { headers: { Accept: "text/html" } });
    if (response.status === 404) return null;
    if (!response.ok) throw new Error(`RECHT.NRW antwortet mit HTTP ${response.status}.`);
    const text = stripHtml(await response.text());
    return {
      id: makeSourceId(this.name, url.toString()),
      title: "Landesrecht Nordrhein-Westfalen",
      kind: "state-law",
      provider: this.name,
      url: url.toString(),
      excerpt: text.slice(0, 1_200),
      official: true,
      verifiedAt: new Date().toISOString(),
      decisionDate: null,
      validFrom: null,
      metadata: { jurisdiction: "Nordrhein-Westfalen" },
    };
  }

  async getLegislationVersion(law: string): Promise<LegalSourceRecord | null> {
    const [record] = await this.searchLegislation(`${law} NRW`);
    return record ?? null;
  }
}
