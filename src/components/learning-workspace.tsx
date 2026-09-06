"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  BookOpenText,
  Camera,
  Check,
  FileCheck2,
  Gauge,
  LoaderCircle,
  MessageCircleQuestion,
  Paperclip,
  Plus,
  Send,
  Sparkles,
  X,
} from "lucide-react";
import type { AssistantResponse, LearningMode } from "@/lib/ai/schemas";
import type { LegalSourceRecord } from "@/lib/legal/types";
import { AssistantAnswerView } from "@/components/assistant-answer";
import { useRuntimeConfig } from "@/components/runtime-provider";
import { DEFAULT_MODEL_PRESET, MODEL_PRESETS, type ModelPresetId } from "@/lib/ai/models";

interface Attachment {
  id: string;
  name: string;
  mimeType: string;
  extractedText: string;
}

interface ApiResult {
  answer: AssistantResponse;
  sources: LegalSourceRecord[];
  conversationId: string;
  meta: { demo: boolean; sourceStatus: string; durationMs: number; costEur: number; model?: string; modelPreset?: ModelPresetId };
}

interface ChatTurn {
  id: string;
  question: string;
  answer: AssistantResponse;
  sources: LegalSourceRecord[];
}

const MODES: Array<{ id: LearningMode; label: string; short: string; icon: typeof Sparkles }> = [
  { id: "explanation", label: "Verstehen", short: "Erklären", icon: Sparkles },
  { id: "correction", label: "Korrigieren", short: "Korrektur", icon: FileCheck2 },
  { id: "socratic", label: "Gemeinsam lernen", short: "Lernrunde", icon: MessageCircleQuestion },
];

const SUBJECTS = [
  "Allgemeines Verwaltungsrecht",
  "Verwaltungsprozessrecht (VwGO / NRW)",
  "Schuldrecht II",
  "Vertragliche Schuldverhältnisse",
  "Sachenrecht",
  "Strafrecht III",
];

const STARTERS: Record<LearningMode, string[]> = {
  explanation: [
    "Wie prüfe ich die Rücknahme nach § 48 VwVfG?",
    "Erkläre mir Schadensersatz aus § 280 Abs. 1 BGB.",
    "Wie grenze ich Anfechtungs- und Verpflichtungsklage ab?",
  ],
  correction: [
    "Korrigiere meine Lösung und schätze die Note.",
    "Prüfe besonders Aufbau, Subsumtion und Schwerpunktsetzung.",
  ],
  socratic: [
    "Prüfe mit mir einen Anspruch aus § 280 Abs. 1 BGB.",
    "Frag mich zur Zulässigkeit einer Anfechtungsklage ab.",
  ],
};

function readMode(value: string | null): LearningMode {
  return value === "correction" || value === "socratic" ? value : "explanation";
}

function saveLocalConversation(result: ApiResult, subject: string, mode: LearningMode, turns: ChatTurn[]) {
  if (typeof window === "undefined") return;
  const key = "jura-agent-demo-conversations";
  let current: unknown[] = [];
  try {
    current = JSON.parse(localStorage.getItem(key) ?? "[]") as unknown[];
  } catch {
    current = [];
  }
  const latest = turns.at(-1);
  if (!latest) return;
  const entry = {
    id: result.conversationId,
    title: turns[0].question.slice(0, 80),
    subject,
    mode,
    updatedAt: new Date().toISOString(),
    answer: latest.answer,
    sources: latest.sources,
    turns,
  };
  localStorage.setItem(key, JSON.stringify([entry, ...current.filter((item) => (item as { id?: string }).id !== entry.id)].slice(0, 30)));
}

export function LearningWorkspace() {
  const searchParams = useSearchParams();
  const runtime = useRuntimeConfig();
  const [mode, setMode] = useState<LearningMode>(() => readMode(searchParams.get("mode")));
  const [subject, setSubject] = useState(searchParams.get("subject") || "Allgemeines Verwaltungsrecht");
  const [query, setQuery] = useState(searchParams.get("prompt") || "");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [pendingQuestion, setPendingQuestion] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadNote, setUploadNote] = useState<string | null>(null);
  const [modelPreset, setModelPreset] = useState<ModelPresetId>(DEFAULT_MODEL_PRESET);
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const activeMode = useMemo(() => MODES.find((item) => item.id === mode) ?? MODES[0], [mode]);
  const activeModel = useMemo(
    () => MODEL_PRESETS.find((preset) => preset.id === modelPreset) ?? MODEL_PRESETS[1],
    [modelPreset],
  );

  useEffect(() => {
    if (searchParams.get("prompt")) composerRef.current?.focus();
  }, [searchParams]);

  async function upload(file: File | undefined) {
    if (!file) return;
    setUploading(true);
    setError(null);
    setUploadNote(null);
    try {
      const form = new FormData();
      form.set("file", file);
      const response = await fetch("/api/documents/analyze", { method: "POST", body: form });
      const payload = (await response.json()) as {
        error?: string;
        document?: Attachment;
        warnings?: string[];
      };
      if (!response.ok || !payload.document) throw new Error(payload.error ?? "Datei konnte nicht verarbeitet werden.");
      setAttachments((current) => [...current, payload.document!]);
      if (payload.warnings?.length) setUploadNote(payload.warnings.join(" "));
      if (mode !== "correction" && /klausur|lösung/i.test(file.name)) setMode("correction");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Upload fehlgeschlagen.");
    } finally {
      setUploading(false);
    }
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const effectiveQuery = query.trim() || (mode === "correction" ? "Korrigiere meine hochgeladene Klausur." : "");
    if (!effectiveQuery) return;
    setBusy(true);
    setError(null);
    setPendingQuestion(effectiveQuery);
    setQuery("");
    try {
      const response = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode,
          subject,
          query: effectiveQuery,
          conversationId,
          attachments,
          modelPreset,
        }),
      });
      const payload = (await response.json()) as ApiResult & { error?: string };
      if (!response.ok || !payload.answer) throw new Error(payload.error ?? "Antwort konnte nicht erstellt werden.");
      const nextTurn: ChatTurn = {
        id: crypto.randomUUID(),
        question: effectiveQuery,
        answer: payload.answer,
        sources: payload.sources,
      };
      const nextTurns = [...turns, nextTurn];
      setTurns(nextTurns);
      setConversationId(payload.conversationId);
      saveLocalConversation(payload, subject, mode, nextTurns);
      window.setTimeout(() => document.getElementById("chat-end")?.scrollIntoView({ behavior: "smooth", block: "end" }), 60);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Antwort fehlgeschlagen.");
      setQuery(effectiveQuery);
    } finally {
      setPendingQuestion(null);
      setBusy(false);
    }
  }

  function switchMode(nextMode: LearningMode) {
    setMode(nextMode);
    setTurns([]);
    setConversationId(null);
    setPendingQuestion(null);
    setError(null);
    if (!query || STARTERS[mode].includes(query)) setQuery("");
  }

  function startNewChat() {
    setTurns([]);
    setConversationId(null);
    setPendingQuestion(null);
    setQuery("");
    setAttachments([]);
    setError(null);
    setUploadNote(null);
    window.setTimeout(() => composerRef.current?.focus(), 0);
  }

  return (
    <div className="learning-page">
      <header className="workspace-header">
        <Link href="/" className="icon-button back-button" aria-label="Zurück zur Startseite"><ArrowLeft size={20} /></Link>
        <div className="workspace-heading-copy">
          <span className={`workspace-mode-icon ${mode}`}><activeMode.icon size={20} /></span>
          <div><p>{activeMode.label}</p><h1>{mode === "correction" ? "Deine Klausur im Blick" : mode === "socratic" ? "Gemeinsam zur Lösung" : "Frag, bis es wirklich sitzt"}</h1></div>
        </div>
        {turns.length > 0 && <button type="button" className="new-chat-button" onClick={startNewChat} disabled={busy}><Plus size={16} /><span>Neuer Chat</span></button>}
        {runtime.mode === "demo" && <span className="demo-pill">Demo</span>}
      </header>

      <div className="mode-tabs" role="tablist" aria-label="Lernmodus">
        {MODES.map(({ id, short, icon: Icon }) => (
          <button key={id} type="button" role="tab" aria-selected={mode === id} className={mode === id ? "is-active" : ""} disabled={busy} onClick={() => switchMode(id)}>
            <Icon size={17} /> <span>{short}</span>
          </button>
        ))}
      </div>

      <div className="workspace-body">
        <section className="conversation-panel">
          {turns.length === 0 && !pendingQuestion ? (
            <div className="workspace-empty">
              <span className={`empty-illustration ${mode}`}><activeMode.icon size={31} /></span>
              <p className="section-kicker">{activeMode.label}</p>
              <h2>{mode === "correction" ? "Lade deine Bearbeitung hoch." : mode === "socratic" ? "Welchen Fall lösen wir zusammen?" : "Was soll heute klar werden?"}</h2>
              <p>{mode === "correction" ? "Fotografiere einzelne Seiten oder wähle ein PDF. Sachverhalt und Lösungsskizze verbessern die Schätzung." : "Wähle eine Idee oder formuliere deine eigene Frage. Du bekommst eine strukturierte, quellenklare Antwort."}</p>
              <div className="starter-list">
                {STARTERS[mode].map((starter) => (
                  <button key={starter} type="button" onClick={() => { setQuery(starter); composerRef.current?.focus(); }}>
                    <BookOpenText size={16} /><span>{starter}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div id="assistant-result" className="result-wrap">
              {runtime.mode === "demo" && <div className="demo-banner"><Check size={16} /><span><strong>Demoantwort</strong> · Ablauf und Darstellung sind echt, KI und Quellenabruf sind simuliert.</span></div>}
              <div className="chat-thread" aria-label="Chatverlauf">
                {turns.map((turn) => (
                  <div className="chat-turn" key={turn.id}>
                    <div className="user-message"><span>Du</span><p>{turn.question}</p></div>
                    <AssistantAnswerView answer={turn.answer} sources={turn.sources} />
                  </div>
                ))}
                {pendingQuestion && (
                  <div className="chat-turn pending-turn">
                    <div className="user-message"><span>Du</span><p>{pendingQuestion}</p></div>
                    <div className="assistant-typing" role="status"><LoaderCircle className="spin" size={17} /><span>Antwort wird erstellt …</span></div>
                  </div>
                )}
                <div id="chat-end" />
              </div>
            </div>
          )}
        </section>

        <aside className="workspace-context">
          <div className="context-card">
            <p className="section-kicker">Fach</p>
            <label htmlFor="subject" className="sr-only">Fach auswählen</label>
            <select id="subject" value={subject} disabled={turns.length > 0 || busy} title={turns.length > 0 ? "Für ein anderes Fach bitte einen neuen Chat starten." : undefined} onChange={(event) => setSubject(event.target.value)}>
              {SUBJECTS.map((item) => <option key={item}>{item}</option>)}
            </select>
          </div>
          <div className="context-card context-note">
            <strong>Quellenstatus</strong>
            <p>Amtliche Fundstellen erscheinen direkt unter der Antwort. Unsichere Aktualität wird ausdrücklich markiert.</p>
          </div>
          {attachments.length > 0 && (
            <div className="context-card">
              <p className="section-kicker">Unterlagen</p>
              <div className="attachment-list">
                {attachments.map((attachment) => (
                  <div key={attachment.id}><FileCheck2 size={16} /><span>{attachment.name}</span><button type="button" onClick={() => setAttachments((items) => items.filter((item) => item.id !== attachment.id))} aria-label={`${attachment.name} entfernen`}><X size={15} /></button></div>
                ))}
              </div>
            </div>
          )}
        </aside>
      </div>

      <div className="composer-dock">
        <form className="composer" onSubmit={submit}>
          <div className="composer-topline">
            <span>{activeMode.label}</span>
            <span>{subject} · {activeModel.label}</span>
          </div>
          {attachments.length > 0 && (
            <div className="composer-attachments">
              {attachments.map((attachment) => <span key={attachment.id}><FileCheck2 size={14} />{attachment.name}<button type="button" onClick={() => setAttachments((items) => items.filter((item) => item.id !== attachment.id))}><X size={13} /></button></span>)}
            </div>
          )}
          <div className="composer-input-row">
            <textarea ref={composerRef} rows={1} value={query} disabled={busy} onChange={(event) => setQuery(event.target.value)} placeholder={mode === "correction" ? "Was soll ich besonders prüfen?" : "Stell deine juristische Frage …"} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); event.currentTarget.form?.requestSubmit(); } }} />
            <button className="send-button" type="submit" disabled={busy || (!query.trim() && !(mode === "correction" && attachments.length))} aria-label="Absenden">
              {busy ? <LoaderCircle className="spin" size={20} /> : <Send size={19} />}
            </button>
          </div>
          <div className="composer-tools">
            <label className={uploading ? "is-disabled" : ""}><Paperclip size={17} /><span>Datei</span><input type="file" accept="application/pdf,text/plain,text/markdown,image/jpeg,image/png,image/webp,image/heic,image/heif" disabled={uploading} onChange={(event) => { void upload(event.target.files?.[0]); event.currentTarget.value = ""; }} /></label>
            <label className={uploading ? "is-disabled" : ""}><Camera size={17} /><span>Foto</span><input type="file" accept="image/*" capture="environment" disabled={uploading} onChange={(event) => { void upload(event.target.files?.[0]); event.currentTarget.value = ""; }} /></label>
            <label className="model-picker" title={activeModel.description}>
              <Gauge size={17} />
              <select
                aria-label="Modellstärke"
                value={modelPreset}
                disabled={busy}
                onChange={(event) => {
                  const next = event.target.value as ModelPresetId;
                  setModelPreset(next);
                }}
              >
                {MODEL_PRESETS.map((preset) => <option key={preset.id} value={preset.id}>{preset.label} · {preset.model.replace("gpt-5.6-", "")}</option>)}
              </select>
            </label>
            {uploading && <span className="uploading-label"><LoaderCircle className="spin" size={15} /> Datei wird geprüft …</span>}
            <span className="composer-privacy">Privat · max. 25 MB</span>
          </div>
          {error && <p className="form-error" role="alert">{error}</p>}
          {uploadNote && <p className="form-note">{uploadNote}</p>}
        </form>
      </div>
    </div>
  );
}
