import { describe, expect, it } from "vitest";
import { buildLegalSearchQueries, decideLegalRetrieval, extractLawAndSection } from "@/lib/legal/query-parser";

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
});
