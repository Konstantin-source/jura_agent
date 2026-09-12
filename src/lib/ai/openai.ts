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
  type ConversationContextMessage,
  type SourceStatus,
} from "@/lib/ai/schemas";
import { buildSystemPrompt, buildUserPrompt } from "@/lib/ai/prompts";
import { getModelPreset } from "@/lib/ai/models";
import { getServerEnvironment } from "@/lib/config/env";
import type { LegalResearchResult } from "@/lib/legal/types";
import { validateResponseCitations } from "@/lib/legal/source-validator";

export interface GeneratedAssistantResponse {
  answer: AssistantResponse;
  model: string;
  responseId: string;
  usage: { inputTokens: number; outputTokens: number };
}

const GENERIC_SOURCE_UNCERTAINTY = /(?:keine|ohne).*(?:amtliche|bereitgestellte).*quelle|quellen-id|(?:aktuelle|konkrete).*(?:geltung|fassung).*nicht.*verifiziert/i;

function removeRedundantSourceWarnings(answer: AssistantResponse): AssistantResponse {
  return {
    ...answer,
    uncertainties: answer.uncertainties
      .filter((uncertainty) => !GENERIC_SOURCE_UNCERTAINTY.test(uncertainty))
      .slice(0, 2),
  } as AssistantResponse;
}

function calibrateCorrection(answer: AssistantResponse, request: AssistantRequest): AssistantResponse {
  if (answer.mode !== "correction") return answer;

  const documentTypes = new Set((request.attachments ?? []).map((attachment) => attachment.documentType));
  const hasStudentAnswer = documentTypes.has("bearbeitung") || documentTypes.has("kombiniertes-klausurdokument");
  const hasTaskMaterial = documentTypes.has("sachverhalt") || documentTypes.has("bearbeitervermerk") || documentTypes.has("kombiniertes-klausurdokument");
  const weakEvidence = !hasStudentAnswer || (request.attachments ?? []).some((attachment) => attachment.legibility === "schlecht");
  const confidence = weakEvidence ? "niedrig" : !hasTaskMaterial && answer.estimatedScore.confidence === "hoch" ? "mittel" : answer.estimatedScore.confidence;
  const minimumSpread = weakEvidence ? 3 : !hasTaskMaterial ? 2 : 0;
  const central = answer.estimatedScore.central;
  const min = Math.min(answer.estimatedScore.min, central, Math.max(0, central - minimumSpread));
  const max = Math.max(answer.estimatedScore.max, central, Math.min(18, central + minimumSpread));

  return {
    ...answer,
    estimatedScore: { ...answer.estimatedScore, min, central, max, confidence },
  };
}

export async function generateWithOpenAI(
  request: AssistantRequest,
  research: LegalResearchResult,
  sourceStatus: SourceStatus,
  history: ConversationContextMessage[] = [],
): Promise<GeneratedAssistantResponse> {
  const env = getServerEnvironment();
  if (!env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY fehlt.");
  const client = new OpenAI({ apiKey: env.OPENAI_API_KEY });
  const preset = getModelPreset(request.modelPreset);
  const schema =
    request.mode === "correction"
      ? correctionResponseSchema
      : request.mode === "socratic"
        ? socraticResponseSchema
        : explanationResponseSchema;

  const response = await client.responses.parse({
    model: preset.model,
    store: false,
    reasoning: { effort: preset.reasoningEffort },
    max_output_tokens: preset.maxOutputTokens[request.mode],
    input: [
      { role: "system", content: buildSystemPrompt(request, research, sourceStatus) },
      ...history.map((message) => ({ role: message.role, content: message.content })),
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

  const answer = calibrateCorrection(
    removeRedundantSourceWarnings(assistantResponseSchema.parse(response.output_parsed)),
    request,
  );
  validateResponseCitations(answer, research.sources);
  return {
    answer,
    model: preset.model,
    responseId: response.id,
    usage: {
      inputTokens: response.usage?.input_tokens ?? 0,
      outputTokens: response.usage?.output_tokens ?? 0,
    },
  };
}
