import { NextResponse } from "next/server";
import { assistantRequestSchema } from "@/lib/ai/schemas";
import { createDemoResponse, getDemoSources } from "@/lib/ai/mock";
import { generateWithOpenAI } from "@/lib/ai/openai";
import { requireAppUser, AuthenticationError } from "@/lib/auth/server";
import { getServerEnvironment } from "@/lib/config/env";
import { calculateRunCostEur, getBudgetState } from "@/lib/cost/pricing";
import {
  getConversationContext,
  getMonthlySpendEur,
  getOwnedAttachmentReferences,
  persistInteraction,
} from "@/lib/data/persistence";
import { deriveSourceStatus, researchOfficialSources } from "@/lib/legal/composite-provider";
import { buildCorrectionResearchQuery } from "@/lib/legal/query-parser";
import { isSameOriginRequest } from "@/lib/security/origin";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  const startedAt = Date.now();
  try {
    if (!isSameOriginRequest(request)) {
      return NextResponse.json({ error: "Anfrage von einer fremden Herkunft abgelehnt." }, { status: 403 });
    }
    const user = await requireAppUser();
    const parsed = assistantRequestSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Die Anfrage ist unvollständig.", details: parsed.error.flatten() },
        { status: 400 },
      );
    }
    const input = parsed.data;
    const env = getServerEnvironment();

    if (user.demo) {
      const sources = getDemoSources(`${input.subject} ${input.query}`);
      const sourceStatus = "Teilweise verifiziert" as const;
      return NextResponse.json({
        answer: createDemoResponse(input, sources, sourceStatus),
        sources,
        conversationId: input.conversationId ?? crypto.randomUUID(),
        meta: { demo: true, sourceStatus, durationMs: Date.now() - startedAt, costEur: 0, modelPreset: input.modelPreset },
      });
    }

    const spentEur = await getMonthlySpendEur();
    const budget = getBudgetState(spentEur, env.MONTHLY_AI_BUDGET_EUR);
    if (budget.blocked) {
      return NextResponse.json(
        { error: "Das gemeinsame Monatsbudget ist erreicht.", budget },
        { status: 402 },
      );
    }

    const effectiveInput = {
      ...input,
      attachments: getOwnedAttachmentReferences(user.id, input.attachments ?? []),
    };
    const history = effectiveInput.conversationId ? getConversationContext(user.id, effectiveInput.conversationId) : [];
    const previousQuestion = [...history].reverse().find((message) => message.role === "user")?.content ?? "";
    const researchQuery = effectiveInput.mode === "correction"
      ? buildCorrectionResearchQuery(
          effectiveInput.subject,
          effectiveInput.query,
          (effectiveInput.attachments ?? []).map((attachment) => attachment.extractedText),
          previousQuestion,
        )
      : `${effectiveInput.subject}: ${effectiveInput.query}${previousQuestion ? ` Kontext: ${previousQuestion}` : ""}`;
    const research = await researchOfficialSources(
      researchQuery,
      effectiveInput.mode,
    );
    const hasSupportingCourseDocument = (effectiveInput.attachments ?? []).some((attachment) =>
      attachment.documentType === "lösungsskizze" ||
      attachment.documentType === "bewertungsbogen" ||
      attachment.documentType === "skript"
    );
    const sourceStatus = deriveSourceStatus(research.sources, hasSupportingCourseDocument);
    const generated = await generateWithOpenAI(effectiveInput, research, sourceStatus, history);
    const costEur = calculateRunCostEur(generated.model, generated.usage, env.EUR_PER_USD);
    const conversationId = await persistInteraction({
      userId: user.id,
      request: effectiveInput,
      response: generated,
      sources: research.sources,
      costEur,
      durationMs: Date.now() - startedAt,
    });

    return NextResponse.json({
      answer: generated.answer,
      sources: research.sources,
      conversationId,
      meta: {
        demo: false,
        model: generated.model,
        modelPreset: input.modelPreset,
        sourceStatus,
        durationMs: Date.now() - startedAt,
        costEur,
        budget: getBudgetState(spentEur + costEur, env.MONTHLY_AI_BUDGET_EUR),
      },
    });
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    console.error("assistant_route_failed", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Die Antwort konnte nicht erstellt werden." },
      { status: 502 },
    );
  }
}
