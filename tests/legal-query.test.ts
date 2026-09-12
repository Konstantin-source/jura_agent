import { describe, expect, it } from "vitest";
import {
  buildCorrectionResearchQuery,
  buildLegalSearchQueries,
  decideLegalRetrieval,
  extractLawAndSection,
  extractLegalReferences,
} from "@/lib/legal/query-parser";

describe("legal retrieval decision", () => {
  it("requires official retrieval for concrete provisions", () => {
    const result = decideLegalRetrieval("Was bedeutet § 280 Abs. 1 BGB?", "explanation");
    expect(result.required).toBe(true);
    expect(result.references[0]).toContain("§ 280");
  });

  it("requires official retrieval for every correction", () => {
    expect(decideLegalRetrieval("Korrigiere meinen Aufbau", "correction").required).toBe(true);
  });

  it("also checks broad legal learning questions", () => {
    const result = decideLegalRetrieval("Was ist der Unterschied zwischen Rücknahme und Widerruf?", "explanation");
    expect(result.required).toBe(true);
    expect(buildLegalSearchQueries("Allgemeines Verwaltungsrecht: Was ist der Unterschied zwischen Rücknahme und Widerruf?"))
      .toContain("VwVfG rücknahme widerruf");
  });

  it("detects law and section in both common orders", () => {
    expect(extractLawAndSection("§ 48 VwVfG")).toEqual({ law: "VWVFG", section: "48" });
    expect(extractLawAndSection("BGB § 281")).toEqual({ law: "BGB", section: "281" });
    expect(extractLawAndSection("Allgemeines Verwaltungsrecht: Rücknahme eines Bescheids"))
      .toEqual({ law: "VWVFG" });
  });

  it("extracts exact provisions from uploaded correction materials", () => {
    expect(extractLegalReferences("A verlangt nach § 280 Abs. 1 BGB Ersatz. Art. 20 Abs. 3 GG ist nicht einschlägig.")).toEqual([
      "§ 280 Abs. 1 BGB",
      "Art. 20 Abs. 3 GG",
    ]);
    expect(buildCorrectionResearchQuery(
      "Schuldrecht II",
      "Korrigiere meine Lösung.",
      ["Geprüft wurden § 280 Abs. 1 BGB und § 281 BGB."],
    )).toContain("Normen aus den Klausurunterlagen: § 280 Abs. 1 BGB; § 281 BGB");
  });
});
