export const MODEL_PRESET_IDS = ["economy", "normal", "advanced", "expert"] as const;

export type ModelPresetId = (typeof MODEL_PRESET_IDS)[number];
export type ReasoningEffort = "low" | "medium" | "high";

export interface ModelPreset {
  id: ModelPresetId;
  label: string;
  model: "gpt-5.6-luna" | "gpt-5.6-terra" | "gpt-5.6-sol";
  reasoningEffort: ReasoningEffort;
  description: string;
  maxOutputTokens: Record<"explanation" | "socratic" | "correction", number>;
}

export const MODEL_PRESETS: readonly ModelPreset[] = [
  {
    id: "economy",
    label: "Sparsam",
    model: "gpt-5.6-luna",
    reasoningEffort: "low",
    description: "Luna · kurz und sehr günstig",
    maxOutputTokens: { explanation: 1_600, socratic: 1_000, correction: 3_800 },
  },
  {
    id: "normal",
    label: "Normal",
    model: "gpt-5.6-luna",
    reasoningEffort: "medium",
    description: "Luna · für normale Lernfragen",
    maxOutputTokens: { explanation: 2_000, socratic: 1_300, correction: 4_500 },
  },
  {
    id: "advanced",
    label: "Stärker",
    model: "gpt-5.6-terra",
    reasoningEffort: "medium",
    description: "Terra · für schwierigere Fälle",
    maxOutputTokens: { explanation: 2_500, socratic: 1_600, correction: 5_200 },
  },
  {
    id: "expert",
    label: "Stark",
    model: "gpt-5.6-sol",
    reasoningEffort: "high",
    description: "Sol · für komplexe Klausuren",
    maxOutputTokens: { explanation: 3_000, socratic: 1_900, correction: 6_000 },
  },
] as const;

export const DEFAULT_MODEL_PRESET: ModelPresetId = "normal";

export function getModelPreset(id: ModelPresetId): ModelPreset {
  return MODEL_PRESETS.find((preset) => preset.id === id) ?? MODEL_PRESETS[1];
}
