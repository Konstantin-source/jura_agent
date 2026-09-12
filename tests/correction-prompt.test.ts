import { describe, expect, it } from "vitest";
import { buildSystemPrompt, buildUserPrompt } from "@/lib/ai/prompts";
import type { AssistantRequest } from "@/lib/ai/schemas";
import type { LegalResearchResult } from "@/lib/legal/types";

const request: AssistantRequest = {
  mode: "correction",
  subject: "Schuldrecht II",
  query: "Korrigiere die Lösung fair.",
  modelPreset: "normal",
  attachments: [{
    id: "document-1",
    name: "bearbeitung.pdf",
    mimeType: "application/pdf",
    extractedText: "[Seite 1]\nA könnte gegen B einen Anspruch aus § 280 Abs. 1 BGB haben.",
    documentType: "bearbeitung",
    pageCount: 3,
    legibility: "teilweise",
    warnings: ["Eine Randnotiz ist unleserlich."],
  }],
};

const research: LegalResearchResult = {
  query: "§ 280 Abs. 1 BGB",
  sources: [],
  attemptedProviders: ["NeuRIS"],
  warnings: [],
  live: false,
};

describe("evidence-aware correction prompt", () => {
  it("passes document role, pages, legibility and OCR warnings explicitly", () => {
    const prompt = buildUserPrompt(request);
    expect(prompt).toContain("Dokumentrolle: studentische Bearbeitung");
    expect(prompt).toContain("Seiten: 3");
    expect(prompt).toContain("Lesbarkeit: teilweise");
    expect(prompt).toContain("Eine Randnotiz ist unleserlich.");
    expect(prompt).toContain("[Seite 1]");
  });

  it("loads the correction protocol into the system prompt", () => {
    const prompt = buildSystemPrompt(request, research, "Mit Kursunterlage belegt");
    expect(prompt).toContain("interne Referenzlösung");
    expect(prompt).toContain("studentischen Bearbeitung tatsächlich steht");
    expect(prompt).toContain("Bewertungsbogen oder eine Lösungsskizze");
  });
});
