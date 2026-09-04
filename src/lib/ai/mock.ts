import type { AssistantRequest, AssistantResponse, SourceStatus } from "@/lib/ai/schemas";
import type { LegalSourceRecord } from "@/lib/legal/types";
import { extractLawAndSection } from "@/lib/legal/query-parser";
import { makeSourceId } from "@/lib/legal/utils";

const LAW_TITLES: Record<string, { slug: string; title: string }> = {
  BGB: { slug: "bgb", title: "Bürgerliches Gesetzbuch" },
  VWGO: { slug: "vwgo", title: "Verwaltungsgerichtsordnung" },
  VWVFG: { slug: "vwvfg", title: "Verwaltungsverfahrensgesetz" },
  GG: { slug: "gg", title: "Grundgesetz" },
  STGB: { slug: "stgb", title: "Strafgesetzbuch" },
};

export function getDemoSources(query: string): LegalSourceRecord[] {
  const parsed = extractLawAndSection(query) ?? { law: "BGB", section: "280" };
  const law = LAW_TITLES[parsed.law] ?? LAW_TITLES.BGB;
  const path = parsed.section ? `/${law.slug}/__${parsed.section}.html` : `/${law.slug}/`;
  const url = new URL(path, "https://www.gesetze-im-internet.de").toString();
  return [
    {
      id: makeSourceId("Gesetze im Internet", url),
      title: `${law.title}${parsed.section ? ` – § ${parsed.section}` : ""}`,
      kind: "legislation",
      provider: "Gesetze im Internet",
      url,
      excerpt: "Demo-Quellenkarte: Der Inhalt wurde in diesem Lauf nicht live abgerufen.",
      official: true,
      verifiedAt: null,
      decisionDate: null,
      validFrom: null,
      metadata: { demo: true },
    },
  ];
}

function citations(sources: LegalSourceRecord[]) {
  return sources.slice(0, 2).map((source) => ({
    sourceId: source.id,
    label: source.title,
    pinpoint: source.title.match(/§\s*\d+[a-z]?/)?.[0] ?? "Übersicht",
  }));
}

export function createDemoResponse(
  request: AssistantRequest,
  sources: LegalSourceRecord[],
  sourceStatus: SourceStatus = "Teilweise verifiziert",
): AssistantResponse {
  const cited = citations(sources);
  const concernsAdministrativeLaw = /verwalt|vwvfg|vwgo/i.test(`${request.subject} ${request.query}`);

  if (request.mode === "socratic") {
    return {
      mode: "socratic",
      assessment: "Du hast das Thema benannt; für eine belastbare Prüfung fehlt noch der erste methodische Anknüpfungspunkt.",
      feedback: "Starte nicht mit dem Ergebnis, sondern identifiziere zunächst die passende Anspruchsgrundlage beziehungsweise Klageart.",
      nextQuestion: concernsAdministrativeLaw
        ? "Welche Handlungsform der Verwaltung liegt vor und woran erkennst du sie im Sachverhalt?"
        : "Welche Anspruchsgrundlage passt zum begehrten Schadensersatz und warum?",
      hintLevel: 1,
      completedCheckpoints: ["Rechtsgebiet eingeordnet"],
      nextCheckpoint: concernsAdministrativeLaw ? "Handlungsform bestimmen" : "Anspruchsgrundlage nennen",
      solutionRevealed: false,
      citations: cited,
      sourceStatus,
      uncertainties: ["Demo-Modus: Die amtliche Quelle wurde nicht live abgerufen."],
    };
  }

  if (request.mode === "correction") {
    return {
      mode: "correction",
      disclaimer: "Unverbindliche KI-Schätzung – keine offizielle Klausurbewertung",
      detectedMaterials: (request.attachments ?? []).length
        ? (request.attachments ?? []).map((file) => file.name)
        : ["Keine auswertbare Klausurdatei – Demo anhand der Anfrage"],
      summary: "Die Lösung erkennt die Grundstruktur, müsste die Voraussetzungen aber enger am Sachverhalt entwickeln und ihre Schwerpunkte deutlicher begründen.",
      estimatedScore: {
        central: 7,
        min: 5,
        max: 9,
        confidence: "niedrig",
        basis: "Demonstrationsbewertung ohne vollständigen Sachverhalt, Bearbeitervermerk und Korrekturraster.",
        assumptions: ["60–90-minütige Übungsklausur", "Übliche Bewertung auf der Skala von 0 bis 18 Punkten"],
      },
      rubric: [
        { criterion: "Aufbau", weight: "25 %", assessment: "Im Ansatz nachvollziehbar, Obersätze noch schärfen." },
        { criterion: "Subsumtion", weight: "40 %", assessment: "Zu abstrakt; Tatsachen und Merkmale enger verknüpfen." },
        { criterion: "Schwerpunkte", weight: "25 %", assessment: "Probleme erkannt, Gewichtung noch nicht überzeugend." },
        { criterion: "Sprache", weight: "10 %", assessment: "Verständlich; Gutachtenstil konsequenter einsetzen." },
      ],
      strengths: ["Grundproblem erkannt", "Vertretbare Gliederung gewählt"],
      issues: ["Zu wenig fallbezogene Subsumtion", "Rechtsfolgen nicht sauber vom Tatbestand getrennt"],
      lineFeedback: [
        {
          excerpt: "Aus der Anfrage lässt sich noch kein konkreter Klausurausschnitt sicher zitieren.",
          comment: "Lade die Seiten oder den Text hoch, damit Randkommentare an echten Passagen möglich werden.",
          severity: "wichtig",
        },
      ],
      missingIssues: ["Sachverhalt und Bearbeitervermerk fehlen", "Kein universitäres Punkteschema übermittelt"],
      improvedExamples: ["Obersatz → Definition → fallbezogene Subsumtion → Zwischenergebnis."],
      nextLearningSteps: ["Klausur vollständig hochladen", "Drei zentrale Subsumtionen neu formulieren"],
      citations: cited,
      sourceStatus,
      uncertainties: ["Die Punktespanne ist wegen fehlender Originalunterlagen bewusst breit."],
    };
  }

  return {
    mode: "explanation",
    title: concernsAdministrativeLaw ? "Sauber vom Verwaltungsakt zur Rechtsfolge" : "Anspruch systematisch prüfen",
    shortExplanation: concernsAdministrativeLaw
      ? "Im Verwaltungsrecht bestimmst du zuerst die Handlungsform und prüfst danach Rechtsgrundlage, formelle Rechtmäßigkeit, materielle Rechtmäßigkeit und Rechtsfolge."
      : "Im Schuldrecht führt ein guter Aufbau von der Anspruchsgrundlage über ihre Voraussetzungen bis zu Einwendungen und Einreden.",
    preciseExplanation: concernsAdministrativeLaw
      ? "Bei belastenden Verwaltungsakten ist die Ermächtigungsgrundlage Ausgangspunkt. Danach folgen Zuständigkeit, Verfahren und Form sowie die tatbestandlichen Voraussetzungen. Auf Rechtsfolgenseite ist besonders zwischen gebundener Entscheidung und Ermessen zu unterscheiden. Bei Aufhebungstatbeständen müssen außerdem Vertrauensschutz und die richtige landesrechtliche Normfassung beachtet werden."
      : "Bei § 280 Abs. 1 BGB sind Schuldverhältnis, Pflichtverletzung, Vertretenmüssen und Schaden zu prüfen. Das Vertretenmüssen wird vermutet; die Abgrenzung zu Schadensersatz statt der Leistung entscheidet darüber, ob zusätzliche Voraussetzungen wie eine Fristsetzung hinzukommen.",
    example: concernsAdministrativeLaw
      ? "Eine Behörde nimmt einen begünstigenden Bescheid zurück. Dann genügt es nicht, nur die ursprüngliche Rechtswidrigkeit festzustellen; Vertrauensschutz und Ermessen gehören in die Prüfung."
      : "Liefert V mangelhaft und beschädigt die Sache weitere Rechtsgüter, ist zu trennen, welcher Schaden neben und welcher statt der Leistung verlangt wird.",
    examRelevance: "Punkte entstehen vor allem durch den passenden Einstieg, klare Prüfungsebenen und eine echte Subsumtion am Sachverhalt.",
    typicalErrors: ["Normen nur aufzählen", "Tatbestand und Rechtsfolge vermischen", "Bundes- und Landesrecht ungeprüft gleichsetzen"],
    connections: concernsAdministrativeLaw
      ? ["Statthafte Klageart nach der VwGO", "Rücknahme und Widerruf", "VwVfG NRW"]
      : ["§§ 281 und 323 BGB", "Gewährleistungsrecht", "Schadensarten"],
    citations: cited,
    sourceStatus,
    uncertainties: ["Demo-Modus: Quellenkarte und Antwort wurden nicht live abgeglichen."],
    nextActions: ["Prüfungsschema aus dem Gedächtnis notieren", "Einen Mini-Fall subsumieren", "Im Lernmodus abfragen lassen"],
  };
}
