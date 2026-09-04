export type LegalDocumentKind = "legislation" | "case-law" | "state-law";

export type LegalSourceProviderName =
  | "NeuRIS"
  | "Gesetze im Internet"
  | "Rechtsprechung im Internet"
  | "RECHT.NRW";

export interface LegalSourceRecord {
  id: string;
  title: string;
  kind: LegalDocumentKind;
  provider: LegalSourceProviderName;
  url: string;
  excerpt: string;
  official: true;
  verifiedAt: string | null;
  decisionDate: string | null;
  validFrom: string | null;
  metadata: Record<string, string | number | boolean | null>;
}

export interface LegalSearchOptions {
  limit?: number;
  court?: string;
  dateFrom?: string;
  dateTo?: string;
}

export interface LegalSourceProvider {
  readonly name: LegalSourceProviderName;
  searchLegislation(query: string, options?: LegalSearchOptions): Promise<LegalSourceRecord[]>;
  searchCaseLaw(query: string, options?: LegalSearchOptions): Promise<LegalSourceRecord[]>;
  getDocument(documentIdOrUrl: string): Promise<LegalSourceRecord | null>;
  getLegislationVersion(
    law: string,
    section?: string,
    asOf?: string,
  ): Promise<LegalSourceRecord | null>;
}

export interface LegalResearchResult {
  query: string;
  sources: LegalSourceRecord[];
  attemptedProviders: LegalSourceProviderName[];
  warnings: string[];
  live: boolean;
}
