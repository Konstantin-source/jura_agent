import "server-only";

import type { AssistantRequest, AssistantResponse } from "@/lib/ai/schemas";
import type { GeneratedAssistantResponse } from "@/lib/ai/openai";
import type { LegalSourceRecord } from "@/lib/legal/types";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function getMonthlySpendEur(userId: string): Promise<number> {
  const supabase = await createSupabaseServerClient();
  const { data: sharedSpend, error: rpcError } = await supabase.rpc("get_shared_monthly_ai_spend");
  if (!rpcError && sharedSpend !== null) return Number(sharedSpend);
  const start = new Date();
  start.setUTCDate(1);
  start.setUTCHours(0, 0, 0, 0);
  const { data, error } = await supabase
    .from("ai_runs")
    .select("cost_eur")
    .gte("created_at", start.toISOString());
  if (error) throw error;
  // Safe fallback for deployments where the migration has not added the aggregate RPC yet.
  return (data ?? []).reduce((sum, run) => sum + Number(run.cost_eur ?? 0), 0) + (userId ? 0 : 0);
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
  const supabase = await createSupabaseServerClient();
  let conversationId = input.request.conversationId ?? null;
  if (!conversationId) {
    const { data, error } = await supabase
      .from("conversations")
      .insert({
        user_id: input.userId,
        mode: input.request.mode,
        subject: input.request.subject,
        title: input.request.query.slice(0, 80),
      })
      .select("id")
      .single();
    if (error) throw error;
    conversationId = data.id;
  }

  const messages = [
    {
      user_id: input.userId,
      conversation_id: conversationId,
      role: "user",
      content: { text: input.request.query, attachments: input.request.attachments ?? [] },
      citations: [],
    },
    {
      user_id: input.userId,
      conversation_id: conversationId,
      role: "assistant",
      content: { answer: input.response.answer, sources: input.sources },
      citations: input.response.answer.citations,
    },
  ];
  const { error: messagesError } = await supabase.from("messages").insert(messages);
  if (messagesError) throw messagesError;

  const { error: runError } = await supabase.from("ai_runs").insert({
    user_id: input.userId,
    conversation_id: conversationId,
    provider: "openai",
    model: input.response.model,
    mode: input.request.mode,
    input_tokens: input.response.usage.inputTokens,
    output_tokens: input.response.usage.outputTokens,
    cost_eur: input.costEur,
    duration_ms: input.durationMs,
    response_id: input.response.responseId,
    source_count: input.sources.length,
  });
  if (runError) throw runError;

  if (input.response.answer.mode === "correction") {
    const correction = input.response.answer;
    const { error: correctionError } = await supabase.from("correction_reports").insert({
      user_id: input.userId,
      conversation_id: conversationId,
      document_id: input.request.attachments?.[0]?.id ?? null,
      central_score: correction.estimatedScore.central,
      min_score: correction.estimatedScore.min,
      max_score: correction.estimatedScore.max,
      confidence: correction.estimatedScore.confidence,
      report: correction,
    });
    if (correctionError) throw correctionError;
  }
  if (!conversationId) throw new Error("Conversation konnte nicht angelegt werden.");
  return conversationId;
}

export async function listConversations(userId: string) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("conversations")
    .select("id,title,mode,subject,created_at,updated_at")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
    .limit(50);
  if (error) throw error;
  return data ?? [];
}

export async function getConversation(userId: string, id: string) {
  const supabase = await createSupabaseServerClient();
  const { data: conversation, error } = await supabase
    .from("conversations")
    .select("id,title,mode,subject,created_at,updated_at")
    .eq("user_id", userId)
    .eq("id", id)
    .single();
  if (error) throw error;
  const { data: messages, error: messagesError } = await supabase
    .from("messages")
    .select("id,role,content,citations,created_at")
    .eq("conversation_id", id)
    .order("created_at", { ascending: true });
  if (messagesError) throw messagesError;
  return { conversation, messages: messages ?? [] };
}

export async function persistDocument(
  userId: string,
  file: File,
  extractedText: string,
  pageCount: number | null,
) {
  const supabase = await createSupabaseServerClient();
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const path = `${userId}/${crypto.randomUUID()}-${safeName}`;
  const bytes = new Uint8Array(await file.arrayBuffer());
  const { error: storageError } = await supabase.storage
    .from("documents")
    .upload(path, bytes, { contentType: file.type, upsert: false });
  if (storageError) throw storageError;

  const { data, error } = await supabase
    .from("documents")
    .insert({
      user_id: userId,
      filename: file.name,
      mime_type: file.type,
      size_bytes: file.size,
      storage_path: path,
      page_count: pageCount,
      extraction_status: "completed",
      extracted_text: extractedText,
    })
    .select("id")
    .single();
  if (error) {
    await supabase.storage.from("documents").remove([path]);
    throw error;
  }
  return { id: data.id as string, storagePath: path };
}

export async function listDocuments(userId: string) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("documents")
    .select("id,filename,mime_type,page_count,created_at,extraction_status")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw error;
  return data ?? [];
}

export async function deleteDocument(userId: string, id: string) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("documents")
    .select("storage_path")
    .eq("user_id", userId)
    .eq("id", id)
    .single();
  if (error) throw error;
  const { error: storageError } = await supabase.storage.from("documents").remove([data.storage_path]);
  if (storageError) throw storageError;
  const { error: deleteError } = await supabase
    .from("documents")
    .delete()
    .eq("user_id", userId)
    .eq("id", id);
  if (deleteError) throw deleteError;
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
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("ai_runs").insert({
    user_id: input.userId,
    conversation_id: null,
    provider: "openai",
    model: input.model,
    mode: input.mode,
    input_tokens: input.inputTokens,
    output_tokens: input.outputTokens,
    cost_eur: input.costEur,
    duration_ms: input.durationMs,
    response_id: input.responseId,
    source_count: 0,
  });
  if (error) throw error;
}

export function serializeAssistantAnswer(answer: AssistantResponse) {
  return JSON.parse(JSON.stringify(answer)) as Record<string, unknown>;
}
