# Betrieb und Übergabe

## Ersteinrichtung

1. Externes Docker-Netzwerk `web-services` in Portainer anlegen oder das vorhandene Netzwerk verwenden.
2. Stack aus `docker-compose.yml` erstellen und die Variablen ausschließlich in Portainer setzen.
3. Einen mindestens 32 Zeichen langen, zufälligen `SETUP_TOKEN` erzeugen und nur für die Ersteinrichtung hinterlegen.
4. Stack deployen und über `/api/health` die lokale Datenbank prüfen.
5. Unter `/setup` genau zwei Konten anlegen und beide Anmeldungen testen.
6. `SETUP_TOKEN` aus Portainer entfernen und neu deployen.
7. Einen ersten konsistenten Sicherungspunkt des Volumes `jura-agent-data` erstellen.

## Geheimnisse

`OPENAI_API_KEY` und `SETUP_TOKEN` sind ausschließlich serverseitig. Sie werden in Portainer gesetzt, nicht in Dateien des öffentlichen Repositorys. Das Repository ignoriert alle `.env*`-Dateien außer den ausdrücklich leeren Beispieldateien.

## Kosten

Der Standardwert ist ein gemeinsames Monatslimit von 10 Euro. Preise sind versioniert in `src/lib/cost/pricing.ts` hinterlegt und müssen bei einem Modellwechsel gegen die offizielle Preisseite geprüft werden. Bei 80 Prozent meldet die API eine Warnung; bei 100 Prozent antwortet sie mit HTTP 402, bevor ein neuer KI-Lauf startet.

## Datenhaltung

- OpenAI Responses werden mit `store: false` aufgerufen.
- Für PDF-Extraktion hochgeladene OpenAI-Dateien werden in einem `finally`-Block gelöscht.
- Originale bleiben im lokalen Docker-Volume, bis der jeweilige Nutzer sie löscht.
- Browser-Demo-Daten liegen nur in `localStorage` und sind sichtbar als Demo gekennzeichnet.

## Backup und Wiederherstellung

- Zu sichern ist das vollständige benannte Volume `jura-agent-data`, nicht nur `jura-agent.db`.
- Für ein einfaches dateibasiertes Backup den App-Container vorher stoppen, damit SQLite-Datei, WAL und Uploads denselben Stand haben.
- Sicherungen verschlüsseln, getrennt vom Docker-Host aufbewahren und eine Wiederherstellung regelmäßig auf einem separaten Test-Volume prüfen.
- Updates mit **Pull and redeploy** ersetzen nur den Container. Das benannte Volume muss bestehen bleiben.
- Der Verlust oder die bewusste Entfernung des Volumes löscht alle beiden Konten, Chats, Kostenprotokolle und Dokumente. Ein Reset ist deshalb immer eine ausdrücklich destruktive Betriebsentscheidung.

## Checkliste vor Livegang

- `npm run check` erfolgreich
- `npm run test:storage-smoke` erfolgreich
- `npm run test:e2e` auf Desktop und Mobile erfolgreich
- Anmeldung und Datentrennung mit beiden Nutzerkonten verifiziert
- persistentes Volume gesichert und Wiederherstellung getestet
- NeuRIS-Ausfall und unvollständige Treffer getestet
- monatliches Budget und EUR/USD-Annahme bestätigt
- Impressum/Datenschutz für die konkrete private Bereitstellung geprüft
