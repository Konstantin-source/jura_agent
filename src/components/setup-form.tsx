"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, LoaderCircle, LockKeyhole, ShieldCheck, UsersRound } from "lucide-react";
import { BrandMark } from "@/components/brand-mark";

interface AccountInput {
  displayName: string;
  email: string;
  password: string;
  confirmation: string;
}

const emptyAccount = (): AccountInput => ({
  displayName: "",
  email: "",
  password: "",
  confirmation: "",
});

export function SetupForm({ setupAvailable }: { setupAvailable: boolean }) {
  const router = useRouter();
  const [setupToken, setSetupToken] = useState("");
  const [accounts, setAccounts] = useState<[AccountInput, AccountInput]>([
    emptyAccount(),
    emptyAccount(),
  ]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function updateAccount(index: 0 | 1, field: keyof AccountInput, value: string) {
    setAccounts((current) => {
      const next: [AccountInput, AccountInput] = [{ ...current[0] }, { ...current[1] }];
      next[index][field] = value;
      return next;
    });
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    if (accounts.some((account) => account.password !== account.confirmation)) {
      setError("Die Passwortbestätigungen stimmen nicht überein.");
      return;
    }
    if (accounts[0].email.trim().toLowerCase() === accounts[1].email.trim().toLowerCase()) {
      setError("Bitte verwende zwei unterschiedliche E-Mail-Adressen.");
      return;
    }

    setBusy(true);
    try {
      const response = await fetch("/api/auth/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          setupToken,
          users: accounts.map(({ displayName, email, password }) => ({ displayName, email, password })),
        }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "Konten konnten nicht angelegt werden.");
      router.replace("/login?setup=completed");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Einrichtung fehlgeschlagen.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="login-page setup-page">
      <section className="login-intro">
        <BrandMark />
        <div>
          <p className="eyebrow">Einmalige Ersteinrichtung</p>
          <h1>Zwei Konten.<br />Ein privater Lernraum.</h1>
          <p>Die Konten, Lernverläufe und Dokumente werden lokal auf deinem Server gespeichert.</p>
        </div>
        <div className="login-trust"><ShieldCheck size={19} /><span><strong>Kein öffentlicher Zugang.</strong> Nach der Einrichtung kann der Einrichtungsschlüssel aus Portainer entfernt werden.</span></div>
      </section>
      <section className="login-form-panel">
        <div className="login-form-wrap setup-form-wrap">
          <p className="section-kicker">Konten anlegen</p>
          <h2>Ersteinrichtung</h2>
          <p>Lege genau eure beiden privaten Zugänge fest. Passwörter benötigen mindestens 12 Zeichen.</p>

          {!setupAvailable ? (
            <div className="demo-login" role="alert">
              <span>Einrichtung gesperrt</span>
              <p>Hinterlege zuerst einen mindestens 32 Zeichen langen <code>SETUP_TOKEN</code> in Portainer und starte den Stack neu.</p>
              <Link href="/login" className="secondary-button">Zurück zur Anmeldung</Link>
            </div>
          ) : (
            <form onSubmit={submit}>
              <label>
                <span>Einrichtungsschlüssel aus Portainer</span>
                <input type="password" autoComplete="off" required minLength={32} value={setupToken} onChange={(event) => setSetupToken(event.target.value)} />
              </label>

              <div className="setup-users">
                {accounts.map((account, index) => {
                  const accountIndex = index as 0 | 1;
                  return (
                    <fieldset className="setup-account" key={index}>
                      <legend><UsersRound size={16} /> Konto {index + 1}</legend>
                      <div className="setup-grid">
                        <label><span>Anzeigename</span><input required minLength={2} maxLength={80} autoComplete="name" value={account.displayName} onChange={(event) => updateAccount(accountIndex, "displayName", event.target.value)} /></label>
                        <label><span>E-Mail-Adresse</span><input type="email" required autoComplete="email" value={account.email} onChange={(event) => updateAccount(accountIndex, "email", event.target.value)} /></label>
                        <label><span>Passwort</span><input type="password" required minLength={12} maxLength={128} autoComplete="new-password" value={account.password} onChange={(event) => updateAccount(accountIndex, "password", event.target.value)} /></label>
                        <label><span>Passwort bestätigen</span><input type="password" required minLength={12} maxLength={128} autoComplete="new-password" value={account.confirmation} onChange={(event) => updateAccount(accountIndex, "confirmation", event.target.value)} /></label>
                      </div>
                    </fieldset>
                  );
                })}
              </div>

              {error && <p className="form-error" role="alert">{error}</p>}
              <button type="submit" className="primary-button login-submit" disabled={busy}>
                {busy ? <LoaderCircle className="spin" size={18} /> : <LockKeyhole size={18} />}
                Beide Konten anlegen <ArrowRight size={17} />
              </button>
            </form>
          )}
          <small className="login-legal">Die Passwörter werden mit scrypt gehasht und niemals im Klartext gespeichert.</small>
        </div>
      </section>
    </main>
  );
}
