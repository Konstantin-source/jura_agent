"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, CircleAlert, Database, ExternalLink, KeyRound, LogOut, Scale, Server, ShieldCheck, WalletCards } from "lucide-react";

interface Health {
  status: string;
  mode: "demo" | "live";
  integrations: {
    openai: boolean;
    localDatabase: boolean;
    neuris: boolean;
    neurisStatus?: { reachable: boolean; message: string; checkedAt: string | null };
  };
}

interface AccountState {
  user: { id: string; email: string; displayName: string; demo: boolean };
  budget: { monthlySpendEur: number; monthlyLimitEur: number };
}

function IntegrationRow({ label, description, ready, icon: Icon }: { label: string; description: string; ready: boolean; icon: typeof Database }) {
  return (
    <div className="integration-row"><span className="integration-icon"><Icon size={19} /></span><div><strong>{label}</strong><span>{description}</span></div><span className={`integration-state ${ready ? "ready" : "waiting"}`}>{ready ? <Check size={14} /> : <CircleAlert size={14} />}{ready ? "Bereit" : "Offen"}</span></div>
  );
}

export function SettingsPanel() {
  const router = useRouter();
  const [health, setHealth] = useState<Health | null>(null);
  const [account, setAccount] = useState<AccountState | null>(null);
  const [logoutBusy, setLogoutBusy] = useState(false);
  const [logoutError, setLogoutError] = useState<string | null>(null);
  useEffect(() => {
    fetch("/api/health?probe=1", { cache: "no-store" })
      .then((response) => response.json() as Promise<Health>)
      .then(setHealth)
      .catch(() => undefined);
    fetch("/api/auth/me", { cache: "no-store" })
      .then((response) => response.json() as Promise<AccountState>)
      .then(setAccount)
      .catch(() => undefined);
  }, []);
  const demo = account ? account.user.demo : !health || health.mode === "demo";
  const spent = account?.budget.monthlySpendEur ?? 0;
  const budget = account?.budget.monthlyLimitEur ?? 5;
  const usagePercent = budget > 0 ? Math.min(100, (spent / budget) * 100) : 0;
  const initials = (account?.user.displayName ?? "JA").split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase();

  async function logout() {
    setLogoutBusy(true);
    setLogoutError(null);
    try {
      const response = await fetch("/api/auth/logout", { method: "POST" });
      if (!response.ok) throw new Error("Abmeldung fehlgeschlagen.");
      router.replace("/login");
      router.refresh();
    } catch (error) {
      setLogoutError(error instanceof Error ? error.message : "Abmeldung fehlgeschlagen.");
    } finally {
      setLogoutBusy(false);
    }
  }

  return (
    <div className="page settings-page">
      <header className="page-heading"><div><p className="eyebrow">Konfiguration</p><h1>Einstellungen</h1><p>Konten, Kosten und Datenquellen im Blick.</p></div></header>
      <div className="settings-grid">
        <section className="settings-card profile-settings">
          <div className="settings-card-head"><span><KeyRound size={20} /></span><div><p className="section-kicker">Zugang</p><h2>Zwei private Konten</h2></div></div>
          <p>Im Live-Betrieb existieren genau zwei lokal verwaltete Konten. Lernverläufe und Dokumente werden anhand der Konto-ID getrennt.</p>
          <div className="profile-preview"><span>{initials || "JA"}</span><div><strong>{account?.user.displayName ?? (demo ? "Demo-Nutzer" : "Angemeldetes Konto")}</strong><small>{account?.user.email ?? (demo ? "Nur lokal in diesem Browser" : "Lokale, getrennte Daten")}</small></div></div>
          {logoutError && <p className="form-error" role="alert">{logoutError}</p>}
          {!demo && <button type="button" className="secondary-button" disabled={logoutBusy} onClick={() => void logout()}><LogOut size={17} /> {logoutBusy ? "Abmelden …" : "Abmelden"}</button>}
        </section>

        <section className="settings-card budget-settings">
          <div className="settings-card-head"><span><WalletCards size={20} /></span><div><p className="section-kicker">Kostenbremse</p><h2>{budget.toLocaleString("de-DE")} € pro Monat</h2></div></div>
          <div className="budget-value"><strong>{spent.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €</strong><span>von {budget.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €</span></div>
          <div className="budget-track"><span style={{ width: `${usagePercent}%` }} /></div>
          <p>Warnung ab 80 %. Bei 100 % werden neue KI-Läufe blockiert. Amtliche Quellensuche bleibt davon getrennt.</p>
        </section>

        <section className="settings-card integrations-settings">
          <div className="settings-card-head"><span><Server size={20} /></span><div><p className="section-kicker">Systemstatus</p><h2>Integrationen</h2></div></div>
          <div className="integration-list">
            <IntegrationRow label="OpenAI Responses API" description="Strukturierte Lernantworten" ready={Boolean(health?.integrations.openai)} icon={Scale} />
            <IntegrationRow label="Lokaler Speicher" description="SQLite und privates Docker-Volume" ready={Boolean(health?.integrations.localDatabase || demo)} icon={Database} />
            <IntegrationRow
              label="NeuRIS Provider"
              description={demo ? "Im Demo-Modus nicht live geprüft" : health?.integrations.neurisStatus?.message ?? "Verbindung wird geprüft …"}
              ready={Boolean(health?.integrations.neuris && !demo)}
              icon={ShieldCheck}
            />
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
