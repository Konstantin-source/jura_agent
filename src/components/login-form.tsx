"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowRight, Eye, EyeOff, LoaderCircle, LockKeyhole, ShieldCheck } from "lucide-react";
import { BrandMark } from "@/components/brand-mark";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { useRuntimeConfig } from "@/components/runtime-provider";

export function LoginForm() {
  const router = useRouter();
  const runtime = useRuntimeConfig();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const demo = runtime.mode === "demo";

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (!runtime.supabase) throw new Error("Supabase ist nicht konfiguriert.");
      const supabase = createSupabaseBrowserClient(runtime.supabase);
      const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
      if (authError) throw authError;
      router.replace("/");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Anmeldung fehlgeschlagen.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="login-page">
      <section className="login-intro">
        <BrandMark />
        <div><p className="eyebrow">Dein persönlicher Lernraum</p><h1>Recht verstehen.<br />Klausuren besser schreiben.</h1><p>Präzise Erklärungen, ehrliche Korrekturen und amtliche Quellen – für euer drittes Semester in Köln.</p></div>
        <div className="login-trust"><ShieldCheck size={19} /><span><strong>Privat für zwei Personen.</strong> Keine öffentliche Registrierung, getrennte Lernverläufe.</span></div>
      </section>
      <section className="login-form-panel">
        <div className="login-form-wrap">
          <p className="section-kicker">Willkommen zurück</p><h2>Anmelden</h2><p>Nutze eine der beiden freigeschalteten E-Mail-Adressen.</p>
          <form onSubmit={submit}>
            <label><span>E-Mail-Adresse</span><input type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="name@beispiel.de" /></label>
            <label><span>Passwort</span><span className="password-field"><input type={showPassword ? "text" : "password"} autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} /><button type="button" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? "Passwort verbergen" : "Passwort zeigen"}>{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button></span></label>
            {error && <p className="form-error" role="alert">{error}</p>}
            <button type="submit" className="primary-button login-submit" disabled={busy}>{busy ? <LoaderCircle className="spin" size={18} /> : <LockKeyhole size={18} />} Anmelden <ArrowRight size={17} /></button>
          </form>
          {demo && <div className="demo-login"><span>Demo aktiv</span><p>Für die lokale Vorschau sind keine Zugangsdaten nötig.</p><Link href="/" className="secondary-button">Demo öffnen <ArrowRight size={16} /></Link></div>}
          <small className="login-legal">Jura Agent ist ein Lernwerkzeug und keine Rechtsberatung.</small>
        </div>
      </section>
    </main>
  );
}
