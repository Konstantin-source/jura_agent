# Jura Agent

Mobile-first Lernassistent für das deutsche Jurastudium. Der MVP unterstützt Erklärungen, sokratisches Lernen und Klausurkorrekturen mit klar gekennzeichneter Notenschätzung. Amtliche Quellen werden über eine interne Provider-Schicht eingebunden.

> **Wichtig:** Jura Agent ist ein Lernwerkzeug und keine Rechtsberatung. Antworten und Notenschätzungen müssen fachlich geprüft werden.

## MVP

- drei Lernmodi: **Verstehen**, **Klausur korrigieren**, **Gemeinsam lernen**
- Schwerpunktpakete Schuldrecht II / vertragliche Schuldverhältnisse und Allgemeines Verwaltungsrecht / VwGO / NRW
- kontrollierte amtliche Recherche: NeuRIS, Gesetze-im-Internet und RECHT.NRW
- Foto-, PDF- und Text-Upload mit mobilen Kamera-Inputs
- strukturierte OpenAI-Antworten, Quellenvalidierung und Kostenbremse
- zwei getrennte Supabase-Konten per E-Mail-Allowlist und Row Level Security
- transparenter Demo-Modus ohne geheime Schlüssel

## Lokal starten

```bash
cp .env.example .env.local
npm install
npm run dev
```

Die Voreinstellung startet den klar markierten Demo-Modus. Für den Produktivbetrieb `DEMO_MODE` und `NEXT_PUBLIC_DEMO_MODE` auf `false` setzen und OpenAI-/Supabase-Werte ergänzen.

## Prüfen

```bash
npm run check
npx playwright install chromium
npm run test:e2e
```

## Einrichtung

1. Supabase-Projekt in Frankfurt (`eu-central-1`) anlegen.
2. Migration unter `supabase/migrations` ausführen und einen privaten Bucket `documents` verwenden.
3. Genau zwei Nutzer in Supabase Auth anlegen und ihre E-Mail-Adressen in `ALLOWED_EMAILS` eintragen.
4. OpenAI-Schlüssel ausschließlich als serverseitige Umgebungsvariable setzen.
5. Entweder auf Vercel deployen oder mit `docker-compose.portainer.yml` im externen Netzwerk `web-services` betreiben.

Weitere Details stehen in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md), [docs/OPERATIONS.md](docs/OPERATIONS.md) und [docs/PORTAINER.md](docs/PORTAINER.md).

## Vorschau

![Jura Agent Dashboard](docs/screenshots/dashboard-desktop.png)

![Mobile Klausurkorrektur](docs/screenshots/correction-mobile.png)
