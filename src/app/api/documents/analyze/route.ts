import { NextResponse } from "next/server";
import { requireAppUser, AuthenticationError } from "@/lib/auth/server";
import { getServerEnvironment } from "@/lib/config/env";
import { calculateRunCostEur, getBudgetState } from "@/lib/cost/pricing";
import {
  getMonthlySpendEur,
  persistDocument,
  persistStandaloneAiRun,
} from "@/lib/data/persistence";
import { extractDocumentWithOpenAI, estimatePdfPageCount } from "@/lib/documents/extract";
import { validateUpload } from "@/lib/documents/policy";
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
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return NextResponse.json({ error: "Keine Datei übermittelt." }, { status: 400 });
    const validation = validateUpload(file);
    if (!validation.valid) return NextResponse.json({ error: validation.message }, { status: 400 });

    if (file.type === "text/plain" || file.type === "text/markdown") {
      const extractedText = (await file.text()).slice(0, 120_000);
      if (user.demo) {
        return NextResponse.json({
          document: { id: crypto.randomUUID(), name: file.name, mimeType: file.type, extractedText },
          warnings: ["Demo-Modus: Die Datei wurde nicht dauerhaft gespeichert."],
          demo: true,
        });
      }
      const stored = await persistDocument(user.id, file, extractedText, 1);
      return NextResponse.json({
        document: { id: stored.id, name: file.name, mimeType: file.type, extractedText },
        warnings: [],
        demo: false,
      });
    }

    if (user.demo) {
      const bytes = new Uint8Array(await file.arrayBuffer());
      return NextResponse.json({
        document: {
          id: crypto.randomUUID(),
          name: file.name,
          mimeType: file.type,
          extractedText: "",
          pageCount: file.type === "application/pdf" ? estimatePdfPageCount(bytes) : 1,
        },
        warnings: ["Demo-Modus: Datei validiert, aber weder hochgeladen noch per KI ausgelesen."],
        demo: true,
      });
    }

    const env = getServerEnvironment();
    const spentEur = await getMonthlySpendEur();
    const budget = getBudgetState(spentEur, env.MONTHLY_AI_BUDGET_EUR);
    if (budget.blocked) return NextResponse.json({ error: "Das gemeinsame Monatsbudget ist erreicht." }, { status: 402 });

    const extracted = await extractDocumentWithOpenAI(file);
    const costEur = calculateRunCostEur(extracted.model, extracted.usage, env.EUR_PER_USD);
    const stored = await persistDocument(
      user.id,
      file,
      extracted.extraction.extractedText.slice(0, 120_000),
      extracted.extraction.pageCount,
    );
    await persistStandaloneAiRun({
      userId: user.id,
      model: extracted.model,
      mode: "document-extraction",
      inputTokens: extracted.usage.inputTokens,
      outputTokens: extracted.usage.outputTokens,
      costEur,
      durationMs: Date.now() - startedAt,
      responseId: extracted.responseId,
    });
    return NextResponse.json({
      document: {
        id: stored.id,
        name: file.name,
        mimeType: file.type,
        extractedText: extracted.extraction.extractedText,
        pageCount: extracted.extraction.pageCount,
        legibility: extracted.extraction.legibility,
      },
      warnings: extracted.extraction.warnings,
      demo: false,
      costEur,
    });
  } catch (error) {
    if (error instanceof AuthenticationError) return NextResponse.json({ error: error.message }, { status: 401 });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Die Datei konnte nicht verarbeitet werden." },
      { status: 422 },
    );
  }
}
