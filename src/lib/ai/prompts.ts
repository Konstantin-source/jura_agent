import type { AssistantRequest, SourceStatus } from "@/lib/ai/schemas";
import type { LegalResearchResult } from "@/lib/legal/types";
import { wrapUntrustedDocumentText } from "@/lib/documents/policy";
import { DOCUMENT_TYPE_LABELS } from "@/lib/documents/types";
import { renderSkillsForPrompt, resolveSkills } from "@/lib/skills/resolver";

const MAX_DOCUMENT_EVIDENCE_CHARS = 180_000;

function renderSources(research: LegalResearchResult): string {
  if (research.sources.length === 0) return "Keine amtliche Quelle wurde für diese Anfrage bereitgestellt.";
  return research.sources
    .map(
      (source) =>
        `[${source.id}] ${source.title}\nAnbieter: ${source.provider}\nURL: ${source.url}\n` +
        `Geprüft: ${source.verifiedAt ?? "nein"}\nAuszug: ${source.excerpt || "Kein Textauszug verfügbar."}`,
    )
    .join("\n\n");
}

export function buildSystemPrompt(
  request: AssistantRequest,
  research: LegalResearchResult,
  sourceStatus: SourceStatus,
): string {
  const skills = resolveSkills(request.mode, request.subject);
  return [
    "# Verbindlicher Auftrag",
    renderSkillsForPrompt(skills),
    "# Laufzeitkontext",
    `Datum: ${new Date().toISOString().slice(0, 10)}`,
    `Fach: ${request.subject}`,
    `Quellenstatus, der exakt auszugeben ist: ${sourceStatus}`,
    "Zitiere nur Quellen-IDs aus dem folgenden Block. Wenn der Block leer ist, muss citations leer bleiben.",
    renderSources(research),
    research.warnings.length ? `Abrufwarnungen: ${research.warnings.join(" | ")}` : "Abrufwarnungen: keine",
    "Antworte unmittelbar auf die konkrete Frage. Wiederhole die Frage nicht und ergänze keine allgemeine Einleitung.",
    "Nutze frühere Nachrichten für Rückbezüge und Folgefragen, beantworte aber vorrangig die aktuelle Nutzeranfrage.",
    "Halte die sichtbare Antwort knapp: kurze Absätze, höchstens zwei typische Fehler und keine Wiederholungen zwischen den Feldern.",
    "Verwende innerhalb der Textfelder kein Markdown wie **Fettdruck**, Überschriften oder Listenmarker; die Oberfläche übernimmt die Struktur.",
    "Beispiel, Klausurrelevanz, Verbindung oder Lernschritt nur ausfüllen, wenn sie die konkrete Antwort wirklich verbessern; sonst leere Zeichenfolge beziehungsweise leere Liste.",
    "Der Quellenstatus genügt als Hinweis auf fehlende Aktualitätsprüfung. Wiederhole diesen Hinweis nicht zusätzlich unter Unsicherheiten.",
    "Gib ausschließlich die verlangte strukturierte Antwort aus. Keine Markdown-Fundnoten außerhalb des Schemas.",
  ].join("\n\n");
}

export function buildUserPrompt(request: AssistantRequest): string {
  let remainingCharacters = MAX_DOCUMENT_EVIDENCE_CHARS;
  const attachments = (request.attachments ?? []).map((attachment, index) => {
    const extractedText = attachment.extractedText.trim();
    const includedText = extractedText.slice(0, Math.max(0, remainingCharacters));
    remainingCharacters -= includedText.length;
    const truncated = includedText.length < extractedText.length;
    const metadata = [
      `Kennung: D${index + 1}`,
      `Dateiname: ${attachment.name}`,
      `Dokumentrolle: ${attachment.documentType ? DOCUMENT_TYPE_LABELS[attachment.documentType] : "nicht klassifiziert"}`,
      `Seiten: ${attachment.pageCount ?? "unbekannt"}`,
      `Lesbarkeit: ${attachment.legibility ?? "unbekannt"}`,
      `OCR-Warnungen: ${attachment.warnings?.join(" | ") || "keine"}`,
      `Kontextkürzung: ${truncated ? "ja – nachfolgender Text ist unvollständig" : "nein"}`,
      "--- BEGINN DOKUMENTTEXT ---",
      includedText || "[Kein auswertbarer Text erkannt]",
      "--- ENDE DOKUMENTTEXT ---",
    ].join("\n");
    return wrapUntrustedDocumentText(metadata);
  }).join("\n\n");

  return [
    request.mode === "correction" ? "KORREKTURAUFTRAG" : "ANFRAGE",
    request.query,
    attachments
      ? `MATERIALVERZEICHNIS UND DOKUMENTTEXT\n${attachments}`
      : "MATERIALVERZEICHNIS\nKeine hochgeladenen Unterlagen.",
  ].join("\n\n");
}
