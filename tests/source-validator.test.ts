import { describe, expect, it } from "vitest";
import { createDemoResponse, getDemoSources } from "@/lib/ai/mock";
import { UnknownCitationError, validateResponseCitations } from "@/lib/legal/source-validator";

describe("citation validation", () => {
  it("accepts citations returned by the provider", () => {
    const sources = getDemoSources("§ 280 BGB");
    const answer = createDemoResponse(
      { mode: "explanation", subject: "Schuldrecht II", query: "§ 280 BGB", attachments: [] },
      sources,
    );
    expect(validateResponseCitations(answer, sources)).toBe(answer);
  });

  it("rejects model-invented source IDs", () => {
    const sources = getDemoSources("§ 280 BGB");
    const answer = createDemoResponse(
      { mode: "explanation", subject: "Schuldrecht II", query: "§ 280 BGB", attachments: [] },
      sources,
    );
    answer.citations[0].sourceId = "src_invented";
    expect(() => validateResponseCitations(answer, sources)).toThrow(UnknownCitationError);
  });
});
