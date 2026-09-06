import { z } from "zod";
import { DEFAULT_MODEL_PRESET, MODEL_PRESET_IDS } from "@/lib/ai/models";

export const learningModeSchema = z.enum(["explanation", "socratic", "correction"]);
export type LearningMode = z.infer<typeof learningModeSchema>;

export const sourceStatusSchema = z.enum([
  "Amtlich verifiziert",
  "Mit Kursunterlage belegt",
  "Teilweise verifiziert",
  "Nicht aktuell verifiziert",
]);
export type SourceStatus = z.infer<typeof sourceStatusSchema>;

export const citationSchema = z
  .object({
    sourceId: z.string().min(1),
    label: z.string().min(1),
    pinpoint: z.string(),
  })
  .strict();

const baseResponseFields = {
  citations: z.array(citationSchema),
  sourceStatus: sourceStatusSchema,
  uncertainties: z.array(z.string().max(280)).max(2),
} as const;

export const explanationResponseSchema = z
  .object({
    mode: z.literal("explanation"),
    title: z.string().max(100),
    shortExplanation: z.string().max(700),
    preciseExplanation: z.string().max(1_500),
    example: z.string().max(600),
    examRelevance: z.string().max(500),
    typicalErrors: z.array(z.string().max(280)).max(2),
    connections: z.array(z.string().max(220)).max(1),
    ...baseResponseFields,
    nextActions: z.array(z.string().max(220)).max(1),
  })
  .strict();

export const socraticResponseSchema = z
  .object({
    mode: z.literal("socratic"),
    assessment: z.string(),
    feedback: z.string(),
    nextQuestion: z.string(),
    hintLevel: z.number().int().min(0).max(3),
    completedCheckpoints: z.array(z.string()),
    nextCheckpoint: z.string(),
    solutionRevealed: z.boolean(),
    citations: z.array(citationSchema),
    sourceStatus: sourceStatusSchema,
    uncertainties: z.array(z.string()),
  })
  .strict();

const scoreSchema = z
  .object({
    central: z.number().min(0).max(18),
    min: z.number().min(0).max(18),
    max: z.number().min(0).max(18),
    confidence: z.enum(["niedrig", "mittel", "hoch"]),
    basis: z.string(),
    assumptions: z.array(z.string()),
  })
  .strict();

const rubricItemSchema = z
  .object({
    criterion: z.string(),
    weight: z.string(),
    assessment: z.string(),
  })
  .strict();

const lineFeedbackSchema = z
  .object({
    excerpt: z.string(),
    comment: z.string(),
    severity: z.enum(["hinweis", "wichtig", "kritisch"]),
  })
  .strict();

export const correctionResponseSchema = z
  .object({
    mode: z.literal("correction"),
    disclaimer: z.literal("Unverbindliche KI-Schätzung – keine offizielle Klausurbewertung"),
    detectedMaterials: z.array(z.string()),
    summary: z.string(),
    estimatedScore: scoreSchema,
    rubric: z.array(rubricItemSchema),
    strengths: z.array(z.string()),
    issues: z.array(z.string()),
    lineFeedback: z.array(lineFeedbackSchema),
    missingIssues: z.array(z.string()),
    improvedExamples: z.array(z.string()),
    nextLearningSteps: z.array(z.string()),
    ...baseResponseFields,
  })
  .strict();

export const assistantResponseSchema = z.discriminatedUnion("mode", [
  explanationResponseSchema,
  socraticResponseSchema,
  correctionResponseSchema,
]);

export type AssistantResponse = z.infer<typeof assistantResponseSchema>;
export type ExplanationResponse = z.infer<typeof explanationResponseSchema>;
export type SocraticResponse = z.infer<typeof socraticResponseSchema>;
export type CorrectionResponse = z.infer<typeof correctionResponseSchema>;

export interface ConversationContextMessage {
  role: "user" | "assistant";
  content: string;
}

export const attachmentReferenceSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    mimeType: z.string(),
    extractedText: z.string().max(120_000),
  })
  .strict();

export const assistantRequestSchema = z
  .object({
    mode: learningModeSchema,
    subject: z.string().min(1).max(120),
    query: z.string().min(2).max(20_000),
    conversationId: z.string().uuid().nullable().optional(),
    attachments: z.array(attachmentReferenceSchema).max(10).optional(),
    modelPreset: z.enum(MODEL_PRESET_IDS).default(DEFAULT_MODEL_PRESET),
  })
  .strict();

export type AssistantRequest = z.infer<typeof assistantRequestSchema>;
