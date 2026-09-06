export interface ModelPrice {
  model: string;
  inputUsdPerMillion: number;
  outputUsdPerMillion: number;
  effectiveFrom: string;
}

// Versioned snapshot. Review against the official OpenAI pricing page before changing models.
export const MODEL_PRICES: ModelPrice[] = [
  {
    model: "gpt-5.6-sol",
    inputUsdPerMillion: 4,
    outputUsdPerMillion: 20,
    effectiveFrom: "2026-09-06",
  },
  {
    model: "gpt-5.6-terra",
    inputUsdPerMillion: 2,
    outputUsdPerMillion: 12,
    effectiveFrom: "2026-09-04",
  },
  {
    model: "gpt-5.6-luna",
    inputUsdPerMillion: 0.2,
    outputUsdPerMillion: 1.2,
    effectiveFrom: "2026-09-04",
  },
];

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
}

export function calculateRunCostEur(
  model: string,
  usage: TokenUsage,
  eurPerUsd: number,
): number {
  const price = MODEL_PRICES.find((entry) => model === entry.model || model.startsWith(`${entry.model}-`));
  if (!price) throw new Error(`Für das Modell ${model} ist keine geprüfte Preisangabe hinterlegt.`);
  const inputUsd = (usage.inputTokens / 1_000_000) * price.inputUsdPerMillion;
  const outputUsd = (usage.outputTokens / 1_000_000) * price.outputUsdPerMillion;
  return Number(((inputUsd + outputUsd) * eurPerUsd).toFixed(6));
}

export function getBudgetState(spentEur: number, budgetEur: number) {
  const ratio = budgetEur > 0 ? spentEur / budgetEur : 1;
  return {
    spentEur,
    budgetEur,
    ratio,
    warning: ratio >= 0.8 && ratio < 1,
    blocked: ratio >= 1,
    remainingEur: Math.max(0, budgetEur - spentEur),
  };
}
