import { describe, expect, it } from "vitest";
import { assistantRequestSchema, correctionResponseSchema, explanationResponseSchema } from "@/lib/ai/schemas";

const validCorrection = {
  mode: "correction" as const,
  disclaimer: "Unverbindliche KI-Schätzung – keine offizielle Klausurbewertung" as const,
  detectedMaterials: ["klausur.pdf"],
  summary: "Solider Ansatz.",
  estimatedScore: {
    central: 8,
    min: 6,
    max: 10,
    confidence: "mittel" as const,
    basis: "Vollständige Probeklausur.",
    assumptions: [],
  },
  rubric: [
    { criterion: "Rechtskenntnis", weight: "30 %", assessment: "Im Ansatz vorhanden" },
    { criterion: "Subsumtion", weight: "40 %", assessment: "Ausbaufähig" },
    { criterion: "Aufbau", weight: "30 %", assessment: "Nachvollziehbar" },
  ],
  strengths: ["Aufbau"],
  issues: ["Subsumtion"],
  lineFeedback: [{ excerpt: "Daher ...", comment: "Begründen.", severity: "wichtig" as const }],
  missingIssues: [],
  improvedExamples: ["A könnte ..."],
  nextLearningSteps: ["Neu formulieren"],
  citations: [],
  sourceStatus: "Nicht aktuell verifiziert" as const,
  uncertainties: [],
};

describe("correctionResponseSchema", () => {
  it("requires the explicit non-official grade disclaimer", () => {
    expect(correctionResponseSchema.parse(validCorrection).estimatedScore.central).toBe(8);
    expect(
      correctionResponseSchema.safeParse({ ...validCorrection, disclaimer: "Unverbindlich" }).success,
    ).toBe(false);
  });

  it("rejects scores outside the German 0–18 point scale", () => {
    const invalid = {
      ...validCorrection,
      estimatedScore: { ...validCorrection.estimatedScore, central: 19 },
    };
    expect(correctionResponseSchema.safeParse(invalid).success).toBe(false);
  });
});

describe("concise assistant requests and responses", () => {
  it("uses the normal model preset when an older client omits it", () => {
    const request = assistantRequestSchema.parse({
      mode: "explanation",
      subject: "Schuldrecht II",
      query: "Erkläre § 280 BGB.",
      attachments: [],
    });
    expect(request.modelPreset).toBe("normal");
    expect(assistantRequestSchema.safeParse({ ...request, modelPreset: "beliebiges-modell" }).success).toBe(false);
  });

  it("caps optional explanation filler", () => {
    const response = {
      mode: "explanation" as const,
      title: "Kurz",
      shortExplanation: "Antwort",
      preciseExplanation: "Details",
      example: "",
      examRelevance: "",
      typicalErrors: ["Fehler 1", "Fehler 2", "Fehler 3"],
      connections: [],
      nextActions: [],
      citations: [],
      sourceStatus: "Nicht aktuell verifiziert" as const,
      uncertainties: [],
    };
    expect(explanationResponseSchema.safeParse(response).success).toBe(false);
  });
});
