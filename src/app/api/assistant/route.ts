import { NextResponse } from "next/server";
import { assistantRequestSchema } from "@/lib/ai/schemas";
import { createDemoResponse, getDemoSources } from "@/lib/ai/mock";
import { generateWithOpenAI } from "@/lib/ai/openai";
import { requireAppUser, AuthenticationError } from "@/lib/auth/server";
import { getServerEnvironment } from "@/lib/config/env";
import { calculateRunCostEur, getBudgetState } from "@/lib/cost/pricing";
import { getMonthlySpendEur, persistInteraction } from "@/lib/data/persistence";
import { deriveSourceStatus, researchOfficialSources } from "@/lib/legal/composite-provider";
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
        meta: { demo: true, sourceStatus, durationMs: Date.now() - startedAt, costEur: 0 },
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

    const research = await researchOfficialSources(`${input.subject}: ${input.query}`, input.mode);
    const sourceStatus = deriveSourceStatus(research.sources, Boolean(input.attachments?.length));
    const generated = await generateWithOpenAI(input, research, sourceStatus);
    const costEur = calculateRunCostEur(generated.model, generated.usage, env.EUR_PER_USD);
    const conversationId = await persistInteraction({
      userId: user.id,
      request: input,
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
