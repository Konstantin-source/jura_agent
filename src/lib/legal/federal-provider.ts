import type { LegalSourceProvider, LegalSourceRecord } from "@/lib/legal/types";
import { extractLawAndSection } from "@/lib/legal/query-parser";
import { fetchWithTimeout, makeSourceId, stripHtml } from "@/lib/legal/utils";

const FEDERAL_LAWS: Record<string, { slug: string; title: string }> = {
  BGB: { slug: "bgb", title: "Bürgerliches Gesetzbuch" },
  VWGO: { slug: "vwgo", title: "Verwaltungsgerichtsordnung" },
  VWVFG: { slug: "vwvfg", title: "Verwaltungsverfahrensgesetz" },
  GG: { slug: "gg", title: "Grundgesetz" },
  STGB: { slug: "stgb", title: "Strafgesetzbuch" },
  ZPO: { slug: "zpo", title: "Zivilprozessordnung" },
  STPO: { slug: "stpo", title: "Strafprozessordnung" },
  HGB: { slug: "hgb", title: "Handelsgesetzbuch" },
};

export class FederalLawProvider implements LegalSourceProvider {
  readonly name = "Gesetze im Internet" as const;

  async searchLegislation(query: string): Promise<LegalSourceRecord[]> {
    const parsed = extractLawAndSection(query);
    if (!parsed) return [];
    const record = await this.getLegislationVersion(parsed.law, parsed.section);
    return record ? [record] : [];
  }

  async searchCaseLaw(): Promise<LegalSourceRecord[]> {
    return [];
  }

  async getDocument(documentIdOrUrl: string): Promise<LegalSourceRecord | null> {
    const url = new URL(documentIdOrUrl);
    if (url.hostname !== "www.gesetze-im-internet.de") throw new Error("Nicht erlaubte Bundesrechtsadresse.");
    return this.fetchOfficialPage(url, "Amtliche Bundesnorm");
  }

  async getLegislationVersion(law: string, section?: string): Promise<LegalSourceRecord | null> {
    const entry = FEDERAL_LAWS[law.toUpperCase()];
    if (!entry) return null;
    const path = section ? `/${entry.slug}/__${section}.html` : `/${entry.slug}/`;
    const url = new URL(path, "https://www.gesetze-im-internet.de");
    return this.fetchOfficialPage(url, `${entry.title}${section ? ` – § ${section}` : ""}`);
  }

  private async fetchOfficialPage(url: URL, fallbackTitle: string): Promise<LegalSourceRecord> {
    const response = await fetchWithTimeout(url, { headers: { Accept: "text/html" } });
    if (!response.ok) throw new Error(`Gesetze-im-Internet antwortet mit HTTP ${response.status}.`);
    const text = stripHtml(await response.text());
    const relevantStart = Math.max(0, text.indexOf(fallbackTitle.split(" – ")[0]));
    return {
      id: makeSourceId(this.name, url.toString()),
      title: fallbackTitle,
      kind: "legislation",
      provider: this.name,
      url: url.toString(),
      excerpt: text.slice(relevantStart, relevantStart + 1_200),
      official: true,
      verifiedAt: new Date().toISOString(),
      decisionDate: null,
      validFrom: null,
      metadata: {},
    };
  }
}
