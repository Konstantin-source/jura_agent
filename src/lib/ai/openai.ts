import "server-only";

import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import {
  assistantResponseSchema,
  correctionResponseSchema,
  explanationResponseSchema,
  socraticResponseSchema,
  type AssistantRequest,
  type AssistantResponse,
  type SourceStatus,
} from "@/lib/ai/schemas";
import { buildSystemPrompt, buildUserPrompt } from "@/lib/ai/prompts";
import { getServerEnvironment } from "@/lib/config/env";
import type { LegalResearchResult } from "@/lib/legal/types";
import { validateResponseCitations } from "@/lib/legal/source-validator";

export interface GeneratedAssistantResponse {
  answer: AssistantResponse;
  model: string;
  responseId: string;
  usage: { inputTokens: number; outputTokens: number };
}

const MODE_SETTINGS = {
  explanation: { effort: "low" as const, maxOutputTokens: 2_200 },
  socratic: { effort: "medium" as const, maxOutputTokens: 1_300 },
  correction: { effort: "high" as const, maxOutputTokens: 4_800 },
};

export async function generateWithOpenAI(
  request: AssistantRequest,
  research: LegalResearchResult,
  sourceStatus: SourceStatus,
): Promise<GeneratedAssistantResponse> {
  const env = getServerEnvironment();
  if (!env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY fehlt.");
  const client = new OpenAI({ apiKey: env.OPENAI_API_KEY });
  const settings = MODE_SETTINGS[request.mode];
  const schema =
    request.mode === "correction"
      ? correctionResponseSchema
      : request.mode === "socratic"
        ? socraticResponseSchema
        : explanationResponseSchema;

  const response = await client.responses.parse({
    model: env.OPENAI_PRIMARY_MODEL,
    store: false,
    reasoning: { effort: settings.effort },
    max_output_tokens: settings.maxOutputTokens,
    input: [
      { role: "system", content: buildSystemPrompt(request, research, sourceStatus) },
      { role: "user", content: buildUserPrompt(request) },
    ],
    text: {
      format: zodTextFormat(schema, `jura_agent_${request.mode}`),
    },
  });

  if (!response.output_parsed) {
    const refusal = response.output
      .flatMap((item) => (item.type === "message" ? item.content : []))
      .find((content) => content.type === "refusal");
    throw new Error(refusal?.refusal ?? "Das Modell lieferte keine strukturierte Antwort.");
  }

  const answer = assistantResponseSchema.parse(response.output_parsed);
  validateResponseCitations(answer, research.sources);
  return {
    answer,
    model: env.OPENAI_PRIMARY_MODEL,
    responseId: response.id,
    usage: {
      inputTokens: response.usage?.input_tokens ?? 0,
      outputTokens: response.usage?.output_tokens ?? 0,
    },
  };
}
