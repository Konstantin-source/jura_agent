# Betrieb und Übergabe

## Ersteinrichtung

1. Ein dediziertes Supabase-Projekt in Frankfurt (`eu-central-1`) erstellen.
2. Öffentliche Registrierung und alle nicht benötigten Auth-Provider deaktivieren.
3. `supabase/migrations/202609040001_initial_schema.sql` anwenden.
4. Zwei Nutzer manuell in Supabase Auth anlegen.
5. Beide normalisierten E-Mail-Adressen kommasepariert in `ALLOWED_EMAILS` eintragen.
6. Die Variablen aus `.env.example` auf Vercel konfigurieren; Demo-Schalter in Produktion auf `false` setzen.

## Geheimnisse

`OPENAI_API_KEY` und `SUPABASE_SERVICE_ROLE_KEY` sind ausschließlich serverseitig. Die Service Role ist im aktuellen Request-Pfad nicht erforderlich, wird aber für Wartungsjobs und Cache-Schreibvorgänge vorgesehen. Sie darf nie mit `NEXT_PUBLIC_` beginnen.

## Kosten

Der Standardwert ist ein gemeinsames Monatslimit von 10 Euro. Preise sind versioniert in `src/lib/cost/pricing.ts` hinterlegt und müssen bei einem Modellwechsel gegen die offizielle Preisseite geprüft werden. Bei 80 Prozent meldet die API eine Warnung; bei 100 Prozent antwortet sie mit HTTP 402, bevor ein neuer KI-Lauf startet.

## Datenhaltung

- OpenAI Responses werden mit `store: false` aufgerufen.
- Für PDF-Extraktion hochgeladene OpenAI-Dateien werden in einem `finally`-Block gelöscht.
- Originale bleiben privat in Supabase Storage, bis der jeweilige Nutzer sie löscht.
- Browser-Demo-Daten liegen nur in `localStorage` und sind sichtbar als Demo gekennzeichnet.

## Checkliste vor Livegang

- `npm run check` erfolgreich
- `npm run test:e2e` auf Desktop und Mobile erfolgreich
- RLS-Policies mit beiden Nutzerkonten und einem nicht berechtigten Testkonto verifiziert
- NeuRIS-Ausfall und unvollständige Treffer getestet
- E-Mail-Allowlist enthält exakt zwei Einträge
- monatliches Budget und EUR/USD-Annahme bestätigt
- Impressum/Datenschutz für die konkrete private Bereitstellung geprüft
