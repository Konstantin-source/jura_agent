import {
  AlertTriangle,
  ArrowUpRight,
  BookOpenCheck,
  CheckCircle2,
  CircleHelp,
  Lightbulb,
  Link2,
  ListChecks,
  MessageCircleQuestion,
  Scale,
  Sparkles,
  Target,
  TriangleAlert,
} from "lucide-react";
import type { AssistantResponse } from "@/lib/ai/schemas";
import type { LegalSourceRecord } from "@/lib/legal/types";
import { StatusBadge } from "@/components/status-badge";
import { FormattedText, InlineFormattedText } from "@/components/formatted-text";

function BulletList({ items, tone = "default" }: { items: string[]; tone?: "default" | "warning" | "success" }) {
  if (!items.length) return null;
  return (
    <ul className={`answer-list ${tone}`}>
      {items.map((item, index) => (
        <li key={`${item}-${index}`}><InlineFormattedText text={item} /></li>
      ))}
    </ul>
  );
}

function normalizeStoredSourceUrl(source: LegalSourceRecord) {
  if (source.provider !== "NeuRIS") return source.url;

  try {
    const url = new URL(source.url);
    if (url.hostname !== "testphase.rechtsinformationen.bund.de") return source.url;

    url.pathname = url.pathname.replace(/\/regelungstext-1\.html$/, "");
    url.pathname = url.pathname.replace(/^\/v1\/case-law\//, "/case-law/");
    return url.toString();
  } catch {
    return source.url;
  }
}

function SourceCards({ answer, sources }: { answer: AssistantResponse; sources: LegalSourceRecord[] }) {
  const sourceMap = new Map(sources.map((source) => [source.id, source]));
  const cited = answer.citations.map((citation) => ({ citation, source: sourceMap.get(citation.sourceId) })).filter((item) => item.source);
  return (
    <section className="answer-sources" aria-labelledby="sources-title">
      <div className="answer-section-title">
        <Link2 size={17} />
        <h3 id="sources-title">Verwendete Quellen</h3>
        <StatusBadge status={answer.sourceStatus} compact />
      </div>
      {cited.length ? (
        <div className="source-card-list">
          {cited.map(({ citation, source }) => source && (
            <a key={source.id} className="source-card" href={normalizeStoredSourceUrl(source)} target="_blank" rel="noreferrer">
              <span className="source-provider">{source.provider}</span>
              <strong><InlineFormattedText text={citation.label} /></strong>
              <span><InlineFormattedText text={citation.pinpoint} /></span>
              <ArrowUpRight size={17} />
            </a>
          ))}
        </div>
      ) : (
        <p className="empty-inline">Für diese Antwort wurde keine konkrete Fundstelle zitiert.</p>
      )}
      {answer.uncertainties.length > 0 && (
        <div className="uncertainty-note">
          <TriangleAlert size={16} />
          <div><strong>Unsicherheit</strong><BulletList items={answer.uncertainties} /></div>
        </div>
      )}
    </section>
  );
}

function ExplanationAnswer({ answer, sources }: { answer: Extract<AssistantResponse, { mode: "explanation" }>; sources: LegalSourceRecord[] }) {
  const hasCallouts = Boolean(answer.example.trim() || answer.examRelevance.trim());
  const hasExtras = answer.typicalErrors.length > 0 || answer.connections.length > 0;
  return (
    <article className="assistant-answer">
      <header className="answer-hero">
        <span className="answer-icon blue"><Sparkles size={21} /></span>
        <div><p>Erklärung</p><h2><InlineFormattedText text={answer.title} /></h2></div>
        <StatusBadge status={answer.sourceStatus} compact />
      </header>
      <div className="answer-lead"><FormattedText text={answer.shortExplanation} /></div>
      {answer.preciseExplanation.trim() && <section className="answer-block">
        <div className="answer-section-title"><BookOpenCheck size={18} /><h3>Genauer</h3></div>
        <div className="formatted-text"><FormattedText text={answer.preciseExplanation} /></div>
      </section>}
      {hasCallouts && <div className="answer-two-column">
        {answer.example.trim() && <section className="answer-callout example">
          <div className="answer-section-title"><Lightbulb size={18} /><h3>Mini-Beispiel</h3></div>
          <div className="formatted-text"><FormattedText text={answer.example} /></div>
        </section>}
        {answer.examRelevance.trim() && <section className="answer-callout exam">
          <div className="answer-section-title"><Target size={18} /><h3>Klausurrelevanz</h3></div>
          <div className="formatted-text"><FormattedText text={answer.examRelevance} /></div>
        </section>}
      </div>}
      {hasExtras && <div className="answer-two-column compact-columns">
        {answer.typicalErrors.length > 0 && <section className="answer-block">
          <div className="answer-section-title warning"><AlertTriangle size={18} /><h3>Typische Fehler</h3></div>
          <BulletList items={answer.typicalErrors} tone="warning" />
        </section>}
        {answer.connections.length > 0 && <section className="answer-block">
          <div className="answer-section-title"><Link2 size={18} /><h3>Verbindungen</h3></div>
          <BulletList items={answer.connections} />
        </section>}
      </div>}
      {answer.nextActions.length > 0 && <section className="next-steps">
        <div className="answer-section-title"><ListChecks size={18} /><h3>So lernst du weiter</h3></div>
        <ol>{answer.nextActions.map((action, index) => <li key={action}><span>{index + 1}</span><InlineFormattedText text={action} /></li>)}</ol>
      </section>}
      <SourceCards answer={answer} sources={sources} />
    </article>
  );
}

function SocraticAnswer({ answer, sources }: { answer: Extract<AssistantResponse, { mode: "socratic" }>; sources: LegalSourceRecord[] }) {
  return (
    <article className="assistant-answer">
      <header className="answer-hero">
        <span className="answer-icon green"><MessageCircleQuestion size={21} /></span>
        <div><p>Sokratischer Lernmodus</p><h2>Du bist am Zug.</h2></div>
        <span className="hint-pill">Hinweis {answer.hintLevel}/3</span>
      </header>
      <section className="socratic-feedback">
        <div><CheckCircle2 size={18} /><p><strong>Einordnung</strong><InlineFormattedText text={answer.assessment} /></p></div>
        <div><Lightbulb size={18} /><p><strong>Nächster Denkimpuls</strong><InlineFormattedText text={answer.feedback} /></p></div>
      </section>
      <section className="socratic-question">
        <span><CircleHelp size={22} /></span>
        <div><p>Nächste Frage</p><h3><InlineFormattedText text={answer.nextQuestion} /></h3></div>
      </section>
      <div className="checkpoint-row">
        <div><span>Erledigt</span><strong><InlineFormattedText text={answer.completedCheckpoints.join(" · ") || "Noch kein Schritt"} /></strong></div>
        <div><span>Als Nächstes</span><strong><InlineFormattedText text={answer.nextCheckpoint} /></strong></div>
      </div>
      <SourceCards answer={answer} sources={sources} />
    </article>
  );
}

function ScoreRing({ score }: { score: number }) {
  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (Math.min(18, Math.max(0, score)) / 18) * circumference;
  return (
    <div className="score-ring" aria-label={`${score} von 18 Punkten`}>
      <svg viewBox="0 0 100 100" aria-hidden="true">
        <circle className="score-ring-track" cx="50" cy="50" r={radius} />
        <circle className="score-ring-value" cx="50" cy="50" r={radius} strokeDasharray={circumference} strokeDashoffset={offset} />
      </svg>
      <span><strong>{score.toLocaleString("de-DE")}</strong><small>/ 18</small></span>
    </div>
  );
}

function CorrectionAnswer({ answer, sources }: { answer: Extract<AssistantResponse, { mode: "correction" }>; sources: LegalSourceRecord[] }) {
  return (
    <article className="assistant-answer correction-answer">
      <header className="answer-hero">
        <span className="answer-icon coral"><Scale size={21} /></span>
        <div><p>Klausurkorrektur</p><h2>Deine Auswertung</h2></div>
        <StatusBadge status={answer.sourceStatus} compact />
      </header>
      <div className="grade-card">
        <ScoreRing score={answer.estimatedScore.central} />
        <div className="grade-copy">
          <span className="estimate-label">Deutlich gekennzeichnete Notenschätzung</span>
          <h3>{answer.estimatedScore.min}–{answer.estimatedScore.max} Punkte <span>· Konfidenz {answer.estimatedScore.confidence}</span></h3>
          <p><InlineFormattedText text={answer.estimatedScore.basis} /></p>
          <strong className="disclaimer">{answer.disclaimer}</strong>
        </div>
      </div>
      <div className="answer-lead"><FormattedText text={answer.summary} /></div>
      <section className="answer-block">
        <div className="answer-section-title"><ListChecks size={18} /><h3>Bewertungsraster</h3></div>
        <div className="rubric-list">
          {answer.rubric.map((item) => (
            <div key={item.criterion}><span><strong><InlineFormattedText text={item.criterion} /></strong><small>{item.weight}</small></span><p><InlineFormattedText text={item.assessment} /></p></div>
          ))}
        </div>
      </section>
      <div className="answer-two-column compact-columns">
        <section className="answer-block strength-block">
          <div className="answer-section-title"><CheckCircle2 size={18} /><h3>Stärken</h3></div>
          <BulletList items={answer.strengths} tone="success" />
        </section>
        <section className="answer-block issue-block">
          <div className="answer-section-title warning"><AlertTriangle size={18} /><h3>Größte Hebel</h3></div>
          <BulletList items={answer.issues} tone="warning" />
        </section>
      </div>
      {answer.lineFeedback.length > 0 && (
        <section className="answer-block">
          <div className="answer-section-title"><MessageCircleQuestion size={18} /><h3>Randkommentare</h3></div>
          <div className="line-feedback-list">
            {answer.lineFeedback.map((item, index) => (
              <div key={`${item.excerpt}-${index}`} className={`line-feedback ${item.severity}`}>
                <blockquote><InlineFormattedText text={item.excerpt} /></blockquote><p><InlineFormattedText text={item.comment} /></p>
              </div>
            ))}
          </div>
        </section>
      )}
      <section className="next-steps">
        <div className="answer-section-title"><Target size={18} /><h3>Nächste Lernschritte</h3></div>
        <ol>{answer.nextLearningSteps.map((action, index) => <li key={action}><span>{index + 1}</span><InlineFormattedText text={action} /></li>)}</ol>
      </section>
      {(answer.missingIssues.length > 0 || answer.estimatedScore.assumptions.length > 0) && (
        <section className="assumption-box">
          <strong>Bewertungsgrenzen</strong>
          <BulletList items={[...answer.missingIssues, ...answer.estimatedScore.assumptions]} />
        </section>
      )}
      <SourceCards answer={answer} sources={sources} />
    </article>
  );
}

export function AssistantAnswerView({ answer, sources }: { answer: AssistantResponse; sources: LegalSourceRecord[] }) {
  if (answer.mode === "correction") return <CorrectionAnswer answer={answer} sources={sources} />;
  if (answer.mode === "socratic") return <SocraticAnswer answer={answer} sources={sources} />;
  return <ExplanationAnswer answer={answer} sources={sources} />;
}
