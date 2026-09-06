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

const LAW_LABELS: Record<string, string> = {
  BGB: "BGB",
  VWGO: "VwGO",
  VWVFG: "VwVfG",
  GG: "GG",
  STGB: "StGB",
  ZPO: "ZPO",
  STPO: "StPO",
  HGB: "HGB",
};

const SEARCH_STOP_WORDS = new Set([
  "allgemeines", "bitte", "dann", "dass", "deine", "einer", "eines", "erkläre", "frage", "gegen",
  "ihnen", "kann", "klausur", "meine", "mich", "oder", "prüfe", "recht", "rechtlich", "semester",
  "das", "der", "die", "den", "dem", "des", "ein", "eine", "ist", "sind", "studium", "über", "unterschied", "unter", "verstehen", "warum", "welche", "welcher", "welches",
  "und", "was", "wenn", "wird", "womit", "zwischen",
]);

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

  return {
    required: true,
    reason: "Juristische Lernantworten werden grundsätzlich mit amtlichen Quellen abgeglichen.",
    references,
    wantsCaseLaw,
  };
}

export function extractLawAndSection(query: string): { law: string; section?: string } | null {
  const paragraph = query.match(/§\s*(\d+[a-z]?).{0,24}?\b(BGB|VwGO|VwVfG|GG|StGB|ZPO|StPO|HGB)\b/i);
  if (paragraph) return { law: paragraph[2].toUpperCase(), section: paragraph[1].toLowerCase() };

  const reverse = query.match(/\b(BGB|VwGO|VwVfG|GG|StGB|ZPO|StPO|HGB)\b.{0,12}?§\s*(\d+[a-z]?)/i);
  if (reverse) return { law: reverse[1].toUpperCase(), section: reverse[2].toLowerCase() };

  const lawOnly = query.match(/\b(BGB|VwGO|VwVfG|GG|StGB|ZPO|StPO|HGB)\b/i);
  if (lawOnly) return { law: lawOnly[1].toUpperCase() };

  const normalized = query.toLowerCase();
  if (/verwaltungsprozess|anfechtungsklage|verpflichtungsklage|vwgo/.test(normalized)) return { law: "VWGO" };
  if (/verwaltungsrecht|verwaltungsakt|behörde|bescheid|rücknahme|widerruf/.test(normalized)) return { law: "VWVFG" };
  if (/schuldrecht|sachenrecht|vertrag|anspruch|schadensersatz/.test(normalized)) return { law: "BGB" };
  if (/strafrecht|strafbar|tatbestand|vorsatz/.test(normalized)) return { law: "STGB" };
  if (/grundrecht|verfassungsrecht|öffentliches recht/.test(normalized)) return { law: "GG" };
  return null;
}

function meaningfulTerms(query: string): string[] {
  const question = query.includes(":") ? query.slice(query.indexOf(":") + 1) : query;
  return question
    .replace(/§{1,2}\s*\d+[a-z]?(?:\s*Abs\.\s*\d+)?(?:\s*S\.\s*\d+)?/gi, " ")
    .replace(/\b(BGB|VwGO|VwVfG|GG|StGB|ZPO|StPO|HGB)\b/gi, " ")
    .toLowerCase()
    .match(/[a-zäöüß]{3,}/g)
    ?.filter((term) => !SEARCH_STOP_WORDS.has(term))
    .filter((term, index, all) => all.indexOf(term) === index)
    .slice(0, 6) ?? [];
}

export function buildLegalSearchQueries(query: string): string[] {
  const decision = decideLegalRetrieval(query, "explanation");
  const parsed = extractLawAndSection(query);
  const law = parsed ? LAW_LABELS[parsed.law] ?? parsed.law : null;
  const terms = meaningfulTerms(query);
  const candidates = [
    ...decision.references,
    parsed?.section && law ? `§ ${parsed.section} ${law}` : "",
    law && terms.length ? `${law} ${terms.join(" ")}` : "",
    law ?? "",
    terms.join(" "),
  ];
  return candidates
    .map((candidate) => candidate.trim().replace(/\s+/g, " "))
    .filter((candidate) => candidate.length >= 2)
    .filter((candidate, index, all) => all.findIndex((item) => item.toLowerCase() === candidate.toLowerCase()) === index)
    .slice(0, 3);
}
