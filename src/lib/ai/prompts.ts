import type { AssistantRequest, SourceStatus } from "@/lib/ai/schemas";
import type { LegalResearchResult } from "@/lib/legal/types";
import { wrapUntrustedDocumentText } from "@/lib/documents/policy";
import { renderSkillsForPrompt, resolveSkills } from "@/lib/skills/resolver";

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
  const attachments = (request.attachments ?? [])
    .map((attachment) =>
      `Datei: ${attachment.name} (${attachment.mimeType})\n${wrapUntrustedDocumentText(attachment.extractedText)}`,
    )
    .join("\n\n");
  return [
    `Anfrage: ${request.query}`,
    attachments ? `Hochgeladene Unterlagen:\n${attachments}` : "Keine hochgeladenen Unterlagen.",
  ].join("\n\n");
}
