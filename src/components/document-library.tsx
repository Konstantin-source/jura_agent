"use client";

import { useEffect, useState } from "react";
import { Camera, File, FileText, Image as ImageIcon, LoaderCircle, Plus, ShieldCheck, Trash2, UploadCloud } from "lucide-react";
import { useRuntimeConfig } from "@/components/runtime-provider";

interface StoredDocument {
  id: string;
  name: string;
  mimeType: string;
  extractedText: string;
  pageCount?: number | null;
  addedAt: string;
}

const storageKey = "jura-agent-demo-documents";

function DocumentIcon({ type }: { type: string }) {
  if (type.startsWith("image/")) return <ImageIcon size={21} />;
  if (type === "application/pdf") return <FileText size={21} />;
  return <File size={21} />;
}

export function DocumentLibrary() {
  const runtime = useRuntimeConfig();
  const [documents, setDocuments] = useState<StoredDocument[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    if (runtime.mode === "loading") return;
    const frame = window.requestAnimationFrame(() => {
      if (runtime.mode === "demo") {
        setDocuments(JSON.parse(localStorage.getItem(storageKey) ?? "[]") as StoredDocument[]);
        return;
      }
      fetch("/api/documents")
        .then((response) => response.json())
        .then((payload: { documents?: Array<{ id: string; filename: string; mime_type: string; page_count?: number | null; created_at: string }> }) => {
          setDocuments((payload.documents ?? []).map((item) => ({
            id: item.id,
            name: item.filename,
            mimeType: item.mime_type,
            extractedText: "",
            pageCount: item.page_count,
            addedAt: item.created_at,
          })));
        })
        .catch(() => setDocuments([]));
    });
    return () => window.cancelAnimationFrame(frame);
  }, [runtime.mode]);

  function persist(next: StoredDocument[]) {
    setDocuments(next);
    if (runtime.mode === "demo") localStorage.setItem(storageKey, JSON.stringify(next));
  }

  async function removeDocument(document: StoredDocument) {
    if (runtime.mode === "live") {
      const response = await fetch(`/api/documents/${document.id}`, { method: "DELETE" });
      if (!response.ok) {
        setError("Dokument konnte nicht gelöscht werden.");
        return;
      }
    }
    persist(documents.filter((item) => item.id !== document.id));
  }

  async function upload(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    setError(null);
    setNote(null);
    try {
      const form = new FormData();
      form.set("file", file);
      const response = await fetch("/api/documents/analyze", { method: "POST", body: form });
      const payload = (await response.json()) as { error?: string; document?: Omit<StoredDocument, "addedAt">; warnings?: string[] };
      if (!response.ok || !payload.document) throw new Error(payload.error ?? "Datei konnte nicht verarbeitet werden.");
      persist([{ ...payload.document, addedAt: new Date().toISOString() }, ...documents]);
      setNote(payload.warnings?.join(" ") || "Dokument wurde verarbeitet.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Upload fehlgeschlagen.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="page library-page">
      <header className="page-heading library-heading">
        <div><p className="eyebrow">Deine Unterlagen</p><h1>Dokumente</h1><p>Skripte, Notizen und Klausuren sicher an einem Ort.</p></div>
        <label className={`primary-button ${busy ? "is-disabled" : ""}`}><Plus size={18} /> Hinzufügen<input type="file" disabled={busy} accept="application/pdf,text/plain,text/markdown,image/jpeg,image/png,image/webp,image/heic,image/heif" onChange={(event) => { void upload(event.target.files?.[0]); event.currentTarget.value = ""; }} /></label>
      </header>

      <section className="upload-zone">
        <span className="upload-zone-icon">{busy ? <LoaderCircle className="spin" size={27} /> : <UploadCloud size={27} />}</span>
        <div><h2>{busy ? "Dokument wird geprüft …" : "Datei auswählen oder Foto aufnehmen"}</h2><p>PDF, TXT, Markdown, JPEG, PNG, WebP oder HEIC · höchstens 25 MB</p></div>
        <div className="upload-actions">
          <label className="secondary-button"><FileText size={17} /> Datei<input type="file" disabled={busy} accept="application/pdf,text/plain,text/markdown,image/jpeg,image/png,image/webp,image/heic,image/heif" onChange={(event) => { void upload(event.target.files?.[0]); event.currentTarget.value = ""; }} /></label>
          <label className="secondary-button"><Camera size={17} /> Kamera<input type="file" disabled={busy} accept="image/*" capture="environment" onChange={(event) => { void upload(event.target.files?.[0]); event.currentTarget.value = ""; }} /></label>
        </div>
      </section>
      {error && <p className="form-error standalone" role="alert">{error}</p>}
      {note && <p className="form-note standalone">{note}</p>}

      <div className="privacy-strip"><ShieldCheck size={18} /><p><strong>Privater Bereich.</strong> Im Live-Betrieb liegen Originaldateien im privaten Supabase-Bucket. Temporär an OpenAI übermittelte PDFs werden nach der Extraktion gelöscht.</p></div>

      <section className="document-section">
        <div className="section-title-row"><div><p className="section-kicker">Ablage</p><h2>Meine Dokumente</h2></div><span className="count-pill">{documents.length}</span></div>
        {documents.length ? (
          <div className="document-grid">
            {documents.map((document) => (
              <article className="document-card" key={document.id}>
                <span className="document-icon"><DocumentIcon type={document.mimeType} /></span>
                <div><strong>{document.name}</strong><span>{document.pageCount ? `${document.pageCount} Seite${document.pageCount === 1 ? "" : "n"}` : document.mimeType}</span><small>{new Intl.DateTimeFormat("de-DE", { dateStyle: "medium" }).format(new Date(document.addedAt))}</small></div>
                <button type="button" onClick={() => void removeDocument(document)} aria-label={`${document.name} entfernen`}><Trash2 size={17} /></button>
              </article>
            ))}
          </div>
        ) : (
          <div className="empty-state-card compact-empty"><span><FileText size={26} /></span><h2>Noch keine Dokumente</h2><p>Füge dein erstes Skript, Foto oder eine Probeklausur hinzu.</p></div>
        )}
      </section>
    </div>
  );
}
