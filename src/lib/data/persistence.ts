import "server-only";

import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import type { AssistantRequest, AssistantResponse } from "@/lib/ai/schemas";
import type { GeneratedAssistantResponse } from "@/lib/ai/openai";
import { getDatabase, resolveStoredFile, withImmediateTransaction } from "@/lib/db/database";
import type { LegalSourceRecord } from "@/lib/legal/types";

function parseJson<T>(value: string, fallback: T): T {
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export async function getMonthlySpendEur(): Promise<number> {
  const start = new Date();
  start.setUTCDate(1);
  start.setUTCHours(0, 0, 0, 0);
  const row = getDatabase()
    .prepare("SELECT COALESCE(SUM(cost_eur), 0) AS total FROM ai_runs WHERE created_at >= ?")
    .get(start.toISOString()) as { total: number };
  return Number(row.total ?? 0);
}

interface PersistInteractionInput {
  userId: string;
  request: AssistantRequest;
  response: GeneratedAssistantResponse;
  sources: LegalSourceRecord[];
  costEur: number;
  durationMs: number;
}

export async function persistInteraction(input: PersistInteractionInput): Promise<string> {
  const db = getDatabase();
  return withImmediateTransaction(db, () => {
    const now = new Date().toISOString();
    let conversationId = input.request.conversationId ?? null;
    if (conversationId) {
      const owned = db
        .prepare("SELECT id FROM conversations WHERE id = ? AND user_id = ?")
        .get(conversationId, input.userId);
      if (!owned) throw new Error("Der angegebene Chat gehört nicht zu diesem Konto.");
      db.prepare("UPDATE conversations SET updated_at = ? WHERE id = ? AND user_id = ?")
        .run(now, conversationId, input.userId);
    } else {
      conversationId = crypto.randomUUID();
      db.prepare(`
        INSERT INTO conversations (id, user_id, title, mode, subject, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(
        conversationId,
        input.userId,
        input.request.query.slice(0, 80),
        input.request.mode,
        input.request.subject,
        now,
        now,
      );
    }

    const insertMessage = db.prepare(`
      INSERT INTO messages (id, user_id, conversation_id, role, content_json, citations_json, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    insertMessage.run(
      crypto.randomUUID(),
      input.userId,
      conversationId,
      "user",
      JSON.stringify({
        text: input.request.query,
        attachments: (input.request.attachments ?? []).map(({ id, name, mimeType }) => ({ id, name, mimeType })),
      }),
      "[]",
      now,
    );
    insertMessage.run(
      crypto.randomUUID(),
      input.userId,
      conversationId,
      "assistant",
      JSON.stringify({ answer: input.response.answer, sources: input.sources }),
      JSON.stringify(input.response.answer.citations),
      now,
    );

    db.prepare(`
      INSERT INTO ai_runs (
        id, user_id, conversation_id, provider, model, mode, input_tokens, output_tokens,
        cost_eur, duration_ms, response_id, source_count, created_at
      ) VALUES (?, ?, ?, 'openai', ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      crypto.randomUUID(),
      input.userId,
      conversationId,
      input.response.model,
      input.request.mode,
      input.response.usage.inputTokens,
      input.response.usage.outputTokens,
      input.costEur,
      input.durationMs,
      input.response.responseId,
      input.sources.length,
      now,
    );

    if (input.response.answer.mode === "correction") {
      const correction = input.response.answer;
      const candidateDocumentId = input.request.attachments?.[0]?.id ?? null;
      const ownedDocument = candidateDocumentId
        ? db.prepare("SELECT id FROM documents WHERE id = ? AND user_id = ?").get(candidateDocumentId, input.userId)
        : null;
      db.prepare(`
        INSERT INTO correction_reports (
          id, user_id, conversation_id, document_id, central_score, min_score, max_score,
          confidence, report_json, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        crypto.randomUUID(),
        input.userId,
        conversationId,
        ownedDocument ? candidateDocumentId : null,
        correction.estimatedScore.central,
        correction.estimatedScore.min,
        correction.estimatedScore.max,
        correction.estimatedScore.confidence,
        JSON.stringify(correction),
        now,
      );
    }
    return conversationId;
  });
}

export async function listConversations(userId: string) {
  return getDatabase().prepare(`
    SELECT id, title, mode, subject, created_at, updated_at
    FROM conversations
    WHERE user_id = ?
    ORDER BY updated_at DESC
    LIMIT 50
  `).all(userId) as Array<{
    id: string;
    title: string;
    mode: string;
    subject: string;
    created_at: string;
    updated_at: string;
  }>;
}

export async function getConversation(userId: string, id: string) {
  const db = getDatabase();
  const conversation = db.prepare(`
    SELECT id, title, mode, subject, created_at, updated_at
    FROM conversations WHERE id = ? AND user_id = ?
  `).get(id, userId) as
    | { id: string; title: string; mode: string; subject: string; created_at: string; updated_at: string }
    | undefined;
  if (!conversation) throw new Error("Chat nicht gefunden.");
  const rows = db.prepare(`
    SELECT id, role, content_json, citations_json, created_at
    FROM messages
    WHERE conversation_id = ? AND user_id = ?
    ORDER BY created_at ASC
  `).all(id, userId) as Array<{
    id: string;
    role: string;
    content_json: string;
    citations_json: string;
    created_at: string;
  }>;
  return {
    conversation,
    messages: rows.map((row) => ({
      id: row.id,
      role: row.role,
      content: parseJson<Record<string, unknown>>(row.content_json, {}),
      citations: parseJson<unknown[]>(row.citations_json, []),
      created_at: row.created_at,
    })),
  };
}

export async function persistDocument(
  userId: string,
  file: File,
  extractedText: string,
  pageCount: number | null,
) {
  const id = crypto.randomUUID();
  const originalName = file.name.replace(/[\u0000-\u001f\u007f]/g, "").slice(0, 255) || "dokument";
  const safeName = originalName.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-160) || "dokument";
  const relativePath = `${userId}/${id}-${safeName}`;
  const absolutePath = resolveStoredFile(relativePath);
  await mkdir(path.dirname(absolutePath), { recursive: true, mode: 0o700 });
  await writeFile(absolutePath, Buffer.from(await file.arrayBuffer()), { flag: "wx", mode: 0o600 });

  try {
    const now = new Date().toISOString();
    getDatabase().prepare(`
      INSERT INTO documents (
        id, user_id, filename, mime_type, size_bytes, storage_path, page_count,
        extraction_status, extracted_text, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 'completed', ?, ?, ?)
    `).run(
      id,
      userId,
      originalName,
      file.type,
      file.size,
      relativePath,
      pageCount,
      extractedText,
      now,
      now,
    );
  } catch (error) {
    await unlink(absolutePath).catch(() => undefined);
    throw error;
  }
  return { id, storagePath: relativePath };
}

export async function listDocuments(userId: string) {
  return getDatabase().prepare(`
    SELECT id, filename, mime_type, page_count, created_at, extraction_status
    FROM documents
    WHERE user_id = ?
    ORDER BY created_at DESC
    LIMIT 100
  `).all(userId) as Array<{
    id: string;
    filename: string;
    mime_type: string;
    page_count: number | null;
    created_at: string;
    extraction_status: string;
  }>;
}

export async function deleteDocument(userId: string, id: string) {
  const db = getDatabase();
  const row = db
    .prepare("SELECT storage_path FROM documents WHERE id = ? AND user_id = ?")
    .get(id, userId) as { storage_path: string } | undefined;
  if (!row) throw new Error("Dokument nicht gefunden.");
  const absolutePath = resolveStoredFile(row.storage_path);
  await unlink(absolutePath).catch((error: NodeJS.ErrnoException) => {
    if (error.code !== "ENOENT") throw error;
  });
  db.prepare("DELETE FROM documents WHERE id = ? AND user_id = ?").run(id, userId);
}

export async function persistStandaloneAiRun(input: {
  userId: string;
  model: string;
  mode: string;
  inputTokens: number;
  outputTokens: number;
  costEur: number;
  durationMs: number;
  responseId: string;
}) {
  getDatabase().prepare(`
    INSERT INTO ai_runs (
      id, user_id, conversation_id, provider, model, mode, input_tokens, output_tokens,
      cost_eur, duration_ms, response_id, source_count, created_at
    ) VALUES (?, ?, NULL, 'openai', ?, ?, ?, ?, ?, ?, ?, 0, ?)
  `).run(
    crypto.randomUUID(),
    input.userId,
    input.model,
    input.mode,
    input.inputTokens,
    input.outputTokens,
    input.costEur,
    input.durationMs,
    input.responseId,
    new Date().toISOString(),
  );
}

export function serializeAssistantAnswer(answer: AssistantResponse) {
  return JSON.parse(JSON.stringify(answer)) as Record<string, unknown>;
}
