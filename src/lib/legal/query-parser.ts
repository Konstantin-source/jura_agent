const REFERENCE_PATTERN = /(?:§{1,2}|Art\.?)\s*\d+[a-z]?(?:\s*Abs\.\s*\d+)?\s*(?:S\.\s*\d+)?\s*([A-ZÄÖÜ][A-Za-zÄÖÜäöüß.\-\s]{1,20})?/g;

const CURRENT_LAW_TERMS = [
  "aktuell",
  "derzeit",
  "geltende fassung",
  "heute",
  "rechtsprechung",
  "urteil",
  "beschluss",
  "bgh",
  "bverwg",
  "bverfg",
  "ovg",
];

export interface RetrievalDecision {
  required: boolean;
  reason: string;
  references: string[];
  wantsCaseLaw: boolean;
}

export function decideLegalRetrieval(query: string, mode: string): RetrievalDecision {
  const references = Array.from(query.matchAll(REFERENCE_PATTERN), (match) => match[0].trim());
  const normalized = query.toLowerCase();
  const wantsCaseLaw = ["rechtsprechung", "urteil", "beschluss", "bgh", "bverwg", "bverfg", "ovg"].some(
    (term) => normalized.includes(term),
  );

  if (mode === "correction") {
    return { required: true, reason: "Klausurkorrektur benötigt überprüfbare Normgrundlagen.", references, wantsCaseLaw };
  }
  if (references.length > 0) {
    return { required: true, reason: "Die Frage nennt eine konkrete Norm.", references, wantsCaseLaw };
  }
  if (CURRENT_LAW_TERMS.some((term) => normalized.includes(term))) {
    return { required: true, reason: "Die Frage verlangt aktuelle Rechtsinformationen.", references, wantsCaseLaw };
  }

  return { required: false, reason: "Keine aktuelle oder konkrete Fundstelle angefragt.", references, wantsCaseLaw };
}

export function extractLawAndSection(query: string): { law: string; section?: string } | null {
  const paragraph = query.match(/§\s*(\d+[a-z]?).{0,24}?\b(BGB|VwGO|VwVfG|GG|StGB|ZPO|StPO|HGB)\b/i);
  if (paragraph) return { law: paragraph[2].toUpperCase(), section: paragraph[1].toLowerCase() };

  const reverse = query.match(/\b(BGB|VwGO|VwVfG|GG|StGB|ZPO|StPO|HGB)\b.{0,12}?§\s*(\d+[a-z]?)/i);
  if (reverse) return { law: reverse[1].toUpperCase(), section: reverse[2].toLowerCase() };

  const lawOnly = query.match(/\b(BGB|VwGO|VwVfG|GG|StGB|ZPO|StPO|HGB)\b/i);
  return lawOnly ? { law: lawOnly[1].toUpperCase() } : null;
}
