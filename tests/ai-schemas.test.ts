import { describe, expect, it } from "vitest";
import { correctionResponseSchema } from "@/lib/ai/schemas";

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
  rubric: [{ criterion: "Subsumtion", weight: "40 %", assessment: "Ausbaufähig" }],
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
