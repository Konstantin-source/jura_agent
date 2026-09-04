"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Check, CircleAlert, Database, ExternalLink, KeyRound, LogIn, Scale, Server, ShieldCheck, WalletCards } from "lucide-react";

interface Health {
  status: string;
  mode: "demo" | "live";
  integrations: { openai: boolean; supabase: boolean; neuris: boolean };
}

function IntegrationRow({ label, description, ready, icon: Icon }: { label: string; description: string; ready: boolean; icon: typeof Database }) {
  return (
    <div className="integration-row"><span className="integration-icon"><Icon size={19} /></span><div><strong>{label}</strong><span>{description}</span></div><span className={`integration-state ${ready ? "ready" : "waiting"}`}>{ready ? <Check size={14} /> : <CircleAlert size={14} />}{ready ? "Bereit" : "Offen"}</span></div>
  );
}

export function SettingsPanel() {
  const [health, setHealth] = useState<Health | null>(null);
  useEffect(() => { fetch("/api/health").then((response) => response.json()).then(setHealth).catch(() => undefined); }, []);
  const demo = !health || health.mode === "demo";
  return (
    <div className="page settings-page">
      <header className="page-heading"><div><p className="eyebrow">Konfiguration</p><h1>Einstellungen</h1><p>Konten, Kosten und Datenquellen im Blick.</p></div></header>
      <div className="settings-grid">
        <section className="settings-card profile-settings">
          <div className="settings-card-head"><span><KeyRound size={20} /></span><div><p className="section-kicker">Zugang</p><h2>Zwei private Konten</h2></div></div>
          <p>Im Live-Betrieb dürfen ausschließlich die beiden E-Mail-Adressen aus der Allowlist zugreifen. Jeder Lernverlauf bleibt getrennt.</p>
          <div className="profile-preview"><span>JA</span><div><strong>{demo ? "Demo-Nutzer" : "Angemeldetes Konto"}</strong><small>{demo ? "Nur lokal in diesem Browser" : "Daten durch RLS getrennt"}</small></div></div>
          <Link href="/login" className="secondary-button"><LogIn size={17} /> Zur Anmeldung</Link>
        </section>

        <section className="settings-card budget-settings">
          <div className="settings-card-head"><span><WalletCards size={20} /></span><div><p className="section-kicker">Kostenbremse</p><h2>10 € pro Monat</h2></div></div>
          <div className="budget-value"><strong>{demo ? "0,00 €" : "Live-Abrechnung"}</strong><span>von 10,00 €</span></div>
          <div className="budget-track"><span style={{ width: demo ? "0%" : "1%" }} /></div>
          <p>Warnung ab 80 %. Bei 100 % werden neue KI-Läufe blockiert. Amtliche Quellensuche bleibt davon getrennt.</p>
        </section>

        <section className="settings-card integrations-settings">
          <div className="settings-card-head"><span><Server size={20} /></span><div><p className="section-kicker">Systemstatus</p><h2>Integrationen</h2></div></div>
          <div className="integration-list">
            <IntegrationRow label="OpenAI Responses API" description="Strukturierte Lernantworten" ready={Boolean(health?.integrations.openai)} icon={Scale} />
            <IntegrationRow label="Supabase" description="Login, Datenbank und private Dateien" ready={Boolean(health?.integrations.supabase)} icon={Database} />
            <IntegrationRow label="NeuRIS Provider" description={demo ? "Im Demo-Modus nicht live geprüft" : "Amtliche Testphasen-API"} ready={Boolean(health?.integrations.neuris && !demo)} icon={ShieldCheck} />
          </div>
        </section>

        <section className="settings-card legal-settings">
          <div className="settings-card-head"><span><ShieldCheck size={20} /></span><div><p className="section-kicker">Rechtsinformationen</p><h2>Kontrollierte Quellen</h2></div></div>
          <p>Keine freie Websuche. Der Provider greift ausschließlich auf die vorgesehenen amtlichen Portale zu und kennzeichnet Lücken.</p>
          <div className="official-links"><a href="https://testphase.rechtsinformationen.bund.de/" target="_blank" rel="noreferrer">NeuRIS Testphase <ExternalLink size={14} /></a><a href="https://www.gesetze-im-internet.de/" target="_blank" rel="noreferrer">Gesetze im Internet <ExternalLink size={14} /></a><a href="https://recht.nrw.de/" target="_blank" rel="noreferrer">RECHT.NRW <ExternalLink size={14} /></a></div>
        </section>
      </div>
    </div>
  );
}
