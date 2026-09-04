import { describe, expect, it } from "vitest";
import { calculateRunCostEur, getBudgetState } from "@/lib/cost/pricing";

describe("cost guard", () => {
  it("calculates input and output cost from the versioned price table", () => {
    expect(calculateRunCostEur("gpt-5.6-terra", { inputTokens: 1_000_000, outputTokens: 1_000_000 }, 1)).toBe(14);
  });

  it("warns at 80 percent and blocks at 100 percent", () => {
    expect(getBudgetState(8, 10)).toMatchObject({ warning: true, blocked: false });
    expect(getBudgetState(10, 10)).toMatchObject({ warning: false, blocked: true });
  });
});
