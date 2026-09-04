"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BookOpenText, ChevronRight, Clock3, MessageSquareText, Plus, Search } from "lucide-react";
import type { AssistantResponse, LearningMode } from "@/lib/ai/schemas";
import type { LegalSourceRecord } from "@/lib/legal/types";
import { AssistantAnswerView } from "@/components/assistant-answer";
import { useRuntimeConfig } from "@/components/runtime-provider";

interface SavedConversation {
  id: string;
  title: string;
  subject: string;
  mode: LearningMode;
  updatedAt: string;
  answer?: AssistantResponse;
  sources?: LegalSourceRecord[];
}

const modeLabel: Record<LearningMode, string> = {
  explanation: "Erklärung",
  correction: "Korrektur",
  socratic: "Lernrunde",
};

export function ChatLibrary() {
  const runtime = useRuntimeConfig();
  const [items, setItems] = useState<SavedConversation[]>([]);
  const [selected, setSelected] = useState<SavedConversation | null>(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (runtime.mode === "loading") return;
    const frame = window.requestAnimationFrame(() => {
      if (runtime.mode === "demo") {
        const local = JSON.parse(localStorage.getItem("jura-agent-demo-conversations") ?? "[]") as SavedConversation[];
        setItems(local);
        return;
      }
      fetch("/api/conversations")
        .then((response) => response.json())
        .then((payload: { conversations?: Array<{ id: string; title: string; subject: string; mode: LearningMode; updated_at: string }> }) => {
          setItems((payload.conversations ?? []).map((item) => ({ ...item, updatedAt: item.updated_at })));
        })
        .catch(() => setItems([]));
    });
    return () => window.cancelAnimationFrame(frame);
  }, [runtime.mode]);

  async function openConversation(item: SavedConversation) {
    if (item.answer && item.sources) {
      setSelected(item);
      return;
    }
    try {
      const response = await fetch(`/api/conversations/${item.id}`);
      const payload = (await response.json()) as {
        messages?: Array<{ role: string; content: { answer?: AssistantResponse; sources?: LegalSourceRecord[] } }>;
      };
      const assistant = [...(payload.messages ?? [])].reverse().find((message) => message.role === "assistant");
      if (assistant?.content.answer) {
        setSelected({ ...item, answer: assistant.content.answer, sources: assistant.content.sources ?? [] });
      }
    } catch {
      // Keep the list usable if a single historic record cannot be opened.
    }
  }

  const visible = items.filter((item) => `${item.title} ${item.subject}`.toLowerCase().includes(query.toLowerCase()));

  if (selected) {
    return (
      <div className="page chat-detail-page">
        <button className="back-text-button" type="button" onClick={() => setSelected(null)}>← Alle Chats</button>
        <div className="chat-detail-heading"><p>{selected.subject} · {modeLabel[selected.mode]}</p><h1>{selected.title}</h1></div>
        {selected.answer && <AssistantAnswerView answer={selected.answer} sources={selected.sources ?? []} />}
      </div>
    );
  }

  return (
    <div className="page library-page">
      <header className="page-heading library-heading">
        <div><p className="eyebrow">Dein Archiv</p><h1>Chats</h1><p>Frühere Erklärungen, Korrekturen und Lernrunden.</p></div>
        <Link href="/lernen" className="primary-button"><Plus size={18} /> Neuer Chat</Link>
      </header>
      <label className="search-field"><Search size={18} /><span className="sr-only">Chats durchsuchen</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Chats und Fächer durchsuchen" /></label>
      {visible.length ? (
        <div className="chat-list">
          {visible.map((item) => (
            <button key={item.id} type="button" className="chat-row" onClick={() => void openConversation(item)}>
              <span className={`chat-row-icon ${item.mode}`}><MessageSquareText size={19} /></span>
              <span className="chat-row-copy"><strong>{item.title}</strong><span>{item.subject} · {modeLabel[item.mode]}</span><small><Clock3 size={13} /> {new Intl.DateTimeFormat("de-DE", { dateStyle: "medium", timeStyle: "short" }).format(new Date(item.updatedAt))}</small></span>
              <ChevronRight size={19} />
            </button>
          ))}
        </div>
      ) : (
        <div className="empty-state-card"><span><BookOpenText size={28} /></span><h2>Noch kein gespeicherter Chat</h2><p>Starte eine Erklärung oder Lernrunde. Im Demo-Modus wird der Verlauf nur in diesem Browser gespeichert.</p><Link href="/lernen" className="primary-button">Ersten Chat starten</Link></div>
      )}
    </div>
  );
}
