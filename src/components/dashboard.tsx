"use client";

import Link from "next/link";
import {
  ArrowRight,
  BookMarked,
  ChevronRight,
  FileCheck2,
  Landmark,
  MessageCircleQuestion,
  PenLine,
  Scale,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { StatusBadge } from "@/components/status-badge";
import { useRuntimeConfig } from "@/components/runtime-provider";

const actions = [
  {
    mode: "explanation",
    title: "Etwas verstehen",
    description: "Komplexe Themen klar, präzise und klausurnah erklärt.",
    icon: Sparkles,
    className: "action-understand",
    cta: "Thema erklären",
  },
  {
    mode: "correction",
    title: "Klausur korrigieren",
    description: "Fotos oder PDF hochladen und strukturiertes Feedback erhalten.",
    icon: FileCheck2,
    className: "action-correct",
    cta: "Klausur prüfen",
  },
  {
    mode: "socratic",
    title: "Gemeinsam lernen",
    description: "Mit gezielten Fragen Schritt für Schritt selbst zur Lösung.",
    icon: MessageCircleQuestion,
    className: "action-learn",
    cta: "Lernrunde starten",
  },
];

const subjects = [
  {
    title: "Schuldrecht II",
    subtitle: "Vertragliche Schuldverhältnisse",
    detail: "Leistungsstörungen · Vertragstypen · Gewährleistung",
    icon: Scale,
    accent: "blue",
  },
  {
    title: "Verwaltungsrecht",
    subtitle: "Allgemeiner Teil · VwGO · NRW",
    detail: "Verwaltungsakt · Klagearten · Landesrecht",
    icon: Landmark,
    accent: "green",
  },
];

export function Dashboard() {
  const runtime = useRuntimeConfig();
  const today = new Intl.DateTimeFormat("de-DE", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "Europe/Berlin",
  })
    .format(new Date())
    .toUpperCase();
  return (
    <div className="page dashboard-page">
      <header className="page-heading dashboard-heading">
        <div>
          <p className="eyebrow" suppressHydrationWarning>{today}</p>
          <h1>Was möchtest du heute lernen?</h1>
          <p>Dein persönlicher Lernraum für das dritte Semester.</p>
        </div>
        <div className="heading-actions">
          {runtime.mode === "demo" && <span className="demo-pill desktop-only">Demo-Modus</span>}
          <Link href="/einstellungen" className="avatar-button" aria-label="Einstellungen öffnen">
            JA
          </Link>
        </div>
      </header>

      <section className="action-grid" aria-labelledby="quick-actions-title">
        <h2 id="quick-actions-title" className="sr-only">Lernmodus wählen</h2>
        {actions.map(({ mode, title, description, icon: Icon, className, cta }) => (
          <Link key={mode} href={`/lernen?mode=${mode}`} className={`action-card ${className}`}>
            <span className="action-icon"><Icon size={25} strokeWidth={1.8} /></span>
            <span className="action-card-body">
              <strong>{title}</strong>
              <span>{description}</span>
            </span>
            <span className="action-card-cta">{cta}<ArrowRight size={16} /></span>
          </Link>
        ))}
      </section>

      <div className="dashboard-columns">
        <section className="content-section">
          <div className="section-title-row">
            <div>
              <p className="section-kicker">Dein Fokus</p>
              <h2>Fachpakete im MVP</h2>
            </div>
            <Link href="/lernen" className="text-link">Alle Fächer <ChevronRight size={15} /></Link>
          </div>
          <div className="subject-list">
            {subjects.map(({ title, subtitle, detail, icon: Icon, accent }) => (
              <Link href={`/lernen?subject=${encodeURIComponent(title)}`} className="subject-card" key={title}>
                <span className={`subject-icon ${accent}`}><Icon size={22} /></span>
                <span className="subject-copy">
                  <strong>{title}</strong>
                  <span>{subtitle}</span>
                  <small>{detail}</small>
                </span>
                <ChevronRight className="subject-chevron" size={19} />
              </Link>
            ))}
          </div>
        </section>

        <aside className="dashboard-aside">
          <div className="source-panel">
            <span className="panel-icon"><ShieldCheck size={22} /></span>
            <div>
              <p className="section-kicker">Quellenklarheit</p>
              <h2>Du siehst, was belegt ist.</h2>
              <p>Jede Antwort zeigt ihren Prüfstatus und verlinkt verwendete amtliche Fundstellen.</p>
            </div>
            <StatusBadge status="Teilweise verifiziert" />
            <p className="demo-hint">
              {runtime.mode === "demo"
                ? "Im Demo-Modus werden Quellenkarten gezeigt, aber nicht live abgerufen."
                : runtime.mode === "live"
                  ? "Im Live-Modus werden verwendete amtliche Quellen für jeden Lauf geprüft."
                  : "Laufzeitkonfiguration wird geprüft …"}
            </p>
          </div>
        </aside>
      </div>

      <section className="recent-section">
        <div className="section-title-row">
          <div>
            <p className="section-kicker">Weitermachen</p>
            <h2>Letzte Lernideen</h2>
          </div>
          <Link href="/chats" className="text-link">Zu den Chats <ChevronRight size={15} /></Link>
        </div>
        <div className="recent-grid">
          <Link href="/lernen?mode=explanation&prompt=Wie%20prüfe%20ich%20§%2048%20VwVfG%3F" className="recent-card">
            <span className="recent-icon green"><BookMarked size={18} /></span>
            <span><strong>Rücknahme nach § 48 VwVfG</strong><small>Verwaltungsrecht · Erklärung</small></span>
            <ChevronRight size={18} />
          </Link>
          <Link href="/lernen?mode=socratic&prompt=Prüfe%20mit%20mir%20§%20280%20Abs.%201%20BGB" className="recent-card">
            <span className="recent-icon blue"><PenLine size={18} /></span>
            <span><strong>Schadensersatz aus § 280 I BGB</strong><small>Schuldrecht · Lernrunde</small></span>
            <ChevronRight size={18} />
          </Link>
        </div>
      </section>
    </div>
  );
}
